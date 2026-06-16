import { useState, useEffect } from 'react';
import { saveActualResults, getActualResults, getUsers, deletePredictions, deleteUser, loadPredictions } from '../api';
import { ALL_TEAMS, GROUPS, GROUP_NAMES } from '../data/teams';
import KnockoutBracket from './KnockoutBracket';

const STAGE_CONFIG = [
  { key: 'r32',      label: 'Group Stage Qualifiers (Round of 32)', count: 32, pts: 1  },
  { key: 'r16',      label: 'Round of 16 Qualifiers',               count: 16, pts: 2  },
  { key: 'qf',       label: 'Quarter-finalists',                    count: 8,  pts: 4  },
  { key: 'sf',       label: 'Semi-finalists',                       count: 4,  pts: 8  },
  { key: 'final',    label: 'Finalists',                            count: 2,  pts: 16 },
  { key: 'champion', label: 'Champion',                             count: 1,  pts: 32 },
];

const SCORING_RULES = [
  { stage: 'Group stage → Round of 32', qualifying: 32, pts: 1,  max: 32  },
  { stage: 'Round of 32 → Round of 16', qualifying: 16, pts: 2,  max: 32  },
  { stage: 'Round of 16 → Quarter-finals', qualifying: 8, pts: 4, max: 32 },
  { stage: 'Quarter-finals → Semi-finals', qualifying: 4, pts: 8, max: 32 },
  { stage: 'Semi-finals → Final',           qualifying: 2, pts: 16, max: 32 },
  { stage: 'Champion',                      qualifying: 1, pts: 32, max: 32 },
];

const ALL_TEAM_NAMES = ALL_TEAMS.map(t => t.name).sort();

const DEFAULT_GROUP_PRED = () =>
  GROUP_NAMES.reduce((acc, g) => ({ ...acc, [g]: { first: null, second: null, third: null, fourth: null } }), {});

