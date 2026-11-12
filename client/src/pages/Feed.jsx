import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { postsApi, friendsApi, groupsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import PostCard from '../components/PostCard.jsx';
import Avatar from '../components/Avatar.jsx';
import RelationshipButton from '../components/RelationshipButton.jsx';
import Icon from '../components/Icon.jsx';
import { displayName } from '../lib/format.js';

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [topGroups, setTopGroups] = useState(null);

  // Composer state
  const [content, setContent] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [mediaList, setMediaList] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const fileInputRef = useRef(null);

  const loadFeed = () => {
    postsApi
      .feed({ limit: 30 })
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(() => {
    loadFeed();
    friendsApi
      .suggestions()
      .then((d) => setSuggestions(d.suggestions?.slice(0, 4) || []))
      .catch(() => {});
    groupsApi
      .list({ limit: 3 })
      .then((d) => setTopGroups(d.groups?.slice(0, 3) || []))
      .catch(() => {});
  }, []);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingMedia(true);
    setPostError('');
    try {
      for (const file of files) {
        const uploadRes = await postsApi.uploadMedia(file);
        setMediaList((prev) => [...prev, uploadRes.media]);
      }
    } catch (err) {
      setPostError(errorMessage(err));
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = (index) => {
    setMediaList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if ((!content.trim() && mediaList.length === 0) || posting) return;

    setPosting(true);
    setPostError('');
    try {
      await postsApi.create({
        content: content.trim(),
        privacy_level: privacyLevel,
        media: mediaList,
      });
      setContent('');
      setMediaList([]);
      loadFeed();
    } catch (err) {
      setPostError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = (deletedPostId) => {
    setPosts((prev) => prev?.filter((p) => p.post_id !== deletedPostId) || []);
  };

  const handleUpdatePost = (updatedPost) => {
    setPosts((prev) =>
      prev?.map((p) => (p.post_id === updatedPost.post_id ? { ...p, ...updatedPost } : p)) || []
    );
  };

  return (
    <div className="feed-layout">
      {/* Primary Feed Stream */}
      <section className="feed-main">
        <header className="page__header page__header--split">
          <div>
            <h1 className="page__title">Feed</h1>
            <p className="page__subtitle">Latest updates from your network</p>
          </div>
        </header>

        {/* Post Composer */}
        <form className="composer" onSubmit={handleCreatePost}>
          {postError && <p className="form__error">{postError}</p>}
          <div className="composer__top">
            <Avatar user={user} size={38} />
            <textarea
              className="composer__textarea"
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={posting}
              rows={2}
            />
          </div>

          {/* Attached Media Thumbnails */}
          {mediaList.length > 0 && (
            <div className="composer__media-previews">
              {mediaList.map((m, idx) => (
                <div key={idx} className="composer__preview-item">
                  {m.media_type === 'video' ? (
                    <video src={m.url} />
                  ) : (
                    <img src={m.url} alt="Attachment" />
                  )}
                  <button
                    type="button"
                    className="composer__preview-remove"
                    onClick={() => handleRemoveMedia(idx)}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="composer__footer">
            <div className="composer__tools">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="button button--quiet"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia || posting}
              >
                <Icon name="media" size={16} />
                <span>{uploadingMedia ? 'Uploading…' : 'Add Media'}</span>
              </button>
            </div>

            <div className="composer__actions">
              <select
                className="composer__privacy"
                value={privacyLevel}
                onChange={(e) => setPrivacyLevel(e.target.value)}
                disabled={posting}
              >
                <option value="public">Public</option>
                <option value="friends_only">Friends Only</option>
                <option value="private">Only You</option>
              </select>
              <button
                type="submit"
                className="button button--primary"
                disabled={(!content.trim() && mediaList.length === 0) || posting || uploadingMedia}
              >
                {posting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </form>

        {error && <p className="form__error" role="alert">{error}</p>}
        {posts === null && !error && <p className="muted">Loading posts…</p>}
        {posts?.length === 0 && (
          <div className="empty">
            <p>No posts found. Write a post above or find friends to connect with.</p>
            <Link className="button button--primary" to="/friends?tab=find">
              Find Friends
            </Link>
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

      {/* Sidebar Rail */}
      <aside className="feed-rail" aria-label="Suggested friends and groups">
        {/* Suggested Friends */}
        {suggestions && suggestions.length > 0 && (
          <section className="rail-widget">
            <div className="rail-widget__header">
              <h2 className="rail-widget__title">Suggested Friends</h2>
              <Link to="/friends?tab=find" className="rail-widget__more">
                View All
              </Link>
            </div>
            <div className="suggestions-list">
              {suggestions.map((p) => (
                <div key={p.user_id} className="suggestion-row">
                  <Link to={`/users/${p.user_id}`} className="suggestion-row__user">
                    <Avatar user={p} size={34} />
                    <div className="suggestion-row__info">
                      <span className="suggestion-row__name">{displayName(p)}</span>
                      <span className="suggestion-row__handle">@{p.username}</span>
                    </div>
                  </Link>
                  <RelationshipButton
                    compact
                    userId={p.user_id}
                    relationship={p.relationship}
                    onChange={(rel) =>
                      setSuggestions((prev) =>
                        prev.map((item) => (item.user_id === p.user_id ? { ...item, relationship: rel } : item))
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Popular Groups */}
        {topGroups && topGroups.length > 0 && (
          <section className="rail-widget">
            <div className="rail-widget__header">
              <h2 className="rail-widget__title">Popular Groups</h2>
              <Link to="/groups" className="rail-widget__more">
                View All
              </Link>
            </div>
            <div className="circles-list">
              {topGroups.map((g) => (
                <Link key={g.group_id} to={`/groups/${g.group_id}`} className="circle-row">
                  <div className="circle-row__info">
                    <span className="circle-row__name">{g.name}</span>
                    <span className="circle-row__members">{g.member_count} {g.member_count === 1 ? 'member' : 'members'}</span>
                  </div>
                  <span className="tag">{g.visibility}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
