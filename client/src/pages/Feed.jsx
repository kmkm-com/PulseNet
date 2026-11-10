import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { postsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { timeAgo } from '../lib/time.js';
import { plural } from '../lib/format.js';

const PRIVACY_LABEL = { public: 'Public', friends_only: 'Friends', private: 'Only you' };

function PostItem({ post, currentUser, onDeletePost }) {
  const [liked, setLiked] = useState(Boolean(post.has_liked));
  const [likeCount, setLikeCount] = useState(parseInt(post.like_count, 10) || 0);
  const [commentCount, setCommentCount] = useState(parseInt(post.comment_count, 10) || 0);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const isAuthor = currentUser?.user_id === post.author_id;

  const handleToggleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((prev) => prev + (nextLiked ? 1 : -1));

    try {
      if (nextLiked) {
        await postsApi.like(post.post_id);
      } else {
        await postsApi.unlike(post.post_id);
      }
    } catch {
      // Revert on failure
      setLiked(!nextLiked);
      setLikeCount((prev) => prev + (nextLiked ? -1 : 1));
    }
  };

  const handleToggleComments = async () => {
    const nextState = !showComments;
    setShowComments(nextState);

    if (nextState && comments === null) {
      setLoadingComments(true);
      try {
        const res = await postsApi.comments(post.post_id);
        setComments(res.comments);
      } catch (err) {
        setCommentError(errorMessage(err));
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    setCommentError('');
    try {
      const res = await postsApi.addComment(post.post_id, newComment.trim());
      setComments((prev) => [...(prev || []), res.comment]);
      setCommentCount((prev) => prev + 1);
      setNewComment('');
    } catch (err) {
      setCommentError(errorMessage(err));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await postsApi.deleteComment(post.post_id, commentId);
      setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
      setCommentCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await postsApi.delete(post.post_id);
      onDeletePost(post.post_id);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <li className="post">
      <Link to={`/users/${post.author_id}`} className="post__author">
        <Avatar user={{ user_id: post.author_id, username: post.username }} size={40} />
      </Link>
      <div className="post__body">
        <div className="post__meta">
          <Link to={`/users/${post.author_id}`} className="strong-link">
            {post.username}
          </Link>
          <span className="muted">{timeAgo(post.created_at)}</span>
          <span className="tag">{PRIVACY_LABEL[post.privacy_level]}</span>

          {isAuthor && (
            <button
              className="icon-button"
              onClick={handleDeletePost}
              title="Delete post"
              style={{ marginLeft: 'auto', color: 'var(--slate)' }}
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>

        <p className="post__content">{post.content}</p>

        <div className="post__actions">
          <button
            type="button"
            className={`post__action-btn ${liked ? 'post__action-btn--liked' : ''}`}
            onClick={handleToggleLike}
            title={liked ? 'Unlike' : 'Like'}
          >
            <Icon name={liked ? 'heartFilled' : 'heart'} size={18} />
            <span>{likeCount}</span>
          </button>

          <button
            type="button"
            className="post__action-btn"
            onClick={handleToggleComments}
            title="Comments"
          >
            <Icon name="comment" size={18} />
            <span>{commentCount}</span>
          </button>
        </div>

        {showComments && (
          <div className="post__comments">
            {loadingComments && <p className="muted">Loading comments…</p>}
            {commentError && <p className="form__error">{commentError}</p>}

            {comments && comments.length === 0 && !loadingComments && (
              <p className="muted" style={{ fontSize: '0.85rem' }}>No comments yet. Be the first to comment!</p>
            )}

            {comments?.map((comment) => (
              <div key={comment.comment_id} className="comment-item">
                <Avatar user={{ user_id: comment.author_id, username: comment.username }} size={28} />
                <div className="comment-item__body">
                  <div className="comment-item__header">
                    <Link to={`/users/${comment.author_id}`} className="strong-link">
                      {comment.username}
                    </Link>
                    <span className="muted">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p>{comment.content}</p>
                </div>
                {(currentUser?.user_id === comment.author_id || isAuthor) && (
                  <button
                    className="icon-button"
                    onClick={() => handleDeleteComment(comment.comment_id)}
                    title="Delete comment"
                    style={{ color: 'var(--slate)' }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            ))}

            <form className="comment-form" onSubmit={handleAddComment}>
              <input
                type="text"
                className="comment-form__input"
                placeholder="Write a comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submittingComment}
              />
              <button
                type="submit"
                className="button button--primary"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                disabled={!newComment.trim() || submittingComment}
              >
                Post
              </button>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  // Composer state
  const [content, setContent] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const loadFeed = () => {
    postsApi
      .feed({ limit: 30 })
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() || posting) return;

    setPosting(true);
    setPostError('');
    try {
      await postsApi.create({ content: content.trim(), privacy_level: privacyLevel });
      setContent('');
      loadFeed(); // Refresh feed to include the new post with proper joins
    } catch (err) {
      setPostError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = (deletedPostId) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== deletedPostId));
  };

  return (
    <section className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">Feed</h1>
      </header>

      {/* Post Composer */}
      <form className="composer" onSubmit={handleCreatePost}>
        {postError && <p className="form__error">{postError}</p>}
        <textarea
          className="composer__textarea"
          placeholder="Share a pulse with your network…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={posting}
        />
        <div className="composer__footer">
          <select
            className="composer__privacy"
            value={privacyLevel}
            onChange={(e) => setPrivacyLevel(e.target.value)}
            disabled={posting}
          >
            <option value="public">🌍 Public</option>
            <option value="friends_only">👥 Friends Only</option>
            <option value="private">🔒 Only You</option>
          </select>
          <button
            type="submit"
            className="button button--primary"
            disabled={!content.trim() || posting}
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      {error && <p className="form__error" role="alert">{error}</p>}
      {posts === null && !error && <p className="muted">Loading posts…</p>}
      {posts?.length === 0 && (
        <div className="empty">
          <p>No posts yet. Share something above or add friends to see their pulses!</p>
          <Link className="button button--primary" to="/friends">Find friends</Link>
        </div>
      )}

      <ol className="rows">
        {posts?.map((post) => (
          <PostItem
            key={post.post_id}
            post={post}
            currentUser={user}
            onDeletePost={handleDeletePost}
          />
        ))}
      </ol>
    </section>
  );
}
