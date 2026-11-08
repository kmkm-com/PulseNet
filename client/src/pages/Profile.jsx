import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usersApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import RelationshipButton from '../components/RelationshipButton.jsx';
import { displayName, plural, pluralWord } from '../lib/format.js';
import { shortDate } from '../lib/time.js';

const RELATIONSHIP_NOTE = {
  request_sent: 'Friend request sent',
  request_received: 'Wants to be your friend',
  friends: 'Friends',
};

const STATS = [
  ['friend_count', 'friend'],
  ['post_count', 'post'],
  ['likes_received', 'like received', 'likes received'],
  ['group_count', 'group'],
];

export default function Profile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  // Also used after a friendship change, since friend_count moves
  const load = useCallback(() => {
    usersApi.profile(userId)
      .then((d) => { setProfile(d.user); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [userId]);

  useEffect(() => {
    setProfile(null);
    load();
  }, [load]);

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

  return (
    <section className="page page--narrow">
      <div className="profile">
        <Avatar user={profile} size={112} />
        <div className="profile__head">
          <h1 className="page__title profile__name">{displayName(profile)}</h1>
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
          <span>{plural(profile.mutual_friends, 'mutual friend')}</span>
        )}
      </p>

      <RelationshipButton userId={profile.user_id} relationship={profile.relationship} onChange={load} />

      <dl className="stats">
        {STATS.map(([key, one, many]) => (
          <div key={key} className="stats__item">
            <dt className="stats__label">{pluralWord(profile[key], one, many)}</dt>
            <dd className="stats__value">{profile[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
