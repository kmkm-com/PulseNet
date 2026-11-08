import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usersApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import RelationshipButton from '../components/RelationshipButton.jsx';
import { shortDate } from '../lib/time.js';

const RELATIONSHIP_NOTE = {
  request_sent: 'Friend request sent',
  request_received: 'Wants to be your friend',
  friends: 'Friends',
};

export default function Profile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setProfile(null);
    setError('');
    usersApi.profile(userId).then((d) => setProfile(d.user)).catch((e) => setError(errorMessage(e)));
  }, [userId]);

  if (error) {
    return (
      <section className="page page--narrow">
        <div className="empty">
          <p>{error}</p>
          <Link className="button button--primary" to="/friends?tab=find">Find people</Link>
        </div>
      </section>
    );
  }
  if (!profile) return <section className="page page--narrow"><p className="muted">Loading profile…</p></section>;

  // Reload counts after a friendship change (friend_count moves)
  const onRelationshipChange = () => usersApi.profile(userId).then((d) => setProfile(d.user)).catch(() => {});

  const stats = [
    { value: profile.friend_count, label: profile.friend_count === 1 ? 'friend' : 'friends' },
    { value: profile.post_count, label: profile.post_count === 1 ? 'post' : 'posts' },
    { value: profile.likes_received, label: profile.likes_received === 1 ? 'like received' : 'likes received' },
    { value: profile.group_count, label: profile.group_count === 1 ? 'group' : 'groups' },
  ];

  return (
    <section className="page page--narrow">
      <div className="profile">
        <Avatar user={profile} size={112} />
        <div className="profile__head">
          <h1 className="profile__name">{profile.full_name || profile.username}</h1>
          <p className="profile__handle">@{profile.username}</p>
          {RELATIONSHIP_NOTE[profile.relationship] && (
            <p className="profile__relationship">{RELATIONSHIP_NOTE[profile.relationship]}</p>
          )}
        </div>
      </div>

      {profile.bio && <p className="profile__bio">{profile.bio}</p>}
      <p className="profile__facts muted">
        {profile.location && <span>{profile.location}</span>}
        <span>Joined {shortDate(profile.joined_at)}</span>
        {profile.relationship !== 'self' && profile.mutual_friends > 0 && (
          <span>{profile.mutual_friends} mutual {profile.mutual_friends === 1 ? 'friend' : 'friends'}</span>
        )}
      </p>

      <RelationshipButton userId={profile.user_id} relationship={profile.relationship} onChange={onRelationshipChange} />

      <dl className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stats__item">
            <dt className="stats__label">{s.label}</dt>
            <dd className="stats__value">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
