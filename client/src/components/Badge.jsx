import { useEffect, useRef, useState } from 'react';

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
    <span className={`count-pill${beat ? ' count-pill--beat' : ''}`} aria-label={`${count} ${label}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
