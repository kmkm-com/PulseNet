-- =============================================================
-- PulseNet Database Schema
-- DBMS Course Project | PERN / Supabase PostgreSQL Stack
-- =============================================================
-- Run this file to initialize a clean standalone database:
--   psql -U <user> -d pulsenet_db -f schema.sql
-- =============================================================

-- Drop tables in reverse dependency order for clean re-runs
DROP VIEW  IF EXISTS post_engagement_summary CASCADE;
DROP VIEW  IF EXISTS v_user_stats            CASCADE;
DROP VIEW  IF EXISTS v_friend_suggestions    CASCADE;
DROP VIEW  IF EXISTS v_friend_pairs          CASCADE;

DROP TABLE IF EXISTS direct_messages         CASCADE;
DROP TABLE IF EXISTS notifications           CASCADE;
DROP TABLE IF EXISTS group_members           CASCADE;
DROP TABLE IF EXISTS groups                  CASCADE;
DROP TABLE IF EXISTS comments                CASCADE;
DROP TABLE IF EXISTS saved_posts             CASCADE;
DROP TABLE IF EXISTS post_likes              CASCADE;
DROP TABLE IF EXISTS post_media              CASCADE;
DROP TABLE IF EXISTS posts                   CASCADE;
DROP TABLE IF EXISTS friendships             CASCADE;
DROP TABLE IF EXISTS user_profiles           CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;

