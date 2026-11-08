// Short relative times for lists ("now", "5m", "3h", "2d", then a date).
export function timeAgo(value) {
  const then = new Date(value);
  const seconds = Math.round((Date.now() - then.getTime()) / 1000);
  if (seconds < 45) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Clock time for chat bubbles, with the date when it is not today.
export function messageTime(value) {
  const d = new Date(value);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

// "8 Nov", or "8 Nov 2025" when not this year.
export function shortDate(value) {
  const d = new Date(value);
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

export function isToday(value) {
  return new Date(value).toDateString() === new Date().toDateString();
}
