import { useState, useEffect, useCallback, useRef } from 'react';
import NamePicker from './components/NamePicker';
import GroupStage from './components/GroupStage';
import ThirdPlace from './components/ThirdPlace';
import KnockoutBracket from './components/KnockoutBracket';
import Leaderboard from './components/Leaderboard';
import Admin from './components/Admin';
import { loadPredictions, savePredictions, getUsers } from './api';
import { GROUP_NAMES, GROUPS, R32_MATCHES, R16_MATCHES, QF_MATCHES, SF_MATCHES } from './data/teams';

const EDITOR_TABS = [
  { id: 'groups',  label: 'Groups',   step: 1 },
  { id: 'third',   label: 'Best 3rd', step: 2 },
  { id: 'bracket', label: 'Bracket',  step: 3 },
];

const DEFAULT_GROUP_PRED = () =>
  GROUP_NAMES.reduce((acc, g) => ({ ...acc, [g]: { first: null, second: null, third: null, fourth: null } }), {});

function predsToPayload(groupPredictions, thirdSelections, knockoutPicks) {
  const items = [];
  for (const [g, pred] of Object.entries(groupPredictions)) {
    if (pred.first || pred.second || pred.third || pred.fourth) {
      items.push({ stage: 'groups', match_id: g, data: pred });
    }
  }
  if (thirdSelections.length > 0) {
    items.push({ stage: 'third', match_id: 'selections', data: thirdSelections });
  }
  for (const [matchId, winner] of Object.entries(knockoutPicks)) {
    if (winner) items.push({ stage: 'knockout', match_id: matchId, data: winner });
  }
  return items;
}

function payloadToPreds(rows) {
  const groupPredictions = DEFAULT_GROUP_PRED();
  let thirdSelections = [];
  const knockoutPicks = {};
  for (const row of rows) {
    if (row.stage === 'groups') {
      groupPredictions[row.match_id] = { ...{ first: null, second: null, third: null, fourth: null }, ...row.data };
    } else if (row.stage === 'third') {
      thirdSelections = row.data;
    } else if (row.stage === 'knockout') {
      knockoutPicks[row.match_id] = row.data;
    }
  }
  return { groupPredictions, thirdSelections, knockoutPicks };
}

