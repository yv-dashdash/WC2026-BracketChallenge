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

const ADMIN_PASSWORD = 'SoftIsBeautiful2026';

// ── API Endpoints ──

app.get('/api/scores', async (_req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, name FROM users');
    const predsRes = await pool.query('SELECT user_id, stage, match_id, data FROM predictions');
    const actualRes = await pool.query('SELECT stage, teams FROM actual_results');

    const users = usersRes.rows;
    // Safely parse prediction data
    const allPreds = predsRes.rows.map(r => {
      let parsedData = r.data;
      try {
        parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      } catch (e) { /* keep as is */ }
      return { ...r, data: parsedData };
    });
    
    const actual = {};
    for (const r of actualRes.rows) {
      const parsedTeams = JSON.parse(r.teams);
      actual[r.stage] = new Set(Array.isArray(parsedTeams) ? parsedTeams : [parsedTeams]);
    }

    const scores = users.map(user => {
      const up = allPreds.filter(p => p.user_id === user.id);

      // Fixed: Target 'r32' key instead of 'groups'
      let groups = actual['r32'] ? 0 : null;
      if (actual['r32']) {
        for (const gp of up.filter(p => p.stage === 'groups')) {
          const d = gp.data;
          const first = d?.first ? String(d.first).replace(/^["'\s]+|["'\s]+$/g, '') : null;
          const second = d?.second ? String(d.second).replace(/^["'\s]+|["'\s]+$/g, '') : null;
          
          if (first && actual['r32'].has(first)) groups++;
          if (second && actual['r32'].has(second)) groups++;
        }
      }

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
          let cleanPick = String(pick.data).replace(/^["'\s]+|["'\s]+$/g, '');
          if (actual[stageKey].has(cleanPick)) s += pts;
        }
        return s;
      };

      const r16 = getQualifyingScore('r16', 2);
      const qf = getQualifyingScore('qf', 4);
      const sf = getQualifyingScore('sf', 8);
      const final = getQualifyingScore('final', 16);
      
      let champion = actual['champion'] ? 0 : null;
      if (actual['champion']) {
        const cp = up.find(p => p.stage === 'knockout' && p.match_id === 'final');
        const cleanChampion = cp?.data ? String(cp.data).replace(/^["'\s]+|["'\s]+$/g, '') : null;
        if (cleanChampion && actual['champion'].has(cleanChampion)) champion = 32;
      }

      const total = [groups, r16, qf, sf, final, champion].reduce((s, v) => s + (v ?? 0), 0);
      return { 
        user_id: user.id, 
        user_name: user.name, 
        total_points: total, 
        breakdown: { groups: groups ?? 0, r16, qf, sf, final, champion } 
      };
    });

    scores.sort((a, b) => b.total_points - a.total_points);
    res.json(scores);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ... (keep all other existing endpoints for users, predictions, and admin)

app.listen(PORT, () => console.log(`World Cup Cloud API running on port ${PORT}`));