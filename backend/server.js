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

const ADMIN_PASSWORD = 'SoftIsBeautiful2026';

// ── API Endpoints ──

// Users
app.post('/api/users', async (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const existing = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    if (existing.rows.length > 0) return res.json(existing.rows[0]);
    const result = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [name]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name, created_at FROM users ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Predictions
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
        data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
    `;
    for (const p of predictions) {
      await client.query(upsertQuery, [user_id, p.stage, p.match_id, JSON.stringify(p.data)]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.get('/api/predictions/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT stage, match_id, data FROM predictions WHERE user_id = $1', [req.params.userId]);
    res.json(result.rows.map(r => ({ stage: r.stage, match_id: r.match_id, data: JSON.parse(r.data) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin
function checkAdmin(req, res) {
  const pw = req.body?.password || req.query?.password;
  if (pw !== ADMIN_PASSWORD) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}

app.post('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { stage, teams } = req.body;
  const valid = ['r32', 'r16', 'qf', 'sf', 'final', 'champion'];
  if (!stage || !valid.includes(stage) || teams === undefined) {
    return res.status(400).json({ error: 'Invalid stage' });
  }
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
    const rows = await pool.query('SELECT stage, teams FROM actual_results');
    const result = {};
    for (const r of rows.rows) result[r.stage] = { teams: JSON.parse(r.teams) };
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Scores
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

      // 1. Group Stage: 1 pt per correct team (capped at 32)
      let groups = actual['r32'] ? 0 : null;
      if (actual['r32']) {
        let count = 0;
        for (const gp of up.filter(p => p.stage === 'groups')) {
          ['first', 'second', 'third', 'fourth'].forEach(pos => {
            const team = gp.data[pos];
            if (team && actual['r32'].has(team)) count++;
          });
        }
        groups = Math.min(count, 32);
      }

      // Helper for knockout stages (capped at 32)
      const getQualifyingScore = (stageKey, pts) => {
        if (!actual[stageKey]) return 0;
        let s = 0;
        
        const stageMap = {
          'r16': ['r16_m89', 'r16_m90', 'r16_m91', 'r16_m92', 'r16_m93', 'r16_m94', 'r16_m95', 'r16_m96'],
          'qf':  ['qf_01', 'qf_02', 'qf_03', 'qf_04'],
          'sf':  ['sf_01', 'sf_02'],
          'final': ['final']
        };

        const relevantMatchIds = stageMap[stageKey] || [];
        const picks = up.filter(p => p.stage === 'knockout' && relevantMatchIds.includes(p.match_id));
        
        for (const pick of picks) {
          const cleanPick = typeof pick.data === 'string' ? pick.data.replace(/^["'\s]+|["'\s]+$/g, '') : pick.data;
          if (cleanPick && actual[stageKey].has(cleanPick)) s += pts;
        }
        return Math.min(s, 32);
      };

      const r16 = getQualifyingScore('r16', 2);
      const qf = getQualifyingScore('qf', 4);
      const sf = getQualifyingScore('sf', 8);
      const final = getQualifyingScore('final', 16);
      
      let champion = actual['champion'] ? 0 : null;
      if (actual['champion']) {
        const cp = up.find(p => p.stage === 'knockout' && p.match_id === 'final');
        const cleanChampion = typeof cp?.data === 'string' ? cp.data.replace(/^["'\s]+|["'\s]+$/g, '') : cp?.data;
        if (cleanChampion && actual['champion'].has(cleanChampion)) champion = 32;
      }

      const total = [groups, r16, qf, sf, final, champion].reduce((s, v) => s + (v ?? 0), 0);
      return { 
        user_id: user.id, 
        user_name: user.name, 
        total_points: total, 
        breakdown: { groups, r16, qf, sf, final, champion } 
      };
    });

    scores.sort((a, b) => b.total_points - a.total_points);
    res.json(scores);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/predictions/:userId', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    await pool.query('DELETE FROM predictions WHERE user_id = $1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    await pool.query('DELETE FROM predictions WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`World Cup Cloud API running on port ${PORT}`));