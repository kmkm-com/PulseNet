import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { displayName } from '../lib/format.js';

// One person in a list: avatar + name (linking to their profile),
// an optional detail line, and actions on the right.
export default function PersonRow({ person, detail, children }) {
  return (
    <li className="person">
      <Link to={`/users/${person.user_id}`} className="person__link">
        <Avatar user={person} size={44} />
        <span className="person__text">
          <span className="person__name">
            {displayName(person)}
            <span className="person__handle">@{person.username}</span>
          </span>
          {detail && <span className="person__detail">{detail}</span>}
        </span>
      </Link>
      <div className="person__actions">{children}</div>
    </li>
  );
}
