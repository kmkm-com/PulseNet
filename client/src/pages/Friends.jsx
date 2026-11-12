import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { friendsApi, usersApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import PersonRow from '../components/PersonRow.jsx';
import RelationshipButton from '../components/RelationshipButton.jsx';
import Icon from '../components/Icon.jsx';
import { plural } from '../lib/format.js';
import { shortDate } from '../lib/time.js';

const TABS = [
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'find', label: 'Find People' },
];

const without = (id) => (list) => list.filter((p) => p.user_id !== id);

export default function Friends() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'friends';
  const [incomingCount, setIncomingCount] = useState(0);

  useEffect(() => {
    if (tab === 'requests') return;
    friendsApi.requests('incoming').then((d) => setIncomingCount(d.requests.length)).catch(() => {});
  }, [tab]);

  return (
    <section className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">Friends</h1>
        <p className="page__subtitle">Manage your connections and friend requests</p>
      </header>
      <div className="tabs" role="tablist" aria-label="Friends sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="tabs__tab"
            onClick={() => setParams(t.id === 'friends' ? {} : { tab: t.id })}
          >
            {t.label}
            {t.id === 'requests' && incomingCount > 0 && <span className="count-pill" style={{ marginLeft: '6px' }}>{incomingCount}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'friends' && <FriendsList />}
        {tab === 'requests' && <Requests onIncomingCount={setIncomingCount} />}
        {tab === 'find' && <FindPeople />}
      </div>
    </section>
  );
}

function FriendsList() {
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    friendsApi.list().then((d) => setFriends(d.friends)).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="form__error" role="alert">{error}</p>;
  if (friends === null) return <p className="muted">Loading friends…</p>;
  if (friends.length === 0) {
    return (
      <div className="empty">
        <p>No friends yet. Find people to connect with.</p>
        <Link className="button button--primary" to="/friends?tab=find">Find People</Link>
      </div>
    );
  }
  return (
    <ul className="rows">
      {friends.map((f) => (
        <PersonRow key={f.user_id} person={f} detail={`Friends since ${shortDate(f.friends_since)}`}>
          <Link className="icon-button" to={`/messages/${f.user_id}`} aria-label={`Message ${f.username}`} title="Message">
            <Icon name="messages" size={18} />
          </Link>
          <RelationshipButton
            compact
            userId={f.user_id}
            relationship="friends"
            onChange={() => setFriends(without(f.user_id))}
          />
        </PersonRow>
      ))}
    </ul>
  );
}

function Requests({ onIncomingCount }) {
  const [incoming, setIncoming] = useState(null);
  const [outgoing, setOutgoing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([friendsApi.requests('incoming'), friendsApi.requests('outgoing')])
      .then(([inRes, outRes]) => {
        setIncoming(inRes.requests);
        setOutgoing(outRes.requests);
        onIncomingCount(inRes.requests.length);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [onIncomingCount]);

  if (error) return <p className="form__error" role="alert">{error}</p>;
  if (incoming === null || outgoing === null) return <p className="muted">Loading requests…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 className="section-title" style={{ marginBottom: '14px' }}>
          <span>Friend Requests</span>
          {incoming.length > 0 && <span className="tag" style={{ marginLeft: '8px' }}>{incoming.length}</span>}
        </h2>
        {incoming.length === 0 ? (
          <p className="muted">No pending friend requests.</p>
        ) : (
          <ul className="rows">
            {incoming.map((r) => {
              const dateStr = shortDate(r.requested_at || r.created_at);
              return (
                <PersonRow key={r.user_id} person={r} detail={dateStr ? `Request received ${dateStr}` : 'Request pending'}>
                  <RelationshipButton
                    compact
                    userId={r.user_id}
                    relationship="request_received"
                    onChange={() => {
                      setIncoming(without(r.user_id));
                      onIncomingCount(incoming.length - 1);
                    }}
                  />
                </PersonRow>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="section-title" style={{ marginBottom: '14px' }}>
          <span>Sent Requests</span>
          {outgoing.length > 0 && <span className="tag" style={{ marginLeft: '8px' }}>{outgoing.length}</span>}
        </h2>
        {outgoing.length === 0 ? (
          <p className="muted">You have no active sent requests.</p>
        ) : (
          <ul className="rows">
            {outgoing.map((r) => {
              const dateStr = shortDate(r.requested_at || r.created_at);
              return (
                <PersonRow key={r.user_id} person={r} detail={dateStr ? `Sent ${dateStr}` : 'Request sent'}>
                  <RelationshipButton
                    compact
                    userId={r.user_id}
                    relationship="request_sent"
                    onChange={() => setOutgoing(without(r.user_id))}
                  />
                </PersonRow>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FindPeople() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    friendsApi.suggestions().then((d) => setSuggestions(d.suggestions)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    usersApi
      .search(query.trim())
      .then((d) => {
        setResults(d.users);
        setError('');
      })
      .catch((err) => setError(errorMessage(err)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          className="search-form__input"
          placeholder="Search by name or username…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="button button--quiet">
          Search
        </button>
      </form>

      {error && <p className="form__error" role="alert">{error}</p>}

      {results !== null && (
        <div>
          <h2 className="section-title" style={{ marginBottom: '14px' }}>
            <span>Search Results</span>
            <span className="tag" style={{ marginLeft: '8px' }}>{results.length}</span>
          </h2>
          {results.length === 0 ? (
            <p className="muted">No users found matching "{query}".</p>
          ) : (
            <ul className="rows">
              {results.map((p) => (
                <PersonRow
                  key={p.user_id}
                  person={p}
                  detail={p.mutual_friends ? plural(p.mutual_friends, 'mutual friend') : (p.location || null)}
                >
                  <RelationshipButton
                    compact
                    userId={p.user_id}
                    relationship={p.relationship}
                    onChange={(rel) =>
                      setResults((prev) =>
                        prev.map((item) => (item.user_id === p.user_id ? { ...item, relationship: rel } : item))
                      )
                    }
                  />
                </PersonRow>
              ))}
            </ul>
          )}
        </div>
      )}

      {suggestions && suggestions.length > 0 && results === null && (
        <div>
          <h2 className="section-title" style={{ marginBottom: '14px' }}>
            <span>Suggested Friends</span>
          </h2>
          <ul className="rows">
            {suggestions.map((p) => (
              <PersonRow
                key={p.user_id}
                person={p}
                detail={p.mutual_friends ? plural(p.mutual_friends, 'mutual friend') : (p.location || null)}
              >
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
              </PersonRow>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
