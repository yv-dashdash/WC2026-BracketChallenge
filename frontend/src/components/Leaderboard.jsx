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
        if (Array.isArray(data)) {
          setScores(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading standings:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="leaderboard-loading">Loading standings...</div>;

  // Safe client-side sorting to make sure the rows stay perfectly ordered by active tab
  const sortedScores = [...scores].sort((a, b) => {
    const scoreA = viewMode === 'live' 
      ? (a.live_total ?? a.total_points ?? a.total ?? 0)
      : (a.official_total ?? a.total ?? 0);
    const scoreB = viewMode === 'live' 
      ? (b.live_total ?? b.total_points ?? b.total ?? 0)
      : (b.official_total ?? b.total ?? 0);
    return scoreB - scoreA;
  });

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
          {sortedScores.map((row, i) => {
            const isMe = currentUser && row.user_id === currentUser.id;
            
            // Safe alignment matching whatever naming conversion your Supabase payload uses
            const pointsToDisplay = viewMode === 'live'
              ? (row.live_total ?? row.total_points ?? row.total ?? 0)
              : (row.official_total ?? row.total ?? 0);

            return (
              <tr key={row.user_id || i} className={isMe ? 'row-me' : ''}>
                <td className="col-rank">{i + 1}</td>
                <td className="col-name">
                  <span 
                    className="leaderboard-name-link"
                    onClick={() => onSelectUser && onSelectUser({ id: row.user_id, name: row.user_name })}
                    style={{ 
                      cursor: 'pointer', 
                      fontWeight: isMe ? '800' : '500',
                      textDecoration: 'underline',
                      textDecorationColor: 'rgba(255,255,255,0.2)'
                    }}
                  >
                    {row.user_name || 'Unknown'}
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
          {sortedScores.length === 0 && (
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