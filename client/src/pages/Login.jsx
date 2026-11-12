import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client.js';
import Wordmark from '../components/Wordmark.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
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
        <h1 className="auth__title">Sign In</h1>
        <p className="auth__desc">
          Sign in to your PulseNet account to connect with friends and groups.
        </p>

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label className="field__label">Email Address</label>
            <input
              type="email"
              className="field__input"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@example.com"
            />
          </div>
          <div className="field">
            <label className="field__label">Password</label>
            <input
              type="password"
              className="field__input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>
          {error && <p className="form__error" role="alert">{error}</p>}
          <button type="submit" className="button button--primary button--wide" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth__switch">
          Don't have an account? <Link to="/register" className="strong-link">Create an account</Link>
        </p>
        <div className="auth__demo-box">
          <span className="auth__demo-label">Demo Credentials:</span>
          <code>alice@example.com</code> / <code>password123</code>
        </div>
      </div>
    </div>
  );
}
