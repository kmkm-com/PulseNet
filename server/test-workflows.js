/**
 * PulseNet Comprehensive Multi-Workflow Automated Integration Test Suite
 * DBMS Course Project Evaluation Verification
 *
 * Covers all 4 Core Application Workflows:
 *   W1: User Authentication & Profile Provisioning (Registration, Bcrypt, JWT, /auth/me)
 *   W2: Social Graph Connection, Friend Discovery & Privacy-Aware Feed Scoping
 *   W3: Atomic Post Publication, Deferred Constraint Invariants, Likes & Comments
 *   W4: Collaborative Communities (Auto-Admin Trigger), Join Notifications, & Direct Messaging with Read Receipts
 */
import app from './src/app.js';
import pool from './src/db/pool.js';
import { validateSafeTestTarget } from './src/db/safety.js';

async function runWorkflowTestSuite() {
  console.log('===============================================================');
  console.log('🚀 STARTING PULSENET FULL MULTI-WORKFLOW INTEGRATION TEST SUITE');
  console.log('===============================================================');

  // Verify target database is safe and local before proceeding
  const target = validateSafeTestTarget({ operation: 'Workflow Integration Test' });
  console.log(`[Test Runner] Target confirmed safe: host='${target.host}', database='${target.database}'`);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;
  console.log(`Server listening on ephemeral port: ${port}`);

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (!condition) {
      testFailed++;
      console.error(`  ❌ ASSERTION FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      testPassed++;
      console.log(`  ✓ ${message}`);
    }
  }

  const createdUserIds = [];
  const createdPostIds = [];
  const createdGroupIds = [];

  try {
    // ------------------------------------------------------------------------
    // WORKFLOW 1: Authentication & Profile Management
    // ------------------------------------------------------------------------
    console.log('\n[WORKFLOW 1] Testing User Authentication & Profile Lifecycle...');
    const w1Username = `w1_user_${Date.now()}`;
    const w1Email = `${w1Username}@example.com`;
    const w1Password = 'SecurePass123!';
    const w1FullName = 'Workflow One Scholar';

    // 1.1 Register
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: w1Username,
        email: w1Email,
        password: w1Password,
        full_name: w1FullName,
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'User registration returns HTTP 201 Created');
    assert(regData.user && regData.user.user_id, 'Registration returns valid user_id');
    const w1UserId = regData.user.user_id;
    createdUserIds.push(w1UserId);

    // 1.2 Verify database password hashing & 1:1 profile creation
    const dbUserRes = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [w1UserId]);
    assert(dbUserRes.rows.length === 1, 'User row confirmed in users table');
    const storedHash = dbUserRes.rows[0].password_hash;
    assert(storedHash !== w1Password && storedHash.startsWith('$2'), 'Password stored as bcrypt salted hash (not plaintext)');

    const dbProfileRes = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [w1UserId]);
    assert(dbProfileRes.rows.length === 1, 'Linked profile record automatically created in user_profiles');
    assert(dbProfileRes.rows[0].full_name === w1FullName, 'Profile full_name matches registration payload');

    // 1.3 Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: w1Email, password: w1Password }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'User login succeeds with HTTP 200');
    assert(loginData.token && typeof loginData.token === 'string', 'Login returns valid JWT token string');
    const w1Token = loginData.token;

    // 1.4 Protected Route Access (/auth/me)
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${w1Token}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'Protected endpoint /api/auth/me returns HTTP 200');
    assert(meData.user.user_id === w1UserId, 'Profile payload matches authenticated identity');

    // ------------------------------------------------------------------------
    // WORKFLOW 2: Social Graph, Friends & Privacy-Aware Feed
    // ------------------------------------------------------------------------
    console.log('\n[WORKFLOW 2] Testing Social Graph, Friendships & Privacy Feed...');
    // Create User A (Requester) and User B (Addressee) and User C (Stranger)
    const ts = Date.now();
    async function quickRegister(name) {
      const email = `${name}_${ts}@test.dev`;
      const pass = 'Password123!';
      const uRes = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `${name}_${ts}`,
          email,
          password: pass,
          full_name: `${name} Tester`,
        }),
      });
      const data = await uRes.json();
      createdUserIds.push(data.user.user_id);

      // Log in to acquire JWT token
      const lRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const lData = await lRes.json();
      return { id: data.user.user_id, token: lData.token };
    }

    const userA = await quickRegister('user_a');
    const userB = await quickRegister('user_b');
    const userC = await quickRegister('user_c');

    // 2.1 Send friend request A -> B
    const sendReqRes = await fetch(`${baseUrl}/friends/requests/${userB.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if (!sendReqRes.ok) {
      const errText = await sendReqRes.text();
      console.log('Send request failed:', sendReqRes.status, errText);
    }
    assert(sendReqRes.status === 201, 'Friend request A -> B returns HTTP 201');

    // Verify friendship state is pending
    const dbFriendRes = await pool.query(
      'SELECT status, responded_at FROM friendships WHERE requester_id = $1 AND addressee_id = $2',
      [userA.id, userB.id]
    );
    assert(dbFriendRes.rows[0].status === 'pending', 'Friendship state in database is pending');
    assert(dbFriendRes.rows[0].responded_at === null, 'Pending friendship responded_at is NULL');

    // Verify notification emitted for User B
    const notifResB = await pool.query(
      `SELECT * FROM notifications WHERE recipient_id = $1 AND actor_id = $2 AND notification_type = 'friend_request'`,
      [userB.id, userA.id]
    );
    assert(notifResB.rows.length === 1, 'Database trigger trg_friendships_notify generated friend_request notification for User B');

    // 2.2 Accept friend request B accepts A
    const acceptRes = await fetch(`${baseUrl}/friends/requests/${userA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
      body: JSON.stringify({ action: 'accept' }),
    });
    assert(acceptRes.status === 200, 'Accepting friend request returns HTTP 200');

    // Verify state transition to accepted
    const dbFriendAccepted = await pool.query(
      'SELECT status, responded_at FROM friendships WHERE requester_id = $1 AND addressee_id = $2',
      [userA.id, userB.id]
    );
    assert(dbFriendAccepted.rows[0].status === 'accepted', 'Friendship status updated to accepted');
    assert(dbFriendAccepted.rows[0].responded_at !== null, 'Accepted friendship has non-null responded_at timestamp');

    // Verify v_friend_pairs view contains bilateral connection
    const pairsRes = await pool.query(
      'SELECT * FROM v_friend_pairs WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userA.id, userB.id]
    );
    assert(pairsRes.rows.length === 2, 'v_friend_pairs view lists accepted friendship symmetrically in both directions');

    // 2.3 Privacy Scoping: User A creates a friends_only post
    const pPostRes = await fetch(`${baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        content: 'Confidential research dispatch for confirmed peers only',
        privacy_level: 'friends_only',
      }),
    });
    const pPostData = await pPostRes.json();
    const pPostId = pPostData.post.post_id;
    createdPostIds.push(pPostId);

    // Friend B should see it in feed
    const feedBRes = await fetch(`${baseUrl}/posts/feed`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    const feedBData = await feedBRes.json();
    assert(feedBData.posts.some(p => p.post_id === pPostId), 'Friend B correctly receives friends_only post in feed');

    // Stranger C must NOT see it in feed
    const feedCRes = await fetch(`${baseUrl}/posts/feed`, {
      headers: { Authorization: `Bearer ${userC.token}` },
    });
    const feedCData = await feedCRes.json();
    assert(!feedCData.posts.some(p => p.post_id === pPostId), 'Non-friend Stranger C is blocked by privacy scoping from seeing friends_only post');

    // ------------------------------------------------------------------------
    // WORKFLOW 3: Post Publication, Deferred Invariants & Engagement
    // ------------------------------------------------------------------------
    console.log('\n[WORKFLOW 3] Testing Post Publication, Deferred Constraints, Likes & Comments...');

    // 3.1 Deferred post content constraint: empty content should be rejected
    let deferredRejected = false;
    try {
      await pool.query(
        `INSERT INTO posts (author_id, content, privacy_level) VALUES ($1, '   ', 'public')`,
        [userA.id]
      );
    } catch (err) {
      deferredRejected = true;
    }
    assert(deferredRejected, 'Deferred constraint trigger trg_post_has_content correctly rejected empty whitespace post');

    // 3.2 Like and Unlike
    const likeRes = await fetch(`${baseUrl}/posts/${pPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    const likeData = await likeRes.json();
    assert(likeRes.status === 200 && likeData.liked === true, 'Liking post returns liked = true');

    const likeNotifRes = await pool.query(
      `SELECT * FROM notifications WHERE recipient_id = $1 AND actor_id = $2 AND notification_type = 'post_like'`,
      [userA.id, userB.id]
    );
    assert(likeNotifRes.rows.length === 1, 'trg_post_likes_notify emitted post_like notification to post author');

    // 3.3 Add Comment
    const commentRes = await fetch(`${baseUrl}/posts/${pPostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
      body: JSON.stringify({ content: 'Excellent relational architecture design!' }),
    });
    assert(commentRes.status === 201, 'Adding discussion comment returns HTTP 201');

    const commentNotifRes = await pool.query(
      `SELECT * FROM notifications WHERE recipient_id = $1 AND actor_id = $2 AND notification_type = 'post_comment'`,
      [userA.id, userB.id]
    );
    assert(commentNotifRes.rows.length === 1, 'trg_comments_notify emitted post_comment notification to post author');

    // ------------------------------------------------------------------------
    // WORKFLOW 4: Communities & Direct Messaging
    // ------------------------------------------------------------------------
    console.log('\n[WORKFLOW 4] Testing Communities (Auto-Admin Trigger) & Direct Messaging...');

    // 4.1 Create Group & check auto-admin trigger
    const groupRes = await fetch(`${baseUrl}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        name: `Automated Test Lab ${ts}`,
        description: 'Advanced testing circle for PostgreSQL database invariants',
        visibility: 'private',
      }),
    });
    const groupData = await groupRes.json();
    assert(groupRes.status === 201, 'Group creation returns HTTP 201 Created');
    const groupId = groupData.group.group_id;
    createdGroupIds.push(groupId);

    // Verify creator auto-admin trigger trg_groups_creator_admin
    const groupMemberRes = await pool.query(
      `SELECT role, status FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userA.id]
    );
    assert(groupMemberRes.rows.length === 1, 'Group creator automatically enrolled in group_members table');
    assert(groupMemberRes.rows[0].role === 'admin' && groupMemberRes.rows[0].status === 'active', 'Creator role is admin with active status via trg_groups_creator_admin');

    // 4.2 User C requests to join private group -> triggers group_join notification
    const joinReqRes = await fetch(`${baseUrl}/groups/${groupId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userC.token}` },
    });
    assert(joinReqRes.status === 200, 'User C requesting to join private group returns HTTP 200');

    const groupNotifRes = await pool.query(
      `SELECT * FROM notifications WHERE recipient_id = $1 AND actor_id = $2 AND notification_type = 'group_join'`,
      [userA.id, userC.id]
    );
    assert(groupNotifRes.rows.length === 1, 'trg_group_members_notify emitted group_join notification to group creator User A');

    // 4.3 Direct Messaging & Trigger-Driven Notifications (User B -> User A)
    // 4.3.1 Send First Message
    const dmRes1 = await fetch(`${baseUrl}/messages/${userA.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
      body: JSON.stringify({ content: 'Hello User A, initial collaborative dispatch.' }),
    });
    assert(dmRes1.status === 201, 'Sending first direct message between friends returns HTTP 201');

    // 4.3.2 Verify direct_message notification created for User A with actor User B
    const dmNotifRes1 = await pool.query(
      `SELECT * FROM notifications
       WHERE recipient_id = $1 AND actor_id = $2 AND notification_type = 'direct_message' AND is_read = FALSE`,
      [userA.id, userB.id]
    );
    assert(dmNotifRes1.rows.length === 1, 'trg_direct_messages_notify emitted direct_message notification for recipient User A');
    assert(dmNotifRes1.rows[0].actor_id === userB.id, 'Notification correctly identifies sender User B as actor');
    const firstNotifId = dmNotifRes1.rows[0].notification_id;

    // 4.3.3 Send Second Consecutive Unread Message (Testing Notification Collapsing)
    const dmRes2 = await fetch(`${baseUrl}/messages/${userA.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
      body: JSON.stringify({ content: 'Follow-up dispatch: checking your availability.' }),
    });
    assert(dmRes2.status === 201, 'Sending second direct message returns HTTP 201');

    // Verify collapsing: exactly 1 unread notification exists with updated timestamp
    const dmNotifRes2 = await pool.query(
      `SELECT * FROM notifications
       WHERE recipient_id = $1 AND actor_id = $2 AND notification_type = 'direct_message' AND is_read = FALSE`,
      [userA.id, userB.id]
    );
    assert(dmNotifRes2.rows.length === 1, 'Consecutive unread messages collapsed into a single unread notification');
    assert(dmNotifRes2.rows[0].notification_id === firstNotifId, 'Collapsed notification retains original notification_id via ON CONFLICT DO UPDATE');

    // 4.3.4 Check unread badge count
    const unreadRes = await fetch(`${baseUrl}/messages/unread-count`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const unreadData = await unreadRes.json();
    assert(unreadData.unread_count === 2, 'User A unread direct message count equals 2');

    // 4.3.5 User A marks conversation as read
    const readReceiptRes = await fetch(`${baseUrl}/messages/${userB.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert(readReceiptRes.status === 200, 'Marking conversation read returns HTTP 200');

    // 4.3.6 Verify read_at timestamp in direct_messages
    const dbDmRes = await pool.query(
      `SELECT read_at FROM direct_messages WHERE sender_id = $1 AND recipient_id = $2 ORDER BY message_id DESC`,
      [userB.id, userA.id]
    );
    assert(dbDmRes.rows.every(r => r.read_at !== null), 'All direct messages in conversation have non-null read_at timestamps');

    // 4.3.7 Verify trigger automatically updated notification to is_read = true
    const dmNotifResRead = await pool.query(
      `SELECT is_read FROM notifications
       WHERE recipient_id = $1 AND actor_id = $2 AND notification_type = 'direct_message'`,
      [userA.id, userB.id]
    );
    assert(dmNotifResRead.rows.every(r => r.is_read === true), 'trg_direct_messages_notify automatically marked notification as is_read = true on read receipt update');

    console.log('\n===============================================================');
    console.log(`🎉 ALL 4 WORKFLOWS VERIFIED! Tests Passed: ${testPassed} | Failed: ${testFailed}`);
    console.log('===============================================================');
  } finally {
    // Teardown: Clean up test fixtures created during the test run
    console.log('--- Cleaning Up Test Fixtures ---');
    if (createdPostIds.length > 0) {
      await pool.query('DELETE FROM posts WHERE post_id = ANY($1)', [createdPostIds]);
    }
    if (createdGroupIds.length > 0) {
      await pool.query('DELETE FROM groups WHERE group_id = ANY($1)', [createdGroupIds]);
    }
    if (createdUserIds.length > 0) {
      await pool.query('DELETE FROM users WHERE user_id = ANY($1)', [createdUserIds]);
    }
    server.close();
    await pool.end();
    console.log('✓ Teardown complete. Test resources released.');
  }
}

runWorkflowTestSuite().catch((err) => {
  console.error('\n❌ Workflow test suite encountered fatal error:', err);
  process.exit(1);
});
