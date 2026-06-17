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

// ── Admin: Save Results ──
app.post('/api/admin/results', async (req, res) => {
  const { password, stage, teams } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).send('Unauthorized');
  
  // Allowing both official keys (e.g., 'r32') and live keys (e.g., 'live_r32')
  try {
    await pool.query(
      'INSERT INTO actual_results (stage, teams) VALUES ($1, $2) ON CONFLICT(stage) DO UPDATE SET teams = $2', 
      [stage, JSON.stringify(teams)]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).send(err.message); }
});

// ── Scores: Mode-Specific Fetching ──
app.get('/api/scores', async (req, res) => {
  // Frontend should call /api/scores?mode=live OR /api/scores?mode=official
  const mode = req.query.mode || 'live'; 
  
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const users = usersRes.rows;
    const allPreds = predsRes.rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
    
    // Create separate objects for official and live data
    const actualOfficial = {};
    const actualLive = {};
    
    for (const r of actualRes.rows) {
      const teams = new Set(JSON.parse(r.teams));
      if (r.stage.startsWith('live_')) {
        actualLive[r.stage.replace('live_', '')] = teams;
      } else {
        actualOfficial[r.stage] = teams;
      }
    }

    // Select the dataset based on the requested mode
    const activeData = (mode === 'official') ? actualOfficial : actualLive;

    const scores = users.map(user => {
      const up = allPreds.filter(p => p.user_id === user.id);
      
      const r32Set = activeData['r32'];
      let groups = 0;
      if (r32Set) {
        for (const gp of up.filter(p => p.stage === 'groups')) {
          if (gp.data.first && r32Set.has(gp.data.first)) groups++;
          if (gp.data.second && r32Set.has(gp.data.second)) groups++;
        }
      }
      
      // Calculate other stages similarly using activeData...
      
      const total = groups; // Expand this with other stages as needed
      return { user_id: user.id, user_name: user.name, total };
    });

    res.json(scores.sort((a, b) => b.total - a.total));
  } catch (err) { res.status(500).send(err.message); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));