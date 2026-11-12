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
  get: (id) => get(`/posts/${id}`),
  create: (fields) => post('/posts', fields),
  update: (id, fields) => patch(`/posts/${id}`, fields),
  delete: (id) => del(`/posts/${id}`),
  like: (id) => post(`/posts/${id}/like`),
  unlike: (id) => del(`/posts/${id}/like`),
  comments: (id) => get(`/posts/${id}/comments`),
  addComment: (id, content) => post(`/posts/${id}/comments`, { content }),
  deleteComment: (postId, commentId) => del(`/posts/${postId}/comments/${commentId}`),
  bookmark: (id) => post(`/posts/${id}/bookmark`),
  unbookmark: (id) => del(`/posts/${id}/bookmark`),
  bookmarks: (params) => get('/posts/bookmarks/all', params),
  uploadMedia: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/posts/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

export const usersApi = {
  search: (search) => get('/users', { search }),
  profile: (userId) => get(`/users/${userId}`),
  updateProfile: (fields) => patch('/users/me', fields),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

export const groupsApi = {
  list: (params) => get('/groups', params),
  get: (id) => get(`/groups/${id}`),
  create: (fields) => post('/groups', fields),
  update: (id, fields) => patch(`/groups/${id}`, fields),
  delete: (id) => del(`/groups/${id}`),
  join: (id) => post(`/groups/${id}/join`),
  leave: (id) => del(`/groups/${id}/leave`),
  members: (id) => get(`/groups/${id}/members`),
  updateMember: (groupId, userId, fields) => patch(`/groups/${groupId}/members/${userId}`, fields),
  removeMember: (groupId, userId) => del(`/groups/${groupId}/members/${userId}`),
  posts: (id, params) => get(`/groups/${id}/posts`, params),
  createPost: (id, fields) => post(`/groups/${id}/posts`, fields),
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
