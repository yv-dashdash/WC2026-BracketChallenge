const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- NEW ENDPOINT TO FIX POT DISPLAY ---
app.get('/api/users', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- EXISTING ENDPOINTS ---
app.get('/api/scores', async (_req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const users = usersRes.rows;
    const allPreds = predsRes.rows.map(r => {
      let data = r.data;
      try { data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; } catch (e) {}
      return { ...r, data };
    });
    
    const actual = {};
    for (const r of actualRes.rows) {
      const teams = JSON.parse(r.teams);
      actual[r.stage] = new Set(Array.isArray(teams) ? teams : [teams]);
    }

    const scores = users.map(user => {
      const up = allPreds.filter(p => p.user_id === user.id);

      // Scoring logic
      let groups = 0;
      up.filter(p => p.stage === 'groups').forEach(gp => {
        ['first', 'second', 'third', 'fourth'].forEach(pos => {
          if (gp.data?.[pos] && actual['r32']?.has(String(gp.data[pos]).replace(/^["'\s]+|["'\s]+$/g, ''))) {
            groups++;
          }
        });
      });

      const getScore = (stage, matchIds, pts) => {
        let s = 0;
        matchIds.forEach(mId => {
          const pred = up.find(p => p.match_id === mId);
          if (pred?.data && actual[stage]?.has(String(pred.data).replace(/^["'\s]+|["'\s]+$/g, ''))) {
            s += pts;
          }
        });
        return s;
      };

      const r16 = getScore('r16', ['r16_m89', 'r16_m90', 'r16_m91', 'r16_m92', 'r16_m93', 'r16_m94', 'r16_m95', 'r16_m96'], 2);
      const qf = getScore('qf', ['qf_01', 'qf_02', 'qf_03', 'qf_04'], 4);
      const sf = getScore('sf', ['sf_01', 'sf_02'], 8);
      const final = getScore('final', ['final'], 16);
      
      let champion = 0;
      const cp = up.find(p => p.match_id === 'final');
      if (cp?.data && actual['champion']?.has(String(cp.data).replace(/^["'\s]+|["'\s]+$/g, ''))) champion = 32;

      return { 
        user_id: user.id, 
        user_name: user.name, 
        total_points: groups + r16 + qf + sf + final + champion, 
        breakdown: { groups, r16, qf, sf, final, champion } 
      };
    });

    res.json(scores.sort((a, b) => b.total_points - a.total_points));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ... Keep your existing POST /api/users, /api/predictions/bulk, etc. here ...

app.listen(process.env.PORT || 3001);