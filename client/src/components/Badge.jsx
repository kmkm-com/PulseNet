import { useEffect, useRef, useState } from 'react';

// Unread counter. When the count goes up, the badge "beats" once,
// the app's single attention animation (disabled for reduced motion in CSS).
export default function Badge({ count, label }) {
  const previous = useRef(count);
  const [beat, setBeat] = useState(false);

  useEffect(() => {
    if (count > previous.current) {
      setBeat(true);
      const id = setTimeout(() => setBeat(false), 700);
      previous.current = count;
      return () => clearTimeout(id);
    }
    previous.current = count;
  }, [count]);

  if (!count) return null;
  return (
    <span className={`badge${beat ? ' badge--beat' : ''}`} aria-label={`${count} ${label}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
