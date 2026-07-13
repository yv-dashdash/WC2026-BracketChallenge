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

      let groups = actual['r32'] ? 0 : null;
      if (actual['r32']) {
        let correctTopTwo = 0;
        let correctThirds = 0;

        for (const gp of up.filter(p => p.stage === 'groups')) {
          if (gp.data.first && actual['r32'].has(gp.data.first)) correctTopTwo++;
          if (gp.data.second && actual['r32'].has(gp.data.second)) correctTopTwo++;
        }

        const thirdSelectionRow = up.find(p => p.stage === 'third');
        if (thirdSelectionRow && Array.isArray(thirdSelectionRow.data)) {
          thirdSelectionRow.data.forEach(team => {
            if (team && actual['r32'].has(team)) correctThirds++;
          });
        }

        groups = correctTopTwo + correctThirds;
      }

      const getQualifyingScore = (stageKey, pts) => {
        if (!actual[stageKey]) return 0;
        
        const predictedTeamsInKnockout = new Set();
        const knockoutPicks = up.filter(p => p.stage === 'knockout' || p.match_id.startsWith('r32_') || p.match_id.startsWith('r16_') || p.match_id.startsWith('qf_') || p.match_id.startsWith('sf_') || p.match_id === 'final');
        
        for (const pick of knockoutPicks) {
          const cleanPick = typeof pick.data === 'string' ? pick.data.replace(/^["'\s]+|["'\s]+$/g, '') : pick.data;
          if (cleanPick) predictedTeamsInKnockout.add(cleanPick);
        }

        let score = 0;
        predictedTeamsInKnockout.forEach(team => {
          if (actual[stageKey].has(team)) score += pts;
        });

        return Math.min(score, 32);
      };

      const r16 = getQualifyingScore('r16', 2);
      const qf = getQualifyingScore('qf', 4);
      const sf = getQualifyingScore('sf', 8);
      const final = getQualifyingScore('final', 16);
      
      let champion = actual['champion'] ? 0 : null;
      if (actual['champion']) {
        const cp = up.find(p => p.match_id === 'final');
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

// ── EXACT 8-OUTCOME SEMI-FINAL ODDS SIMULATION ENDPOINT ──
app.get('/api/odds', async (_req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const users = usersRes.rows;
    const allPreds = predsRes.rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
    
    const baselineActual = {};
    for (const r of actualRes.rows) {
      const parsedTeams = JSON.parse(r.teams);
      baselineActual[r.stage] = Array.isArray(parsedTeams) ? parsedTeams : [parsedTeams];
    }

    const semiFinalists = baselineActual['qf'] ? [...baselineActual['qf']] : [];

    if (semiFinalists.length < 4) {
      const qfPicks = new Set();
      allPreds.forEach(p => {
        if (p.match_id.startsWith('qf_')) {
          const clean = typeof p.data === 'string' ? p.data.replace(/^["'\s]+|["'\s]+$/g, '') : p.data;
          if (clean) qfPicks.add(clean);
        }
      });
      while(qfPicks.size < 4) qfPicks.add(`Team ${qfPicks.size + 1}`);
      semiFinalists.push(...Array.from(qfPicks).slice(0, 4));
    }

    const sf1_teams = [semiFinalists[0], semiFinalists[1]];
    const sf2_teams = [semiFinalists[2], semiFinalists[3]];

    const scenarios = [];
    for (const finalist1 of sf1_teams) {
      for (const finalist2 of sf2_teams) {
        const finalMatchTeams = [finalist1, finalist2];
        for (const champion of finalMatchTeams) {
          scenarios.push({
            final: [finalist1, finalist2],
            champion: [champion]
          });
        }
      }
    }

    const winCounts = {};
    users.forEach(u => winCounts[u.id] = 0);

    scenarios.forEach(simulatedActual => {
      const dynamicActual = {};
      Object.keys(baselineActual).forEach(k => dynamicActual[k] = new Set(baselineActual[k]));
      
      dynamicActual['final'] = new Set(simulatedActual.final);
      dynamicActual['champion'] = new Set(simulatedActual.champion);

      let highestScore = -1;
      let winnersOfScenario = [];

      users.forEach(user => {
        const up = allPreds.filter(p => p.user_id === user.id);
        let score = 0;

        if (dynamicActual['r32']) {
          let count = 0;
          for (const gp of up.filter(p => p.stage === 'groups')) {
            if (gp.data.first && dynamicActual['r32'].has(gp.data.first)) count++;
            if (gp.data.second && dynamicActual['r32'].has(gp.data.second)) count++;
          }
          const thirdRow = up.find(p => p.stage === 'third');
          if (thirdRow && Array.isArray(thirdRow.data)) {
            thirdRow.data.forEach(t => { if (t && dynamicActual['r32'].has(t)) count++; });
          }
          score += count;
        }

        const stagesConfig = [
          { key: 'r16', pts: 2 },
          { key: 'qf', pts: 4 },
          { key: 'sf', pts: 8 },
          { key: 'final', pts: 16 }
        ];

        stagesConfig.forEach(stageOpt => {
          if (!dynamicActual[stageOpt.key]) return;
          const predictedTeams = new Set();
          up.filter(p => p.stage === 'knockout' || p.match_id.startsWith('r32_') || p.match_id.startsWith('r16_') || p.match_id.startsWith('qf_') || p.match_id.startsWith('sf_') || p.match_id === 'final')
            .forEach(pick => {
              const clean = typeof pick.data === 'string' ? pick.data.replace(/^["'\s]+|["'\s]+$/g, '') : pick.data;
              if (clean) predictedTeams.add(clean);
            });

          let stageScore = 0;
          predictedTeams.forEach(t => { if (dynamicActual[stageOpt.key].has(t)) stageScore += stageOpt.pts; });
          score += Math.min(stageScore, 32);
        });

        if (dynamicActual['champion']) {
          const cp = up.find(p => p.match_id === 'final');
          const cleanChamp = typeof cp?.data === 'string' ? cp.data.replace(/^["'\s]+|["'\s]+$/g, '') : cp?.data;
          if (cleanChamp && dynamicActual['champion'].has(cleanChamp)) score += 32;
        }

        if (score > highestScore) {
          highestScore = score;
          winnersOfScenario = [user.id];
        } else if (score === highestScore) {
          winnersOfScenario.push(user.id);
        }
      });

      winnersOfScenario.forEach(id => {
        winCounts[id] += 1;
      });
    });

    const oddsReport = users.map(u => {
      const wins = winCounts[u.id] || 0;
      const rawPct = (wins / scenarios.length) * 100;
      return {
        user_id: u.id,
        user_name: u.name,
        winning_probability: Math.round(rawPct)
      };
    }).sort((a, b) => b.winning_probability - a.winning_probability);

    res.json({
      outcomes_calculated: scenarios.length,
      odds: oddsReport
    });
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