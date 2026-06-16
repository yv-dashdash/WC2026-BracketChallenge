import { useState, useEffect } from 'react';
import { getScores } from '../api';

export default function Leaderboard({ currentUser, onSelectUser }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  // Toggle between 'live' (fallback enabled) and 'official' (strict data only)
  const [viewMode, setViewMode] = useState('live'); 

  useEffect(() => {
    getScores()
      .then(data => {
        setScores(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="leaderboard-loading">Loading standings...</div>;

  // Filter or sort depending on selection if your backend separates breakdowns,
  // or use the total_points property synced from the fallback calculation.
  return (
    <div className="leaderboard-card">
      {/* View Mode Toggle Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '0 4px'
      }}>
        <div style={{ fontSize: '16px', fontWeight: '750', color: 'var(--text)' }}>
          Tournament Standings
        </div>
        <div style={{ 
          display: 'flex', 
          background: 'var(--surface2)', 
          padding: '4px', 
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <button 
            onClick={() => setViewMode('live')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'live' ? 'var(--blue)' : 'transparent',
              color: viewMode === 'live' ? '#fff' : 'var(--text-dim)',
              transition: 'all 0.2s ease'
            }}
          >
            ⚡ Live Trend
          </button>
          <button 
            onClick={() => setViewMode('official')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'official' ? 'var(--gold)' : 'transparent',
              color: viewMode === 'official' ? '#000' : 'var(--text-dim)',
              transition: 'all 0.2s ease'
            }}
          >
            🏆 Official
          </button>
        </div>
      </div>

      {/* Leaderboard Table View */}
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th className="col-name">Participant</th>
            <th className="col-score">Pts</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((row, i) => {
            const isMe = currentUser && row.user_id === currentUser.id;
            
            // If viewing strict official mode, show base total or fall back to 0 if none locked
            const pointsToDisplay = viewMode === 'official' 
              ? (row.breakdown?.groups !== null ? row.total : 0)
              : (row.total_points || 0);

            return (
              <tr key={row.user_id} className={isMe ? 'row-me' : ''}>
                <td className="col-rank">{i + 1}</td>
                <td className="col-name">
                  <span 
                    className="leaderboard-name-link"
                    onClick={() => onSelectUser({ id: row.user_id, name: row.user_name })}
                    style={{ 
                      cursor: 'pointer', 
                      fontWeight: isMe ? '800' : '500',
                      textDecoration: 'underline',
                      textDecorationColor: 'rgba(255,255,255,0.2)'
                    }}
                  >
                    {row.user_name}
                  </span>
                  {isMe && <span className="me-badge">YOU</span>}
                </td>
                <td className="col-score" style={{ 
                  color: viewMode === 'live' ? 'var(--blue-light)' : 'var(--gold)',
                  fontWeight: '700'
                }}>
                  {pointsToDisplay}
                </td>
              </tr>
            );
          })}
          {scores.length === 0 && (
            <tr>
              <td colSpan="3" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                No predictions submitted yet. Be the first!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}