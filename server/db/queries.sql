-- ============================================================================
-- PulseNet Database Management System — Course Project
-- Authoritative Non-Trivial Relational SQL Queries (Section D4)
-- ============================================================================
-- Technology Stack: PostgreSQL 14+ / Supabase PostgreSQL
-- This file contains 5 non-trivial, production-grade SQL queries demonstrating
-- advanced relational database techniques:
--   1. Common Table Expressions (CTEs)
--   2. Multi-table Joins & Outer Joins (INNER, LEFT JOIN, Self-JOINs)
--   3. Anti-Joins using NOT EXISTS
--   4. Window Functions (ROW_NUMBER, DENSE_RANK) with PARTITION BY
--   5. Conditional Aggregation using FILTER (WHERE ...)
--   6. Array Aggregation (ARRAY_AGG)
--   7. Correlated Subqueries & Complex Integrity Projections
--
-- All queries are tested and fully executable against the PulseNet database.
-- Standalone runs use user_id = 1 (Test User) as the representative viewer.
-- ============================================================================

-- ============================================================================
-- QUERY 1: Privacy-Aware Post Feed with Author Details & Engagement Aggregates
-- ============================================================================
-- Relational Concepts:
--   - CTE (Common Table Expression) to materialize viewer's accepted social graph
--   - Selection (WHERE) applying relational privacy predicate:
--       (public OR author = viewer OR (friends_only AND author IN friends))
--   - Multi-table Outer Joins (posts LEFT JOIN user_profiles, post_likes, comments, etc.)
--   - GROUP BY aggregation to compute distinct engagement counts
--   - Correlated subqueries for current viewer interaction state (has_liked, has_saved)
-- Business Purpose:
--   Compiles the main social dispatch feed for a specific viewer, respecting strict
--   content privacy levels, computing live engagement counts, and indicating whether
--   the viewing user has already liked or bookmarked each post.
-- ============================================================================

WITH viewer_friends AS (
    -- Materialize the viewer's bidirectional accepted friend IDs
    SELECT friend_id
    FROM v_friend_pairs
    WHERE user_id = 1 -- Replace with parameter $1 in API queries
)
SELECT
    p.post_id,
    p.content,
    p.privacy_level,
    p.group_id,
    p.created_at,
    p.updated_at,
    u.user_id AS author_id,
    u.username AS author_username,
    up.full_name AS author_full_name,
    up.avatar_url AS author_avatar_url,
    COUNT(DISTINCT pl.user_id)::int AS like_count,
    COUNT(DISTINCT c.comment_id)::int AS comment_count,
    COUNT(DISTINCT sp.user_id)::int AS save_count,
    COUNT(DISTINCT pm.media_id)::int AS media_count,
    EXISTS(
        SELECT 1 FROM post_likes
        WHERE post_id = p.post_id AND user_id = 1
    ) AS has_liked,
    EXISTS(
        SELECT 1 FROM saved_posts
        WHERE post_id = p.post_id AND user_id = 1
    ) AS has_saved
FROM posts p
JOIN users u ON u.user_id = p.author_id
LEFT JOIN user_profiles up ON up.user_id = u.user_id
LEFT JOIN post_likes pl ON pl.post_id = p.post_id
LEFT JOIN comments c ON c.post_id = p.post_id
LEFT JOIN saved_posts sp ON sp.post_id = p.post_id
LEFT JOIN post_media pm ON pm.post_id = p.post_id
WHERE p.deleted_at IS NULL
  AND (
      p.privacy_level = 'public'
      OR p.author_id = 1
      OR (p.privacy_level = 'friends_only' AND p.author_id IN (SELECT friend_id FROM viewer_friends))
  )
GROUP BY p.post_id, u.user_id, up.profile_id
ORDER BY p.created_at DESC
LIMIT 20 OFFSET 0;


-- ============================================================================
-- QUERY 2: Friends-of-Friends Social Recommendation Engine
-- ============================================================================
-- Relational Concepts:
--   - Self-JOIN on bidirectional friendship view (v_friend_pairs f1 JOIN v_friend_pairs f2)
--     to traverse degree-2 separation across the social graph
--   - Anti-Join via NOT EXISTS against the base friendships table to filter out users
--     who already have an existing relationship (pending, accepted, or declined)
--   - Aggregate function ARRAY_AGG(DISTINCT ...) to collect mutual friend usernames
--   - GROUP BY candidate user and profile details
--   - ORDER BY mutual friend count DESC
-- Business Purpose:
--   Suggests new peers to connect with based on shared social circles, providing
--   both the number of mutual friends and a human-readable list of their names.
-- ============================================================================

SELECT
    f2.friend_id AS recommended_user_id,
    u.username AS recommended_username,
    up.full_name AS recommended_full_name,
    up.avatar_url AS recommended_avatar_url,
    up.bio AS recommended_bio,
    COUNT(DISTINCT f1.friend_id)::int AS mutual_friend_count,
    ARRAY_AGG(DISTINCT mfu.username ORDER BY mfu.username) AS mutual_friend_usernames
