import { useState } from 'react';
import { displayName } from '../lib/format.js';

// Vibrant, warm human gradients for user initials
const GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
];

export default function Avatar({ user, size = 40 }) {
  const [broken, setBroken] = useState(false);

  const name = displayName(user);
  const parts = name.trim().split(/\s+/);
  let initials = '';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (name.length > 0) {
    initials = name.slice(0, 2).toUpperCase();
  } else {
    initials = 'PN';
  }

  const style = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.38)),
    lineHeight: `${size}px`,
  };

  // Only trust reliable Supabase or custom URLs; skip external pravatar.cc which hangs or fails
  const isPravatar = typeof user?.avatar_url === 'string' && user.avatar_url.includes('pravatar.cc');
  const hasValidPhoto = Boolean(user?.avatar_url) && !broken && !isPravatar;

  if (hasValidPhoto) {
    return (
      <img
        className="avatar"
        src={user.avatar_url}
        alt={name}
        style={style}
        onError={() => setBroken(true)}
        loading="lazy"
      />
    );
  }

  const seed = (user?.user_id ?? 0) + (name.charCodeAt(0) || 0);
  const gradient = GRADIENTS[Math.abs(seed) % GRADIENTS.length];

  return (
    <span
      className="avatar avatar--initials"
      style={{
        ...style,
        background: gradient,
        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.25)',
      }}
      aria-hidden="true"
      title={name}
    >
      {initials}
    </span>
  );
}
