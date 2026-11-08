import { useState } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';

// The friend action(s) for one person, based on my relationship to them:
// none/declined -> Add friend, request_sent -> Cancel request,
// request_received -> Accept / Decline, friends -> Message / Unfriend.
export default function RelationshipButton({ userId, relationship, onChange, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);

  const run = async (action, nextRelationship) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setConfirmUnfriend(false);
      onChange?.(nextRelationship);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  let buttons;
  switch (relationship) {
    case 'self':
      return null;
    case 'request_sent':
      buttons = (
        <button className="button button--quiet" disabled={busy}
          onClick={() => run(() => friendsApi.remove(userId), 'none')}>
          Cancel request
        </button>
      );
      break;
    case 'request_received':
      buttons = (
        <>
          <button className="button button--primary" disabled={busy}
            onClick={() => run(() => friendsApi.respond(userId, 'accept'), 'friends')}>
            Accept
          </button>
          <button className="button button--quiet" disabled={busy}
            onClick={() => run(() => friendsApi.respond(userId, 'decline'), 'declined')}>
            Decline
          </button>
        </>
      );
      break;
    case 'friends':
      buttons = (
        <>
          {!compact && <Link className="button button--primary" to={`/messages/${userId}`}>Message</Link>}
          {confirmUnfriend ? (
            <>
              <button className="button button--danger" disabled={busy}
                onClick={() => run(() => friendsApi.remove(userId), 'none')}>
                Confirm unfriend
              </button>
              <button className="button button--quiet" onClick={() => setConfirmUnfriend(false)}>Keep</button>
            </>
          ) : (
            <button className="button button--quiet" onClick={() => setConfirmUnfriend(true)}>Unfriend</button>
          )}
        </>
      );
      break;
    default: // 'none' or 'declined': a new request is allowed
      buttons = (
        <button className="button button--primary" disabled={busy}
          onClick={() => run(() => friendsApi.send(userId), 'request_sent')}>
          Add friend
        </button>
      );
  }

  return (
    <div className="actions">
      {buttons}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  );
}
