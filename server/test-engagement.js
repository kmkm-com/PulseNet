import app from './src/app.js';
import pool from './src/db/pool.js';

async function runTests() {
  console.log('--- Starting Post Engagement API Integration Test ---');
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // 0. Ensure seed password hash is valid
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE email = $2`,
      ['$2b$10$Jo6wbIdEYSOK2uwoFTfiDOVI2h3UBwsPGu2uRd8pVxBmnDXOYP9TS', 'alice@example.com']
    );

    // 1. Login as alice
    console.log('1. Logging in as alice@example.com...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    console.log('✓ Logged in successfully. Token acquired.');

    // 2. Create a post
    console.log('2. Creating a test post...');
    const createRes = await fetch(`${baseUrl}/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ content: 'Automated engagement test post', privacy_level: 'public' }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Create post failed: ${JSON.stringify(createData)}`);
    const postId = createData.post.post_id;
    console.log(`✓ Post created with ID: ${postId}`);

    // 3. Verify Feed before like
    console.log('3. Checking feed before like...');
    const feedRes1 = await fetch(`${baseUrl}/posts/feed`, { headers: authHeaders });
    const feedData1 = await feedRes1.json();
    const myPost1 = feedData1.posts.find((p) => p.post_id === postId);
    console.log(`✓ Feed fetched. Post has_liked: ${myPost1.has_liked}, like_count: ${myPost1.like_count}`);

    // 4. Like the post
    console.log('4. Liking the post...');
    const likeRes = await fetch(`${baseUrl}/posts/${postId}/like`, {
      method: 'POST',
      headers: authHeaders,
    });
    const likeData = await likeRes.json();
    if (!likeRes.ok) throw new Error(`Like failed: ${JSON.stringify(likeData)}`);
    console.log(`✓ Like response:`, likeData);

    // 5. Verify Feed after like
    console.log('5. Verifying feed shows has_liked = true and count incremented...');
    const feedRes2 = await fetch(`${baseUrl}/posts/feed`, { headers: authHeaders });
    const feedData2 = await feedRes2.json();
    const myPost2 = feedData2.posts.find((p) => p.post_id === postId);
    if (!myPost2.has_liked || parseInt(myPost2.like_count, 10) < 1) {
      throw new Error(`Feed verification failed after like: ${JSON.stringify(myPost2)}`);
    }
    console.log(`✓ Verified: has_liked = ${myPost2.has_liked}, like_count = ${myPost2.like_count}`);

    // 6. Add a comment
    console.log('6. Adding a comment to the post...');
    const commentRes = await fetch(`${baseUrl}/posts/${postId}/comments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ content: 'Testing awesome comments functionality!' }),
    });
    const commentData = await commentRes.json();
    if (!commentRes.ok) throw new Error(`Add comment failed: ${JSON.stringify(commentData)}`);
    const commentId = commentData.comment.comment_id;
    console.log(`✓ Comment added with ID: ${commentId}`);

    // 7. Get comments
    console.log('7. Fetching comments for the post...');
    const getCommentsRes = await fetch(`${baseUrl}/posts/${postId}/comments`, { headers: authHeaders });
    const getCommentsData = await getCommentsRes.json();
    if (!getCommentsRes.ok) throw new Error(`Get comments failed: ${JSON.stringify(getCommentsData)}`);
    const foundComment = getCommentsData.comments.find((c) => c.comment_id === commentId);
    if (!foundComment) throw new Error('Added comment not found in comments list');
    console.log(`✓ Verified: Found comment "${foundComment.content}" by @${foundComment.username}`);

    // 8. Delete comment
    console.log('8. Deleting comment...');
    const delCommentRes = await fetch(`${baseUrl}/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!delCommentRes.ok) throw new Error('Delete comment failed');
    console.log('✓ Comment deleted successfully.');

    // 9. Unlike post
    console.log('9. Unliking the post...');
    const unlikeRes = await fetch(`${baseUrl}/posts/${postId}/like`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const unlikeData = await unlikeRes.json();
    if (!unlikeRes.ok) throw new Error(`Unlike failed: ${JSON.stringify(unlikeData)}`);
    console.log(`✓ Unlike response:`, unlikeData);

    // 10. Clean up post
    console.log('10. Deleting the test post...');
    const delPostRes = await fetch(`${baseUrl}/posts/${postId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!delPostRes.ok) throw new Error('Delete post failed');
    console.log('✓ Test post cleaned up successfully.');

    console.log('\n=========================================');
    console.log(' ALL POST ENGAGEMENT TESTS PASSED! (10/10) ');
    console.log('=========================================\n');
  } finally {
    server.close();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
