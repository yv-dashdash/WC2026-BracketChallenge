import { useState, useEffect } from 'react';
import { getScores } from '../api';

export default function Leaderboard({ currentUser, onSelectUser }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScores()
      .then(data => {
        setScores(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="leaderboard-loading">Loading standings...</div>;

  return (
    <div className="leaderboard-card">
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
                <td className="col-score">{row.total_points || 0}</td>
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