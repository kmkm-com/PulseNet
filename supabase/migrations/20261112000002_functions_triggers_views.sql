-- =============================================================
-- Migration 002: Triggers, Functions, Views & Invariants
-- =============================================================

-- 1. Helper function for updated_at
CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_touch ON user_profiles;
CREATE TRIGGER trg_user_profiles_touch BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_groups_touch ON groups;
CREATE TRIGGER trg_groups_touch BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_posts_touch ON posts;
CREATE TRIGGER trg_posts_touch BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_comments_touch ON comments;
CREATE TRIGGER trg_comments_touch BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();


-- 2. Trigger: Automatic group creator becomes Admin member
CREATE OR REPLACE FUNCTION fn_add_group_creator_admin() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role, status)
    VALUES (NEW.group_id, NEW.creator_id, 'admin', 'active')
    ON CONFLICT (group_id, user_id) 
    DO UPDATE SET role = 'admin', status = 'active';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_groups_creator_admin ON groups;
CREATE TRIGGER trg_groups_creator_admin
    AFTER INSERT ON groups
    FOR EACH ROW EXECUTE FUNCTION fn_add_group_creator_admin();


-- 3. Invariant: Every non-deleted post must have text content or at least one media attachment.
-- Implemented as a DEFERRED constraint trigger at transaction commit.
CREATE OR REPLACE FUNCTION fn_assert_post_has_content() RETURNS TRIGGER AS $$
DECLARE
    v_has_media BOOLEAN;
BEGIN
    -- Only check active posts
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Check if content has non-whitespace characters
    IF NEW.content IS NOT NULL AND length(trim(NEW.content)) > 0 THEN
        RETURN NEW;
    END IF;

    -- Check if media attachment exists
    SELECT EXISTS (
        SELECT 1 FROM post_media WHERE post_id = NEW.post_id
    ) INTO v_has_media;

    IF NOT v_has_media THEN
        RAISE EXCEPTION 'Constraint violation: Post % must contain either non-empty text content or at least one media attachment', NEW.post_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_has_content ON posts;
CREATE CONSTRAINT TRIGGER trg_post_has_content
    AFTER INSERT OR UPDATE ON posts
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_assert_post_has_content();


-- 4. Triggers: Notification automation
-- Friendship notification
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
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_friendships_notify ON friendships;
CREATE TRIGGER trg_friendships_notify
    AFTER INSERT OR UPDATE OF status OR DELETE ON friendships
    FOR EACH ROW EXECUTE FUNCTION fn_notify_friendship();


-- Post Like notification
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

DROP TRIGGER IF EXISTS trg_post_likes_notify ON post_likes;
CREATE TRIGGER trg_post_likes_notify
    AFTER INSERT OR DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION fn_notify_post_like();


-- Comment notification
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

DROP TRIGGER IF EXISTS trg_comments_notify ON comments;
CREATE TRIGGER trg_comments_notify
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION fn_notify_comment();


-- Direct Message notification
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

DROP TRIGGER IF EXISTS trg_direct_messages_notify ON direct_messages;
CREATE TRIGGER trg_direct_messages_notify
    AFTER INSERT OR UPDATE OF read_at ON direct_messages
    FOR EACH ROW EXECUTE FUNCTION fn_notify_direct_message();


-- Group Join Request notification
CREATE OR REPLACE FUNCTION fn_notify_group_member() RETURNS TRIGGER AS $$
BEGIN
    -- When someone requests to join private group, notify group creator/admin
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        INSERT INTO notifications (recipient_id, actor_id, notification_type, related_group_id)
        SELECT g.creator_id, NEW.user_id, 'group_join', NEW.group_id
        FROM groups g
        WHERE g.group_id = NEW.group_id
          AND g.creator_id <> NEW.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_group_members_notify ON group_members;
CREATE TRIGGER trg_group_members_notify
    AFTER INSERT ON group_members
    FOR EACH ROW EXECUTE FUNCTION fn_notify_group_member();


-- =============================================================
-- 5. VIEWS
-- =============================================================

CREATE OR REPLACE VIEW v_friend_pairs AS
    SELECT requester_id AS user_id, addressee_id AS friend_id, responded_at AS friends_since
    FROM friendships WHERE status = 'accepted'
    UNION ALL
    SELECT addressee_id AS user_id, requester_id AS friend_id, responded_at AS friends_since
    FROM friendships WHERE status = 'accepted';

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
             WHERE gm.user_id = u.user_id AND gm.status = 'active')::int AS group_count
    FROM users u;

CREATE OR REPLACE VIEW post_engagement_summary AS
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
