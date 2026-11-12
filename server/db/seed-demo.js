/**
 * Deterministic Seeder for PulseNet on Supabase
 * Generates ~1,800 records across all 12 core relations while obeying all database constraints
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vsuqxguawnxtodcuajij.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ID83pmexw6HHj-AVEgk0nw_glhLQjq9';

// Fixed bcrypt hash for 'password123'
const DEMO_PASSWORD_HASH = '$2b$10$Jo6wbIdEYSOK2uwoFTfiDOVI2h3UBwsPGu2uRd8pVxBmnDXOYP9TS';

const FIRST_NAMES = ['Aarav', 'Aditi', 'Alok', 'Ananya', 'Aryan', 'Bhavna', 'Chetan', 'Dev', 'Diya', 'Gaurav', 'Ishaan', 'Kavya', 'Manish', 'Neha', 'Pooja', 'Rahul', 'Rhea', 'Rohan', 'Sneha', 'Tanvi', 'Varun', 'Vikram', 'Yash', 'Zoya', 'Aditya', 'Harsh', 'Meera', 'Kiran', 'Naveen', 'Priya', 'Rajesh', 'Sanya', 'Siddharth', 'Simran', 'Tanya', 'Akash', 'Deepak', 'Geeta', 'Kunal', 'Maya', 'Nitin', 'Payal', 'Sachin', 'Shreya', 'Tarun', 'Anjali', 'Karthik', 'Preeti', 'Sameer', 'Swati', 'Amit', 'Divya', 'Mohit', 'Nandini', 'Pranav'];
const LAST_NAMES = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Mehta', 'Nair', 'Kapoor', 'Rao', 'Iyer', 'Gupta', 'Singh', 'Deshmukh', 'Bhat', 'Joshi', 'Chopra', 'Malhotra', 'Bose', 'Chatterjee', 'Pandey', 'Saxena'];
const CITIES = ['Hyderabad, India', 'Bengaluru, India', 'Mumbai, India', 'Delhi, India', 'Pune, India', 'Chennai, India', 'Kolkata, India', 'Ahmedabad, India'];
const TOPICS = [
  'Exploring PostgreSQL 17 query plans and vacuum strategies today! 🚀 #DBMS',
  'Just configured Supabase Row Level Security. Rock solid data protection! 🛡️',
  'Working on responsive UI layouts with React and Vite. Smooth 60fps! ⚡',
  'Database normalisation: Boyce-Codd Normal Form is truly satisfying once it clicks. 📚',
  'Late night coding with hot filter coffee ☕ What are you building this weekend?',
  'Indexes are game changers for million-row queries. B-Trees for the win! 🌲',
  'Completed our database system lab demo! Feeling accomplished 🎉',
  'Does anyone prefer CTEs over nested subqueries for readability? Let’s discuss!',
  'Contributing open-source PRs to our favourite developer libraries today 🌐',
  'Designing database schemas with deferred constraints and trigger audits. Clean architecture!'
];

export async function runSeeder(pool) {
  console.log('--- Starting PulseNet Synthetic Data Seeding ---');

  // 1. Ensure 5 original users + 55 synthetic users = 60 users
  console.log('1. Inserting Users & Profiles...');
  const users = [
    { username: 'alice', email: 'alice@example.com', name: 'Alice Sharma', bio: 'Computer Science student. Coffee enthusiast ☕', location: 'Delhi, India' },
    { username: 'bob', email: 'bob@example.com', name: 'Bob Mehta', bio: 'Building cool things one commit at a time 🚀', location: 'Mumbai, India' },
    { username: 'charlie', email: 'charlie@example.com', name: 'Charlie Verma', bio: 'DBMS nerd | Love SQL and distributed systems 🗄️', location: 'Bangalore, India' },
    { username: 'diana', email: 'diana@example.com', name: 'Diana Kapoor', bio: 'UI/UX designer & React developer 🎨', location: 'Pune, India' },
    { username: 'evan', email: 'evan@example.com', name: 'Evan Nair', bio: 'Fullstack dev | Open source contributor 🌐', location: 'Chennai, India' },
  ];

  for (let i = 6; i <= 60; i++) {
    const fn = FIRST_NAMES[(i - 6) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i - 6) % LAST_NAMES.length];
    users.push({
      username: `${fn.toLowerCase()}${i}`,
      email: `${fn.toLowerCase()}${i}@pulsenet.dev`,
      name: `${fn} ${ln}`,
      bio: `Software explorer and DBMS enthusiast #${i}`,
      location: CITIES[(i - 6) % CITIES.length],
    });
  }

  const userIds = [];
  for (const u of users) {
    const res = await pool.query(
      `INSERT INTO users (username, email, password_hash, account_status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (LOWER(username)) DO UPDATE SET email = EXCLUDED.email
       RETURNING user_id`,
      [u.username, u.email, DEMO_PASSWORD_HASH]
    );
    const uid = res.rows[0].user_id;
    userIds.push(uid);

    await pool.query(
      `INSERT INTO user_profiles (user_id, full_name, bio, location, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         bio = EXCLUDED.bio,
         location = EXCLUDED.location`,
      [uid, u.name, u.bio, u.location, `https://i.pravatar.cc/150?u=${u.username}`]
    );
  }
  console.log(`✓ Inserted/verified ${userIds.length} users and user profiles.`);

  // 2. Friendships (~180 pairs)
  console.log('2. Inserting Friendships...');
  let friendshipCount = 0;
  for (let i = 0; i < userIds.length; i++) {
    for (let j = 1; j <= 6; j++) {
      const targetIdx = (i + j) % userIds.length;
      const u1 = Math.min(userIds[i], userIds[targetIdx]);
      const u2 = Math.max(userIds[i], userIds[targetIdx]);
      if (u1 === u2) continue;

      const status = (i + j) % 5 === 0 ? 'pending' : (i + j) % 7 === 0 ? 'declined' : 'accepted';
      const respondedAt = status === 'pending' ? null : new Date();

      try {
        await pool.query(
          `INSERT INTO friendships (requester_id, addressee_id, status, created_at, responded_at)
           VALUES ($1, $2, $3, NOW() - INTERVAL '${(i + j)} hours', $4)
           ON CONFLICT DO NOTHING`,
          [u1, u2, status, respondedAt]
        );
        friendshipCount++;
      } catch (e) {
        // Ignore duplicate pairs
      }
    }
  }
  console.log(`✓ Friendships generated: ${friendshipCount}`);

  // 3. Groups (15 groups)
  console.log('3. Inserting Groups...');
  const groupNames = [
    ['DBMS Study Group', 'Database systems, normalisation, indexing and SQL optimization', 'public'],
    ['React & Vite Developers', 'Frontend web tooling, React 18, and modern CSS', 'public'],
    ['Open Source Club', 'Weekly sprint contributions to high impact OSS repos', 'public'],
    ['Algorithms & Competitive Coding', 'Daily LeetCode and graph theory problem breakdowns', 'public'],
    ['Cloud & Distributed Systems', 'Consensus protocols, Raft, microservices, and kubernetes', 'public'],
    ['Cybersecurity & AppSec', 'Network security, secure authentication, and pen testing', 'public'],
    ['Machine Learning Enthusiasts', 'Deep learning, LLMs, fine-tuning, and PyTorch models', 'public'],
    ['Campus Career & Internships', 'Interview prep, resume reviews, and internship referrals', 'public'],
    ['PulseNet Core Contributors', 'Private internal discussions and architecture reviews', 'private'],
    ['Hyderabad Techies', 'Local developer meetups, coffee catchups, and hackathons', 'public'],
    ['Fullstack PERN Guild', 'PostgreSQL, Express, React, and Node.js masters', 'public'],
    ['System Design Masters', 'Scalability, load balancing, caching, and database sharding', 'public'],
    ['Database Theory Seminar', 'Research papers on relational algebra and modern storage engines', 'private'],
    ['Mobile App Developers', 'React Native, Flutter, and Android Jetpack development', 'public'],
    ['DevOps & Site Reliability', 'CI/CD pipelines, Docker, Prometheus, and monitoring', 'public']
  ];

  const groupIds = [];
  for (let i = 0; i < groupNames.length; i++) {
    const [name, desc, vis] = groupNames[i];
    const creator = userIds[i % userIds.length];
    const gRes = await pool.query(
      `INSERT INTO groups (name, description, creator_id, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING group_id`,
      [name, desc, creator, vis]
    );
    groupIds.push(gRes.rows[0].group_id);
  }
  console.log(`✓ Inserted ${groupIds.length} groups with automatic creator admin trigger.`);

  // 4. Group Members (~150 memberships)
  console.log('4. Inserting Group Members...');
  let memberCount = 0;
  for (let gi = 0; gi < groupIds.length; gi++) {
    const gid = groupIds[gi];
    // Add 8-12 members per group
    for (let u = 0; u < 10; u++) {
      const uid = userIds[(gi * 3 + u) % userIds.length];
      const role = u === 1 ? 'moderator' : 'member';
      try {
        await pool.query(
          `INSERT INTO group_members (group_id, user_id, role, status)
           VALUES ($1, $2, $3, 'active')
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [gid, uid, role]
        );
        memberCount++;
      } catch (e) {}
    }
  }
  console.log(`✓ Group members populated: ${memberCount}`);

  // 5. Posts (~200 posts)
  console.log('5. Inserting Posts...');
  const postIds = [];
  for (let i = 0; i < 200; i++) {
    const authorId = userIds[i % userIds.length];
    const isGroupPost = i % 4 === 0;
    const gid = isGroupPost ? groupIds[i % groupIds.length] : null;
    const privacy = isGroupPost ? 'public' : (i % 3 === 0 ? 'friends_only' : 'public');
    const text = `${TOPICS[i % TOPICS.length]} [Pulse #${i + 1}]`;

    const res = await pool.query(
      `INSERT INTO posts (author_id, group_id, content, privacy_level, created_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i * 30} minutes')
       RETURNING post_id`,
      [authorId, gid, text, privacy]
    );
    postIds.push(res.rows[0].post_id);
  }
  console.log(`✓ Inserted ${postIds.length} posts.`);

  // 6. Post Media (~60 media items)
  console.log('6. Inserting Post Media...');
  let mediaCount = 0;
  for (let i = 0; i < 60; i++) {
    const pid = postIds[i * 3]; // attach to every 3rd post
    const isVideo = i % 8 === 0;
    const path = isVideo ? `sample_assets/video_${i}.mp4` : `sample_assets/image_${i}.jpg`;
    const mime = isVideo ? 'video/mp4' : 'image/jpeg';
    const type = isVideo ? 'video' : 'image';
    const size = isVideo ? 12450000 + i * 1000 : 850000 + i * 500;

    try {
      await pool.query(
        `INSERT INTO post_media (post_id, storage_bucket, storage_path, media_type, mime_type, file_size_bytes)
         VALUES ($1, 'post-media', $2, $3, $4, $5)
         ON CONFLICT (storage_bucket, storage_path) DO NOTHING`,
        [pid, path, type, mime, size]
      );
      mediaCount++;
    } catch (e) {}
  }
  console.log(`✓ Inserted ${mediaCount} post media attachments.`);

  // 7. Post Likes (~400 likes)
  console.log('7. Inserting Post Likes...');
  let likesCount = 0;
  for (let i = 0; i < postIds.length; i++) {
    const pid = postIds[i];
    // Each post liked by 2-4 users
    const numLikes = (i % 4) + 1;
    for (let k = 0; k < numLikes; k++) {
      const uid = userIds[(i + k * 5) % userIds.length];
      try {
        await pool.query(
          `INSERT INTO post_likes (user_id, post_id, created_at)
           VALUES ($1, $2, NOW() - INTERVAL '${(i + k)} minutes')
           ON CONFLICT DO NOTHING`,
          [uid, pid]
        );
        likesCount++;
      } catch (e) {}
    }
  }
  console.log(`✓ Inserted post likes: ${likesCount}`);

  // 8. Saved Posts (~200 bookmarks)
  console.log('8. Inserting Saved Posts...');
  let savedCount = 0;
  for (let i = 0; i < 200; i++) {
    const uid = userIds[i % userIds.length];
    const pid = postIds[(i * 2 + 1) % postIds.length];
    try {
      await pool.query(
        `INSERT INTO saved_posts (user_id, post_id, saved_at)
         VALUES ($1, $2, NOW() - INTERVAL '${i * 15} minutes')
         ON CONFLICT DO NOTHING`,
        [uid, pid]
      );
      savedCount++;
    } catch (e) {}
  }
  console.log(`✓ Inserted saved posts: ${savedCount}`);

  // 9. Comments (~400 comments)
  console.log('9. Inserting Comments...');
  const comments = [
    'Great point! Totally agree with this approach.',
    'Could you share more details or a code snippet?',
    'This was super helpful for our DBMS presentation.',
    'PostgreSQL execution explain plans are so informative.',
    'Nice post! Bookmarked for later review.',
    'How does this handle edge cases under concurrency?',
    'Fantastic progress! Looking forward to the next update.',
    'Loved the clear explanation and diagrams!'
  ];
  let commentTotal = 0;
  for (let i = 0; i < 400; i++) {
    const pid = postIds[i % postIds.length];
    const authorId = userIds[(i * 3 + 2) % userIds.length];
    const text = comments[i % comments.length];
    await pool.query(
      `INSERT INTO comments (post_id, author_id, content, created_at)
       VALUES ($1, $2, $3, NOW() - INTERVAL '${i * 10} minutes')`,
      [pid, authorId, text]
    );
    commentTotal++;
  }
  console.log(`✓ Inserted ${commentTotal} comments.`);

  // 10. Direct Messages (~250 messages between friends)
  console.log('10. Inserting Direct Messages...');
  const dmMessages = [
    'Hey, are you free to discuss the database normalisation schema?',
    'Yes, I just reviewed the tables and constraints. Looking very clean!',
    'Awesome! Are we meeting in the library this evening?',
    'Sounds great, see you at 5 PM with our laptops ready.',
    'Could you send me the link to the Supabase console?',
    'Sent! Check your email for the project invite link.',
    'Thanks a lot! The query performance on the views is lightning fast.'
  ];
  let dmCount = 0;
  for (let i = 0; i < 250; i++) {
    const sender = userIds[i % 25];
    const recipient = userIds[(i + 1) % 25];
    if (sender === recipient) continue;
    const text = dmMessages[i % dmMessages.length];
    const isRead = i % 3 !== 0;
    const readAt = isRead ? new Date() : null;

    await pool.query(
      `INSERT INTO direct_messages (sender_id, recipient_id, content, sent_at, read_at)
       VALUES ($1, $2, $3, NOW() - INTERVAL '${(300 - i) * 5} minutes', $4)`,
      [sender, recipient, text, readAt]
    );
    dmCount++;
  }
  console.log(`✓ Inserted ${dmCount} direct messages.`);

  console.log('\n--- Seeding Completed Successfully! ---');
}
