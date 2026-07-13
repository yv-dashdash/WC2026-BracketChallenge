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

app.get('/api/scores', async (_req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const users = usersRes.rows;
    const pot = users.length * 5; // 12 users * 5 CHF = 60 CHF[cite: 1]

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

      // Groups: 1pt per correct team, max 32[cite: 1]
      let groups = 0;
      if (actual['r32']) {
        up.filter(p => p.stage === 'groups').forEach(gp => {
          ['first', 'second', 'third', 'fourth'].forEach(pos => {
            if (gp.data?.[pos]) {
              const team = String(gp.data[pos]).replace(/^["'\s]+|["'\s]+$/g, '');
              if (actual['r32'].has(team)) groups++;
            }
          });
        });
        groups = Math.min(groups, 32);
      }

      // Knockout Scoring Logic[cite: 1]
      const getKnockoutScore = (stage, pts) => {
        if (!actual[stage]) return 0;
        const matches = up.filter(p => p.stage === 'knockout' && p.data);
        let s = 0;
        matches.forEach(m => {
          const team = String(m.data).replace(/^["'\s]+|["'\s]+$/g, '');
          if (actual[stage].has(team)) s += pts;
        });
        return Math.min(s, 32);
      };

      const r16 = getKnockoutScore('r16', 2);
      const qf = getKnockoutScore('qf', 4);
      const sf = getKnockoutScore('sf', 8);
      const final = getKnockoutScore('final', 16);
      
      let champion = 0;
      if (actual['champion']) {
        const cp = up.find(p => p.stage === 'knockout' && p.match_id === 'final');
        const team = cp?.data ? String(cp.data).replace(/^["'\s]+|["'\s]+$/g, '') : null;
        if (team && actual['champion'].has(team)) champion = 32;
      }

      const total = groups + r16 + qf + sf + final + champion;
      return { user_id: user.id, user_name: user.name, total_points: total, pot, breakdown: { groups, r16, qf, sf, final, champion } };
    });

    res.json(scores.sort((a, b) => b.total_points - a.total_points));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(process.env.PORT || 3001);