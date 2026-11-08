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
      <div className="auth__panel">
        <Wordmark large />
        <h1 className="auth__title">Create your account</h1>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">Full name</span>
            <input autoComplete="name" required value={fields.full_name} onChange={update('full_name')} />
          </label>
          <label className="field">
            <span className="field__label">Username</span>
            <input autoComplete="username" required maxLength={50} pattern="[A-Za-z0-9_.]+"
              title="Letters, numbers, dots and underscores"
              value={fields.username} onChange={update('username')} />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input type="email" autoComplete="email" required value={fields.email} onChange={update('email')} />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input type="password" autoComplete="new-password" required minLength={8}
              value={fields.password} onChange={update('password')} />
            <span className="field__help">At least 8 characters</span>
          </label>
          {error && <p className="form__error" role="alert">{error}</p>}
          <button className="button button--primary button--wide" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth__switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
