import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client.js';
import Wordmark from '../components/Wordmark.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ full_name: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setFields({ ...fields, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(fields);
      navigate('/friends', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <Wordmark large />
        </div>
        <h1 className="auth__title">Create Account</h1>
        <p className="auth__desc">
          Join PulseNet to connect with friends, share posts, and join groups.
        </p>

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label className="field__label">Full Name</label>
            <input
              type="text"
              className="field__input"
              autoComplete="name"
              required
              placeholder="e.g. Alice Sharma"
              value={fields.full_name}
              onChange={update('full_name')}
            />
          </div>
          <div className="field">
            <label className="field__label">Username</label>
            <input
              type="text"
              className="field__input"
              autoComplete="username"
              required
              maxLength={50}
              pattern="[A-Za-z0-9_.]+"
              title="Letters, numbers, dots and underscores"
              placeholder="e.g. alicesharma"
              value={fields.username}
              onChange={update('username')}
            />
          </div>
          <div className="field">
            <label className="field__label">Email Address</label>
            <input
              type="email"
              className="field__input"
              autoComplete="email"
              required
              placeholder="e.g. alice@example.com"
              value={fields.email}
              onChange={update('email')}
            />
          </div>
          <div className="field">
            <label className="field__label">Password</label>
            <input
              type="password"
              className="field__input"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={fields.password}
              onChange={update('password')}
            />
            <span className="field__help">Must be at least 8 characters long</span>
          </div>
          {error && <p className="form__error" role="alert">{error}</p>}
          <button type="submit" className="button button--primary button--wide" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="auth__switch">
          Already have an account? <Link to="/login" className="strong-link">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
