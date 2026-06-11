import { useState } from 'react';
import { loginUser } from '../api';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const user = await loginUser(name.trim(), email.trim().toLowerCase());
      onLogin(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Connection error — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 16 }}>⚽</div>
      <h1 className="login-title">World Cup 2026</h1>
      <p className="login-subtitle">Fill in your bracket predictions and compete with friends.</p>
      <form onSubmit={submit}>
        <div className="field">
          <label>Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nicolas" autoFocus />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading || !name.trim() || !email.trim()}>
          {loading ? 'Loading…' : 'Enter Predictions →'}
        </button>
      </form>
    </div>
  );
}
