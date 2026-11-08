import { useState } from 'react';
import { displayName } from '../lib/format.js';

// Profile photo, or initials on a tinted circle when there is none
// (or the image fails to load). Tint is derived from the user id.
const TINTS = ['#3D5A80', '#6A4C93', '#1B7F79', '#B5523B', '#4F6D3A', '#8A5A14'];

export default function Avatar({ user, size = 40 }) {
  const [broken, setBroken] = useState(false);
  const initials = displayName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (user?.avatar_url && !broken) {
    return (
      <img
        className="avatar"
        src={user.avatar_url}
        alt=""
        style={style}
        onError={() => setBroken(true)}
      />
    );
  }
  const tint = TINTS[(user?.user_id ?? 0) % TINTS.length];
  return (
    <span className="avatar avatar--initials" style={{ ...style, background: tint }} aria-hidden="true">
      {initials}
    </span>
  );
}
