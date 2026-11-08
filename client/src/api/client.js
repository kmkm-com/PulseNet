import axios from 'axios';

export const TOKEN_KEY = 'pulsenet_token';

// One axios instance for the whole app. Vite proxies /api to the server.
const api = axios.create({ baseURL: '/api' });

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired or invalid token: clear it and let AuthContext send the user to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('pulsenet:logout'));
    }
    return Promise.reject(err);
  }
);

// Server errors look like { error: "..." }; fall back to a generic message
export const errorMessage = (err) =>
  err.response?.data?.error || 'Could not reach the server. Check that it is running.';

export default api;
