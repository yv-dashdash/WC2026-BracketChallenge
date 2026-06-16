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
        // Step 1: Immediately fetch official scores so names appear instantly
        const baseScores = await getScores();
        
        const initialList = baseScores.map(p => ({
          user_id: p.user_id,
          user_name: p.user_name,
          official_score: p.total_points || 0,
          live_score: p.total_points || 0 
        }));
        
        setParticipants(initialList);

        // Step 2: Fetch actual tournament records to evaluate live trends
        const actualData = await getActualResults('').catch(() => ({}));
        
        // Isolate which stages currently have active live choices saved
        const activeLiveStages = STAGE_CONFIGS.filter(stage => {
          const liveTeams = actualData[`live_${stage.key}`]?.teams;
          return Array.isArray(liveTeams) && liveTeams.length > 0;
        });

        // If no dynamic custom data has been registered yet, fallback to stable records
        if (activeLiveStages.length === 0) {
          setLoading(false);
          return;
        }

        const liveTruthMap = {};
        activeLiveStages.forEach(stage => {
          const teams = actualData[`live_${stage.key}`]?.teams;
          liveTruthMap[stage.key] = new Set(teams);
        });

        // Step 3: Compute live user metrics sequentially
        const updatedList = await Promise.all(
          initialList.map(async (player) => {
            let calculatedLivePoints = 0;

            try {
              const predictions = await loadPredictions(player.user_id);

              predictions.forEach(row => {
                // Group stage predictions: Extract 1st, 2nd, AND 3rd place slots!
                if (row.stage === 'groups' && row.data && liveTruthMap['r32']) {
                  const { first, second, third } = row.data;
                  const userTopThreeTeams = [first, second, third].filter(Boolean);

                  userTopThreeTeams.forEach(team => {
                    if (liveTruthMap['r32'].has(team)) {
                      calculatedLivePoints += 1; // 1 point per correct R32 qualifier
                    }
                  });
                }

                // Knockout stage bracket matches
                if (row.stage === 'knockout' && row.data) {
                  const targetStage = row.match_id; 
                  const chosenTeam = row.data;
                  if (chosenTeam && liveTruthMap[targetStage] && liveTruthMap[targetStage].has(chosenTeam)) {
                    const stageWeight = STAGE_CONFIGS.find(s => s.key === targetStage)?.weight || 0;
                    calculatedLivePoints += stageWeight;
                  }
                }
              });
            } catch (err) {
              console.error(`Could not evaluate live variance for user: ${player.user_name}`, err);
              return player; 
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

  const sortedParticipants = [...participants].sort((a, b) => {
    if (boardMode === 'live') {
      return b.live_score - a.live_score || b.official_score - a.official_score;
    } else {
      return b.official_score - a.official_score || b.live_score - a.live_score;
    }
  });

  return (
    <div className="leaderboard-card">
      
      {/* Tab Selectors */}
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