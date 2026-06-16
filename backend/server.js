const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Production CORS Configuration ──
const allowedOrigins = [
  'http://localhost:5173',
  'https://wc-2026-bracket-challenge.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// ── Database Connection ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ── Schema Initialization ──
const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stage TEXT NOT NULL,
        match_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_stage_match UNIQUE(user_id, stage, match_id)
      );

      CREATE TABLE IF NOT EXISTS actual_results (
        stage TEXT PRIMARY KEY,
        teams TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error("Error initializing Supabase tables:", err.message);
  } finally {
    client.release();
  }
};
initDb();

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
app.post('/api/users', async (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const existing = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    if (existing.rows.length > 0) return res.json(existing.rows[0]);
    
    const result = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [name]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name, created_at FROM users ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Predictions ──────────────────────────────────────────────────────────────
app.post('/api/predictions/bulk', async (req, res) => {
  const { user_id, predictions } = req.body;
  if (!user_id || !Array.isArray(predictions)) return res.status(400).json({ error: 'Missing fields' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upsertQuery = `
      INSERT INTO predictions (user_id, stage, match_id, data, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, stage, match_id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = CURRENT_TIMESTAMP
    `;
    for (const p of predictions) {
      await client.query(upsertQuery, [user_id, p.stage, p.match_id, JSON.stringify(p.data)]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/predictions/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT stage, match_id, data FROM predictions WHERE user_id = $1', [req.params.userId]);
    res.json(result.rows.map(r => ({ stage: r.stage, match_id: r.match_id, data: JSON.parse(r.data) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin ────────────────────────────────────────────────────────────────────
function checkAdmin(req, res) {
  const pw = req.body?.password || req.query?.password;
  if (pw !== ADMIN_PASSWORD) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}

app.post('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { stage, teams } = req.body;
  
  // FIX: Allow both official and live keys
  const valid = [
    'r32','r16','qf','sf','final','champion',
    'live_r32','live_r16','live_qf','live_sf','live_final','live_champion'
  ];
  
  if (!stage || !valid.includes(stage) || teams === undefined) return res.status(400).json({ error: 'Invalid' });
  try {
    await pool.query(`
      INSERT INTO actual_results (stage, teams, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT(stage) DO UPDATE SET teams = EXCLUDED.teams, updated_at = CURRENT_TIMESTAMP
    `, [stage, JSON.stringify(teams)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const rows = await pool.query('SELECT stage, teams, updated_at FROM actual_results');
    const result = {};
    for (const r of rows.rows) result[r.stage] = { teams: JSON.parse(r.teams), updated_at: r.updated_at };
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Scores ───────────────────────────────────────────────────────────────────
app.get('/api/scores', async (_req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const users = usersRes.rows;
    const allPreds = predsRes.rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
    
    const actual = {};
    for (const r of actualRes.rows) {
      const parsedTeams = JSON.parse(r.teams);
      actual[r.stage] = new Set(Array.isArray(parsedTeams) ? parsedTeams : [parsedTeams]);
    }

    const scores = users.map(user => {
      const up = allPreds.filter(p => p.user_id === user.id);

      // FIX: Only calculate scores if the exact stage exists
      const calcScore = (stageKey, matchIds, pts, isChampion = false) => {
        if (!actual[stageKey]) return 0; // Return 0 if no results entered
        
        if (isChampion) {
          const cp = up.find(p => p.stage === 'knockout' && p.match_id === 'final');
          return (cp?.data && actual[stageKey].has(cp.data)) ? 32 : 0;
        }

        let s = 0;
        for (const id of matchIds) {
          const pick = up.find(p => p.stage === 'knockout' && p.match_id === id);
          if (pick?.data && actual[stageKey].has(pick.data)) s += pts;
        }
        return s;
      };

      let groups = actual['r32'] ? 0 : 0;
      if (actual['r32']) {
        for (const gp of up.filter(p => p.stage === 'groups')) {
          if (gp.data.first && actual['r32'].has(gp.data.first)) groups++;
          if (gp.data.second && actual['r32'].has(gp.data.second)) groups++;
        }
        const tp = up.find(p => p.stage === 'third' && p.match_id === 'selections');
        if (tp && Array.isArray(tp.data)) for (const t of tp.data) if (t && actual['r32'].has(t)) groups++;
      }

      const r16 = calcScore('r16', R32_MATCH_IDS, 2);
      const qf = calcScore('qf', R16_MATCH_IDS, 4);
      const sf = calcScore('sf', QF_MATCH_IDS, 8);
      const final = calcScore('final', SF_MATCH_IDS, 16);
      const champion = calcScore('champion', [], 0, true);

      const total = groups + r16 + qf + sf + final + champion;
      return { user_id: user.id, user_name: user.name, total, breakdown: { groups, r16, qf, sf, final, champion } };
    });

    scores.sort((a, b) => b.total - a.total);
    res.json(scores);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete predictions ────────────────────────────────────────────────────────
app.delete('/api/admin/predictions/:userId', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    await pool.query('DELETE FROM predictions WHERE user_id = $1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete user entirely ─────────────────────────────────────────────────────
app.delete('/api/admin/users/:userId', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    await pool.query('DELETE FROM predictions WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`World Cup Cloud API running safely on port ${PORT}`));