FROM v_friend_pairs f1
JOIN v_friend_pairs f2 ON f2.user_id = f1.friend_id
JOIN users u ON u.user_id = f2.friend_id
LEFT JOIN user_profiles up ON up.user_id = u.user_id
JOIN users mfu ON mfu.user_id = f1.friend_id
WHERE f1.user_id = 1 -- Target viewer id (parameter $1)
  AND f2.friend_id <> 1
  AND NOT EXISTS (
      -- Exclude anyone where a friendship record already exists in either direction
      SELECT 1 FROM friendships f
      WHERE (f.requester_id = 1 AND f.addressee_id = f2.friend_id)
         OR (f.requester_id = f2.friend_id AND f.addressee_id = 1)
  )
GROUP BY f2.friend_id, u.user_id, up.profile_id
ORDER BY mutual_friend_count DESC, u.username ASC
LIMIT 10;


-- ============================================================================
-- QUERY 3: Community & Research Circle Analytics with Activity Ranking
-- ============================================================================
-- Relational Concepts:
--   - Multi-table Outer Joins across groups, creator, members, posts, comments
--   - Conditional Aggregation using PostgreSQL FILTER (WHERE ...) clause
--   - Window function DENSE_RANK() OVER (ORDER BY score DESC) to rank groups
--   - Arithmetic expressions with NULLIF to safely calculate averages without divide-by-zero
--   - GROUP BY group_id, name, creator attributes
-- Business Purpose:
--   Provides platform administrators and community leads with deep engagement metrics
--   for academic groups, calculating active rosters, moderator ratios, dispatch density,
--   average discussion comments per post, and relative platform ranking.
-- ============================================================================

SELECT
    g.group_id,
    g.name AS group_name,
    g.visibility,
    g.created_at AS group_created_at,
    u.username AS creator_username,
    up.full_name AS creator_name,
    COUNT(DISTINCT gm.user_id) FILTER (WHERE gm.status = 'active')::int AS active_member_count,
    COUNT(DISTINCT gm.user_id) FILTER (WHERE gm.role = 'moderator')::int AS moderator_count,
    COUNT(DISTINCT p.post_id) FILTER (WHERE p.deleted_at IS NULL)::int AS total_dispatches,
    COUNT(DISTINCT c.comment_id)::int AS total_comments,
    ROUND(
        COALESCE(
            COUNT(DISTINCT c.comment_id)::numeric / NULLIF(COUNT(DISTINCT p.post_id) FILTER (WHERE p.deleted_at IS NULL), 0),
            0
        ), 2
    ) AS avg_comments_per_dispatch,
    DENSE_RANK() OVER (
        ORDER BY (
            COUNT(DISTINCT gm.user_id) FILTER (WHERE gm.status = 'active') * 2 +
            COUNT(DISTINCT p.post_id) FILTER (WHERE p.deleted_at IS NULL) * 3 +
            COUNT(DISTINCT c.comment_id)
        ) DESC
    ) AS community_activity_rank
FROM groups g
JOIN users u ON u.user_id = g.creator_id
LEFT JOIN user_profiles up ON up.user_id = u.user_id
LEFT JOIN group_members gm ON gm.group_id = g.group_id
LEFT JOIN posts p ON p.group_id = g.group_id
LEFT JOIN comments c ON c.post_id = p.post_id
GROUP BY g.group_id, u.user_id, up.profile_id
ORDER BY community_activity_rank ASC;


-- ============================================================================
-- QUERY 4: Comprehensive User Activity & Scholarly Ledger
-- ============================================================================
-- Relational Concepts:
--   - Multiple CTEs pre-aggregating distinct interaction domains to completely
--     eliminate Cartesian explosion and join fan-out
--   - True interaction event summation via SUM(like_count) across all authored posts,
--     correcting the logical flaw of counting distinct user_ids
--   - Safe floating-point division using NULLIF to prevent divide-by-zero errors
--   - Filtering on active user account status
--   - Outer joins (LEFT JOIN) preserving users with zero publications or engagements
-- Business Purpose:
--   Produces a consolidated scholarly scorecard for platform members, tracking
--   peer network size, active posts authored, actual likes and comments earned,
--   bookmarks received, and average peer reception per publication.
-- ============================================================================

