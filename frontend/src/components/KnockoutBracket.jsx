import { R32_MATCHES, R16_MATCHES, QF_MATCHES, SF_MATCHES, FINAL_MATCH, GROUPS } from '../data/teams';

// Each team row = 34px, two rows + border = 69px, margin 4px top+bottom = 77px total block
const SLOT_BASE = 78; // px — one R32 match slot height (match + gaps)

function resolveSeed(seed, groupPredictions, thirdSelections) {
  if (!seed) return null;
  if (seed.startsWith('1')) return groupPredictions[seed[1]]?.first || null;
  if (seed.startsWith('2')) return groupPredictions[seed[1]]?.second || null;
  if (seed.startsWith('3rd_')) return thirdSelections[parseInt(seed.split('_')[1], 10) - 1] || null;
  return null;
}

function getFlag(teamName) {
  if (!teamName) return null;
  for (const g of Object.values(GROUPS)) {
    const t = g.teams.find(t => t.name === teamName);
    if (t) return t.flag;
  }
  return '🏳️';
}

function MatchBox({ match, teamA, teamB, winner, onPick, readOnly }) {
  const TeamRow = ({ team }) => {
    const isWinner = winner === team;
    const isLoser = winner && winner !== team && team;
    return (
      <div
        className={`bracket-team${isWinner ? ' winner' : ''}${isLoser ? ' loser' : ''}${!team ? ' tbd' : ''}${readOnly ? ' read-only' : ''}`}
        onClick={() => !readOnly && team && onPick(match.id, team)}
        title={readOnly ? undefined : (team ? `Pick ${team}` : 'TBD')}
        style={readOnly ? { cursor: 'default' } : {}}
      >
        <span className="team-flag">{team ? getFlag(team) : '—'}</span>
        <span className="bracket-team-name">{team || 'TBD'}</span>
        {isWinner && <span style={{ fontSize: 10 }}>▶</span>}
      </div>
    );
  };

  return (
    <div className="bracket-match">
      <TeamRow team={teamA} />
      <TeamRow team={teamB} />
    </div>
  );
}

function BracketSpacer() {
  return <div style={{ width: 14, flexShrink: 0 }} />;
}

function BracketRound({ title, matches, teams, picks, onPick, roundIndex, className, readOnly }) {
  const slotH = SLOT_BASE * Math.pow(2, roundIndex);
  return (
    <div className={`bracket-round${className ? ` ${className}` : ''}`}>
      <div className="round-title">{title}</div>
      {matches.map(m => (
        <div
          key={m.id}
          style={{ height: slotH, display: 'flex', alignItems: 'center' }}
        >
          <MatchBox
            match={m}
            teamA={teams[m.id]?.teamA}
            teamB={teams[m.id]?.teamB}
            winner={picks[m.id]}
            onPick={onPick}
            readOnly={readOnly}
          />
        </div>
      ))}
    </div>
  );
}

// Full code below updated to accept isReadOnly from App.jsx and pass as readOnly internally
export default function KnockoutBracket({ groupPredictions, thirdSelections, knockoutPicks, onPick, onRandom, isReadOnly }) {
  const resolve = (seed) => resolveSeed(seed, groupPredictions, thirdSelections);
  const readOnly = isReadOnly; // Map prop to internal variable name

  const r32Teams = R32_MATCHES.reduce((acc, m) => {
    acc[m.id] = { teamA: resolve(m.team1Seed), teamB: resolve(m.team2Seed) };
    return acc;
  }, {});

  const r16Teams = R16_MATCHES.reduce((acc, m) => ({
    ...acc,
    [m.id]: { teamA: knockoutPicks[m.prevMatch1] || null, teamB: knockoutPicks[m.prevMatch2] || null },
  }), {});

  const qfTeams = QF_MATCHES.reduce((acc, m) => ({
    ...acc,
    [m.id]: { teamA: knockoutPicks[m.prevMatch1] || null, teamB: knockoutPicks[m.prevMatch2] || null },
  }), {});

  const sfTeams = SF_MATCHES.reduce((acc, m) => ({
    ...acc,
    [m.id]: { teamA: knockoutPicks[m.prevMatch1] || null, teamB: knockoutPicks[m.prevMatch2] || null },
  }), {});

  const sf1W = knockoutPicks['sf_01'] || null;
  const sf2W = knockoutPicks['sf_02'] || null;
  const finalTeams = { teamA: sf1W, teamB: sf2W };
  const champion = knockoutPicks['final'] || null;

  // Count only scoreable picks (exclude third-place match key)
  const filledPicks = Object.entries(knockoutPicks).filter(([k, v]) => v && k !== 'third').length;
  const totalMatches = R32_MATCHES.length + R16_MATCHES.length + QF_MATCHES.length + SF_MATCHES.length + 1; // +1 for final

  // Final column slot height = 16 R32 slots
  const finalSlotH = SLOT_BASE * 16;

  return (
    <div>
      <div className="section-title">
        Knockout Bracket
        <span className="badge badge-blue">{filledPicks}/{totalMatches} picks made</span>
        {!readOnly && <button className="btn-random" onClick={onRandom} title="Fill bracket randomly">Random</button>}
      </div>
      {!readOnly && (
        <>
          <p style={{ color: 'var(--text-dim)', marginBottom: 20, fontSize: 13 }}>
            Click a team in each match to pick the winner. Teams auto-advance to the next round.
          </p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(filledPicks / totalMatches) * 100}%` }} />
          </div>
        </>
      )}
      {readOnly && (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', margin: '12px 0 20px' }}>
          Viewing participant's elimination bracket (Read-Only)
        </p>
      )}

      <div className="bracket-wrap">
        <div className="bracket" style={{ alignItems: 'flex-start' }}>

          <BracketRound title="Round of 32" matches={R32_MATCHES} teams={r32Teams}
            picks={knockoutPicks} onPick={onPick} roundIndex={0} readOnly={readOnly} />
          <BracketSpacer />
          <BracketRound title="Round of 16" matches={R16_MATCHES} teams={r16Teams}
            picks={knockoutPicks} onPick={onPick} roundIndex={1} readOnly={readOnly} />
          <BracketSpacer />
          <BracketRound title="Quarter-finals" matches={QF_MATCHES} teams={qfTeams}
            picks={knockoutPicks} onPick={onPick} roundIndex={2} readOnly={readOnly} />
          <BracketSpacer />
          <BracketRound title="Semi-finals" matches={SF_MATCHES} teams={sfTeams}
            picks={knockoutPicks} onPick={onPick} roundIndex={3} readOnly={readOnly} />
          <BracketSpacer />
          <div className="bracket-round bracket-final">
            <div className="round-title">Final</div>
            <div style={{ height: finalSlotH, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <MatchBox
                match={FINAL_MATCH}
                teamA={finalTeams.teamA}
                teamB={finalTeams.teamB}
                winner={champion}
                onPick={onPick}
                readOnly={readOnly}
              />
              {champion && (
                <div className="champion-name" style={{ width: 170 }}>
                  {getFlag(champion)} {champion}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}