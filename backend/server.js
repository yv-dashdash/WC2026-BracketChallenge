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
      CREATE TABLE IF NOT EXISTS users (\n        id SERIAL PRIMARY KEY,\n        name TEXT UNIQUE NOT NULL,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n      );

      CREATE TABLE IF NOT EXISTS predictions (\n        id SERIAL PRIMARY KEY,\n        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n        stage TEXT NOT NULL,\n        match_id TEXT NOT NULL,\n        data JSONB NOT NULL,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n        CONSTRAINT unique_user_stage_match UNIQUE(user_id, stage, match_id)\n      );

      CREATE TABLE IF NOT EXISTS actual_results (\n        stage TEXT PRIMARY KEY,\n        teams JSONB NOT NULL,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n      );
    `);
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
};
initDb();

// ── Admin Authentication Layer ──
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function checkAdmin(req, res) {
  const pw = req.body?.password || req.query?.password;
  if (pw !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── User Endpoints ───────────────────────────────────────────────────────────
app.post('/api/users', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = await pool.query(
      'INSERT INTO users (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Prediction Endpoints ──────────────────────────────────────────────────────
app.post('/api/predictions/bulk', async (req, res) => {
  const { user_id, predictions } = req.body;
  if (!user_id || !Array.isArray(predictions)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const pred of predictions) {
      await client.query(`
        INSERT INTO predictions (user_id, stage, match_id, data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, stage, match_id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
      `, [user_id, pred.stage, pred.match_id, JSON.stringify(pred.data)]);
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
    const result = await pool.query('SELECT * FROM predictions WHERE user_id = $1', [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin Configuration Endpoints ───────────────────────────────────────────
app.post('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { stage, teams } = req.body;

  // Added 'groups' and 'live_groups' so your whitelisting logic processes the form data successfully
  const valid = [
    'groups', 'live_groups',
    'r32', 'r16', 'qf', 'sf', 'final', 'champion',
    'live_r32', 'live_r16', 'live_qf', 'live_sf', 'live_final', 'live_champion'
  ];

  if (!stage || !valid.includes(stage) || teams === undefined) {
    return res.status(400).json({ error: 'Invalid stage parameter' });
  }

  try {
    await pool.query(`
      INSERT INTO actual_results (stage, teams, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT(stage) DO UPDATE SET teams = EXCLUDED.teams, updated_at = CURRENT_TIMESTAMP
    `, [stage, JSON.stringify(teams)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const result = await pool.query('SELECT * FROM actual_results');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Leaderboard Core Calculations ───────────────────────────────────────────
app.get('/api/scores', async (req, res) => {
  try {
    const usersRes = await pool.query('SELECT * FROM users');
    const predsRes = await pool.query('SELECT * FROM predictions');
    const actualRes = await pool.query('SELECT * FROM actual_results');

    const actualMap = {};
    actualRes.rows.forEach(r => { actualMap[r.stage] = r.teams; });

    const predsByUser = {};
    predsRes.rows.forEach(p => {
      if (!predsByUser[p.user_id]) predsByUser[p.user_id] = [];
      predsByUser[p.user_id].push(p);
    });

    const scores = usersRes.rows.map(user => {
      const userPreds = predsByUser[user.id] || [];

      const calculateScoreForKeys = (r32K, r16K, qfK, sfK, finalK, champK) => {
        let groups = 0, r16 = 0, qf = 0, sf = 0, final = 0, champion = 0;

        // Group processing logic mapping safely to database records
        const actualGroupTeams = actualMap['live_groups'] || [];
        userPreds.filter(p => p.stage === 'groups').forEach(p => {
          if (p.data) {
            if (p.data.first && actualGroupTeams.includes(p.data.first)) groups += 1;
            if (p.data.second && actualGroupTeams.includes(p.data.second)) groups += 1;
          }
        });

        const r32Actual = actualMap[r32K] || [];
        userPreds.filter(p => p.stage === 'knockout' && p.match_id.startsWith('r32_')).forEach(p => {
          if (r32Actual.includes(p.data)) r16 += 2;
        });

        const r16Actual = actualMap[r16K] || [];
        userPreds.filter(p => p.stage === 'knockout' && p.match_id.startsWith('r16_')).forEach(p => {
          if (r16Actual.includes(p.data)) qf += 4;
        });

        const qfActual = actualMap[qfK] || [];
        userPreds.filter(p => p.stage === 'knockout' && p.match_id.startsWith('qf_')).forEach(p => {
          if (qfActual.includes(p.data)) sf += 8;
        });

        const sfActual = actualMap[sfK] || [];
        userPreds.filter(p => p.stage === 'knockout' && p.match_id.startsWith('sf_')).forEach(p => {
          if (sfActual.includes(p.data)) final += 16;
        });

        const finalActual = actualMap[finalK] || [];
        const userFinalPick = userPreds.find(p => p.stage === 'knockout' && p.match_id === 'final')?.data;
        if (userFinalPick && finalActual.includes(userFinalPick)) champion += 32;

        return groups + r16 + qf + sf + final + champion;
      };

      const liveTotal = calculateScoreForKeys('live_r32', 'live_r16', 'live_qf', 'live_sf', 'live_final', 'live_champion');
      const officialTotal = calculateScoreForKeys('r32', 'r16', 'qf', 'sf', 'final', 'champion');

      return { 
        user_id: user.id, 
        user_name: user.name, 
        live_total: liveTotal,
        official_total: officialTotal
      };
    });

    scores.sort((a, b) => b.live_total - a.live_total);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete endpoints ─────────────────────────────────────────────────────────
app.delete('/api/admin/predictions/:userId', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    await pool.query('DELETE FROM predictions WHERE user_id = $1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    await pool.query('DELETE FROM predictions WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});