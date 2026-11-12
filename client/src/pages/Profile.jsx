import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usersApi, postsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import RelationshipButton from '../components/RelationshipButton.jsx';
import PostCard from '../components/PostCard.jsx';
import Icon from '../components/Icon.jsx';
import { displayName, plural, pluralWord } from '../lib/format.js';
import { shortDate } from '../lib/time.js';

const RELATIONSHIP_NOTE = {
  request_sent: 'Friend request sent',
  request_received: 'Wants to be your friend',
  friends: 'Friends',
};

const STATS = [
  ['friend_count', 'friend', 'friends'],
  ['post_count', 'post', 'posts'],
  ['likes_received', 'like', 'likes'],
  ['group_count', 'group', 'groups'],
];

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  // User posts state
  const [posts, setPosts] = useState(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState('');

  // Edit Profile modal state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editError, setEditError] = useState('');
  const fileInputRef = useRef(null);

  const loadProfile = useCallback(() => {
    usersApi
      .profile(userId)
      .then((d) => {
        setProfile(d.user);
        setError('');
        if (currentUser?.user_id === Number(userId)) {
          setFullName(d.user.full_name || '');
          setBio(d.user.bio || '');
          setLocation(d.user.location || '');
          setWebsiteUrl(d.user.website_url || '');
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [userId, currentUser]);

  const loadPosts = useCallback(() => {
    setLoadingPosts(true);
    postsApi
      .feed({ author_id: userId, limit: 30 })
      .then((d) => {
        setPosts(d.posts);
        setPostsError('');
      })
      .catch((e) => setPostsError(errorMessage(e)))
      .finally(() => setLoadingPosts(false));
  }, [userId]);

  useEffect(() => {
    setProfile(null);
    setPosts(null);
    loadProfile();
    loadPosts();
  }, [loadProfile, loadPosts]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      await usersApi.updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website_url: websiteUrl.trim(),
      });
      setIsEditing(false);
      loadProfile();
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setEditError('');
    try {
      await usersApi.uploadAvatar(file);
      loadProfile();
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  if (error) {
    return (
      <section className="page page--narrow">
        <p className="form__error" role="alert">{error}</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="page page--narrow">
        <p className="muted">Loading profile…</p>
      </section>
    );
  }

  const isSelf = profile.relationship === 'self';

  return (
    <section className="page page--narrow">
      <div className="profile">
        <div className="profile__avatar-container">
          <Avatar user={profile} size={96} />
          {isSelf && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="profile__avatar-edit"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Change Avatar"
              >
                <Icon name="media" size={14} />
              </button>
            </>
          )}
        </div>

        <div className="profile__info">
          <div className="profile__header-top">
            <div>
              <h1 className="profile__name">{displayName(profile)}</h1>
              <p className="profile__handle">@{profile.username}</p>
            </div>
            {isSelf ? (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Icon name="edit" size={15} />
                <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
              </button>
            ) : (
              <RelationshipButton userId={profile.user_id} relationship={profile.relationship} onChange={loadProfile} />
            )}
          </div>

          {RELATIONSHIP_NOTE[profile.relationship] && (
            <p className="profile__status-badge">
              {RELATIONSHIP_NOTE[profile.relationship]}
            </p>
          )}

          {profile.bio && <p className="profile__bio">{profile.bio}</p>}

          <div className="profile__facts">
            {profile.location && <span className="profile__fact">📍 {profile.location}</span>}
            {profile.website_url && (
              <span className="profile__fact">
                🔗{' '}
                <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="profile__link">
                  {profile.website_url}
                </a>
              </span>
            )}
            <span className="profile__fact">Joined {shortDate(profile.joined_at)}</span>
            {profile.relationship !== 'self' && profile.mutual_friends > 0 && (
              <span className="profile__fact">{plural(profile.mutual_friends, 'mutual friend')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      {isEditing && (
        <form className="form-card" onSubmit={handleSaveProfile}>
          <h2 className="form-card__title">Edit Profile</h2>
          {editError && <p className="form__error">{editError}</p>}
          <div className="field">
            <label className="field__label">Full Name</label>
            <input
              type="text"
              className="field__input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="field">
            <label className="field__label">Bio</label>
            <textarea
              className="composer__textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell others about yourself…"
            />
          </div>
          <div className="form-card__grid">
            <div className="field">
              <label className="field__label">Location</label>
              <input
                type="text"
                className="field__input"
                placeholder="e.g. Hyderabad, India"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Website</label>
              <input
                type="url"
                className="field__input"
                placeholder="https://..."
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="form-card__actions">
            <button type="button" className="button button--quiet" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* 4-Column Statistics */}
      <dl className="stats">
        {STATS.map(([key, one, many]) => (
          <div key={key} className="stats__item">
            <dt className="stats__label">{pluralWord(profile[key], one, many)}</dt>
            <dd className="stats__value">{profile[key]}</dd>
          </div>
        ))}
      </dl>

      {/* Posts Stream */}
      <section className="profile__stream">
        <header className="profile__stream-header">
          <h2 className="profile__stream-title">
            Posts by {isSelf ? 'You' : displayName(profile)}
          </h2>
          {posts && <span className="tag">{posts.length}</span>}
        </header>

        {postsError && <p className="form__error">{postsError}</p>}
        {loadingPosts && <p className="muted">Loading posts…</p>}
        {!loadingPosts && posts?.length === 0 && (
          <div className="empty">
            <p>No posts published yet.</p>
            {isSelf && (
              <Link className="button button--primary" to="/">
                Create Post
              </Link>
            )}
          </div>
        )}

        {posts?.length > 0 && (
          <ol className="rows">
            {posts.map((post) => (
              <PostCard
                key={post.post_id}
                post={post}
                currentUser={currentUser}
                onDeletePost={handleDeletePost}
                onUpdatePost={handleUpdatePost}
              />
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
