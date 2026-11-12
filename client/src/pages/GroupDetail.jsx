import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { groupsApi, postsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import PostCard from '../components/PostCard.jsx';
import Icon from '../components/Icon.jsx';
import { timeAgo } from '../lib/time.js';

export default function GroupDetail() {
  const { groupId } = useParams();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState(null);
  const [members, setMembers] = useState(null);
  const [tab, setTab] = useState('posts'); // 'posts' | 'members'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Group Post Composer
  const [postContent, setPostContent] = useState('');
  const [mediaList, setMediaList] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const fileInputRef = useRef(null);

  const loadGroup = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await groupsApi.get(groupId);
      setGroup(data.group);

      if (!data.group.is_restricted) {
        const postsData = await groupsApi.posts(groupId);
        setPosts(postsData.posts);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await groupsApi.members(groupId);
      setMembers(data.members);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  useEffect(() => {
    if (tab === 'members' && !group?.is_restricted && members === null) {
      loadMembers();
    }
  }, [tab, group]);

  const handleJoin = async () => {
    try {
      await groupsApi.join(groupId);
      loadGroup();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await groupsApi.leave(groupId);
      loadGroup();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleMemberAction = async (targetUserId, role, status) => {
    try {
      await groupsApi.updateMember(groupId, targetUserId, { role, status });
      loadMembers();
      loadGroup();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleKickMember = async (targetUserId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await groupsApi.removeMember(groupId, targetUserId);
      loadMembers();
      loadGroup();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

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

  const handleCreateGroupPost = async (e) => {
    e.preventDefault();
    if ((!postContent.trim() && mediaList.length === 0) || posting) return;

    setPosting(true);
    setPostError('');
    try {
      await groupsApi.createPost(groupId, {
        content: postContent.trim(),
        media: mediaList,
      });
      setPostContent('');
      setMediaList([]);
      const postsData = await groupsApi.posts(groupId);
      setPosts(postsData.posts);
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

  if (loading && !group) {
    return (
      <section className="page page--narrow">
        <p className="muted">Loading group…</p>
      </section>
    );
  }

  if (error || !group) {
    return (
      <section className="page page--narrow">
        <p className="form__error" role="alert">{error || 'Group not found.'}</p>
        <Link to="/groups" className="button button--quiet" style={{ marginTop: '16px' }}>
          Back to Groups
        </Link>
      </section>
    );
  }

  const isAdmin = group.user_role === 'admin';
  const isMember = group.membership_status === 'active';
  const isPending = group.membership_status === 'pending';

  return (
    <section className="page page--narrow">
      <header className="page__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page__title">{group.name}</h1>
            <div className="circle-card__tags" style={{ marginTop: '8px' }}>
              <span className="tag">{group.visibility}</span>
              {group.user_role && (
                <span className="tag tag--role">
                  {group.user_role}
                </span>
              )}
              {isPending && <span className="tag">Pending Approval</span>}
              <span className="muted" style={{ fontSize: '12.5px', marginLeft: '6px' }}>
                👥 {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMember && !isPending && (
              <button type="button" className="button button--primary" onClick={handleJoin}>
                Join Group
              </button>
            )}
            {isPending && (
              <button type="button" className="button button--quiet" disabled>
                Pending Approval
              </button>
            )}
            {isMember && (
              <button type="button" className="button button--quiet" onClick={handleLeave}>
                Leave Group
              </button>
            )}
          </div>
        </div>

        {group.description && (
          <p className="profile__bio" style={{ marginTop: '14px' }}>
            {group.description}
          </p>
        )}
      </header>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'posts'}
          className="tabs__tab"
          onClick={() => setTab('posts')}
        >
          Posts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'members'}
          className="tabs__tab"
          onClick={() => setTab('members')}
        >
          Members
        </button>
      </div>

      {/* Restricted View Notice */}
      {group.is_restricted && (
        <div className="empty">
          <p>
            🔒 This group is private. You must join and be approved by an administrator to view posts and members.
          </p>
          {!isMember && !isPending && (
            <button type="button" className="button button--primary" onClick={handleJoin} style={{ marginTop: '14px' }}>
              Request to Join
            </button>
          )}
        </div>
      )}

      {/* Posts Tab */}
      {!group.is_restricted && tab === 'posts' && (
        <div>
          {/* Group Post Composer (Members only) */}
          {isMember ? (
            <form className="composer" onSubmit={handleCreateGroupPost}>
              {postError && <p className="form__error">{postError}</p>}
              <div className="composer__top">
                <Avatar user={user} size={38} />
                <textarea
                  className="composer__textarea"
                  placeholder={`Write something to ${group.name}…`}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  disabled={posting}
                  rows={2}
                />
              </div>

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
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={(!postContent.trim() && mediaList.length === 0) || posting || uploadingMedia}
                >
                  {posting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </form>
          ) : (
            <div className="notice-card" style={{ marginBottom: '24px' }}>
              <p className="muted">Join this group to post.</p>
            </div>
          )}

          {posts === null && <p className="muted">Loading posts…</p>}
          {posts?.length === 0 && (
            <div className="empty">
              <p>No posts in this group yet.</p>
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
        </div>
      )}

      {/* Members Tab */}
      {!group.is_restricted && tab === 'members' && (
        <div>
          {members === null && <p className="muted">Loading members…</p>}
          <div className="member-list">
            {members?.map((m) => (
              <article key={m.user_id} className="member-row">
                <Link to={`/users/${m.user_id}`} className="member-row__user">
                  <Avatar user={m} size={38} />
                  <div>
                    <span className="member-row__name">{m.username}</span>
                    <div className="member-row__meta">
                      <span className="tag">{m.role}</span>
                      {m.status !== 'active' && <span className="tag">{m.status}</span>}
                      <span className="muted">Joined {timeAgo(m.joined_at)}</span>
                    </div>
                  </div>
                </Link>

                {isAdmin && m.user_id !== user.user_id && (
                  <div className="member-row__admin-controls">
                    {m.status === 'pending' && (
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => handleMemberAction(m.user_id, m.role, 'active')}
                      >
                        Approve
                      </button>
                    )}
                    {m.role === 'member' ? (
                      <button
                        type="button"
                        className="button button--quiet"
                        onClick={() => handleMemberAction(m.user_id, 'admin', m.status)}
                      >
                        Make Admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button--quiet"
                        onClick={() => handleMemberAction(m.user_id, 'member', m.status)}
                      >
                        Remove Admin
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => handleKickMember(m.user_id)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
