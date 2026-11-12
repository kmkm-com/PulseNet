-- =============================================================
-- Migration 001: Initial Core Schema & Constraints
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(50) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  TEXT NOT NULL,
    account_status VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (account_status IN ('active', 'suspended', 'disabled')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_ci ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_ci ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id          SERIAL PRIMARY KEY,
    user_id             INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name           VARCHAR(100),
    bio                 TEXT,
    location            VARCHAR(100),
    website_url         TEXT,
    avatar_url          TEXT,
    avatar_storage_path TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
    requester_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    addressee_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_friendship_pair
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE TABLE IF NOT EXISTS groups (
    group_id    SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    creator_id  INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    visibility  VARCHAR(15) NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'private')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id  INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id   INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role      VARCHAR(15) NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'moderator', 'member')),
    status    VARCHAR(15) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'pending')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
    post_id       SERIAL PRIMARY KEY,
    author_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    group_id      INT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    content       TEXT NULL,
    privacy_level VARCHAR(15) NOT NULL DEFAULT 'public'
                  CHECK (privacy_level IN ('public', 'friends_only', 'private')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS post_media (
    media_id        SERIAL PRIMARY KEY,
    post_id         INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    storage_bucket  VARCHAR(100) NOT NULL,
    storage_path    TEXT NOT NULL,
    media_type      VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_post_media_bucket_path UNIQUE (storage_bucket, storage_path),
    CONSTRAINT chk_post_media_mime CHECK (
        (media_type = 'image' AND mime_type LIKE 'image/%') OR
        (media_type = 'video' AND mime_type LIKE 'video/%')
    )
);

CREATE TABLE IF NOT EXISTS post_likes (
    user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id    INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS saved_posts (
    user_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id  INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS comments (
    comment_id SERIAL PRIMARY KEY,
    post_id    INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    author_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content    TEXT NOT NULL CHECK (length(trim(content)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id   SERIAL PRIMARY KEY,
    recipient_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    actor_id          INT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    notification_type VARCHAR(30) NOT NULL
                      CHECK (notification_type IN (
                          'friend_request', 'friend_accepted',
                          'post_like', 'post_comment',
                          'direct_message', 'group_join', 'group_invite'
                      )),
    related_post_id   INT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    related_group_id  INT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    is_read           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_not_self
        CHECK (actor_id IS NULL OR actor_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
    message_id   SERIAL PRIMARY KEY,
    sender_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    recipient_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content      TEXT NOT NULL CHECK (length(trim(content)) > 0),
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at      TIMESTAMPTZ NULL,
    CONSTRAINT chk_dm_distinct_users CHECK (sender_id <> recipient_id),
    CONSTRAINT chk_dm_read_after_sent CHECK (read_at IS NULL OR read_at >= sent_at)
);

-- Essential Performance Indexes
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_group ON posts(group_id);
CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post ON saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_role ON group_members(group_id, role, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addr ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_rec ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, actor_id, notification_type) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_post ON notifications(related_post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON notifications(actor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_unread_dm ON notifications(recipient_id, actor_id) WHERE notification_type = 'direct_message' AND is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(sender_id, recipient_id, message_id DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_dm_unread ON direct_messages(recipient_id, sender_id) WHERE read_at IS NULL;