export default function App() {
  // null = leaderboard, 'bracket' = editor, 'admin' = admin
  const [view, setView] = useState('leaderboard');
  const [editorTab, setEditorTab] = useState('groups');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wc2026_user')); } catch { return null; }
  });
  const [showPicker, setShowPicker] = useState(false);

  // States for viewing other participants' predictions
  const [viewingUser, setViewingUser] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [groupPredictions, setGroupPredictions] = useState(DEFAULT_GROUP_PRED());
  const [thirdSelections, setThirdSelections] = useState([]);
  const [knockoutPicks, setKnockoutPicks] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');
  const [showConfirm, setShowConfirm] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const saveTimer = useRef(null);
  const dirtyRef = useRef(false);

  // Persist user to localStorage
  useEffect(() => {
    if (user) localStorage.setItem('wc2026_user', JSON.stringify(user));
    else localStorage.removeItem('wc2026_user');
  }, [user]);

  // Fetch participant count for pot display
  useEffect(() => {
    getUsers().then(users => setParticipantCount(users.length)).catch(() => {});
  }, [view]); // refresh when returning to leaderboard

  // Load predictions when user OR inspected user changes
  useEffect(() => {
    const targetUserId = viewingUser ? viewingUser.id : user?.id;
    if (!targetUserId) return;

    loadPredictions(targetUserId).then(rows => {
      const { groupPredictions: gp, thirdSelections: ts, knockoutPicks: kp } = payloadToPreds(rows);
      setGroupPredictions(gp);
      setThirdSelections(ts);
      setKnockoutPicks(kp);
      dirtyRef.current = false;
    });
  }, [user, viewingUser]);

  // Auto-save (debounced) - Only active if NOT in read-only mode
  const triggerSave = useCallback(() => {
    if (!user || !dirtyRef.current || isReadOnly) return;
    clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const payload = predsToPayload(groupPredictions, thirdSelections, knockoutPicks);
        await savePredictions(user.id, payload);
        setSaveStatus('saved');
        dirtyRef.current = false;
      } catch {
        setSaveStatus('idle');
      }
    }, 800);
  }, [user, groupPredictions, thirdSelections, knockoutPicks, isReadOnly]);

  useEffect(() => {
    if (user && dirtyRef.current && !isReadOnly) triggerSave();
  }, [groupPredictions, thirdSelections, knockoutPicks, isReadOnly]);

  const handleGroupChange = (group, pred) => {
    if (isReadOnly) return;
    dirtyRef.current = true;
    setGroupPredictions(prev => ({ ...prev, [group]: pred }));
  };
  const handleThirdChange = (sel) => {
    if (isReadOnly) return;
    dirtyRef.current = true;
    setThirdSelections(sel);
  };
  const handleKnockoutPick = (matchId, winner) => {
    if (isReadOnly) return;
    dirtyRef.current = true;
    setKnockoutPicks(prev => clearDownstream(matchId, { ...prev, [matchId]: winner }));
  };

  const openEditor = () => {
    if (!user) { setShowPicker(true); }
    else { 
      setViewingUser(null);
      setIsReadOnly(false);
      setView('bracket'); 
      setEditorTab('groups'); 
    }
  };

  // Click handler to open someone else's bracket from Leaderboard
  const handleSelectUser = (selectedUser) => {
    setViewingUser(selectedUser);
    setIsReadOnly(true);
    setView('bracket');
    setEditorTab('groups');
  };

  const handleBackToLeaderboard = () => {
    setViewingUser(null);
    setIsReadOnly(false);
    setView('leaderboard');
  };

  // ── Random fill helpers ──────────────────────────────────────────────────────
  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const randomizeGroups = () => {
    if (isReadOnly) return;
    const next = {};
    for (const g of GROUP_NAMES) {
      const names = shuffle(GROUPS[g].teams.map(t => t.name));
      next[g] = { first: names[0], second: names[1], third: names[2], fourth: names[3] };
    }
    dirtyRef.current = true;
    setGroupPredictions(next);
  };

  const randomizeThird = () => {
    if (isReadOnly) return;
    const thirds = GROUP_NAMES.map(g => groupPredictions[g]?.third).filter(Boolean);
    dirtyRef.current = true;
    setThirdSelections(shuffle(thirds).slice(0, 8));
  };

  const randomizeBracket = () => {
    if (isReadOnly) return;
    const rWin = (a, b) => a && b ? (Math.random() < 0.5 ? a : b) : (a || b || null);
    const resolveSeed = (seed) => {
      if (!seed) return null;
      if (seed.startsWith('1')) return groupPredictions[seed[1]]?.first || null;
      if (seed.startsWith('2')) return groupPredictions[seed[1]]?.second || null;
      if (seed.startsWith('3rd_')) return thirdSelections[parseInt(seed.split('_')[1], 10) - 1] || null;
      return null;
    };
    const picks = {};
    for (const m of R32_MATCHES) {
      const w = rWin(resolveSeed(m.team1Seed), resolveSeed(m.team2Seed));
      if (w) picks[m.id] = w;
    }
    for (const m of R16_MATCHES) {
      const w = rWin(picks[m.prevMatch1], picks[m.prevMatch2]);
      if (w) picks[m.id] = w;
    }
    for (const m of QF_MATCHES) {
      const w = rWin(picks[m.prevMatch1], picks[m.prevMatch2]);
      if (w) picks[m.id] = w;
    }
    for (const m of SF_MATCHES) {
      const w = rWin(picks[m.prevMatch1], picks[m.prevMatch2]);
      if (w) picks[m.id] = w;
    }
    const finalW = rWin(picks['sf_01'], picks['sf_02']);
    if (finalW) picks['final'] = finalW;
    dirtyRef.current = true;
    setKnockoutPicks(picks);
  };

  const handleConfirmSubmit = async () => {
    if (isReadOnly) return;
    if (user) {
      try {
        const payload = predsToPayload(groupPredictions, thirdSelections, knockoutPicks);
        await savePredictions(user.id, payload);
      } catch { /* ignore */ }
    }
    setUser(null);
    setView('leaderboard');
    setShowConfirm(false);
    dirtyRef.current = false;
  };

  const handlePickerSelect = (u) => {
    setViewingUser(null);
    setIsReadOnly(false);
    setUser(u);
    setShowPicker(false);
    setView('bracket');
    setEditorTab('groups');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo" onClick={handleBackToLeaderboard} style={{ cursor: 'pointer' }}>
          <div><span className="logo-wc">FIFA</span>&nbsp;<span className="logo-year">2026</span></div>
          <div className="logo-byline">(v1.1)</div>
        </div>
        <div className="header-spacer" />
        <div className="header-right">
          {view === 'leaderboard' && (
            <>
              {user && (
                <div className="header-user-chip">
                  <span className="dot" />
                  {user.name}
                </div>
              )}
              <button className="btn-my-bracket" onClick={openEditor}>
                {user ? 'My Bracket' : 'Enter Bracket'}
              </button>
              <button
                className="btn-my-bracket"
                style={{ borderColor: 'var(--text-dim)', color: 'var(--text-dim)', fontSize: 12 }}
                onClick={() => setView('admin')}
              >
                Admin
              </button>
            </>
          )}
          {view === 'bracket' && (
            <button className="btn-back" onClick={handleBackToLeaderboard}>
              ← Leaderboard
            </button>
          )}
          {view === 'admin' && (
            <button className="btn-back" onClick={handleBackToLeaderboard}>
              ← Leaderboard
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {view === 'leaderboard' && (
          <div className="leaderboard-wrap">
            <div className="leaderboard-hero">
              <h1><span className="wc">World Cup</span> <span className="year">2026</span></h1>
              <p>Bracket Predictions — Leaderboard</p>
            </div>

            <div className="info-banner">
              {/* Pot + prizes */}
              <div className="info-grid">
                <div className="info-pot-card">
                  <div className="info-pot-label">Total Pot</div>
                  <div className="info-pot-value">{participantCount * 5} CHF</div>
                  <div className="info-pot-sub">{participantCount} participant{participantCount !== 1 ? 's' : ''} × 5 CHF</div>
                </div>
                <div className="info-prizes">
                  <div className="info-prize-row">
                    <span className="info-prize-medal">🥇</span>
                    <span className="info-prize-pct">1st place</span>
                    <span className="info-prize-amt">{Math.round(participantCount * 5 * 0.5)} CHF</span>
                    <span className="info-prize-share">50%</span>
                  </div>
                  <div className="info-prize-row">
                    <span className="info-prize-medal">🥈</span>
                    <span className="info-prize-pct">2nd place</span>
                    <span className="info-prize-amt">{Math.round(participantCount * 5 * 0.3)} CHF</span>
                    <span className="info-prize-share">30%</span>
                  </div>
                  <div className="info-prize-row">
                    <span className="info-prize-medal">🥉</span>
                    <span className="info-prize-pct">3rd place</span>
                    <span className="info-prize-amt">{Math.round(participantCount * 5 * 0.2)} CHF</span>
                    <span className="info-prize-share">20%</span>
                  </div>
                </div>
              </div>

              <div className="info-divider" />

              {/* Scoring */}
              <div className="info-banner-row">
                <span className="info-icon">📊</span>
                <div>
                  <strong>Scoring rules:</strong>
                  <ul className="scoring-list">
                    <li><strong>1 pt</strong> for each team you correctly predict advancing from the group stage (max 32 pts)</li>
                    <li><strong>2 pts</strong> per team you correctly predict reaching the Round of 16 (max 32 pts)</li>
                    <li><strong>4 pts</strong> per team you correctly predict reaching the Quarter-finals (max 32 pts)</li>
                    <li><strong>8 pts</strong> per team you correctly predict reaching the Semi-finals (max 32 pts)</li>
                    <li><strong>16 pts</strong> per finalist you correctly predict (max 32 pts)</li>
                    <li><strong>32 pts</strong> if you correctly predict the Champion (max 32 pts)</li>
                  </ul>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Maximum possible: 192 pts</span>
                </div>
              </div>

              <div className="info-divider" />

              {/* Deadline */}
              <div className="info-banner-row">
                <span className="info-icon">⏰</span>
                <span>
                  <strong>Registration deadline: Sunday June 14th at 5:00 pm CET.</strong>
                </span>
              </div>

              {/* How to submit */}
              <div className="info-banner-row">
                <span className="info-icon">📝</span>
                <span>
                  Click <em>"Enter Bracket"</em> (top right) to register your prediction and submit it.
                  Enter your <strong>full name</strong> when prompted — you'll need it to log back in.
                  Once submitted, your bracket is locked — contact Cristian if you need to make any changes.
                  Brackets (yours and everyone else's) will be visible once the competition starts on <strong>Thursday June 11th at 9:00 pm CET</strong>.
                </span>
              </div>

              {/* Payment */}
              <div className="info-banner-row">
                <span className="info-icon">💳</span>
                <span>
                  Pay <strong>5 CHF</strong> to Cristian Lafuerza via Twint or cash{' '}
                </span>
              </div>
            </div>

            <Leaderboard currentUser={user} onSelectUser={handleSelectUser} />
          </div>
        )}

        {view === 'bracket' && (
          <>
            <div className="editor-header">
              <div className="step-nav">
                {EDITOR_TABS.map((t, i) => {
                  const tabIndex = EDITOR_TABS.findIndex(x => x.id === editorTab);
                  const isDone = i < tabIndex;
                  const isActive = t.id === editorTab;
                  return (
                    <button
                      key={t.id}
                      className={`step-btn${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
                      onClick={() => setEditorTab(t.id)}
                    >
                      <span className="step-num">{isDone ? '✓' : t.step}</span>
                      <span className="step-label">{t.label}</span>
                    </button>
                  );
                })}
                <div className="step-divider" />
                {!isReadOnly && (
                  <button className="step-btn step-submit" onClick={() => setShowConfirm(true)}>
                    <span className="step-num">→</span>
                    <span className="step-label">Submit</span>
                  </button>
                )}
              </div>
              <div className="editor-user-label">
                {isReadOnly ? `Viewing: ${viewingUser?.name}` : user?.name}
                {!isReadOnly && user && (
                  <button
                    style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}
                    onClick={() => { setUser(null); setView('leaderboard'); }}
                  >
                    (switch)
                  </button>
                )}
              </div>
            </div>

            {editorTab === 'groups' && (
              <GroupStage 
                groupPredictions={groupPredictions} 
                onChange={handleGroupChange} 
                onRandom={randomizeGroups} 
                isReadOnly={isReadOnly}
              />
            )}
            {editorTab === 'third' && (
              <ThirdPlace
                groupPredictions={groupPredictions}
                thirdSelections={thirdSelections}
                onChange={handleThirdChange}
                onRandom={randomizeThird}
                isReadOnly={isReadOnly}
              />
            )}
            {editorTab === 'bracket' && (
              <KnockoutBracket
                groupPredictions={groupPredictions}
                thirdSelections={thirdSelections}
                knockoutPicks={knockoutPicks}
                onPick={handleKnockoutPick}
                onRandom={randomizeBracket}
                isReadOnly={isReadOnly}
              />
            )}
          </>
        )}

        {view === 'admin' && <Admin />}
      </main>

      {saveStatus !== 'idle' && view === 'bracket' && !isReadOnly && (
        <div className="save-bar">
          <span className={`save-status${saveStatus === 'saved' ? ' saved' : ''}`}>
            {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
          </span>
        </div>
      )}

      {showPicker && (
        <NamePicker onSelect={handlePickerSelect} onClose={() => setShowPicker(false)} />
      )}

      {showConfirm && !isReadOnly && (() => {
        const groupsDone = GROUP_NAMES.filter(g => {
          const p = groupPredictions[g];
          return p?.first && p?.second && p?.third && p?.fourth;
        }).length;
        const thirdDone = thirdSelections.length;
        const knockoutTotal = R32_MATCHES.length + R16_MATCHES.length + QF_MATCHES.length + SF_MATCHES.length + 1;
        const knockoutDone = Object.entries(knockoutPicks).filter(([k, v]) => v && k !== 'third').length;
        const missing = [];
        if (groupsDone < GROUP_NAMES.length) missing.push(`${GROUP_NAMES.length - groupsDone} group${GROUP_NAMES.length - groupsDone > 1 ? 's' : ''} not fully ranked`);
        if (thirdDone < 8) missing.push(`${8 - thirdDone} best 3rd-place team${8 - thirdDone > 1 ? 's' : ''} not selected`);
        if (knockoutDone < knockoutTotal) missing.push(`${knockoutTotal - knockoutDone} bracket pick${knockoutTotal - knockoutDone > 1 ? 's' : ''} missing`);
        const isComplete = missing.length === 0;
        return (
          <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{isComplete ? '🏆' : '⚠️'}</div>
              <div className="modal-title">{isComplete ? 'Submit your bracket?' : 'Bracket incomplete'}</div>
              {isComplete ? (
                <div className="modal-subtitle" style={{ marginBottom: 28 }}>
                  Your predictions will be saved and you'll be logged out.
                  To make changes afterwards, contact Cristian.
                </div>
              ) : (
                <div style={{ marginBottom: 28, textAlign: 'left' }}>
                  <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 12 }}>
                    Please complete your bracket before submitting:
                  </p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {missing.map(m => (
                      <li key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--red)' }}>
                        <span>✗</span><span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>
                  {isComplete ? 'Cancel' : 'Go back'}
                </button>
                {isComplete && (
                  <button className="btn btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={handleConfirmSubmit}>
                    Yes, submit!
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function clearDownstream(matchId, picks) {
  const roundOrder = [
    ['r32_m74','r32_m77','r32_m73','r32_m75','r32_m83','r32_m84','r32_m81','r32_m82',
     'r32_m76','r32_m78','r32_m79','r32_m80','r32_m86','r32_m88','r32_m85','r32_m87'],
    ['r16_m89','r16_m90','r16_m93','r16_m94','r16_m91','r16_m92','r16_m95','r16_m96'],
    ['qf_01','qf_02','qf_03','qf_04'],
    ['sf_01','sf_02'],
    ['final','third_place'],
  ];
  const changedRound = roundOrder.findIndex(r => r.includes(matchId));
  if (changedRound === -1) return picks;
  const next = { ...picks };
  for (let r = changedRound + 1; r < roundOrder.length; r++) {
    for (const id of roundOrder[r]) delete next[id];
  }
  return next;
}