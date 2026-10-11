-- =============================================================
-- PulseNet Seed Data
-- DBMS Course Project | PERN Stack
-- =============================================================
-- Run AFTER schema.sql:
--   psql -U <user> -d pulsenet_db -f seed.sql
--
-- NOTE: Passwords below are bcrypt hashes of 'password123'
--       for all test accounts.
-- =============================================================

-- Drop any existing test data and reset serial identity counters
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
INSERT INTO users (username, email, password_hash) VALUES
    ('alice',   'alice@example.com',   '$2b$10$KIXiWfBVP.q7rRl0zjEgXOx3JGF7ND5sW6sF9TZFQM6mB0C8Vq7vy'),
    ('bob',     'bob@example.com',     '$2b$10$KIXiWfBVP.q7rRl0zjEgXOx3JGF7ND5sW6sF9TZFQM6mB0C8Vq7vy'),
    ('charlie', 'charlie@example.com', '$2b$10$KIXiWfBVP.q7rRl0zjEgXOx3JGF7ND5sW6sF9TZFQM6mB0C8Vq7vy'),
    ('diana',   'diana@example.com',   '$2b$10$KIXiWfBVP.q7rRl0zjEgXOx3JGF7ND5sW6sF9TZFQM6mB0C8Vq7vy'),
    ('evan',    'evan@example.com',    '$2b$10$KIXiWfBVP.q7rRl0zjEgXOx3JGF7ND5sW6sF9TZFQM6mB0C8Vq7vy');

-- -----------------------------------------------------------
-- 2. USER_PROFILES
-- -----------------------------------------------------------
INSERT INTO user_profiles (user_id, full_name, bio, location, avatar_url) VALUES
    (1, 'Alice Sharma',   'Computer Science student. Coffee enthusiast ☕',       'Delhi, India',   'https://i.pravatar.cc/150?img=1'),
    (2, 'Bob Mehta',      'Building cool things one commit at a time 🚀',          'Mumbai, India',  'https://i.pravatar.cc/150?img=2'),
    (3, 'Charlie Verma',  'DBMS nerd | Love SQL and distributed systems 🗄️',     'Bangalore, India','https://i.pravatar.cc/150?img=3'),
    (4, 'Diana Kapoor',   'UI/UX designer & React developer 🎨',                  'Pune, India',    'https://i.pravatar.cc/150?img=4'),
    (5, 'Evan Nair',      'Fullstack dev | Open source contributor 🌐',            'Chennai, India', 'https://i.pravatar.cc/150?img=5');

-- -----------------------------------------------------------
-- 3. FRIENDSHIPS
-- -----------------------------------------------------------
INSERT INTO friendships (requester_id, addressee_id, status) VALUES
    (1, 2, 'accepted'),   -- Alice & Bob are friends
    (1, 3, 'accepted'),   -- Alice & Charlie are friends
    (2, 4, 'pending'),    -- Bob sent request to Diana
    (4, 5, 'accepted'),   -- Diana & Evan are friends
    (3, 5, 'declined');   -- Charlie's request to Evan was declined

-- -----------------------------------------------------------
-- 4. POSTS
-- -----------------------------------------------------------
INSERT INTO posts (author_id, content, privacy_level) VALUES
    (1, 'Just finished my DBMS project! Feeling proud 🎉 #PulseNet #DBMS',                    'public'),
    (2, 'PostgreSQL is amazing once you understand JOINs. Trust the process 💪',                'public'),
    (3, 'Reading about normalisation forms today. 1NF → 2NF → 3NF → BCNF 📚',                 'public'),
    (4, 'Designed the new UI for our college project. React + Vite is so fast! ⚡',            'friends_only'),
    (5, 'Open source contribution of the day: fixed a bug in a popular npm package 🐛✅',     'public'),
    (1, 'Late night coding session with coffee. The best kind of session ☕💻',                 'friends_only');

-- -----------------------------------------------------------
-- 5. POST_MEDIA
-- -----------------------------------------------------------
INSERT INTO post_media (post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes) VALUES
    (1, 'post-media', 'posts/1/celebration.jpg',       'image', 'image/jpeg', 2458120),
    (4, 'post-media', 'posts/4/react_ui_preview.png',   'image', 'image/png',  1184920),
    (5, 'post-media', 'posts/5/demo_screencast.mp4',    'video', 'video/mp4',  15482390);

