import { useState } from 'react';
import { loginUser } from '../api';

export default function NamePicker({ onSelect, onClose }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    setLoading(true);
    setError('');
    try {
      const user = await loginUser(n);
      onSelect(user);
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Enter your name</div>
        <div className="modal-subtitle">
          Type your name exactly as you registered to continue editing your bracket.
        </div>

        <div className="name-input-row">
          <input
            type="text"
            placeholder="Your name…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
          />
          <button className="btn-go" disabled={!name.trim() || loading} onClick={submit}>
            {loading ? '…' : 'Go'}
          </button>
        </div>

        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      </div>
    </div>
  );
}
