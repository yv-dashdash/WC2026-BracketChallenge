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

  const [adminMode, setAdminMode] = useState({
    r32: 'live', r16: 'live', qf: 'live', sf: 'live', final: 'live', champion: 'live'
  });

  function askConfirm(message, onConfirm) { setConfirmDialog({ message, onConfirm }); }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      await getActualResults(pwInput);
      setAuthed(true);
      setPwError('');
    } catch { setPwError('Incorrect password.'); }
  }

  // CORRECTED: Fully handles array parsing to prevent empty checkboxes
  const loadData = async () => {
    try {
      const data = await getActualResults(pwInput);
      setSavedResults(data);
      
      const init = {};
      STAGE_CONFIG.forEach(stage => {
        const mode = adminMode[stage.key] || 'live';
        const lookupKey = mode === 'live' ? `live_${stage.key}` : stage.key;
        const val = data[lookupKey];
        
        let teamsArray = [];
        if (val && val.teams) {
          teamsArray = Array.isArray(val.teams) ? val.teams : [val.teams];
        }
        init[stage.key] = new Set(teamsArray);
      });
      setSelections(init);
    } catch (e) { console.error("Failed to load admin data", e); }
  };

  useEffect(() => {
    if (authed) {
      loadData();
      getUsers().then(setParticipants).catch(() => {});
    }
  }, [authed]);

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

  // CORRECTED: Sends clean array representation
  async function handleSave(stageKey, required, isLiveSave) {
    const sel = selections[stageKey] || new Set();
    
    if (!isLiveSave && sel.size !== required) {
      alert(`Cannot lock official results. You must select exactly ${required} teams.`);
      return;
    }

    const targetKey = isLiveSave ? `live_${stageKey}` : stageKey;
    setSaveStatus(prev => ({ ...prev, [targetKey]: 'saving' }));

    try {
      const teamsArray = Array.from(sel);
      await saveActualResults(pwInput, targetKey, teamsArray);
      
      setSavedResults(prev => ({
        ...prev,
        [targetKey]: { teams: teamsArray, updated_at: new Date().toISOString() }
      }));
      
      setSaveStatus(prev => ({ ...prev, [targetKey]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [targetKey]: '' })), 2500);
    } catch (err) {
      console.error(err);
      setSaveStatus(prev => ({ ...prev, [targetKey]: 'error' }));
    }
  }

  // ... (Rest of component functions: setUserStatus, handleClearBracket, handleDeleteUser, handleViewBracket remain same)
  // [Truncated for brevity, maintain your original logic for these helper functions]

  if (!authed) { /* ... render login ... */ }

  return (
    <div>
      <div className="section-title">Admin Panel <span className="badge" style={{ background: 'var(--red)', color: '#fff' }}>Admin</span></div>
      {/* ... render participants, rules, and stages ... */}
    </div>
  );
}