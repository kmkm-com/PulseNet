import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TOKEN_KEY } from '../api/client.js';
import { authApi } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' until we know whether a saved token is still valid
  const [status, setStatus] = useState(() => (localStorage.getItem(TOKEN_KEY) ? 'loading' : 'anonymous'));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
      setStatus('authenticated');
    } catch {
      logout();
    }
  }, [logout]);

  // Restore session on first load
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) loadMe();
  }, [loadMe]);

  // The axios interceptor fires this when the server rejects the token
  useEffect(() => {
    window.addEventListener('pulsenet:logout', logout);
    return () => window.removeEventListener('pulsenet:logout', logout);
  }, [logout]);

  const login = async (email, password) => {
    const { token } = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    await loadMe();
  };

  const register = async (fields) => {
    await authApi.register(fields);
    await login(fields.email, fields.password);
  };

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
