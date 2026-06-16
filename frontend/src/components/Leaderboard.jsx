import { useState, useEffect } from 'react';
import { getScores, getActualResults, loadPredictions } from '../api';

const STAGE_CONFIGS = [
  { key: 'r32', weight: 1 },
  { key: 'r16', weight: 2 },
  { key: 'qf',  weight: 4 },
  { key: 'sf',  weight: 8 },
  { key: 'final', weight: 16 },
  { key: 'champion', weight: 32 }
];

export default function Leaderboard({ currentUser, onSelectUser }) {
  const [boardMode, setBoardMode] = useState('live'); // 'live' or 'official'
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboardSystem() {
      try {
        // Step 1: Immediately fetch the official scores and user listings safely
        const baseScores = await getScores();
        
        // Setup initial display array so names appear instantly
        const initialList = baseScores.map(p => ({
          user_id: p.user_id,
          user_name: p.user_name,
          official_score: p.total_points || 0,
          live_score: p.total_points || 0 // Default fallback until live matches are processed
        }));
        
        setParticipants(initialList);

        // Step 2: Fetch actual tournament targets to calculate live variance on the fly
        const actualData = await getActualResults('').catch(() => ({}));
        
        // Find which stages have active "Live Trend" tracking entries in the DB
        const activeLiveStages = STAGE_CONFIGS.filter(stage => {
          const liveTeams = actualData[`live_${stage.key}`]?.teams;
          return Array.isArray(liveTeams) && liveTeams.length > 0;
        });

        // If no custom live trend data has been entered by the admin yet, we are done!
        if (activeLiveStages.length === 0) {
          setLoading(false);
          return;
        }

        // Build quick lookup structures for active live matching values
        const liveTruthMap = {};
        activeLiveStages.forEach(stage => {
          const teams = actualData[`live_${stage.key}`]?.teams;
          liveTruthMap[stage.key] = new Set(teams);
        });

        // Step 3: Sequentially check user arrays to calculate Live variations cleanly
        const updatedList = await Promise.all(
          initialList.map(async (player) => {
            let calculatedLivePoints = 0;

            try {
              const predictions = await loadPredictions(player.user_id);

              predictions.forEach(row => {
                // Check live points matching for group selections
                if (row.stage === 'groups' && row.data && liveTruthMap['r32']) {
                  const predictedTeams = Object.values(row.data).filter(Boolean);
                  predictedTeams.forEach(team => {
                    if (liveTruthMap['r32'].has(team)) {
                      calculatedLivePoints += 1; // 1 point per correct r32 team
                    }
                  });
                }

                // Check live points matching for direct knockout stages
                if (row.stage === 'knockout' && row.data) {
                  const targetStage = row.match_id; // 'r16', 'qf', etc.
                  const chosenTeam = row.data;
                  if (chosenTeam && liveTruthMap[targetStage] && liveTruthMap[targetStage].has(chosenTeam)) {
                    const stageWeight = STAGE_CONFIGS.find(s => s.key === targetStage)?.weight || 0;
                    calculatedLivePoints += stageWeight;
                  }
                }
              });
            } catch (err) {
              console.error(`Could not evaluate live variance for user: ${player.user_name}`, err);
              return player; // Fallback to safe defaults if connection drops
            }

            return {
              ...player,
              live_score: calculatedLivePoints
            };
          })
        );

        setParticipants(updatedList);
        setLoading(false);
      } catch (globalError) {
        console.error("Leaderboard component loading error:", globalError);
        setLoading(false);
      }
    }

    loadLeaderboardSystem();
  }, []);

  if (loading && participants.length === 0) {
    return <div className="leaderboard-loading">Loading standings...</div>;
  }

  // Sort dynamically depending on what tab view toggle is checked
  const sortedParticipants = [...participants].sort((a, b) => {
    if (boardMode === 'live') {
      return b.live_score - a.live_score || b.official_score - a.official_score;
    } else {
      return b.official_score - a.official_score || b.live_score - a.live_score;
    }
  });

  return (
    <div className="leaderboard-card">
      
      {/* Tab Controls */}
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
            transition: 'all 0.15s'
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
            transition: 'all 0.15s'
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
          {sortedParticipants.map((row, i) => {
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
          {sortedParticipants.length === 0 && (
            <tr>
              <td colSpan="3" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                No predictions submitted yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}