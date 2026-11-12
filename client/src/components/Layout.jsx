import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCounts } from '../context/CountsContext.jsx';
import Avatar from './Avatar.jsx';
import Badge from './Badge.jsx';
import Icon from './Icon.jsx';
import Wordmark from './Wordmark.jsx';
import { displayName } from '../lib/format.js';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { messages, notifications } = useCounts();

  // Dark/Light theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pulsenet-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pulsenet-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const links = [
    { to: '/', label: 'Feed', icon: 'feed', end: true },
    { to: '/groups', label: 'Groups', icon: 'groups' },
    { to: '/bookmarks', label: 'Saved Posts', icon: 'bookmark' },
    { to: '/friends', label: 'Friends', icon: 'friends' },
    { to: '/messages', label: 'Messages', icon: 'messages', count: messages, countLabel: 'unread messages' },
    { to: '/notifications', label: 'Notifications', icon: 'bell', count: notifications, countLabel: 'unread notifications' },
    { to: `/users/${user.user_id}`, label: 'Profile', icon: 'user' },
  ];

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="nav" aria-label="Main">
        <div className="nav__brand">
          <Wordmark />
        </div>
        <ul className="nav__list">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} end={link.end} className="nav__link">
                <span className="nav__link-left">
                  <Icon name={link.icon} size={18} />
                  <span className="nav__label">{link.label}</span>
                </span>
                {link.count !== undefined && link.count > 0 && (
                  <Badge count={link.count} label={link.countLabel} />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="nav__me">
          <Avatar user={user} size={36} />
          <div className="nav__me-info">
            <span className="nav__me-name">{displayName(user)}</span>
            <span className="nav__me-handle">@{user.username}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={logout}
              title="Log out"
              aria-label="Log out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </nav>
      <main id="main" className="main-content">
        {children}
      </main>
    </div>
  );
}
