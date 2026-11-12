import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { postsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import PostCard from '../components/PostCard.jsx';

export default function Bookmarks() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  const loadBookmarks = () => {
    postsApi
      .bookmarks({ limit: 50 })
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const handleDeletePost = (deletedPostId) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== deletedPostId));
  };

  const handleUpdatePost = (updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.post_id === updatedPost.post_id ? { ...p, ...updatedPost } : p))
    );
  };

  return (
    <section className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">Saved Posts</h1>
        <p className="page__subtitle">Posts you have bookmarked</p>
      </header>

      {error && <p className="form__error" role="alert">{error}</p>}
      {posts === null && !error && <p className="muted">Loading saved posts…</p>}
      {posts?.length === 0 && (
        <div className="empty">
          <p>No saved posts yet. Bookmark posts in your feed to view them here later.</p>
          <Link className="button button--primary" to="/">Go to Feed</Link>
        </div>
      )}

      <ol className="rows">
        {posts?.map((post) => (
          <PostCard
            key={post.post_id}
            post={post}
            currentUser={user}
            onDeletePost={handleDeletePost}
            onUpdatePost={handleUpdatePost}
          />
        ))}
      </ol>
    </section>
  );
}
