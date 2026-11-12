import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { postsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import { timeAgo } from '../lib/time.js';

const PRIVACY_LABEL = { public: 'Public', friends_only: 'Friends', private: 'Only you' };

function PostMediaItem({ media }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (media.media_type === 'video') {
    return (
      <div className="post__media-item">
        <video src={media.url} controls preload="metadata" />
      </div>
    );
  }

  if (failed) {
    return null;
  }

  return (
    <div className={`post__media-item ${!loaded ? 'post__media-item--loading' : ''}`}>
      {!loaded && (
        <div className="post__media-skeleton" aria-hidden="true">
          <span className="post__media-spinner" />
        </div>
      )}
      <img
        src={media.url}
        alt="Attachment"
        className={loaded ? 'is-loaded' : 'is-loading'}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    </div>
  );
}

export default function PostCard({ post, currentUser, onDeletePost, onUpdatePost }) {
  const [liked, setLiked] = useState(Boolean(post.has_liked));
  const [likeCount, setLikeCount] = useState(parseInt(post.like_count, 10) || 0);
  const [saved, setSaved] = useState(Boolean(post.has_saved));
  const [commentCount, setCommentCount] = useState(parseInt(post.comment_count, 10) || 0);

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  // Post edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editPrivacy, setEditPrivacy] = useState(post.privacy_level || 'public');
  const [savingEdit, setSavingEdit] = useState(false);

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
      setLiked(!nextLiked);
      setLikeCount((prev) => prev + (nextLiked ? -1 : 1));
    }
  };

  const handleToggleBookmark = async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      if (nextSaved) {
        await postsApi.bookmark(post.post_id);
      } else {
        await postsApi.unbookmark(post.post_id);
      }
    } catch {
      setSaved(!nextSaved);
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
      onDeletePost?.(post.post_id);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const res = await postsApi.update(post.post_id, {
        content: editContent,
        privacy_level: editPrivacy,
      });
      setIsEditing(false);
      onUpdatePost?.(res.post);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <li className="post-item">
      <article className="post">
        <header className="post__header">
          <Link to={`/users/${post.author_id}`} className="post__author">
            <Avatar
              user={{
                user_id: post.author_id,
                username: post.username,
                full_name: post.full_name,
                avatar_url: post.avatar_url,
              }}
              size={40}
            />
          </Link>
          <div className="post__meta-info">
            <div className="post__author-row">
              <Link to={`/users/${post.author_id}`} className="post__author-link">
                <span className="post__author-name">{post.full_name || post.username}</span>
                <span className="post__author-handle">@{post.username}</span>
              </Link>
              <span className="post__separator">·</span>
              <time className="post__timestamp">{timeAgo(post.created_at)}</time>
              <span className="tag">{PRIVACY_LABEL[post.privacy_level] || post.privacy_level}</span>
            </div>
          </div>

          {isAuthor && (
            <div className="post__author-actions">
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsEditing(!isEditing)}
                title="Edit post"
              >
                <Icon name="edit" size={15} />
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={handleDeletePost}
                title="Delete post"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          )}
        </header>

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="post__edit-form">
            <textarea
              className="composer__textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              disabled={savingEdit}
              rows={3}
            />
            <div className="post__edit-controls">
              <select
                className="composer__privacy"
                value={editPrivacy}
                onChange={(e) => setEditPrivacy(e.target.value)}
                disabled={savingEdit}
              >
                <option value="public">Public</option>
                <option value="friends_only">Friends Only</option>
                <option value="private">Only You</option>
              </select>
              <div className="post__edit-buttons">
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => setIsEditing(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="button button--primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          post.content && <p className="post__content">{post.content}</p>
        )}

        {/* Media Attachments Grid */}
        {post.media && post.media.length > 0 && (
          <div
            className="post__media-grid"
            data-count={Math.min(post.media.length, 4)}
          >
            {post.media.map((m, idx) => (
              <PostMediaItem key={m.media_id || idx} media={m} />
            ))}
          </div>
        )}

        {/* Action Row */}
        <div className="post__actions">
          <button
            type="button"
            className={`post__action-btn ${liked ? 'post__action-btn--liked' : ''}`}
            onClick={handleToggleLike}
            title={liked ? 'Unlike' : 'Like'}
          >
            <Icon name={liked ? 'heartFilled' : 'heart'} size={17} />
            <span className="post__action-count">{likeCount}</span>
          </button>

          <button
            type="button"
            className="post__action-btn"
            onClick={handleToggleComments}
            title="Comments"
          >
            <Icon name="comment" size={17} />
            <span className="post__action-count">{commentCount}</span>
          </button>

          <button
            type="button"
            className={`post__action-btn post__action-btn--bookmark ${saved ? 'post__action-btn--saved' : ''}`}
            onClick={handleToggleBookmark}
            title={saved ? 'Unsave Post' : 'Save Post'}
          >
            <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} size={17} />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="post__comments">
            {loadingComments && <p className="muted post__comments-loading">Loading comments…</p>}
            {commentError && <p className="form__error">{commentError}</p>}

            {comments && comments.length === 0 && (
              <p className="muted post__comments-empty">No comments yet. Be the first to comment.</p>
            )}

            {comments?.map((comment) => (
              <div key={comment.comment_id} className="comment-item">
                <Avatar
                  user={{
                    user_id: comment.author_id,
                    username: comment.username,
                    full_name: comment.full_name,
                    avatar_url: comment.avatar_url,
                  }}
                  size={30}
                />
                <div className="comment-item__body">
                  <div className="comment-item__header">
                    <Link to={`/users/${comment.author_id}`} className="comment-item__author">
                      <span className="comment-item__author-name">{comment.full_name || comment.username}</span>
                      <span className="comment-item__author-handle">@{comment.username}</span>
                    </Link>
                    <span className="muted comment-item__timestamp">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p className="comment-item__content">{comment.content}</p>
                </div>
                {(currentUser?.user_id === comment.author_id || isAuthor) && (
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    onClick={() => handleDeleteComment(comment.comment_id)}
                    title="Delete comment"
                  >
                    <Icon name="trash" size={13} />
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
                disabled={!newComment.trim() || submittingComment}
              >
                Comment
              </button>
            </form>
          </div>
        )}
      </article>
    </li>
  );
}