WITH user_post_stats AS (
    -- Pre-aggregate per-post metrics to avoid Cartesian inflation across posts & interactions
    SELECT
        p.author_id AS user_id,
        COUNT(p.post_id)::int AS active_posts_authored,
        COALESCE(SUM(pl_counts.like_count), 0)::int AS total_likes_received,
        COALESCE(SUM(sp_counts.save_count), 0)::int AS total_bookmarks_received,
        COALESCE(SUM(c_counts.comment_count), 0)::int AS total_comments_received
    FROM posts p
    LEFT JOIN (
        SELECT post_id, COUNT(*)::int AS like_count
        FROM post_likes
        GROUP BY post_id
    ) pl_counts ON pl_counts.post_id = p.post_id
    LEFT JOIN (
        SELECT post_id, COUNT(*)::int AS save_count
        FROM saved_posts
        GROUP BY post_id
    ) sp_counts ON sp_counts.post_id = p.post_id
    LEFT JOIN (
        SELECT post_id, COUNT(*)::int AS comment_count
        FROM comments
        GROUP BY post_id
    ) c_counts ON c_counts.post_id = p.post_id
    WHERE p.deleted_at IS NULL
    GROUP BY p.author_id
),
user_friend_stats AS (
    -- Pre-aggregate confirmed bidirectional peer counts
    SELECT user_id, COUNT(*)::int AS confirmed_friends
    FROM v_friend_pairs
    GROUP BY user_id
),
user_group_stats AS (
    -- Pre-aggregate active community circle enrollments
    SELECT user_id, COUNT(*)::int AS joined_groups_count
    FROM group_members
    WHERE status = 'active'
    GROUP BY user_id
)
SELECT
    u.user_id,
    u.username,
    u.email,
    u.account_status,
    up.full_name,
    up.location,
    COALESCE(ufs.confirmed_friends, 0) AS confirmed_friends,
    COALESCE(ups.active_posts_authored, 0) AS active_posts_authored,
    COALESCE(ups.total_likes_received, 0) AS total_likes_received,
    COALESCE(ups.total_bookmarks_received, 0) AS total_bookmarks_received,
    COALESCE(ups.total_comments_received, 0) AS total_comments_received,
    COALESCE(ugs.joined_groups_count, 0) AS joined_groups_count,
    ROUND(
        COALESCE(
            ups.total_likes_received::numeric / NULLIF(ups.active_posts_authored, 0),
            0
        ), 2
    ) AS avg_likes_per_post
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.user_id
LEFT JOIN user_post_stats ups ON ups.user_id = u.user_id
LEFT JOIN user_friend_stats ufs ON ufs.user_id = u.user_id
LEFT JOIN user_group_stats ugs ON ugs.user_id = u.user_id
WHERE u.account_status = 'active'
ORDER BY total_likes_received DESC, active_posts_authored DESC
LIMIT 20;


-- ============================================================================
-- QUERY 5: Real-Time Direct Messaging Inbox with Last Message & Unread Count
-- ============================================================================
-- Relational Concepts:
--   - CTE normalizing bidirectional message threads into consistent partner_id
--   - Window function ROW_NUMBER() OVER (PARTITION BY partner_id ORDER BY sent_at DESC, message_id DESC)
--     to isolate the latest message for every conversation in O(N log N) time
--   - Secondary CTE computing unread incoming message aggregates per partner
--   - Multi-table joins to retrieve partner identity and profile avatar
--   - Relational projection with boolean flag indicating sender identity
-- Business Purpose:
--   Powers the user's messaging hub / conversation list, showing each conversation
--   partner, preview of the most recent message exchanged, timestamp, delivery status,
--   and unread badge counter.
-- ============================================================================

WITH user_conversations AS (
    SELECT
        dm.message_id,
        dm.sender_id,
        dm.recipient_id,
        dm.content,
        dm.sent_at,
        dm.read_at,
        CASE
            WHEN dm.sender_id = 1 THEN dm.recipient_id
            ELSE dm.sender_id
        END AS partner_id,
        ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN dm.sender_id = 1 THEN dm.recipient_id ELSE dm.sender_id END
            ORDER BY dm.sent_at DESC, dm.message_id DESC
        ) AS rn
    FROM direct_messages dm
    WHERE dm.sender_id = 1 OR dm.recipient_id = 1 -- Replace with target user_id ($1)
),
unread_counts AS (
    SELECT
        dm.sender_id AS partner_id,
        COUNT(*)::int AS unread_message_count
    FROM direct_messages dm
    WHERE dm.recipient_id = 1 AND dm.read_at IS NULL
    GROUP BY dm.sender_id
)
SELECT
    uc.partner_id,
    u.username AS partner_username,
    up.full_name AS partner_full_name,
    up.avatar_url AS partner_avatar_url,
    uc.content AS latest_message_content,
    uc.sent_at AS latest_message_time,
    (uc.sender_id = 1) AS is_last_sender_viewer,
    COALESCE(uc.read_at IS NOT NULL, FALSE) AS is_last_message_read,
    COALESCE(unc.unread_message_count, 0) AS unread_incoming_count
FROM user_conversations uc
JOIN users u ON u.user_id = uc.partner_id
LEFT JOIN user_profiles up ON up.user_id = u.user_id
LEFT JOIN unread_counts unc ON unc.partner_id = uc.partner_id
WHERE uc.rn = 1
ORDER BY uc.sent_at DESC;
