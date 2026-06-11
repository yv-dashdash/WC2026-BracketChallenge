# World Cup 2026 — Bracket Predictions

React + Express + SQLite bracket prediction app.

## Local development

**Backend** (port 3001):
```bash
cd backend && npm install && npm run dev
```

**Frontend** (port 5173):
```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Stack
- Frontend: React 18 + Vite
- Backend: Express.js
- Database: SQLite (better-sqlite3)

## Scoring Rules

| Stage | Teams qualifying | Points per team | Max points |
|-------|-----------------|-----------------|-----------|
| Group stage → Round of 32 | 32 | 1 pt | 32 pts |
| Round of 32 → Round of 16 | 16 | 2 pts | 32 pts |
| Round of 16 → Quarter-finals | 8 | 4 pts | 32 pts |
| Quarter-finals → Semi-finals | 4 | 8 pts | 32 pts |
| Semi-finals → Final | 2 | 16 pts | 32 pts |
| Champion | 1 | 32 pts | 32 pts |
| **Total** | | | **192 pts** |

Scoring is computed server-side at `/api/scores` and displayed in the Leaderboard tab.

## Admin Panel

Navigate to the **Admin** tab and enter the password `admin` to:
- Enter actual tournament results for each stage (R32, R16, QF, SF, Final, Champion)
- View the scoring rules table
- Trigger score recalculation (scores are always computed live from saved results)

## Notes
- Group data in `frontend/src/data/teams.js` reflects the official FIFA World Cup 2026 draw.
- The bracket structure follows the 2026 WC format: 12 groups → R32 → R16 → QF → SF → Final.
- Match IDs follow the official wall chart numbering (m73–m96 for R32, m89–m96 for R16).
- Predictions auto-save to the database as you make picks.
