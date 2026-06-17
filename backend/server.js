const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ADMIN_PASSWORD = 'SoftIsBeautiful2026';

// Helper to check admin password
function checkAdmin(req) {
  return req.body?.password === ADMIN_PASSWORD || req.query?.password === ADMIN_PASSWORD;
}

// 1. FIXED: Allow 'live_' prefixed stages in the validator
app.post('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).send('Unauthorized');
  const { stage, teams } = req.body;
  const valid = ['r32', 'r16', 'qf', 'sf', 'final', 'champion', 'live_r32', 'live_r16', 'live_qf', 'live_sf', 'live_final', 'live_champion'];
  
  if (!stage || !valid.includes(stage)) return res.status(400).send('Invalid stage');
  
  try {
    await pool.query(
      'INSERT INTO actual_results (stage, teams) VALUES ($1, $2) ON CONFLICT(stage) DO UPDATE SET teams = $2', 
      [stage, JSON.stringify(teams)]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).send(err.message); }
});

// 2. FIXED: Scoring engine uses 'live_' fallback automatically
app.get('/api/scores', async (req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const actual = {};
    actualRes.rows.forEach(r => actual[r.stage] = new Set(JSON.parse(r.teams)));

    // This helper checks official result, if null, checks live_ version
    const getResult = (s) => actual[s] || actual['live_' + s] || null;

    const scores = usersRes.rows.map(user => {
      const up = predsRes.rows.filter(p => p.user_id === user.id).map(p => ({...p, data: JSON.parse(p.data)}));
      
      const r32Set = getResult('r32');
      let total = 0;
      
      // Calculate based on the results retrieved
      if (r32Set) {
        up.forEach(p => {
          if (p.stage === 'groups' && ((p.data.first && r32Set.has(p.data.first)) || (p.data.second && r32Set.has(p.data.second)))) total++;
        });
      }
      
      // ... (keep rest of your scoring math here, ensuring it uses getResult(stage))
      
      return { user_id: user.id, user_name: user.name, total };
    });

    res.json(scores.sort((a, b) => b.total - a.total));
  } catch (err) { res.status(500).send(err.message); }
});

app.listen(PORT, () => console.log(`Server running`));