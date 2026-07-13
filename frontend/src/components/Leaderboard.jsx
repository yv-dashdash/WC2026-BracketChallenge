import { useState, useEffect } from 'react';
import { getScores } from '../api';

export default function Leaderboard({ currentUser, onSelectUser }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScores()
      .then(data => { setScores(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  const totalPot = scores.length > 0 ? scores[0].pot : 0;

  return (
    <div className="leaderboard-card">      
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th><th>Participant</th><th>Grps</th><th>R16</th><th>QF</th><th>SF</th><th>Fin</th><th>Chmp</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((row, i) => (
            <tr key={row.user_id} className={currentUser?.id === row.user_id ? 'row-me' : ''}>
              <td>{i + 1}</td>
              <td onClick={() => onSelectUser({id: row.user_id, name: row.user_name})} style={{cursor:'pointer', textDecoration:'underline'}}>
                {row.user_name}
              </td>
              <td>{row.breakdown.groups}</td>
              <td>{row.breakdown.r16}</td>
              <td>{row.breakdown.qf}</td>
              <td>{row.breakdown.sf}</td>
              <td>{row.breakdown.final}</td>
              <td>{row.breakdown.champion}</td>
              <td style={{fontWeight:'bold'}}>{row.total_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}