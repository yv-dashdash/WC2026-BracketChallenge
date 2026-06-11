import { useEffect, useState } from 'react';
import { getScores } from '../api';

export default function Leaderboard({ currentUser }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getScores()
      .then(data => setScores(data))
      .catch(() => setError('Failed to load scores.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Loading scores…</div>;
  if (error) return <div className="empty-state" style={{ color: 'var(--red)' }}>{error}</div>;
  if (!scores.length) return <div className="empty-state">No participants yet.</div>;

  const COLUMNS = [
    { key: 'groups',   label: 'Groups',   max: 32  },
    { key: 'r16',      label: 'R16',      max: 32  },
    { key: 'qf',       label: 'QF',       max: 32  },
    { key: 'sf',       label: 'SF',       max: 32  },
    { key: 'final',    label: 'Final',    max: 32  },
    { key: 'champion', label: 'Champion', max: 32  },
  ];

  return (
    <div>
      <div className="section-title">
        Leaderboard
        <span className="badge badge-blue">{scores.length} participants</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400, marginLeft: 4 }}>
          Max possible: 192 pts
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>Rank</th>
              <th>Name</th>
              <th style={{ textAlign: 'center', color: 'var(--gold)' }}>Total</th>
              {COLUMNS.map(c => (
                <th key={c.key} style={{ textAlign: 'center' }}>
                  {c.label}
                  <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)' }}>/{c.max}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scores.map((row, idx) => {
              const isMe = row.user_id === currentUser?.id;
              return (
                <tr key={row.user_id} style={isMe ? { background: 'rgba(245,196,0,.06)' } : {}}>
                  <td style={{ textAlign: 'center', color: idx === 0 ? 'var(--gold)' : 'var(--text-dim)', fontWeight: idx < 3 ? 700 : 400 }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </td>
                  <td>
                    <strong>{row.user_name}</strong>
                    {isMe && (
                      <span className="badge" style={{ marginLeft: 8, fontSize: 10 }}>You</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>
                    {row.total}
                  </td>
                  {COLUMNS.map(c => {
                    const val = row.breakdown[c.key];
                    return (
                      <td key={c.key} style={{ textAlign: 'center' }}>
                        {val === null || val === undefined ? (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        ) : (
                          <span style={{ color: val === c.max ? 'var(--gold)' : val > 0 ? 'var(--text)' : 'var(--text-dim)' }}>
                            {val}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 12 }}>
        Scores update as the tournament progresses. "—" means that stage hasn't been scored yet.
        Points: Groups 1pt/team · R16 2pts · QF 4pts · SF 8pts · Final 16pts · Champion 32pts.
      </p>
    </div>
  );
}
