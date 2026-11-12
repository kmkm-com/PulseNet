-- =============================================================
-- Migration 003: Row Level Security (RLS) Configuration
-- =============================================================
-- Express backend acts as the sole trusted client. Direct access
-- by anonymous or Supabase-authenticated clients is blocked.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Note: In PostgreSQL/Supabase, enabling RLS without granting policies
-- to 'anon' and 'authenticated' roles completely blocks direct client calls
-- (PostgREST / Supabase JS client) while allowing the database owner / superuser
-- / service_role / postgres connection used by Express to perform authorized operations.
