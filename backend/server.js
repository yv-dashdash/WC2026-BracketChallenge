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
    await client.query suicide; // Purposely left out - keeping your core table schema safe
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
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
};
initDb();

// ── Fixed Admin Password Restored Exactly ──
const ADMIN_PASSWORD = 'SoftIsBeautiful2026';

function checkAdmin(req, res) {
  const pw = req.body?.password || req.query?.password;
  if (pw !== ADMIN_PASSWORD) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}

// ── Scoring Match Identification Groups ──────────────────────────────────────
const R32_MATCH_IDS = [
  'r32_m74','r32_m77','r32_m73','r32_m75',
  'r32_m83','r32_m84','r32_m81','r32_m82',
  'r32_m76','r32_m78','r32_m79','r32_m80',
  'r32_m86','r32_m88','r32_m85','r32_m87',
];
const R16_MATCH_IDS = ['r16_m89','r16_m90','r16_m93','r16_m94','r16_m91','r16_m92','r16_m95','r16_m96'];
const QF_MATCH_IDS  = ['qf_01','qf_02','qf_03','qf_04'];
const SF_MATCH_IDS  = ['sf_01','sf_02'];

// Extracts pure lowercase string arrays from any nested JSON formatting anomalies
function extractCleanTeams(mixedData) {
  if (!mixedData) return [];
  const rawString = typeof mixedData === 'string' ? mixedData : JSON.stringify(mixedData);
  
  const pattern = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{1,25}[A-Za-zÀ-ÿ]/g;
  const found = rawString.match(pattern) || [];
  
  const ignoreKeywords = [
    'stage', 'match', 'match_id', 'data', 'teams', 'true', 'false', 
    'first', 'second', 'third', 'fourth', 'groups', 'live_groups', 'knockout', 'selections'
  ];
  
  return found
    .map(name => name.trim().toLowerCase())
    .filter(name => name.length > 2 && !ignoreKeywords.includes(name));
}

// ── User Endpoints ───────────────────────────────────────────────────────────
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

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, created_at FROM users ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Prediction Endpoints ──────────────────────────────────────────────────────
app.post('/api/predictions/bulk', async (req, res) => {
  const { user_id, predictions } = req.body;
  if (!user_id || !Array.isArray(predictions)) return res.status(400).json({ error: 'Missing fields' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upsertQuery = `
      INSERT INTO predictions (user_id, stage, match_id, data, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, stage, match_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
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
    res.json(result.rows.map(r => {
      let parsed = r.data;
      try { parsed = JSON.parse(r.data); } catch(e){}
      return { stage: r.stage, match_id: r.match_id, data: parsed };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin Configuration Endpoints (CRITICAL SANITIZATION UPDATE) ──
app.post('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { stage, teams } = req.body;

  const valid = [
    'groups', 'live_groups',
    'r32', 'r16', 'qf', 'sf', 'final', 'champion',
    'live_r32', 'live_r16', 'live_qf', 'live_sf', 'live_final', 'live_champion'
  ];
  if (!stage || !valid.includes(stage) || teams === undefined) return res.status(400).json({ error: 'Invalid' });

  // CRITICAL FIX: Break the accumulation snowball effect.
  // Instead of saving raw double-stringified objects directly into the DB,
  // we look at what came from the frontend, grab only the active text items,
  // and store them as a perfectly clean, flat single-tier array.
  const pristineTeamList = extractCleanTeams(teams);

  try {
    await pool.query(`
      INSERT INTO actual_results (stage, teams, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT(stage) DO UPDATE SET teams = EXCLUDED.teams, updated_at = CURRENT_TIMESTAMP
    `, [stage, JSON.stringify(pristineTeamList)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/results', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const rows = await pool.query('SELECT stage, teams, updated_at FROM actual_results');
    const result = {};
    for (const r of rows.rows) {
      let parsed = r.teams;
      try { parsed = JSON.parse(r.teams); } catch(e){}
      result[r.stage] = { teams: parsed, updated_at: r.updated_at };
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Leaderboard Core Calculations ───────────────────────────────────────────
app.get('/api/scores', async (req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const users = usersRes.rows;
    const allPreds = predsRes.rows;

    const rawActual = {};
    for (const r of actualRes.rows) {
      rawActual[r.stage] = r.teams;
    }

    const scores = users.map(user => {
      const up = allPreds.filter(p => p.user_id === user.id);

      const calculateScoreForTrack = (isLive) => {
        const targetGroupKey = isLive ? 'live_groups' : 'groups';
        const targetR32Key = isLive ? 'live_r32' : 'r32';
        const targetR16Key = isLive ? 'live_r16' : 'r16';
        const targetQfKey = isLive ? 'live_qf' : 'qf';
        const targetSfKey = isLive ? 'live_sf' : 'sf';
        const targetChampKey = isLive ? 'live_champion' : 'champion';

        // 1. Group Stage Parsing
        const actualGroupTeams = new Set(extractCleanTeams(rawActual[targetGroupKey]));
        let groupsScore = 0;

        for (const gp of up.filter(p => p.stage === 'groups')) {
          extractCleanTeams(gp.data).forEach(team => {
            if (actualGroupTeams.has(team)) groupsScore++;
          });
        }

        const tp = up.find(p => p.stage === 'third' && p.match_id === 'selections');
        if (tp) {
          extractCleanTeams(tp.data).forEach(team => {
            if (actualGroupTeams.has(team)) groupsScore++;
          });
        }

        // 2. Knockout Calculation Layer
        const matchLookupScore = (stageKey, matchIds, pointsPerMatch) => {
          const actualStageTeams = new Set(extractCleanTeams(rawActual[stageKey]));
          if (actualStageTeams.size === 0) return 0;

          let stagePoints = 0;
          for (const id of matchIds) {
            const pick = up.find(p => p.stage === 'knockout' && p.match_id === id);
            if (pick) {
              const userPickedTeams = extractCleanTeams(pick.data);
              if (userPickedTeams.some(team => actualStageTeams.has(team))) {
                stagePoints += pointsPerMatch;
              }
            }
          }
          return stagePoints;
        };

        const r16 = matchLookupScore(targetR32Key, R32_MATCH_IDS, 2);
        const qf = matchLookupScore(targetR16Key, R16_MATCH_IDS, 4);
        const sf = matchLookupScore(targetQfKey, QF_MATCH_IDS, 8);
        const final = matchLookupScore(targetSfKey, SF_MATCH_IDS, 16);

        // 3. Champion Verification
        let championScore = 0;
        const actualChampions = new Set(extractCleanTeams(rawActual[targetChampKey]));
        if (actualChampions.size > 0) {
          const cp = up.find(p => p.stage === 'knockout' && p.match_id === 'final');
          if (cp) {
            const userChampTeams = extractCleanTeams(cp.data);
            if (userChampTeams.some(team => actualChampions.has(team))) {
              championScore = 32;
            }
          }
        }

        return groupsScore + r16 + qf + sf + final + championScore;
      };

      const liveTotal = calculateScoreForTrack(true);
      const officialTotal = calculateScoreForTrack(false);

      return { 
        user_id: user.id, 
        user_name: user.name, 
        live_total: liveTotal,
        official_total: officialTotal
      };
    });

    scores.sort((a, b) => b.live_total - a.live_total);
    res.json(scores);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete endpoints ─────────────────────────────────────────────────────────
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

app.listen(PORT, () => console.log(`Server running smoothly on port ${PORT}`));