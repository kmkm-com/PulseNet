import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';
import { useCounts } from '../context/CountsContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { isToday, timeAgo } from '../lib/time.js';

const PAGE = 20;

// What each notification says, and where clicking it goes
const KINDS = {
  friend_request: { text: 'sent you a friend request', to: () => '/friends?tab=requests' },
  friend_accepted: { text: 'accepted your friend request', to: (n) => `/users/${n.actor_id}` },
  post_like: { text: 'liked your post', to: () => '/' },
  post_comment: { text: 'commented on your post', to: () => '/' },
  direct_message: { text: 'sent you a message', to: (n) => `/messages/${n.actor_id}` },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications: unreadCount } = useCounts();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (offset = 0) => {
    try {
      const data = await notificationsApi.list({ unread: unreadOnly || undefined, limit: PAGE, offset });
      setItems((cur) => (offset === 0 ? data.notifications : [...cur, ...data.notifications]));
      setHasMore(data.notifications.length === PAGE);
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [unreadOnly]);

  useEffect(() => {
    setItems(null);
    load(0);
  }, [load]);

  const open = async (n) => {
    if (!n.is_read) await notificationsApi.markRead(n.notification_id).catch(() => {});
    navigate(KINDS[n.notification_type]?.to(n) || '/');
  };

  const remove = async (n) => {
    try {
      await notificationsApi.remove(n.notification_id);
      setItems((cur) => cur.filter((x) => x.notification_id !== n.notification_id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((cur) => (unreadOnly ? [] : cur.map((x) => ({ ...x, is_read: true }))));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const today = items?.filter((n) => isToday(n.created_at)) || [];
  const earlier = items?.filter((n) => !isToday(n.created_at)) || [];

  return (
    <section className="page page--narrow">
      <header className="page__header page__header--split">
        <h1 className="page__title">Notifications</h1>
        <button className="button button--quiet" onClick={markAll} disabled={!unreadCount}>
          Mark all as read
        </button>
      </header>
      <div className="tabs" role="tablist" aria-label="Filter notifications">
        <button role="tab" className="tabs__tab" aria-selected={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</button>
        <button role="tab" className="tabs__tab" aria-selected={unreadOnly} onClick={() => setUnreadOnly(true)}>
          Unread
          {unreadCount > 0 && <span className="count">{unreadCount}</span>}
        </button>
      </div>

      {error && <p className="form__error" role="alert">{error}</p>}
      {items === null && !error && <p className="muted">Loading notifications…</p>}
      {items?.length === 0 && (
        <div className="empty">
          <p>{unreadOnly ? "You're all caught up." : 'No notifications yet. Activity from friends shows up here.'}</p>
          {!unreadOnly && <Link className="button button--primary" to="/friends?tab=find">Find people</Link>}
        </div>
      )}

      {today.length > 0 && <Group title="Today" items={today} onOpen={open} onRemove={remove} />}
      {earlier.length > 0 && <Group title="Earlier" items={earlier} onOpen={open} onRemove={remove} />}

      {hasMore && (
        <button className="button button--quiet load-more" onClick={() => load(items.length)}>
          Show older notifications
        </button>
      )}
    </section>
  );
}

function Group({ title, items, onOpen, onRemove }) {
  return (
    <>
      <h2 className="section-title">{title}</h2>
      <ul className="rows">
        {items.map((n) => {
          const kind = KINDS[n.notification_type];
          const actor = { user_id: n.actor_id, username: n.actor_username, avatar_url: n.actor_avatar_url };
          return (
            <li key={n.notification_id} className={`note${n.is_read ? '' : ' note--unread'}`}>
              <button className="note__main" onClick={() => onOpen(n)}>
                <Avatar user={actor} size={40} />
                <span className="note__text">
                  <span>
                    <strong>{n.actor_username || 'Someone'}</strong> {kind?.text || 'did something'}
                  </span>
                  {n.post_preview && <span className="note__preview">“{n.post_preview}”</span>}
                  <span className="note__time">
                    {timeAgo(n.created_at)}
                    {!n.is_read && <span className="visually-hidden">, unread</span>}
                  </span>
                </span>
              </button>
              <button className="icon-button note__remove" onClick={() => onRemove(n)} aria-label="Delete notification" title="Delete">
                <Icon name="close" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
