import axios from 'axios';

export const TOKEN_KEY = 'pulsenet_token';

// Fired after any successful write (POST/PATCH/DELETE). Unread counts listen
// for it, so pages never need to know which actions change which badge.
export const CHANGED_EVENT = 'pulsenet:changed';
export const LOGOUT_EVENT = 'pulsenet:logout';

// One axios instance for the whole app. Vite proxies /api to the server.
const api = axios.create({ baseURL: '/api' });

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.config.method !== 'get') window.dispatchEvent(new Event(CHANGED_EVENT));
    return res;
  },
  (err) => {
    // Expired or invalid token: let AuthContext log out
    if (err.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      window.dispatchEvent(new Event(LOGOUT_EVENT));
    }
    return Promise.reject(err);
  }
);

// Server errors look like { error: "..." }; fall back to a generic message
export const errorMessage = (err) =>
  err.response?.data?.error || 'Could not reach the server. Check that it is running.';

export default api;
