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
            <th>Groups</th>
            <th>R16</th>
            <th>QF</th>
            <th>SF</th>
            <th>Final</th>
            <th>Champ</th>
            <th className="col-score">Total</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((row, i) => {
            const isMe = currentUser && row.user_id === currentUser.id;
            // Safely access breakdown, default to 0 if missing
            const b = row.breakdown || {}; 
            return (
              <tr key={row.user_id} className={isMe ? 'row-me' : ''}>
                <td className="col-rank">{i + 1}</td>
                <td className="col-name">
                  <span 
                    className="leaderboard-name-link"
                    onClick={() => onSelectUser({ id: row.user_id, name: row.user_name })}
                    style={{ cursor: 'pointer', fontWeight: isMe ? '800' : '500', textDecoration: 'underline' }}
                  >
                    {row.user_name}
                  </span>
                </td>
                <td>{b.groups ?? 0}</td>
                <td>{b.r16 ?? 0}</td>
                <td>{b.qf ?? 0}</td>
                <td>{b.sf ?? 0}</td>
                <td>{b.final ?? 0}</td>
                <td>{b.champion ?? 0}</td>
                <td className="col-score" style={{ fontWeight: 'bold' }}>{row.total_points || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}