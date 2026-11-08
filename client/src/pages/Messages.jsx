import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { friendsApi, messagesApi, usersApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCounts } from '../context/CountsContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import RelationshipButton from '../components/RelationshipButton.jsx';
import { messageTime, timeAgo } from '../lib/time.js';

const INBOX_POLL_MS = 15000;
const THREAD_POLL_MS = 5000;
const MAX_LENGTH = 2000;

export default function Messages() {
  const { userId } = useParams();
  const [inbox, setInbox] = useState(null);
  const [error, setError] = useState('');

  const loadInbox = useCallback(() => {
    messagesApi.inbox()
      .then((d) => { setInbox(d.conversations); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    loadInbox();
    const id = setInterval(loadInbox, INBOX_POLL_MS);
    return () => clearInterval(id);
  }, [loadInbox]);

  return (
    <section className={`messages${userId ? ' messages--thread-open' : ''}`}>
      <Inbox inbox={inbox} error={error} activeId={Number(userId)} />
      {userId ? (
        <Thread key={userId} otherId={Number(userId)} onActivity={loadInbox} />
      ) : (
        <div className="thread thread--placeholder">
          <p className="muted">Choose a conversation, or start one with a friend.</p>
        </div>
      )}
    </section>
  );
}

function Inbox({ inbox, error, activeId }) {
  const { user } = useAuth();
  const [picking, setPicking] = useState(false);

  return (
    <aside className="inbox" aria-label="Conversations">
      <header className="inbox__header">
        <h1 className="page__title">Messages</h1>
        <button className="button button--quiet" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
          {picking ? 'Close' : 'New message'}
        </button>
      </header>
      {picking && <FriendPicker onPick={() => setPicking(false)} />}
      {error && <p className="form__error" role="alert">{error}</p>}
      {inbox === null && !error && <p className="muted inbox__note">Loading conversations…</p>}
      {inbox?.length === 0 && !picking && (
        <p className="muted inbox__note">No conversations yet. Start one with New message.</p>
      )}
      <ul className="inbox__list">
        {inbox?.map((c) => (
          <li key={c.user_id}>
            <NavLink
              to={`/messages/${c.user_id}`}
              className={`convo${c.unread_count ? ' convo--unread' : ''}${c.user_id === activeId ? ' active' : ''}`}
            >
              <Avatar user={c} size={44} />
              <span className="convo__text">
                <span className="convo__top">
                  <span className="convo__name">{c.full_name || c.username}</span>
                  <span className="convo__time">{timeAgo(c.last_sent_at)}</span>
                </span>
                <span className="convo__preview">
                  {c.last_sender_id === user.user_id && 'You: '}
                  {c.last_message}
                </span>
              </span>
              {c.unread_count > 0 && (
                <span className="convo__unread" aria-label={`${c.unread_count} unread`}>{c.unread_count}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// Friends list to start a new conversation from
function FriendPicker({ onPick }) {
  const navigate = useNavigate();
  const [friends, setFriends] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    friendsApi.list().then((d) => setFriends(d.friends)).catch(() => setFriends([]));
  }, []);

  const shown = (friends || []).filter((f) =>
    `${f.username} ${f.full_name || ''}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <div className="picker">
      <label className="search search--small">
        <Icon name="search" size={18} />
        <span className="visually-hidden">Filter friends</span>
        <input autoFocus placeholder="Message a friend" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      {friends?.length === 0 && (
        <p className="muted inbox__note">
          You can message friends only. <Link to="/friends?tab=find">Find people</Link>
        </p>
      )}
      <ul className="picker__list">
        {shown.map((f) => (
          <li key={f.user_id}>
            <button className="picker__item" onClick={() => { onPick(); navigate(`/messages/${f.user_id}`); }}>
              <Avatar user={f} size={32} />
              <span>{f.full_name || f.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thread({ otherId, onActivity }) {
  const { user } = useAuth();
  const { refresh: refreshCounts } = useCounts();
  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState(null); // oldest first
  const [nextBefore, setNextBefore] = useState(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const scroller = useRef(null);
  const stickToBottom = useRef(true);

  // Merge a newest-first page into the oldest-first list, by message_id
  const merge = (current, page) => {
    const byId = new Map((current || []).map((m) => [m.message_id, m]));
    page.forEach((m) => byId.set(m.message_id, m));
    return [...byId.values()].sort((a, b) => a.message_id - b.message_id);
  };

  const markReadIfNeeded = useCallback(async (page) => {
    if (page.some((m) => m.sender_id === otherId && !m.read_at)) {
      await messagesApi.markRead(otherId).catch(() => {});
      refreshCounts();
      onActivity();
    }
  }, [otherId, refreshCounts, onActivity]);

  const loadLatest = useCallback(async (initial = false) => {
    try {
      const data = await messagesApi.conversation(otherId, { limit: 50 });
      setMessages((cur) => merge(cur, data.messages));
      if (initial) setNextBefore(data.next_before);
      setError('');
      markReadIfNeeded(data.messages);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [otherId, markReadIfNeeded]);

  useEffect(() => {
    usersApi.profile(otherId).then((d) => setOther(d.user)).catch((e) => setError(errorMessage(e)));
    loadLatest(true);
    const id = setInterval(() => loadLatest(false), THREAD_POLL_MS);
    return () => clearInterval(id);
  }, [otherId, loadLatest]);

  const loadEarlier = async () => {
    stickToBottom.current = false;
    const data = await messagesApi.conversation(otherId, { limit: 50, before: nextBefore });
    setMessages((cur) => merge(cur, data.messages));
    setNextBefore(data.next_before);
  };

  // Keep the view pinned to the newest message unless the user scrolled up
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scroller.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async (e) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError('');
    try {
      const { message } = await messagesApi.send(otherId, content);
      stickToBottom.current = true;
      setMessages((cur) => merge(cur, [message]));
      setDraft('');
      onActivity();
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const lastMine = messages ? [...messages].reverse().find((m) => m.sender_id === user.user_id) : null;
  const canMessage = other?.relationship === 'friends';

  return (
    <div className="thread">
      <header className="thread__header">
        <Link to="/messages" className="icon-button thread__back" aria-label="Back to conversations">
          <Icon name="back" />
        </Link>
        {other && (
          <Link to={`/users/${other.user_id}`} className="thread__who">
            <Avatar user={other} size={38} />
            <span>
              <span className="thread__name">{other.full_name || other.username}</span>
              <span className="thread__handle">@{other.username}</span>
            </span>
          </Link>
        )}
      </header>

      <div className="thread__scroll" ref={scroller} onScroll={onScroll} aria-live="polite">
        {error && <p className="form__error" role="alert">{error}</p>}
        {nextBefore && (
          <button className="button button--quiet thread__earlier" onClick={loadEarlier}>
            Show earlier messages
          </button>
        )}
        {messages?.length === 0 && other && (
          <p className="muted thread__empty">This is the start of your conversation with {other.full_name || other.username}.</p>
        )}
        <ol className="bubbles">
          {messages?.map((m, i) => {
            const mine = m.sender_id === user.user_id;
            const next = messages[i + 1];
            // Show the time under the last bubble of each run from the same sender
            const endOfRun = !next || next.sender_id !== m.sender_id
              || new Date(next.sent_at) - new Date(m.sent_at) > 5 * 60 * 1000;
            return (
              <li key={m.message_id} className={`bubble-row${mine ? ' bubble-row--mine' : ''}${endOfRun ? ' bubble-row--end' : ''}`}>
                <p className="bubble">{m.content}</p>
                {endOfRun && (
                  <span className="bubble__meta">
                    {messageTime(m.sent_at)}
                    {m === lastMine && (m.read_at ? ', seen' : ', sent')}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {other && !canMessage ? (
        <div className="thread__blocked">
          <p>You can message {other.full_name || other.username} once you're friends.</p>
          <RelationshipButton
            userId={other.user_id}
            relationship={other.relationship}
            onChange={(relationship) => setOther({ ...other, relationship })}
          />
        </div>
      ) : (
        <form className="composer" onSubmit={send}>
          <label className="visually-hidden" htmlFor="composer-input">Message</label>
          <textarea
            id="composer-input"
            rows={1}
            placeholder="Write a message"
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="button button--primary composer__send" disabled={!draft.trim() || sending} aria-label="Send">
            <Icon name="send" size={20} />
          </button>
          {sendError && <p className="inline-error composer__error" role="alert">{sendError}</p>}
        </form>
      )}
    </div>
  );
}