function parsePredictions(rows) {
  const groupPredictions = DEFAULT_GROUP_PRED();
  let thirdSelections = [];
  const knockoutPicks = {};
  for (const row of rows) {
    if (row.stage === 'groups') {
      groupPredictions[row.match_id] = { ...groupPredictions[row.match_id], ...row.data };
    } else if (row.stage === 'third') {
      thirdSelections = row.data;
    } else if (row.stage === 'knockout') {
      knockoutPicks[row.match_id] = row.data;
    }
  }
  return { groupPredictions, thirdSelections, knockoutPicks };
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const [savedResults, setSavedResults] = useState({});
  const [selections, setSelections] = useState({});
  const [saveStatus, setSaveStatus] = useState({});

  const [participants, setParticipants] = useState([]);
  const [userActionStatus, setUserActionStatus] = useState({});
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [viewBracket, setViewBracket] = useState(null);

  // Default every single configuration track to 'live' editing on launch
  const [adminMode, setAdminMode] = useState({
    r32: 'live',
    r16: 'live',
    qf: 'live',
    sf: 'live',
    final: 'live',
    champion: 'live'
  });

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm });
  }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      await getActualResults(pwInput);
      setAuthed(true);
      setPwError('');
    } catch {
      setPwError('Incorrect password.');
    }
  }

  const loadData = () => {
    getActualResults(pwInput)
      .then(data => {
        setSavedResults(data);
        const init = {};
        STAGE_CONFIG.forEach(stage => {
          const mode = adminMode[stage.key] || 'live';
          const dbKey = mode === 'live' ? `live_${stage.key}` : stage.key;
          const val = data[dbKey];
          init[stage.key] = new Set(val ? (Array.isArray(val.teams) ? val.teams : [val.teams]) : []);
        });
        setSelections(init);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!authed) return;
    loadData();
    getUsers().then(setParticipants).catch(() => {});
  }, [authed]);

  // Synchronize input fields accurately when an admin switches views
  useEffect(() => {
    if (!authed) return;
    const init = {};
    STAGE_CONFIG.forEach(stage => {
      const mode = adminMode[stage.key] || 'live';
      const dbKey = mode === 'live' ? `live_${stage.key}` : stage.key;
      const val = savedResults[dbKey];
      init[stage.key] = new Set(val ? (Array.isArray(val.teams) ? val.teams : [val.teams]) : []);
    });
    setSelections(init);
  }, [adminMode, savedResults, authed]);

  function toggleTeam(stageKey, team) {
    setSelections(prev => {
      const current = new Set(prev[stageKey] || []);
      current.has(team) ? current.delete(team) : current.add(team);
      return { ...prev, [stageKey]: current };
    });
  }

  function toggleAdminMode(stageKey, mode) {
    setAdminMode(prev => ({ ...prev, [stageKey]: mode }));
  }

  async function handleSave(stageKey, required, isLiveSave) {
    const sel = selections[stageKey] || new Set();
    
    if (!isLiveSave && sel.size !== required) {
      alert(`Cannot lock official results. You must select exactly ${required} teams.`);
      return;
    }

    const dbKey = isLiveSave ? `live_${stageKey}` : stageKey;
    setSaveStatus(prev => ({ ...prev, [dbKey]: 'saving' }));

    try {
      const teams = stageKey === 'champion' ? [...sel][0] : [...sel];
      await saveActualResults(pwInput, dbKey, teams);
      
      setSavedResults(prev => ({ ...prev, [dbKey]: { teams, updated_at: new Date().toISOString() } }));
      setSaveStatus(prev => ({ ...prev, [dbKey]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [dbKey]: '' })), 2500);
    } catch {
      setSaveStatus(prev => ({ ...prev, [dbKey]: 'error' }));
    }
  }

  function setUserStatus(id, status) {
    setUserActionStatus(prev => ({ ...prev, [id]: status }));
  }

  function handleClearBracket(userId, userName) {
    askConfirm(`Clear all predictions for "${userName}"?`, async () => {
      setUserStatus(userId, 'working');
      try {
        await deletePredictions(pwInput, userId);
        setUserStatus(userId, 'cleared');
        setTimeout(() => setUserStatus(userId, ''), 2500);
      } catch { setUserStatus(userId, 'error'); }
    });
  }

  function handleDeleteUser(userId, userName) {
    askConfirm(`Permanently delete "${userName}" and all their data? This cannot be undone.`, async () => {
      setUserStatus(userId, 'working');
      try {
        await deleteUser(pwInput, userId);
        setParticipants(prev => prev.filter(u => u.id !== userId));
      } catch { setUserStatus(userId, 'error'); }
    });
  }

  async function handleViewBracket(user) {
    setViewBracket({ name: user.name, loading: true });
    try {
      const rows = await loadPredictions(user.id);
      const { groupPredictions, thirdSelections, knockoutPicks } = parsePredictions(rows);
      setViewBracket({ name: user.name, groupPredictions, thirdSelections, knockoutPicks });
    } catch {
      setViewBracket(null);
    }
  }

  if (!authed) {
    return (
      <div>
        <div className="section-title">Admin Panel</div>
        <div style={{ maxWidth: 360 }}>
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Admin Password</label>
              <input type="password" value={pwInput} onChange={e => setPwInput(e.target.value)}
                placeholder="Enter password" autoFocus />
            </div>
            {pwError && <div className="error">{pwError}</div>}
            <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>
              Unlock Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">
        Admin Panel
        <span className="badge" style={{ background: 'var(--red)', color: '#fff' }}>Admin</span>
      </div>

      {/* ── Participants ── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Participants
          <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}>
            {participants.length} registered
          </span>
        </div>
        {participants.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No participants yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {participants.map(u => {
              const st = userActionStatus[u.id];
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 16px', flexWrap: 'wrap', gap: 8,
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 10 }}>
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleViewBracket(u)}>
                      View Bracket
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: st === 'cleared' ? 'var(--green)' : 'var(--text-dim)',
                        cursor: st === 'working' ? 'not-allowed' : 'pointer',
                      }}
                      disabled={st === 'working'}
                      onClick={() => handleClearBracket(u.id, u.name)}
                    >
                      {st === 'working' ? '…' : st === 'cleared' ? 'Cleared' : 'Clear Bracket'}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--red)',
                        color: 'var(--red)',
                        cursor: st === 'working' ? 'not-allowed' : 'pointer',
                      }}
                      disabled={st === 'working'}
                      onClick={() => handleDeleteUser(u.id, u.name)}
                    >
                      {st === 'error' ? 'Error' : 'Delete User'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Scoring Rules ── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Scoring Rules</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Teams qualifying</th>
                <th>Points per team</th>
                <th>Max points</th>
              </tr>
            </thead>
            <tbody>
              {SCORING_RULES.map(r => (
                <tr key={r.stage}>
                  <td>{r.stage}</td>
                  <td style={{ textAlign: 'center' }}>{r.qualifying}</td>
                  <td style={{ textAlign: 'center' }}>{r.pts} pt{r.pts > 1 ? 's' : ''}</td>
                  <td style={{ textAlign: 'center' }}>{r.max} pts</td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td></td><td></td>
                <td style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 700 }}>192 pts</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Stage Results ── */}
      {STAGE_CONFIG.map(({ key, label, count, pts }) => {
        const sel = selections[key] || new Set();
        const currentMode = adminMode[key] || 'live';
        const activeDbKey = currentMode === 'live' ? `live_${key}` : key;
        const saved = savedResults[activeDbKey];
        const status = saveStatus[activeDbKey];
        const isOfficialReady = sel.size === count;

        return (
          <div key={key} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 20, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{label}</div>
                
                {/* Fixed Mode Selector Tabs */}
                <div style={{ display: 'inline-flex', background: 'var(--surface2)', padding: 4, borderRadius: 6, marginTop: 8, border: '1px solid var(--border)' }}>
                  <button 
                    type="button"
                    onClick={() => toggleAdminMode(key, 'live')}
                    style={{
                      padding: '6px 14px', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                      background: currentMode === 'live' ? '#0070f3' : 'transparent',
                      color: currentMode === 'live' ? '#fff' : '#888',
                      fontWeight: currentMode === 'live' ? 700 : 400
                    }}
                  >
                    ⚡ Edit Live Trend
                  </button>
                  <button 
                    type="button"
                    onClick={() => toggleAdminMode(key, 'official')}
                    style={{
                      padding: '6px 14px', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                      background: currentMode === 'official' ? '#e5a93b' : 'transparent',
                      color: currentMode === 'official' ? '#000' : '#888',
                      fontWeight: currentMode === 'official' ? 700 : 400
                    }}
                  >
                    🏆 Edit Official
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                  {currentMode === 'live' 
                    ? `Select any number of teams currently qualifying right now (${pts} pt each).`
                    : `Select exactly ${count} finalized qualifying teams (${pts} pt each).`
                  }
                  {saved && (
                    <span style={{ marginLeft: 8, color: 'var(--green)' }}>
                      — Saved: {new Date(saved.updated_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: (currentMode === 'live' || isOfficialReady) ? 'var(--green)' : 'var(--red)' }}>
                  {sel.size} {currentMode === 'official' && `/ ${count}`}
                </span>
                
                {currentMode === 'live' ? (
                  <button 
                    type="button"
                    className="btn btn-blue btn-sm" 
                    disabled={status === 'saving'}
                    onClick={() => handleSave(key, count, true)}
                    style={{ background: '#0070f3', color: '#fff' }}
                  >
                    {status === 'saving' ? 'Saving Live…' : status === 'saved' ? 'Live Saved!' : 'Save Live Trend ⚡'}
                  </button>
                ) : (
                  <button 
                    type="button"
                    className="btn btn-green btn-sm" 
                    disabled={!isOfficialReady || status === 'saving'}
                    onClick={() => handleSave(key, count, false)}
                    style={{ opacity: isOfficialReady ? 1 : 0.5, background: '#e5a93b', color: '#000' }}
                  >
                    {status === 'saving' ? 'Locking…' : status === 'saved' ? 'Locked!' : 'Lock Official 🏆'}
                  </button>
                )}
              </div>
            </div>

            {status === 'error' && <div className="error" style={{ marginBottom: 8 }}>Failed to update database.</div>}
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6 }}>
              {ALL_TEAM_NAMES.map(team => {
                const isSelected = sel.has(team);
                const teamData = ALL_TEAMS.find(t => t.name === team);
                return (
                  <button key={team} type="button" onClick={() => toggleTeam(key, team)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                    background: isSelected ? (currentMode === 'live' ? 'rgba(0,112,243,0.15)' : 'rgba(229,169,59,0.15)') : 'var(--surface2)',
                    border: `1px solid ${isSelected ? (currentMode === 'live' ? '#0070f3' : '#e5a93b') : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                    color: isSelected ? 'var(--text)' : 'var(--text-dim)',
                    fontSize: 12, fontWeight: isSelected ? 700 : 400,
                    textAlign: 'left', transition: 'all .1s',
                  }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{teamData?.flag || '🏳️'}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</span>
                    {isSelected && <span style={{ color: currentMode === 'live' ? '#0070f3' : '#e5a93b', fontSize: 14 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Confirm Dialog ── */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 24, color: 'var(--text)' }}>
              {confirmDialog.message}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, marginTop: 0, background: 'var(--red)' }}
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bracket Viewer Modal ── */}
      {viewBracket && (
        <div className="modal-overlay" onClick={() => setViewBracket(null)}>
          <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14,
              width: '96vw', maxHeight: '92vh', overflow: 'auto',
              padding: '24px 20px', boxShadow: '0 24px 60px rgba(0,0,0,.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{viewBracket.name}'s Bracket</div>
              <button onClick={() => setViewBracket(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            {viewBracket.loading ? (
              <div className="empty-state">Loading…</div>
            ) : (
              <KnockoutBracket
                groupPredictions={viewBracket.groupPredictions}
                thirdSelections={viewBracket.thirdSelections}
                knockoutPicks={viewBracket.knockoutPicks}
                onPick={() => {}}
                onRandom={() => {}}
                readOnly
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}