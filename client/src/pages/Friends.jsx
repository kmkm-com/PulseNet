import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { friendsApi, usersApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useCounts } from '../context/CountsContext.jsx';
import PersonRow from '../components/PersonRow.jsx';
import RelationshipButton from '../components/RelationshipButton.jsx';
import Icon from '../components/Icon.jsx';
import { shortDate } from '../lib/time.js';

const TABS = [
  { id: 'friends', label: 'Your friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'find', label: 'Find people' },
];

export default function Friends() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'friends';
  const [incomingCount, setIncomingCount] = useState(0);

  return (
    <section className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">Friends</h1>
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
            {t.id === 'requests' && incomingCount > 0 && <span className="tabs__count">{incomingCount}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'friends' && <FriendsList />}
        {tab === 'requests' && <Requests onIncomingCount={setIncomingCount} />}
        {tab === 'find' && <FindPeople />}
      </div>
      {/* Keep the Requests count fresh even when another tab is open */}
      {tab !== 'requests' && <IncomingCounter onCount={setIncomingCount} />}
    </section>
  );
}

function IncomingCounter({ onCount }) {
  useEffect(() => {
    friendsApi.requests('incoming').then((d) => onCount(d.requests.length)).catch(() => {});
  }, [onCount]);
  return null;
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
        <p>You haven't added any friends yet.</p>
        <Link className="button button--primary" to="/friends?tab=find">Find people</Link>
      </div>
    );
  }
  return (
    <ul className="rows">
      {friends.map((f) => (
        <PersonRow key={f.user_id} person={f} detail={`Friends since ${shortDate(f.friends_since)}`}>
          <Link className="icon-button" to={`/messages/${f.user_id}`} aria-label={`Message ${f.username}`} title="Message">
            <Icon name="messages" size={20} />
          </Link>
          <RelationshipButton
            compact
            userId={f.user_id}
            relationship="friends"
            onChange={() => setFriends((list) => list.filter((x) => x.user_id !== f.user_id))}
          />
        </PersonRow>
      ))}
    </ul>
  );
}

function Requests({ onIncomingCount }) {
  const { refresh } = useCounts();
  const [incoming, setIncoming] = useState(null);
  const [outgoing, setOutgoing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([friendsApi.requests('incoming'), friendsApi.requests('outgoing')])
      .then(([i, o]) => {
        setIncoming(i.requests);
        setOutgoing(o.requests);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (incoming) onIncomingCount(incoming.length);
  }, [incoming, onIncomingCount]);

  if (error) return <p className="form__error" role="alert">{error}</p>;
  if (incoming === null) return <p className="muted">Loading requests…</p>;

  const drop = (setter, id) => setter((list) => list.filter((x) => x.user_id !== id));

  return (
    <>
      <h2 className="section-title">Sent to you</h2>
      {incoming.length === 0 ? (
        <p className="muted section-empty">No new requests.</p>
      ) : (
        <ul className="rows">
          {incoming.map((r) => (
            <PersonRow key={r.user_id} person={r} detail={`Sent ${shortDate(r.requested_at)}`}>
              <RelationshipButton
                userId={r.user_id}
                relationship="request_received"
                onChange={() => {
                  drop(setIncoming, r.user_id);
                  refresh(); // answering marks the request notification read
                }}
              />
            </PersonRow>
          ))}
        </ul>
      )}

      <h2 className="section-title">Sent by you</h2>
      {outgoing.length === 0 ? (
        <p className="muted section-empty">You have no pending requests.</p>
      ) : (
        <ul className="rows">
          {outgoing.map((r) => (
            <PersonRow key={r.user_id} person={r} detail={`Sent ${shortDate(r.requested_at)}`}>
              <RelationshipButton
                userId={r.user_id}
                relationship="request_sent"
                onChange={() => drop(setOutgoing, r.user_id)}
              />
            </PersonRow>
          ))}
        </ul>
      )}
    </>
  );
}

function FindPeople() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    friendsApi.suggestions()
      .then((d) => setSuggestions(d.suggestions.map((s) => ({ ...s, relationship: 'none' }))))
      .catch(() => setSuggestions([]));
  }, []);

  // Search 300ms after the user stops typing
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const id = setTimeout(() => {
      usersApi.search(q)
        .then((d) => { setResults(d.users); setError(''); })
        .catch((e) => setError(errorMessage(e)));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const updateIn = useCallback((setter) => (userId, relationship) =>
    setter((list) => list.map((p) => (p.user_id === userId ? { ...p, relationship } : p))), []);

  return (
    <>
      <label className="search">
        <Icon name="search" size={20} />
        <span className="visually-hidden">Search people</span>
        <input
          type="search"
          placeholder="Search by name or username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      {error && <p className="form__error" role="alert">{error}</p>}

      {results !== null ? (
        results.length === 0 ? (
          <p className="muted section-empty">No one matches "{query.trim()}".</p>
        ) : (
          <ul className="rows">
            {results.map((p) => (
              <PersonRow key={p.user_id} person={p}>
                <RelationshipButton
                  compact
                  userId={p.user_id}
                  relationship={p.relationship}
                  onChange={(rel) => updateIn(setResults)(p.user_id, rel)}
                />
              </PersonRow>
            ))}
          </ul>
        )
      ) : (
        <>
          <h2 className="section-title">People you may know</h2>
          {suggestions === null && <p className="muted">Loading suggestions…</p>}
          {suggestions?.length === 0 && (
            <p className="muted section-empty">Suggestions appear once your friends have friends you haven't met.</p>
          )}
          <ul className="rows">
            {suggestions?.map((p) => (
              <PersonRow
                key={p.user_id}
                person={p}
                detail={`${p.mutual_friends} mutual ${p.mutual_friends === 1 ? 'friend' : 'friends'}`}
              >
                <RelationshipButton
                  compact
                  userId={p.user_id}
                  relationship={p.relationship}
                  onChange={(rel) => updateIn(setSuggestions)(p.user_id, rel)}
                />
              </PersonRow>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
