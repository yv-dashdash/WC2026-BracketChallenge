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
  ssl: { rejectUnauthorized: false }
});

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
  } catch (err) { console.error(err); } finally { client.release(); }
};
initDb();

const ADMIN_PASSWORD = 'SoftIsBeautiful2026';
const R32_MATCH_IDS = ['r32_m74','r32_m77','r32_m73','r32_m75','r32_m83','r32_m84','r32_m81','r32_m82','r32_m76','r32_m78','r32_m79','r32_m80','r32_m86','r32_m88','r32_m85','r32_m87'];
const R16_MATCH_IDS = ['r16_m89','r16_m90','r16_m93','r16_m94','r16_m91','r16_m92','r16_m95','r16_m96'];
const QF_MATCH_IDS = ['qf_01','qf_02','qf_03','qf_04'];
const SF_MATCH_IDS = ['sf_01','sf_02'];

// ... (KEEP USER AND PREDICTION ENDPOINTS SAME)

app.post('/api/admin/results', async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).send('Unauthorized');
  const { stage, teams } = req.body;
  // FIXED: Added live_ prefixes to allowed stages
  const valid = ['r32','r16','qf','sf','final','champion','live_r32','live_r16','live_qf','live_sf','live_final','live_champion'];
  if (!stage || !valid.includes(stage)) return res.status(400).send('Invalid stage');
  try {
    await pool.query('INSERT INTO actual_results (stage, teams) VALUES ($1, $2) ON CONFLICT(stage) DO UPDATE SET teams = $2', [stage, JSON.stringify(teams)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/scores', async (_req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const actual = {};
    for (const r of actualRes.rows) actual[r.stage] = new Set(JSON.parse(r.teams));

    // FIXED: Helper to check official results, then fallback to live_
    const getActual = (s) => actual[s] || actual['live_' + s] || null;

    const scores = usersRes.rows.map(user => {
      const up = predsRes.rows.filter(p => p.user_id === user.id).map(p => ({...p, data: JSON.parse(p.data)}));
      
      const r32Set = getActual('r32');
      let groups = r32Set ? 0 : null;
      if (r32Set) {
        for (const gp of up.filter(p => p.stage === 'groups')) {
          if (gp.data.first && r32Set.has(gp.data.first)) groups++;
          if (gp.data.second && r32Set.has(gp.data.second)) groups++;
        }
      }

      const knockoutScore = (s, ids, pts) => {
        const set = getActual(s);
        if (!set) return null;
        let sc = 0;
        for (const id of ids) {
          const p = up.find(x => x.stage === 'knockout' && x.match_id === id);
          if (p?.data && set.has(p.data)) sc += pts;
        }
        return sc;
      };

      const r16 = knockoutScore('r16', R32_MATCH_IDS, 2);
      const qf = knockoutScore('qf', R16_MATCH_IDS, 4);
      const sf = knockoutScore('sf', QF_MATCH_IDS, 8);
      const final = knockoutScore('final', SF_MATCH_IDS, 16);
      const champion = getActual('champion') && up.find(x => x.stage === 'knockout' && x.match_id === 'final' && getActual('champion').has(x.data)) ? 32 : null;

      const total = [groups, r16, qf, sf, final, champion].reduce((s, v) => s + (v ?? 0), 0);
      return { user_id: user.id, user_name: user.name, total };
    });

    scores.sort((a, b) => b.total - a.total);
    res.json(scores);
  } catch (err) { res.status(500).send(err.message); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));