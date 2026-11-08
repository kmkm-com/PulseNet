import api from './client.js';

// Thin wrappers around the REST API. Each returns the response body.
const get = (url, params) => api.get(url, { params }).then((r) => r.data);
const post = (url, body) => api.post(url, body).then((r) => r.data);
const patch = (url, body) => api.patch(url, body).then((r) => r.data);
const del = (url) => api.delete(url).then((r) => r.data);

export const authApi = {
  login: (email, password) => post('/auth/login', { email, password }),
  register: (fields) => post('/auth/register', fields),
  me: () => get('/auth/me'),
};

export const postsApi = {
  feed: (params) => get('/posts/feed', params),
};

export const usersApi = {
  search: (search) => get('/users', { search }),
  profile: (userId) => get(`/users/${userId}`),
};

export const friendsApi = {
  list: () => get('/friends'),
  suggestions: () => get('/friends/suggestions'),
  requests: (direction) => get('/friends/requests', { direction }),
  send: (userId) => post(`/friends/requests/${userId}`),
  respond: (userId, action) => patch(`/friends/requests/${userId}`, { action }),
  remove: (userId) => del(`/friends/${userId}`),
};

export const messagesApi = {
  inbox: () => get('/messages'),
  unreadCount: () => get('/messages/unread-count'),
  conversation: (userId, params) => get(`/messages/${userId}`, params),
  send: (userId, content) => post(`/messages/${userId}`, { content }),
  markRead: (userId) => patch(`/messages/${userId}/read`),
};

export const notificationsApi = {
  list: (params) => get('/notifications', params),
  unreadCount: () => get('/notifications/unread-count'),
  markRead: (id) => patch(`/notifications/${id}/read`),
  markAllRead: () => patch('/notifications/read-all'),
  remove: (id) => del(`/notifications/${id}`),
};
