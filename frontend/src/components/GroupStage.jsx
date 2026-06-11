import { GROUPS, GROUP_NAMES } from '../data/teams';

const RANK_LABELS = ['1st', '2nd', '3rd', '4th'];
const RANK_KEYS   = ['first', 'second', 'third', 'fourth'];

function autoFillFourth(pred, teams) {
  const assigned = new Set(RANK_KEYS.slice(0, 3).map(k => pred[k]).filter(Boolean));
  if (assigned.size === 3 && !pred.fourth) {
    const remaining = teams.find(t => !assigned.has(t.name));
    if (remaining) return { ...pred, fourth: remaining.name };
  }
  return pred;
}

function getTeamRank(pred, teamName) {
  return RANK_KEYS.findIndex(k => pred[k] === teamName) + 1 || 0;
}

function GroupCard({ groupKey, teams, prediction, onChange }) {
  const handleRank = (teamName, rank) => {
    const currentRank = getTeamRank(prediction, teamName);
    const key = RANK_KEYS[rank - 1];
    let next = { ...prediction };

    // Deselect if clicking own rank
    if (currentRank === rank) {
      next[key] = null;
      onChange(groupKey, autoFillFourth(next, teams));
      return;
    }

    // Remove team from current position
    RANK_KEYS.forEach(k => { if (next[k] === teamName) next[k] = null; });

    // Displace whoever is in target slot
    const displaced = next[key];
    next[key] = teamName;

    // If displaced and had a rank, move them to vacated slot
    if (displaced && currentRank > 0) {
      next[RANK_KEYS[currentRank - 1]] = displaced;
    }

    onChange(groupKey, autoFillFourth(next, teams));
  };

  const isComplete = RANK_KEYS.every(k => prediction[k]);

  return (
    <div className={`group-card${isComplete ? ' complete' : ''}`}>
      <div className="group-header">
        <div className="group-letter">{groupKey}</div>
        <div className="group-name">Group {groupKey}</div>
        {isComplete && <span className="group-complete-badge">✓ Done</span>}
      </div>

      {teams.map(team => {
        const rank = getTeamRank(prediction, team.name);
        return (
          <div key={team.name} className="team-row">
            <span className="team-flag">{team.flag}</span>
            <span className="team-name">{team.name}</span>
            <div className="rank-buttons">
              {[1, 2, 3].map(r => (
                <button
                  key={r}
                  className={`rank-btn${rank === r ? ` rank-${r}` : ''}`}
                  onClick={() => handleRank(team.name, r)}
                  title={`Set ${RANK_LABELS[r - 1]}`}
                >
                  {r}
                </button>
              ))}
              {/* 4th is auto-assigned */}
              <span
                className={`rank-btn${rank === 4 ? ' rank-4' : ''}`}
                style={{ cursor: 'default', opacity: rank === 4 ? 1 : 0.3 }}
                title="4th place is assigned automatically"
              >
                4
              </span>
            </div>
          </div>
        );
      })}

      <div className="group-ranking-preview">
        {RANK_KEYS.map((k, i) => {
          const teamName = prediction[k];
          const team = teamName ? teams.find(t => t.name === teamName) : null;
          return (
            <div key={k} className="preview-slot">
              <span className={`preview-pos p${i + 1}`}>{i + 1}.</span>
              {team
                ? <><span className="preview-flag">{team.flag}</span><span className="preview-team">{team.name}</span></>
                : <span className="preview-team" style={{ fontStyle: 'italic' }}>—</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GroupStage({ groupPredictions, onChange, onRandom }) {
  const filled = GROUP_NAMES.filter(g => RANK_KEYS.every(k => groupPredictions[g]?.[k])).length;

  return (
    <div>
      <div className="section-title">
        Group Stage
        <span className="badge badge-blue">{filled}/{GROUP_NAMES.length} groups complete</span>
        <button className="btn-random" onClick={onRandom} title="Fill all groups randomly">Random</button>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(filled / GROUP_NAMES.length) * 100}%` }} />
      </div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 20, fontSize: 13 }}>
        Rank all 4 teams in each group (1st to 4th). Top 2 qualify automatically; best 8 third-place teams advance as wildcards.
      </p>
      <div className="groups-grid">
        {GROUP_NAMES.map(g => (
          <GroupCard
            key={g}
            groupKey={g}
            teams={GROUPS[g].teams}
            prediction={groupPredictions[g] || { first: null, second: null, third: null, fourth: null }}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
