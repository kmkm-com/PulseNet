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
  { id: 'friends', label: 'Your friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'find', label: 'Find people' },
];

// List-state helpers: drop a person, or update their relationship
const without = (id) => (list) => list.filter((p) => p.user_id !== id);
const withRelationship = (id, relationship) => (list) =>
  list.map((p) => (p.user_id === id ? { ...p, relationship } : p));

export default function Friends() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'friends';
  const [incomingCount, setIncomingCount] = useState(0);

  // Count for the Requests tab label; the Requests tab reports its own count
  useEffect(() => {
    if (tab === 'requests') return;
    friendsApi.requests('incoming').then((d) => setIncomingCount(d.requests.length)).catch(() => {});
  }, [tab]);

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
            {t.id === 'requests' && incomingCount > 0 && <span className="count">{incomingCount}</span>}
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

  return (
    <>
      <RequestSection title="Sent to you" empty="No new requests." requests={incoming}
        relationship="request_received" setRequests={setIncoming} />
      <RequestSection title="Sent by you" empty="You have no pending requests." requests={outgoing}
        relationship="request_sent" setRequests={setOutgoing} />
    </>
  );
}

function RequestSection({ title, empty, requests, relationship, setRequests }) {
  return (
    <>
      <h2 className="section-title">{title}</h2>
      {requests.length === 0 ? (
        <p className="muted section-empty">{empty}</p>
      ) : (
        <ul className="rows">
          {requests.map((r) => (
            <PersonRow key={r.user_id} person={r} detail={`Sent ${shortDate(r.requested_at)}`}>
              <RelationshipButton
                userId={r.user_id}
                relationship={relationship}
                onChange={() => setRequests(without(r.user_id))}
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
        results.length === 0
          ? <p className="muted section-empty">No one matches "{query.trim()}".</p>
          : <PeopleList people={results} setPeople={setResults} />
      ) : (
        <>
          <h2 className="section-title">People you may know</h2>
          {suggestions === null && <p className="muted">Loading suggestions…</p>}
          {suggestions?.length === 0 && (
            <p className="muted section-empty">Suggestions appear once your friends have friends you haven't met.</p>
          )}
          {suggestions && (
            <PeopleList
              people={suggestions}
              setPeople={setSuggestions}
              detail={(p) => `${plural(p.mutual_friends, 'mutual friend')}`}
            />
          )}
        </>
      )}
    </>
  );
}

function PeopleList({ people, setPeople, detail }) {
  return (
    <ul className="rows">
      {people.map((p) => (
        <PersonRow key={p.user_id} person={p} detail={detail?.(p)}>
          <RelationshipButton
            compact
            userId={p.user_id}
            relationship={p.relationship}
            onChange={(rel) => setPeople(withRelationship(p.user_id, rel))}
          />
        </PersonRow>
      ))}
    </ul>
  );
}
