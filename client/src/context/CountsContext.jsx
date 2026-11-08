import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CHANGED_EVENT } from '../api/client.js';
import { messagesApi, notificationsApi } from '../api/index.js';

// Unread message and notification counts for the nav badges.
// There is no websocket, so counts are polled while the tab is visible,
// and refreshed right after any write the app makes (CHANGED_EVENT).
const POLL_MS = 15000;

const CountsContext = createContext(null);

export function CountsProvider({ children }) {
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });

  const refresh = useCallback(async () => {
    try {
      const [m, n] = await Promise.all([messagesApi.unreadCount(), notificationsApi.unreadCount()]);
      setCounts((prev) =>
        prev.messages === m.unread_count && prev.notifications === n.unread_count
          ? prev
          : { messages: m.unread_count, notifications: n.unread_count }
      );
    } catch {
      // keep the last known counts; the next poll will retry
    }
  }, []);

  useEffect(() => {
    refresh();
    const tick = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  // counts keeps its identity until a number changes, so consumers re-render only then
  return <CountsContext.Provider value={counts}>{children}</CountsContext.Provider>;
}

export const useCounts = () => useContext(CountsContext);
