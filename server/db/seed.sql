-- =============================================================
-- PulseNet Seed Data
-- DBMS Course Project | PERN / Supabase PostgreSQL Stack
-- =============================================================
-- Run AFTER schema.sql:
--   psql -U <user> -d pulsenet_db -f seed.sql
--
-- NOTE: Passwords below are bcrypt hashes of 'password123'
--       for all test accounts.
-- =============================================================

-- Drop existing test data and reset serial identity counters
TRUNCATE TABLE
    direct_messages,
    notifications,
    group_members,
    groups,
    comments,
    saved_posts,
    post_likes,
    post_media,
    posts,
    friendships,
    user_profiles,
    users
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------
-- 1. USERS  (bcrypt hash of "password123", cost=10)
-- -----------------------------------------------------------
INSERT INTO users (username, email, password_hash, account_status) VALUES
    ('testuser', 'testuser@example.com', '$2b$10$Jo6wbIdEYSOK2uwoFTfiDOVI2h3UBwsPGu2uRd8pVxBmnDXOYP9TS', 'active'),
    ('bob',     'bob@example.com',     '$2b$10$Jo6wbIdEYSOK2uwoFTfiDOVI2h3UBwsPGu2uRd8pVxBmnDXOYP9TS', 'active'),
    ('charlie', 'charlie@example.com', '$2b$10$Jo6wbIdEYSOK2uwoFTfiDOVI2h3UBwsPGu2uRd8pVxBmnDXOYP9TS', 'active'),
    ('diana',   'diana@example.com',   '$2b$10$Jo6wbIdEYSOK2uwoFTfiDOVI2h3UBwsPGu2uRd8pVxBmnDXOYP9TS', 'active'),
    ('evan',    'evan@example.com',    '$2b$10$Jo6wbIdEYSOK2uwoFTfiDOVI2h3UBwsPGu2uRd8pVxBmnDXOYP9TS', 'active');

-- -----------------------------------------------------------
-- 2. USER_PROFILES
-- -----------------------------------------------------------
INSERT INTO user_profiles (user_id, full_name, bio, location, website_url, avatar_url) VALUES
    (1, 'Test User',   'Computer Science student & DBMS researcher 🚀', 'Hyderabad, India', 'https://github.com/testuser', 'https://i.pravatar.cc/150?img=1'),
    (2, 'Bob Mehta',      'Building cool things one commit at a time 🚀',        'Mumbai, India',    'https://github.com/bob',     'https://i.pravatar.cc/150?img=2'),
    (3, 'Charlie Verma',  'DBMS nerd | Love SQL and distributed systems 🗄️',   'Bangalore, India', 'https://github.com/charlie', 'https://i.pravatar.cc/150?img=3'),
    (4, 'Diana Kapoor',   'UI/UX designer & React developer 🎨',                'Pune, India',      'https://github.com/diana',   'https://i.pravatar.cc/150?img=4'),
    (5, 'Evan Nair',      'Fullstack dev | Open source contributor 🌐',          'Chennai, India',   'https://github.com/evan',    'https://i.pravatar.cc/150?img=5');

-- -----------------------------------------------------------
-- 3. FRIENDSHIPS
--    responded_at must be set for accepted/declined rows and NULL for pending
-- -----------------------------------------------------------
INSERT INTO friendships (requester_id, addressee_id, status, responded_at) VALUES
    (1, 2, 'accepted', NOW()),   -- Alice & Bob are friends
    (1, 3, 'accepted', NOW()),   -- Alice & Charlie are friends
    (2, 4, 'pending',  NULL),    -- Bob sent request to Diana
    (4, 5, 'accepted', NOW()),   -- Diana & Evan are friends
    (3, 5, 'declined', NOW());   -- Charlie's request to Evan was declined

-- -----------------------------------------------------------
-- 4. GROUPS
-- -----------------------------------------------------------
INSERT INTO groups (name, description, creator_id, visibility) VALUES
    ('DBMS Study Group', 'A group for students studying Database Management Systems.', 3, 'public'),
    ('React Devs',       'Frontend developers who love React and modern JS tooling.', 4, 'public'),
    ('Open Source Club', 'We contribute to open source projects every week!',         5, 'public');

