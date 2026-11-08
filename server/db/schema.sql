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
    created_at    TIMESTAMPTZ    DEFAULT NOW()
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
--    responded_at is set exactly when the request leaves 'pending'.
--    uq_friendship_pair (below) stops the reverse duplicate:
--    if A->B exists, B->A cannot be inserted.
-- -----------------------------------------------------------
CREATE TABLE friendships (
    requester_id INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    addressee_id INT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ NULL,
    PRIMARY KEY (requester_id, addressee_id),
    CONSTRAINT chk_friend_not_self
        CHECK (requester_id <> addressee_id),
    CONSTRAINT chk_friend_responded_iff_not_pending
        CHECK ((status = 'pending') = (responded_at IS NULL)),
    CONSTRAINT chk_friend_responded_after_created
        CHECK (responded_at IS NULL OR responded_at >= created_at)
);

CREATE UNIQUE INDEX uq_friendship_pair
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

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
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ DEFAULT NULL
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
    created_at      TIMESTAMPTZ    DEFAULT NOW(),
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- -----------------------------------------------------------
-- 7. SAVED_POSTS
--    Associative relation for bookmarking posts.
-- -----------------------------------------------------------
CREATE TABLE saved_posts (
    user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id    INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    saved_at   TIMESTAMPTZ DEFAULT NOW(),
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
    created_at TIMESTAMPTZ DEFAULT NOW()
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
    created_at  TIMESTAMPTZ DEFAULT NOW()
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
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- -----------------------------------------------------------
-- 11. NOTIFICATIONS
--    recipient_id = user who should see the notification.
--    actor_id     = user whose action caused it (NULL for system alerts).
--    related_post_id / related_group_id point at what it is about.
--    Rows are created by the triggers at the bottom of this file,
--    not by application code. Add new types to the CHECK list.
-- -----------------------------------------------------------
CREATE TABLE notifications (
    notification_id   SERIAL PRIMARY KEY,
    recipient_id      INT  NOT NULL REFERENCES users(user_id)   ON DELETE CASCADE,
    actor_id          INT  NULL     REFERENCES users(user_id)   ON DELETE CASCADE,
    notification_type VARCHAR(30) NOT NULL
                          CHECK (notification_type IN (
                              'friend_request', 'friend_accepted',
                              'post_like', 'post_comment',
                              'direct_message')),
    related_post_id   INT  NULL     REFERENCES posts(post_id)   ON DELETE CASCADE,
    related_group_id  INT  NULL     REFERENCES groups(group_id) ON DELETE CASCADE,
    is_read           BOOLEAN   NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_not_self
        CHECK (actor_id IS NULL OR actor_id <> recipient_id)
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
    sent_at      TIMESTAMPTZ DEFAULT NOW(),
    read_at      TIMESTAMPTZ NULL,
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
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_friendships_addr   ON friendships(addressee_id);

-- Notifications: list newest first; unread badge / mark-all-read (partial);
-- trigger clean-up by actor/post and FK cascades
CREATE INDEX idx_notifications_rec    ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, actor_id, notification_type)
    WHERE is_read = FALSE;
CREATE INDEX idx_notifications_post   ON notifications(related_post_id);
CREATE INDEX idx_notifications_actor  ON notifications(actor_id);
-- At most one unread message notification per sender (used by the DM trigger upsert)
CREATE UNIQUE INDEX uq_notifications_unread_dm ON notifications(recipient_id, actor_id)
    WHERE notification_type = 'direct_message' AND is_read = FALSE;

-- Direct messages: conversation pages (both directions, newest first);
-- unread counts per recipient/sender (partial: only unread rows)
CREATE INDEX idx_dm_conversation    ON direct_messages(sender_id, recipient_id, message_id DESC);
CREATE INDEX idx_dm_recipient       ON direct_messages(recipient_id);
CREATE INDEX idx_dm_unread          ON direct_messages(recipient_id, sender_id) WHERE read_at IS NULL;

-- =============================================================
-- VIEWS
--   Reusable read-only queries. They are dropped automatically
--   when the tables above are dropped (DROP TABLE ... CASCADE).
-- =============================================================

-- v_friend_pairs: accepted friendships listed in BOTH directions,
-- so "friends of X" is simply WHERE user_id = X.
CREATE OR REPLACE VIEW v_friend_pairs AS
    SELECT requester_id AS user_id, addressee_id AS friend_id, responded_at AS friends_since
    FROM friendships WHERE status = 'accepted'
    UNION ALL
    SELECT addressee_id AS user_id, requester_id AS friend_id, responded_at AS friends_since
    FROM friendships WHERE status = 'accepted';

-- v_friend_suggestions: friends-of-friends that user_id has no
-- friendship row with yet (in any state), ranked by mutual friends.
CREATE OR REPLACE VIEW v_friend_suggestions AS
    SELECT f1.user_id,
           f2.friend_id   AS suggested_user_id,
           COUNT(*)::int  AS mutual_friends
    FROM v_friend_pairs f1
    JOIN v_friend_pairs f2 ON f2.user_id = f1.friend_id
    WHERE f2.friend_id <> f1.user_id
      AND NOT EXISTS (
          SELECT 1 FROM friendships f
          WHERE LEAST(f.requester_id, f.addressee_id)    = LEAST(f1.user_id, f2.friend_id)
            AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(f1.user_id, f2.friend_id)
      )
    GROUP BY f1.user_id, f2.friend_id;

-- v_user_stats: public activity counters per user (profile pages).
-- Correlated subqueries avoid the row multiplication that joining
-- several one-to-many tables at once would cause.
CREATE OR REPLACE VIEW v_user_stats AS
    SELECT u.user_id,
           (SELECT COUNT(*) FROM v_friend_pairs fp
             WHERE fp.user_id = u.user_id)::int                         AS friend_count,
           (SELECT COUNT(*) FROM posts p
             WHERE p.author_id = u.user_id AND p.deleted_at IS NULL)::int AS post_count,
           (SELECT COUNT(*) FROM post_likes pl
             JOIN posts p ON p.post_id = pl.post_id
             WHERE p.author_id = u.user_id AND p.deleted_at IS NULL)::int AS likes_received,
           (SELECT COUNT(*) FROM group_members gm
             WHERE gm.user_id = u.user_id)::int                         AS group_count
    FROM users u;

-- =============================================================
-- TRIGGERS: automatic notifications
--   Notifications are generated inside the database so every
--   write path (API, seed, manual SQL) produces them consistently.
--   Self-actions (liking/commenting on your own post) are skipped.
--   Undoing an action (unlike, cancelling a request) removes the
--   matching notification if it has not been read yet.
-- =============================================================

-- Friend request sent -> notify addressee.
-- Request answered    -> mark that request notification read;
--                        if accepted, also notify the original requester.
-- Pending request deleted (cancelled) -> remove unread request notification.
CREATE OR REPLACE FUNCTION fn_notify_friendship() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        INSERT INTO notifications (recipient_id, actor_id, notification_type)
        VALUES (NEW.addressee_id, NEW.requester_id, 'friend_request');

    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
        UPDATE notifications SET is_read = TRUE
        WHERE recipient_id      = NEW.addressee_id
          AND actor_id          = NEW.requester_id
          AND notification_type = 'friend_request';

        IF NEW.status = 'accepted' THEN
            INSERT INTO notifications (recipient_id, actor_id, notification_type)
            VALUES (NEW.requester_id, NEW.addressee_id, 'friend_accepted');
        END IF;

    ELSIF TG_OP = 'DELETE' AND OLD.status = 'pending' THEN
        DELETE FROM notifications
        WHERE recipient_id      = OLD.addressee_id
          AND actor_id          = OLD.requester_id
          AND notification_type = 'friend_request'
          AND is_read = FALSE;
    END IF;
    RETURN NULL;  -- AFTER trigger: return value ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_friendships_notify
    AFTER INSERT OR UPDATE OF status OR DELETE ON friendships
    FOR EACH ROW EXECUTE FUNCTION fn_notify_friendship();

-- Post liked -> notify post author. Unliked -> remove unread notification.
CREATE OR REPLACE FUNCTION fn_notify_post_like() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO notifications (recipient_id, actor_id, notification_type, related_post_id)
        SELECT p.author_id, NEW.user_id, 'post_like', NEW.post_id
        FROM posts p
        WHERE p.post_id = NEW.post_id
          AND p.author_id <> NEW.user_id;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM notifications
        WHERE actor_id          = OLD.user_id
          AND related_post_id   = OLD.post_id
          AND notification_type = 'post_like'
          AND is_read = FALSE;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_likes_notify
    AFTER INSERT OR DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION fn_notify_post_like();

-- Comment added -> notify post author.
CREATE OR REPLACE FUNCTION fn_notify_comment() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (recipient_id, actor_id, notification_type, related_post_id)
    SELECT p.author_id, NEW.author_id, 'post_comment', NEW.post_id
    FROM posts p
    WHERE p.post_id = NEW.post_id
      AND p.author_id <> NEW.author_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comments_notify
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION fn_notify_comment();

-- Unread message received -> notify recipient. uq_notifications_unread_dm
-- allows one unread message notification per sender, so further messages
-- just bump its time (atomic upsert, safe for simultaneous sends).
-- Conversation marked read -> mark that sender's message notification read.
CREATE OR REPLACE FUNCTION fn_notify_direct_message() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.read_at IS NULL THEN
        INSERT INTO notifications (recipient_id, actor_id, notification_type, created_at)
        VALUES (NEW.recipient_id, NEW.sender_id, 'direct_message', COALESCE(NEW.sent_at, NOW()))
        ON CONFLICT (recipient_id, actor_id)
            WHERE notification_type = 'direct_message' AND is_read = FALSE
        DO UPDATE SET created_at = EXCLUDED.created_at;

    ELSIF TG_OP = 'UPDATE' AND OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
        UPDATE notifications SET is_read = TRUE
        WHERE recipient_id      = NEW.recipient_id
          AND actor_id          = NEW.sender_id
          AND notification_type = 'direct_message'
          AND is_read = FALSE;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_direct_messages_notify
    AFTER INSERT OR UPDATE OF read_at ON direct_messages
    FOR EACH ROW EXECUTE FUNCTION fn_notify_direct_message();
