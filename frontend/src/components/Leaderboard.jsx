import { useState, useEffect } from 'react';
import { getActualResults, getUsers, loadPredictions } from '../api';

const STAGE_PTS = { r32: 1, r16: 2, qf: 4, sf: 8, final: 16, champion: 32 };

export default function Leaderboard({ currentUser, onSelectUser }) {
  const [boardMode, setBoardMode] = useState('live'); // 'live' or 'official'
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function calculateLeaderboards() {
      try {
        const [actualData, participants] = await Promise.all([
          getActualResults(''), 
          getUsers()
        ]);

        const officialTruth = {};
        const liveTruth = {};

        Object.keys(STAGE_PTS).forEach(stage => {
          const offTeams = actualData[stage]?.teams;
          officialTruth[stage] = new Set(Array.isArray(offTeams) ? offTeams : offTeams ? [offTeams] : []);

          const liveTeams = actualData[`live_${stage}`]?.teams;
          liveTruth[stage] = new Set(Array.isArray(liveTeams) ? liveTeams : liveTeams ? [liveTeams] : []);
        });

        const calculatedUsers = await Promise.all(
          participants.map(async (user) => {
            let officialPoints = 0;
            let livePoints = 0;

            try {
              const predictions = await loadPredictions(user.id);
              
              predictions.forEach(row => {
                if (row.stage === 'groups' && row.data) {
                  const predictedTeams = Object.values(row.data).filter(Boolean);
                  
                  predictedTeams.forEach(team => {
                    if (officialTruth['r32'].has(team)) officialPoints += STAGE_PTS['r32'];
                    if (liveTruth['r32'].has(team)) livePoints += STAGE_PTS['r32'];
                  });
                }
                
                if (row.stage === 'knockout' && row.data) {
                  const targetStage = row.match_id; 
                  const chosenTeam = row.data;
                  if (chosenTeam && STAGE_PTS[targetStage]) {
                    if (officialTruth[targetStage].has(chosenTeam)) officialPoints += STAGE_PTS[targetStage];
                    if (liveTruth[targetStage].has(chosenTeam)) livePoints += STAGE_PTS[targetStage];
                  }
                }
              });
            } catch (e) {
              console.error(e);
            }

            return {
              user_id: user.id,
              user_name: user.name,
              official_score: officialPoints,
              live_score: livePoints,
            };
          })
        );

        setLeaderboardData(calculatedUsers);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }

    calculateLeaderboards();
  }, []);

  if (loading) return <div className="leaderboard-loading">Loading standings...</div>;

  const sortedScores = [...leaderboardData].sort((a, b) => {
    return boardMode === 'live' 
      ? b.live_score - a.live_score || b.official_score - a.official_score
      : b.official_score - a.official_score || b.live_score - a.live_score;
  });

  return (
    <div className="leaderboard-card">
      
      <div style={{ 
        display: 'flex', 
        background: 'var(--surface2)', 
        padding: '4px', 
        borderRadius: '8px', 
        marginBottom: '16px',
        border: '1px solid var(--border)' 
      }}>
        <button 
          type="button"
          onClick={() => setBoardMode('live')}
          style={{
            flex: 1, padding: '10px 14px', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
            background: boardMode === 'live' ? '#0070f3' : 'transparent',
            color: boardMode === 'live' ? '#fff' : '#888',
            fontWeight: boardMode === 'live' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          ⚡ Live Trend (Real-time)
        </button>
        <button 
          type="button"
          onClick={() => setBoardMode('official')}
          style={{
            flex: 1, padding: '10px 14px', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
            background: boardMode === 'official' ? '#e5a93b' : 'transparent',
            color: boardMode === 'official' ? '#000' : '#888',
            fontWeight: boardMode === 'official' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          🏆 Official Standings (Locked)
        </button>
      </div>

      <table className="leaderboard-table">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th className="col-name">Participant</th>
            <th className="col-score" style={{ color: boardMode === 'live' ? '#0070f3' : '#e5a93b' }}>
              {boardMode === 'live' ? 'Live Pts' : 'Official Pts'}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedScores.map((row, i) => {
            const isMe = currentUser && row.user_id === currentUser.id;
            const displayScore = boardMode === 'live' ? row.live_score : row.official_score;
            
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
                <td className="col-score" style={{ fontWeight: 'bold' }}>{displayScore}</td>
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