-- -----------------------------------------------------------
-- 5. GROUP_MEMBERS
--    Trigger trg_groups_creator_admin automatically adds creator as admin.
--    ON CONFLICT handles creator re-specification gracefully.
-- -----------------------------------------------------------
INSERT INTO group_members (group_id, user_id, role, status) VALUES
    (1, 3, 'admin',  'active'),
    (1, 1, 'member', 'active'),
    (1, 2, 'member', 'active'),
    (2, 4, 'admin',  'active'),
    (2, 1, 'member', 'active'),
    (3, 5, 'admin',  'active'),
    (3, 2, 'member', 'active')
ON CONFLICT (group_id, user_id)
DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- -----------------------------------------------------------
-- 6. POSTS
-- -----------------------------------------------------------
INSERT INTO posts (author_id, group_id, content, privacy_level) VALUES
    (1, NULL, 'Just finished my DBMS project! Feeling proud 🎉 #PulseNet #DBMS',                  'public'),
    (2, NULL, 'PostgreSQL is amazing once you understand JOINs. Trust the process 💪',              'public'),
    (3, 1,    'Reading about normalisation forms today. 1NF → 2NF → 3NF → BCNF 📚',               'public'),
    (4, 2,    'Designed the new UI for our college project. React + Vite is so fast! ⚡',          'friends_only'),
    (5, 3,    'Open source contribution of the day: fixed a bug in a popular npm package 🐛✅',   'public'),
    (1, NULL, 'Late night coding session with coffee. The best kind of session ☕💻',               'friends_only');

-- -----------------------------------------------------------
-- 7. POST_MEDIA
-- -----------------------------------------------------------
INSERT INTO post_media (post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes) VALUES
    (1, 'post-media', 'posts/1/celebration.jpg',     'image', 'image/jpeg', 2458120),
    (4, 'post-media', 'posts/4/react_ui_preview.png', 'image', 'image/png',  1184920),
    (5, 'post-media', 'posts/5/demo_screencast.mp4',  'video', 'video/mp4',  15482390);

-- -----------------------------------------------------------
-- 8. POST_LIKES
-- -----------------------------------------------------------
INSERT INTO post_likes (user_id, post_id) VALUES
    (2, 1),
    (3, 1),
    (1, 2),
    (4, 3),
    (5, 2),
    (1, 5);

-- -----------------------------------------------------------
-- 9. SAVED_POSTS
-- -----------------------------------------------------------
INSERT INTO saved_posts (user_id, post_id) VALUES
    (1, 3),
    (2, 1),
    (3, 2),
    (4, 5);

-- -----------------------------------------------------------
-- 10. COMMENTS
-- -----------------------------------------------------------
INSERT INTO comments (post_id, author_id, content) VALUES
    (1, 2, 'Congrats Alice! Our project is looking great 🔥'),
    (1, 3, 'What database did you use? PostgreSQL is the best!'),
    (2, 1, 'Totally agree! JOINs are the heart of SQL.'),
    (3, 2, 'Don''t forget DKNF 😄'),
    (5, 4, 'That''s awesome Evan! Which package was it?');

-- -----------------------------------------------------------
-- 11. NOTIFICATIONS
--    Generated automatically by triggers on friendships, post_likes,
--    comments, and direct messages.
-- -----------------------------------------------------------
UPDATE notifications SET is_read = TRUE WHERE notification_type = 'post_like';

-- -----------------------------------------------------------
-- 12. DIRECT_MESSAGES
-- -----------------------------------------------------------
INSERT INTO direct_messages (sender_id, recipient_id, content, sent_at, read_at) VALUES
    (1, 2, 'Hey Bob! Are you free to review the database schema PR?', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 minutes'),
    (2, 1, 'Sure Alice, looking at it right now! Tables look clean.',  NOW() - INTERVAL '1 hour 45 minutes', NOW() - INTERVAL '1 hour 40 minutes'),
    (3, 4, 'Hey Diana, loved your new React UI mockup!',              NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '15 minutes'),
    (4, 3, 'Thanks Charlie! Working on the feed components next.',    NOW() - INTERVAL '10 minutes', NULL),
    (5, 1, 'Hey Alice, do you need help with the connection pool?',   NOW() - INTERVAL '5 minutes',  NULL);
