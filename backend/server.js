const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'worldcup.db'));

// ── Migrations ───────────────────────────────────────────────────────────────
db.pragma('foreign_keys = OFF');

// 1. Drop email column from users if present
const usersCols = db.prepare('PRAGMA table_info(users)').all();
if (usersCols.some(c => c.name === 'email')) {
  console.log('Migrating users table (removing email)…');
  db.exec(`
    CREATE TABLE _users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO _users_new (id, name, created_at) SELECT id, name, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE _users_new RENAME TO users;
  `);
  console.log('Users migration done.');
}

// 2. Fix predictions FK if it references a non-existent table (e.g. _users_old)
const predsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='predictions'").get();
if (predsSql && !predsSql.sql.includes('REFERENCES users(id)') && predsSql.sql.includes('REFERENCES')) {
  console.log('Migrating predictions table (fixing FK)…');
  db.exec(`
    CREATE TABLE _preds_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      match_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, stage, match_id)
    );
    INSERT OR IGNORE INTO _preds_new SELECT * FROM predictions;
    DROP TABLE predictions;
    ALTER TABLE _preds_new RENAME TO predictions;
  `);
  console.log('Predictions migration done.');
}

db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    match_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stage, match_id)
  );

  CREATE TABLE IF NOT EXISTS actual_results (
    stage TEXT PRIMARY KEY,
    teams TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const ADMIN_PASSWORD = 'SoftIsBeautiful2026';

// ── Scoring constants ────────────────────────────────────────────────────────
const R32_MATCH_IDS = [
  'r32_m74','r32_m77','r32_m73','r32_m75',
  'r32_m83','r32_m84','r32_m81','r32_m82',
  'r32_m76','r32_m78','r32_m79','r32_m80',
  'r32_m86','r32_m88','r32_m85','r32_m87',
];
const R16_MATCH_IDS = ['r16_m89','r16_m90','r16_m93','r16_m94','r16_m91','r16_m92','r16_m95','r16_m96'];
const QF_MATCH_IDS  = ['qf_01','qf_02','qf_03','qf_04'];
const SF_MATCH_IDS  = ['sf_01','sf_02'];

// ── Users ────────────────────────────────────────────────────────────────────
app.post('/api/users', (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const existing = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (existing) return res.json(existing);
    const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(name);
    res.json(db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', (_req, res) => {
  res.json(db.prepare('SELECT id, name, created_at FROM users ORDER BY name').all());
});

// ── Predictions ──────────────────────────────────────────────────────────────
app.post('/api/predictions/bulk', (req, res) => {
  const { user_id, predictions } = req.body;
  if (!user_id || !Array.isArray(predictions)) return res.status(400).json({ error: 'Missing fields' });
  const upsert = db.prepare(`
    INSERT INTO predictions (user_id, stage, match_id, data, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, stage, match_id) DO UPDATE SET
      data = excluded.data,
      updated_at = CURRENT_TIMESTAMP
  `);
  try {
    db.transaction(() => {
      for (const p of predictions) upsert.run(user_id, p.stage, p.match_id, JSON.stringify(p.data));
    })();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/predictions/:userId', (req, res) => {
  const rows = db.prepare('SELECT stage, match_id, data FROM predictions WHERE user_id = ?').all(req.params.userId);
  res.json(rows.map(r => ({ stage: r.stage, match_id: r.match_id, data: JSON.parse(r.data) })));
});

// ── Admin ────────────────────────────────────────────────────────────────────
function checkAdmin(req, res) {
  const pw = req.body?.password || req.query?.password;
  if (pw !== ADMIN_PASSWORD) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}

app.post('/api/admin/results', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { stage, teams } = req.body;
  const valid = ['r32','r16','qf','sf','final','champion'];
  if (!stage || !valid.includes(stage) || teams === undefined) return res.status(400).json({ error: 'Invalid' });
  try {
    db.prepare(`
      INSERT INTO actual_results (stage, teams, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stage) DO UPDATE SET teams = excluded.teams, updated_at = CURRENT_TIMESTAMP
    `).run(stage, JSON.stringify(teams));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/results', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const rows = db.prepare('SELECT stage, teams, updated_at FROM actual_results').all();
  const result = {};
  for (const r of rows) result[r.stage] = { teams: JSON.parse(r.teams), updated_at: r.updated_at };
  res.json(result);
});

// ── Scores ───────────────────────────────────────────────────────────────────
app.get('/api/scores', (_req, res) => {
  try {
    const users   = db.prepare('SELECT id, name FROM users').all();
    const allPreds = db.prepare('SELECT user_id, stage, match_id, data FROM predictions').all()
      .map(r => ({ ...r, data: JSON.parse(r.data) }));
    const actual  = {};
    for (const r of db.prepare('SELECT stage, teams FROM actual_results').all())
      actual[r.stage] = new Set(Array.isArray(JSON.parse(r.teams)) ? JSON.parse(r.teams) : [JSON.parse(r.teams)]);

    const scores = users.map(user => {
      const up = allPreds.filter(p => p.user_id === user.id);

      // Groups → R32 (1 pt/team)
      let groups = actual['r32'] ? 0 : null;
      if (actual['r32']) {
        for (const gp of up.filter(p => p.stage === 'groups')) {
          if (gp.data.first  && actual['r32'].has(gp.data.first))  groups++;
          if (gp.data.second && actual['r32'].has(gp.data.second)) groups++;
        }
        const tp = up.find(p => p.stage === 'third' && p.match_id === 'selections');
        if (tp && Array.isArray(tp.data)) for (const t of tp.data) if (t && actual['r32'].has(t)) groups++;
      }

      const knockoutScore = (stageKey, matchIds, pts) => {
        if (!actual[stageKey]) return null;
        let s = 0;
        for (const id of matchIds) {
          const pick = up.find(p => p.stage === 'knockout' && p.match_id === id);
          if (pick?.data && actual[stageKey].has(pick.data)) s += pts;
        }
        return s;
      };

      const r16      = knockoutScore('r16', R32_MATCH_IDS, 2);
      const qf       = knockoutScore('qf',  R16_MATCH_IDS, 4);
      const sf       = knockoutScore('sf',  QF_MATCH_IDS,  8);
      const final    = knockoutScore('final', SF_MATCH_IDS, 16);
      let   champion = actual['champion'] ? 0 : null;
      if (actual['champion']) {
        const cp = up.find(p => p.stage === 'knockout' && p.match_id === 'final');
        if (cp?.data && actual['champion'].has(cp.data)) champion = 32;
      }

      const total = [groups, r16, qf, sf, final, champion].reduce((s, v) => s + (v ?? 0), 0);
      return { user_id: user.id, user_name: user.name, total, breakdown: { groups, r16, qf, sf, final, champion } };
    });

    scores.sort((a, b) => b.total - a.total);
    res.json(scores);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete predictions ────────────────────────────────────────────────────────
app.delete('/api/admin/predictions/:userId', (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    db.prepare('DELETE FROM predictions WHERE user_id = ?').run(req.params.userId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete user entirely ─────────────────────────────────────────────────────
app.delete('/api/admin/users/:userId', (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    db.prepare('DELETE FROM predictions WHERE user_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.userId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`World Cup API running on http://localhost:${PORT}`));
