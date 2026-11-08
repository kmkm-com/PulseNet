import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { postsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import { timeAgo } from '../lib/time.js';
import { plural } from '../lib/format.js';

// Read-only feed so the app has a home page. Posting, likes and
// comments belong to the engagement feature and can replace this page.
const PRIVACY_LABEL = { public: 'Public', friends_only: 'Friends', private: 'Only you' };

export default function Feed() {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    postsApi.feed({ limit: 30 })
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <section className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">Feed</h1>
      </header>
      {error && <p className="form__error" role="alert">{error}</p>}
      {posts === null && !error && <p className="muted">Loading posts…</p>}
      {posts?.length === 0 && (
        <div className="empty">
          <p>No posts yet. Add some friends to see what they share.</p>
          <Link className="button button--primary" to="/friends">Find friends</Link>
        </div>
      )}
      <ol className="rows">
        {posts?.map((post) => (
          <li key={post.post_id} className="post">
            <Link to={`/users/${post.author_id}`} className="post__author">
              <Avatar user={{ user_id: post.author_id, username: post.username }} size={40} />
            </Link>
            <div className="post__body">
              <p className="post__meta">
                <Link to={`/users/${post.author_id}`} className="strong-link">{post.username}</Link>
                <span className="muted">{timeAgo(post.created_at)}</span>
                <span className="tag">{PRIVACY_LABEL[post.privacy_level]}</span>
              </p>
              <p className="post__content">{post.content}</p>
              <p className="post__stats muted">
                {plural(post.like_count, 'like')}, {plural(post.comment_count, 'comment')}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
