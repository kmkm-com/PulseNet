import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { messagesApi, notificationsApi } from '../api/index.js';

// Unread message and notification counts for the nav badges.
// There is no websocket, so counts are polled; pages call refresh()
// right after they change something so badges update immediately.
const POLL_MS = 15000;

const CountsContext = createContext(null);

export function CountsProvider({ children }) {
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });

  const refresh = useCallback(async () => {
    try {
      const [m, n] = await Promise.all([messagesApi.unreadCount(), notificationsApi.unreadCount()]);
      setCounts({ messages: m.unread_count, notifications: n.unread_count });
    } catch {
      // keep the last known counts; the next poll will retry
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return <CountsContext.Provider value={{ ...counts, refresh }}>{children}</CountsContext.Provider>;
}

export const useCounts = () => useContext(CountsContext);
