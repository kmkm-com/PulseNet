import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCounts } from '../context/CountsContext.jsx';
import Avatar from './Avatar.jsx';
import Badge from './Badge.jsx';
import Icon from './Icon.jsx';
import Wordmark from './Wordmark.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { messages, notifications } = useCounts();

  const links = [
    { to: '/', label: 'Feed', icon: 'feed', end: true },
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
                <span className="nav__icon">
                  <Icon name={link.icon} />
                  {link.count !== undefined && <Badge count={link.count} label={link.countLabel} />}
                </span>
                <span className="nav__label">{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="nav__me">
          <Avatar user={user} size={36} />
          <div className="nav__me-text">
            <span className="nav__me-name">{user.full_name || user.username}</span>
            <span className="nav__me-handle">@{user.username}</span>
          </div>
          <button className="icon-button" onClick={logout} title="Log out" aria-label="Log out">
            <Icon name="logout" size={20} />
          </button>
        </div>
      </nav>
      <main id="main" className="main">
        {children}
      </main>
    </div>
  );
}