-- -----------------------------------------------------------
-- 1. USERS
--    Core identity & credential store. Passwords stored as
--    bcrypt hashes (never plaintext). Account status tracks
--    active, suspended, and disabled user states.
-- -----------------------------------------------------------
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  TEXT         NOT NULL,
    account_status VARCHAR(20)  NOT NULL DEFAULT 'active'
                   CHECK (account_status IN ('active', 'suspended', 'disabled')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_users_username_ci ON users (LOWER(username));
CREATE UNIQUE INDEX uq_users_email_ci    ON users (LOWER(email));

-- -----------------------------------------------------------
-- 2. USER_PROFILES
--    One-to-one extension of users for public scholarly metadata.
-- -----------------------------------------------------------
CREATE TABLE user_profiles (
    profile_id          SERIAL PRIMARY KEY,
    user_id             INT UNIQUE   NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name           VARCHAR(100),
    bio                 TEXT,
    location            VARCHAR(100),
    website_url         TEXT,
    avatar_url          TEXT,
    avatar_storage_path TEXT,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 3. FRIENDSHIPS
--    Self-referential relation managing peer requests & status.
--    uq_friendship_pair prevents reverse duplicate pairs (A->B and B->A).
-- -----------------------------------------------------------
CREATE TABLE friendships (
    requester_id INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    addressee_id INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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
-- 4. GROUPS (COMMUNITIES / RESEARCH CIRCLES)
--    Collaborative labs and discussion circles. Creator is restricted
--    from deletion while group exists.
-- -----------------------------------------------------------
CREATE TABLE groups (
    group_id    SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    creator_id  INT          NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    visibility  VARCHAR(15)  NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'private')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 5. GROUP_MEMBERS
--    Associative relation managing community membership, roles
--    (admin, moderator, member), and approval status (active, pending).
-- -----------------------------------------------------------
CREATE TABLE group_members (
    group_id  INT         NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id   INT         NOT NULL REFERENCES users(user_id)   ON DELETE CASCADE,
    role      VARCHAR(15) NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'moderator', 'member')),
    status    VARCHAR(15) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'pending')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- -----------------------------------------------------------
-- 6. POSTS (DISPATCHES)
--    Dispatches with privacy scoping, optional group affiliation,
--    and soft delete capability. Every active post is checked by a
--    deferred constraint trigger to have text or media attachment.
-- -----------------------------------------------------------
CREATE TABLE posts (
    post_id       SERIAL PRIMARY KEY,
    author_id     INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    group_id      INT         NULL     REFERENCES groups(group_id) ON DELETE CASCADE,
    content       TEXT        NULL,
    privacy_level VARCHAR(15) NOT NULL DEFAULT 'public'
                  CHECK (privacy_level IN ('public', 'friends_only', 'private')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ DEFAULT NULL
);

-- -----------------------------------------------------------
-- 7. POST_MEDIA
--    One-to-many attachments (images/videos) pointing to object storage.
-- -----------------------------------------------------------
CREATE TABLE post_media (
    media_id        SERIAL PRIMARY KEY,
    post_id         INT          NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    storage_bucket  VARCHAR(100) NOT NULL,
    storage_path    TEXT         NOT NULL,
    media_type      VARCHAR(20)  NOT NULL CHECK (media_type IN ('image', 'video')),
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT       NOT NULL CHECK (file_size_bytes > 0),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_post_media_bucket_path UNIQUE (storage_bucket, storage_path),
    CONSTRAINT chk_post_media_mime CHECK (
        (media_type = 'image' AND mime_type LIKE 'image/%') OR
        (media_type = 'video' AND mime_type LIKE 'video/%')
    )
);

-- -----------------------------------------------------------
-- 8. POST_LIKES
--    Composite PK ensures one like per user per post.
-- -----------------------------------------------------------
CREATE TABLE post_likes (
    user_id    INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id    INT         NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- -----------------------------------------------------------
-- 9. SAVED_POSTS
--    User bookmarks for archiving valuable dispatches.
-- -----------------------------------------------------------
CREATE TABLE saved_posts (
    user_id  INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id  INT         NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- -----------------------------------------------------------
-- 10. COMMENTS
--    Discussion entries on posts. Non-empty check on trimmed content.
-- -----------------------------------------------------------
CREATE TABLE comments (
    comment_id SERIAL PRIMARY KEY,
    post_id    INT         NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    author_id  INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content    TEXT        NOT NULL CHECK (length(trim(content)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 11. NOTIFICATIONS
--    Social alerts generated automatically by triggers.
-- -----------------------------------------------------------
CREATE TABLE notifications (
    notification_id   SERIAL PRIMARY KEY,
    recipient_id      INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    actor_id          INT         NULL     REFERENCES users(user_id) ON DELETE SET NULL,
    notification_type VARCHAR(30) NOT NULL
                      CHECK (notification_type IN (
                          'friend_request', 'friend_accepted',
                          'post_like', 'post_comment',
                          'direct_message', 'group_join', 'group_invite'
                      )),
    related_post_id   INT         NULL REFERENCES posts(post_id)   ON DELETE CASCADE,
    related_group_id  INT         NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    is_read           BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_not_self
        CHECK (actor_id IS NULL OR actor_id <> recipient_id)
);

-- -----------------------------------------------------------
-- 12. DIRECT_MESSAGES
--    One-to-one messaging between connected peers with read receipts.
-- -----------------------------------------------------------
CREATE TABLE direct_messages (
    message_id   SERIAL PRIMARY KEY,
    sender_id    INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    recipient_id INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content      TEXT        NOT NULL CHECK (length(trim(content)) > 0),
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at      TIMESTAMPTZ NULL,
    CONSTRAINT chk_dm_distinct_users CHECK (sender_id <> recipient_id),
    CONSTRAINT chk_dm_read_after_sent CHECK (read_at IS NULL OR read_at >= sent_at)
);

-- =============================================================
-- PERFORMANCE INDEXES
-- =============================================================
CREATE INDEX idx_posts_author             ON posts(author_id);
CREATE INDEX idx_posts_group              ON posts(group_id);
CREATE INDEX idx_post_media_post          ON post_media(post_id);
CREATE INDEX idx_post_likes_post          ON post_likes(post_id);
CREATE INDEX idx_saved_posts_post         ON saved_posts(post_id);
CREATE INDEX idx_comments_post            ON comments(post_id);
CREATE INDEX idx_comments_author          ON comments(author_id);
CREATE INDEX idx_groups_creator           ON groups(creator_id);
CREATE INDEX idx_group_members_user       ON group_members(user_id);
CREATE INDEX idx_group_members_group_role ON group_members(group_id, role, status);
CREATE INDEX idx_friendships_addr         ON friendships(addressee_id);

CREATE INDEX idx_notifications_rec        ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread     ON notifications(recipient_id, actor_id, notification_type) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_post       ON notifications(related_post_id);
CREATE INDEX idx_notifications_group      ON notifications(related_group_id);
CREATE INDEX idx_notifications_actor      ON notifications(actor_id);
CREATE UNIQUE INDEX uq_notifications_unread_dm ON notifications(recipient_id, actor_id) WHERE notification_type = 'direct_message' AND is_read = FALSE;

CREATE INDEX idx_dm_conversation          ON direct_messages(sender_id, recipient_id, message_id DESC);
CREATE INDEX idx_dm_recipient             ON direct_messages(recipient_id);
CREATE INDEX idx_dm_unread                ON direct_messages(recipient_id, sender_id) WHERE read_at IS NULL;

-- =============================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================

-- 1. Helper function for automated updated_at timestamps
CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_user_profiles_touch BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_groups_touch BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_posts_touch BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_comments_touch BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- 2. Trigger: Automatic group creator enrolled as Admin member
CREATE OR REPLACE FUNCTION fn_add_group_creator_admin() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role, status)
    VALUES (NEW.group_id, NEW.creator_id, 'admin', 'active')
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET role = 'admin', status = 'active';
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_groups_creator_admin
    AFTER INSERT ON groups
    FOR EACH ROW EXECUTE FUNCTION fn_add_group_creator_admin();

-- 3. Invariant: Every non-deleted post must have text or media attachment
-- Implemented as a DEFERRED constraint trigger at transaction commit time.
CREATE OR REPLACE FUNCTION fn_assert_post_has_content() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_has_media BOOLEAN;
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.content IS NOT NULL AND length(trim(NEW.content)) > 0 THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM post_media WHERE post_id = NEW.post_id
    ) INTO v_has_media;

    IF NOT v_has_media THEN
        RAISE EXCEPTION 'Constraint violation: Post % must contain either non-empty text content or at least one media attachment', NEW.post_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_post_has_content
    AFTER INSERT OR UPDATE ON posts
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_assert_post_has_content();

-- 4. Notification Triggers
-- Friendship notifications
CREATE OR REPLACE FUNCTION fn_notify_friendship() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_friendships_notify
    AFTER INSERT OR UPDATE OF status OR DELETE ON friendships
    FOR EACH ROW EXECUTE FUNCTION fn_notify_friendship();

-- Post Like notifications
CREATE OR REPLACE FUNCTION fn_notify_post_like() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trg_post_likes_notify
    AFTER INSERT OR DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION fn_notify_post_like();

-- Comment notifications
CREATE OR REPLACE FUNCTION fn_notify_comment() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO notifications (recipient_id, actor_id, notification_type, related_post_id)
    SELECT p.author_id, NEW.author_id, 'post_comment', NEW.post_id
    FROM posts p
    WHERE p.post_id = NEW.post_id
      AND p.author_id <> NEW.author_id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_comments_notify
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION fn_notify_comment();

-- Direct Message notifications
CREATE OR REPLACE FUNCTION fn_notify_direct_message() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trg_direct_messages_notify
    AFTER INSERT OR UPDATE OF read_at ON direct_messages
    FOR EACH ROW EXECUTE FUNCTION fn_notify_direct_message();

-- Group Join Request notification
CREATE OR REPLACE FUNCTION fn_notify_group_member() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        INSERT INTO notifications (recipient_id, actor_id, notification_type, related_group_id)
        SELECT g.creator_id, NEW.user_id, 'group_join', NEW.group_id
        FROM groups g
        WHERE g.group_id = NEW.group_id
          AND g.creator_id <> NEW.user_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_group_members_notify
    AFTER INSERT ON group_members
    FOR EACH ROW EXECUTE FUNCTION fn_notify_group_member();

-- =============================================================
-- VIEWS
-- =============================================================

-- 1. v_friend_pairs: Accepted bidirectional friendships
CREATE OR REPLACE VIEW v_friend_pairs WITH (security_invoker = true) AS
    SELECT requester_id AS user_id, addressee_id AS friend_id, responded_at AS friends_since
    FROM friendships WHERE status = 'accepted'
    UNION ALL
    SELECT addressee_id AS user_id, requester_id AS friend_id, responded_at AS friends_since
    FROM friendships WHERE status = 'accepted';

-- 2. v_friend_suggestions: Mutual friend recommendations
CREATE OR REPLACE VIEW v_friend_suggestions WITH (security_invoker = true) AS
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

-- 3. v_user_stats: Public activity counters per user
CREATE OR REPLACE VIEW v_user_stats WITH (security_invoker = true) AS
    SELECT u.user_id,
           (SELECT COUNT(*) FROM v_friend_pairs fp
             WHERE fp.user_id = u.user_id)::int                         AS friend_count,
           (SELECT COUNT(*) FROM posts p
             WHERE p.author_id = u.user_id AND p.deleted_at IS NULL)::int AS post_count,
           (SELECT COUNT(*) FROM post_likes pl
             JOIN posts p ON p.post_id = pl.post_id
             WHERE p.author_id = u.user_id AND p.deleted_at IS NULL)::int AS likes_received,
           (SELECT COUNT(*) FROM group_members gm
             WHERE gm.user_id = u.user_id AND gm.status = 'active')::int AS group_count
    FROM users u;

-- 4. post_engagement_summary: Consolidated metrics per post
CREATE OR REPLACE VIEW post_engagement_summary WITH (security_invoker = true) AS
    SELECT p.post_id,
           p.author_id,
           p.group_id,
           p.created_at,
           (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id)::int AS total_likes,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id)::int AS total_comments,
           (SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.post_id)::int AS total_bookmarks,
           (SELECT COUNT(*) FROM post_media pm WHERE pm.post_id = p.post_id)::int AS media_count
    FROM posts p
    WHERE p.deleted_at IS NULL;