-- -----------------------------------------------------------
-- 6. POST_LIKES
-- -----------------------------------------------------------
INSERT INTO post_likes (user_id, post_id) VALUES
    (2, 1),   -- Bob liked Alice's post
    (3, 1),   -- Charlie liked Alice's post
    (1, 2),   -- Alice liked Bob's post
    (4, 3),   -- Diana liked Charlie's post
    (5, 2),   -- Evan liked Bob's post
    (1, 5);   -- Alice liked Evan's post

-- -----------------------------------------------------------
-- 7. SAVED_POSTS
-- -----------------------------------------------------------
INSERT INTO saved_posts (user_id, post_id) VALUES
    (1, 3),   -- Alice saved Charlie's normalisation post
    (2, 1),   -- Bob saved Alice's project announcement
    (3, 2),   -- Charlie saved Bob's SQL JOINs post
    (4, 5);   -- Diana saved Evan's open source post

-- -----------------------------------------------------------
-- 8. COMMENTS
-- -----------------------------------------------------------
INSERT INTO comments (post_id, author_id, content) VALUES
    (1, 2, 'Congrats Alice! Our project is looking great 🔥'),
    (1, 3, 'What database did you use? PostgreSQL is the best!'),
    (2, 1, 'Totally agree! JOINs are the heart of SQL.'),
    (3, 2, 'Don''t forget DKNF 😄'),
    (5, 4, 'That''s awesome Evan! Which package was it?');

-- -----------------------------------------------------------
-- 9. GROUPS
-- -----------------------------------------------------------
INSERT INTO groups (name, description, creator_id) VALUES
    ('DBMS Study Group',  'A group for students studying Database Management Systems.', 3),
    ('React Devs',        'Frontend developers who love React and modern JS tooling.',  4),
    ('Open Source Club',  'We contribute to open source projects every week!',          5);

-- -----------------------------------------------------------
-- 10. GROUP_MEMBERS
-- -----------------------------------------------------------
INSERT INTO group_members (group_id, user_id, role) VALUES
    (1, 3, 'admin'),    -- Charlie created group 1
    (1, 1, 'member'),   -- Alice joined DBMS group
    (1, 2, 'member'),   -- Bob joined DBMS group
    (2, 4, 'admin'),    -- Diana created group 2
    (2, 1, 'member'),   -- Alice in React Devs
    (3, 5, 'admin'),    -- Evan created group 3
    (3, 2, 'member');   -- Bob in Open Source Club

-- -----------------------------------------------------------
-- 11. NOTIFICATIONS
-- -----------------------------------------------------------
INSERT INTO notifications (recipient_id, type, is_read) VALUES
    (1, 'friend_request', FALSE),   -- Alice got a friend request
    (2, 'post_like',      TRUE),    -- Bob's post was liked (read)
    (3, 'comment',        FALSE),   -- Charlie got a comment notification
    (4, 'friend_request', FALSE),   -- Diana got a request from Bob
    (5, 'post_like',      TRUE);    -- Evan's post was liked

-- -----------------------------------------------------------
-- 12. DIRECT_MESSAGES
-- -----------------------------------------------------------
INSERT INTO direct_messages (sender_id, recipient_id, content, sent_at, read_at) VALUES
    (1, 2, 'Hey Bob! Are you free to review the database schema PR?', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 minutes'),
    (2, 1, 'Sure Alice, looking at it right now! Tables look clean.',  NOW() - INTERVAL '1 hour 45 minutes', NOW() - INTERVAL '1 hour 40 minutes'),
    (3, 4, 'Hey Diana, loved your new React UI mockup!',              NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '15 minutes'),
    (4, 3, 'Thanks Charlie! Working on the feed components next.',    NOW() - INTERVAL '10 minutes', NULL),
    (5, 1, 'Hey Alice, do you need help with the connection pool?',   NOW() - INTERVAL '5 minutes',  NULL);
