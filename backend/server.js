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

// This function only performs an UPDATE/INSERT on a single row. 
// It does NOT affect other rows in the table.
app.post('/api/admin/results', async (req, res) => {
  const { password, stage, teams } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).send('Unauthorized');
  
  try {
    await pool.query(
      `INSERT INTO actual_results (stage, teams, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       ON CONFLICT (stage) DO UPDATE SET teams = $2, updated_at = CURRENT_TIMESTAMP`,
      [stage, JSON.stringify(teams)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// This is the simplest possible fetch. 
// It gets everything currently in the database so we can see what's there.
app.get('/api/scores', async (req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const actual = {};
    actualRes.rows.forEach(r => {
      try {
        actual[r.stage] = new Set(JSON.parse(r.teams));
      } catch (e) {
        console.error("Failed to parse teams for", r.stage);
      }
    });

    const scores = usersRes.rows.map(user => {
      const up = predsRes.rows.filter(p => p.user_id === user.id);
      
      // Calculate scores based on whatever is in 'actual'
      // If a stage key exists in 'actual', it uses it.
      const r32Set = actual['r32'] || actual['live_r32'];
      let total = 0;
      if (r32Set) {
        up.forEach(p => {
            if (p.stage === 'groups' && ((p.data.first && r32Set.has(p.data.first)) || (p.data.second && r32Set.has(p.data.second)))) total++;
        });
      }
      
      return { user_id: user.id, user_name: user.name, total };
    });

    res.json(scores.sort((a, b) => b.total - a.total));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));