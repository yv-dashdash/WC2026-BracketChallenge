import { GROUP_NAMES, GROUPS } from '../data/teams';

export default function ThirdPlace({ groupPredictions, thirdSelections, onChange, onRandom, isReadOnly }) {
  const thirdTeams = GROUP_NAMES.map(g => {
    const pred = groupPredictions[g];
    const name = pred?.third || null;
    if (!name) return null;
    const team = GROUPS[g].teams.find(t => t.name === name);
    return { group: g, name, flag: team?.flag || '🏳️' };
  }).filter(Boolean);

  const toggle = (teamName) => {
    if (isReadOnly) return; // Guard to block data modifications when in read-only view
    
    if (thirdSelections.includes(teamName)) {
      onChange(thirdSelections.filter(t => t !== teamName));
    } else if (thirdSelections.length < 8) {
      onChange([...thirdSelections, teamName]);
    }
  };

  const groupsWithThird = thirdTeams.length;

  return (
    <div>
      <div className="section-title">
        Best 3rd Place Teams
        <span className="badge badge-blue">{thirdSelections.length}/8 selected</span>
        {/* Hide random fill button when viewing an inspected leaderboard user */}
        {!isReadOnly && (
          <button className="btn-random" onClick={onRandom} title="Pick 8 random third-place teams">Random</button>
        )}
      </div>

      {groupsWithThird < 12 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20, padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {12 - groupsWithThird} group{12 - groupsWithThird !== 1 ? 's' : ''} still need a 3rd-place team ranked before they appear here.
        </div>
      )}

      <div className="third-place-section">
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
          {isReadOnly 
            ? "Viewing participant's best 3rd place selections (Read-Only)" 
            : "8 of the 12 third-place teams advance to the Round of 32. Pick which ones you think will qualify."
          }
          {!isReadOnly && thirdSelections.length === 8 && <strong style={{ color: 'var(--green)' }}> All 8 slots filled!</strong>}
        </p>
        <div className="third-team-grid">
          {thirdTeams.map(team => {
            const selected = thirdSelections.includes(team.name);
            const disabled = (!selected && thirdSelections.length >= 8) || isReadOnly;
            
            // Generate visual style adjustments based on status
            let chipStyle = {};
            if (isReadOnly) {
              chipStyle = { cursor: 'default' };
            } else if (disabled) {
              chipStyle = { opacity: .4, cursor: 'not-allowed' };
            }

            return (
              <div
                key={team.group}
                className={`third-team-chip${selected ? ' selected' : ''}${isReadOnly ? ' read-only' : ''}`}
                onClick={() => !disabled && toggle(team.name)}
                style={chipStyle}
              >
                <span style={{ fontSize: 16 }}>{team.flag}</span>
                <span>{team.name}</span>
                <span className="chip-group">{team.group}</span>
                {selected && <span style={{ color: 'var(--green)', marginLeft: 4 }}>✓</span>}
              </div>
            );
          })}
          {thirdTeams.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Rank 3rd-place teams in the Groups tab first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}