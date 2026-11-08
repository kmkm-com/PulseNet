// Reusable SQL fragments. Table aliases are fixed: users u, user_profiles up.

// Public user fields shown in lists
export const USER_COLUMNS = 'u.user_id, u.username, up.full_name, up.avatar_url';
export const JOIN_PROFILE = 'LEFT JOIN user_profiles up ON up.user_id = u.user_id';

// Matches the single friendships row (alias f) for users a and b, in either
// direction. Written with LEAST/GREATEST so it uses the uq_friendship_pair index.
export const pairMatch = (a, b, f = 'f') => `
  LEAST(${f}.requester_id, ${f}.addressee_id)    = LEAST(${a}, ${b})
  AND GREATEST(${f}.requester_id, ${f}.addressee_id) = GREATEST(${a}, ${b})
`;
