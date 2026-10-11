-- =============================================================
-- PulseNet Database Schema
-- DBMS Course Project | PERN Stack
-- =============================================================
-- Run this file to initialise the database:
--   psql -U <user> -d pulsenet_db -f schema.sql
-- =============================================================

-- Drop tables in reverse dependency order so we can re-run cleanly
DROP TABLE IF EXISTS direct_messages CASCADE;
DROP TABLE IF EXISTS notifications   CASCADE;
DROP TABLE IF EXISTS group_members   CASCADE;
DROP TABLE IF EXISTS groups          CASCADE;
DROP TABLE IF EXISTS comments        CASCADE;
DROP TABLE IF EXISTS saved_posts     CASCADE;
DROP TABLE IF EXISTS post_likes      CASCADE;
DROP TABLE IF EXISTS post_media      CASCADE;
DROP TABLE IF EXISTS posts           CASCADE;
DROP TABLE IF EXISTS friendships     CASCADE;
DROP TABLE IF EXISTS user_profiles   CASCADE;
DROP TABLE IF EXISTS users           CASCADE;

-- -----------------------------------------------------------
-- 1. USERS
--    Core authentication table. Passwords are stored as bcrypt
--    hashes – never plain text.
-- -----------------------------------------------------------
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT         NOT NULL,
    created_at    TIMESTAMP    DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 2. USER_PROFILES
--    One-to-one extension of users (user_id is UNIQUE here).
--    Created automatically when a user registers.
-- -----------------------------------------------------------
CREATE TABLE user_profiles (
    profile_id  SERIAL PRIMARY KEY,
    user_id     INT UNIQUE  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name   VARCHAR(100),
    bio         TEXT,
    location    VARCHAR(100),
    avatar_url  TEXT
);

-- -----------------------------------------------------------
-- 3. FRIENDSHIPS
--    Composite PK prevents duplicate friendship requests.
--    status can be: 'pending', 'accepted', or 'declined'.
-- -----------------------------------------------------------
CREATE TABLE friendships (
    requester_id INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    addressee_id INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at   TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (requester_id, addressee_id)
);

-- -----------------------------------------------------------
-- 4. POSTS
--    privacy_level controls who can see the post.
-- -----------------------------------------------------------
CREATE TABLE posts (
    post_id       SERIAL PRIMARY KEY,
    author_id     INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    privacy_level VARCHAR(15) NOT NULL DEFAULT 'public'
                      CHECK (privacy_level IN ('public', 'friends_only', 'private')),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 5. POST_MEDIA
--    One-to-many relation for images/videos attached to posts.
--    Actual binary files live in object storage (e.g. Supabase Storage).
-- -----------------------------------------------------------
CREATE TABLE post_media (
    media_id        SERIAL PRIMARY KEY,
    post_id         INT          NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    storage_bucket  VARCHAR(100) NOT NULL,
    storage_path    TEXT         NOT NULL,
    media_type      VARCHAR(20)  NOT NULL CHECK (media_type IN ('image', 'video')),
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT       NOT NULL CHECK (file_size_bytes > 0),
    created_at      TIMESTAMP    DEFAULT NOW(),
    CONSTRAINT uq_post_media_bucket_path UNIQUE (storage_bucket, storage_path),
    CONSTRAINT chk_post_media_mime CHECK (
        (media_type = 'image' AND mime_type LIKE 'image/%') OR
        (media_type = 'video' AND mime_type LIKE 'video/%')
    )
);

-- -----------------------------------------------------------
-- 6. POST_LIKES
--    Composite PK ensures a user can only like a post once.
-- -----------------------------------------------------------
CREATE TABLE post_likes (
    user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id    INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- -----------------------------------------------------------
-- 7. SAVED_POSTS
--    Associative relation for bookmarking posts.
-- -----------------------------------------------------------
CREATE TABLE saved_posts (
    user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id    INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    saved_at   TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- -----------------------------------------------------------
-- 8. COMMENTS
--    Each comment belongs to a post and has an author.
-- -----------------------------------------------------------
CREATE TABLE comments (
    comment_id SERIAL PRIMARY KEY,
    post_id    INT  NOT NULL REFERENCES posts(post_id)  ON DELETE CASCADE,
    author_id  INT  NOT NULL REFERENCES users(user_id)  ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 9. GROUPS
--    creator_id is the user who created the group (admin by default).
-- -----------------------------------------------------------
CREATE TABLE groups (
    group_id    SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    creator_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 10. GROUP_MEMBERS
--    Composite PK prevents duplicate memberships.
--    role: 'admin' or 'member'.
-- -----------------------------------------------------------
CREATE TABLE group_members (
    group_id  INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id   INT NOT NULL REFERENCES users(user_id)   ON DELETE CASCADE,
    role      VARCHAR(10) NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- -----------------------------------------------------------
-- 11. NOTIFICATIONS
--    recipient_id = user who should see the notification.
--    type examples: 'friend_request', 'post_like', 'comment'
-- -----------------------------------------------------------
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    recipient_id    INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    is_read         BOOLEAN   DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 12. DIRECT_MESSAGES
--    One-to-one direct messages between two distinct users.
--    read_at tracks read receipts and cannot precede sent_at.
-- -----------------------------------------------------------
CREATE TABLE direct_messages (
    message_id   SERIAL PRIMARY KEY,
    sender_id    INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    recipient_id INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content      TEXT NOT NULL CHECK (length(trim(content)) > 0),
    sent_at      TIMESTAMP DEFAULT NOW(),
    read_at      TIMESTAMP NULL,
    CONSTRAINT chk_dm_distinct_users CHECK (sender_id <> recipient_id),
    CONSTRAINT chk_dm_read_after_sent CHECK (read_at IS NULL OR read_at >= sent_at)
);

-- -----------------------------------------------------------
-- Indexes for commonly queried foreign keys (performance)
-- -----------------------------------------------------------
CREATE INDEX idx_posts_author       ON posts(author_id);
CREATE INDEX idx_post_media_post    ON post_media(post_id);
CREATE INDEX idx_post_likes_post    ON post_likes(post_id);
CREATE INDEX idx_saved_posts_post   ON saved_posts(post_id);
CREATE INDEX idx_comments_post      ON comments(post_id);
CREATE INDEX idx_notifications_rec  ON notifications(recipient_id);
CREATE INDEX idx_friendships_addr   ON friendships(addressee_id);
CREATE INDEX idx_dm_sender          ON direct_messages(sender_id);
CREATE INDEX idx_dm_recipient       ON direct_messages(recipient_id);
CREATE INDEX idx_dm_conversation    ON direct_messages(sender_id, recipient_id, sent_at DESC);
