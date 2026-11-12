import { useState } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi } from '../api/index.js';
import { errorMessage } from '../api/client.js';

// The friend action(s) for one person, based on my relationship to them:
// none/declined -> Add friend, request_sent -> Cancel request,
// request_received -> Accept / Decline, friends -> Message / Unfriend.
export default function RelationshipButton({ userId, relationship, onChange, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);

  if (relationship === 'self') return null;

  const run = async (actionName, action, nextRelationship) => {
    setBusy(true);
    setBusyAction(actionName);
    setError('');
    try {
      await action();
      setConfirmUnfriend(false);
      onChange?.(nextRelationship);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setBusyAction('');
    }
  };

  const act = (label, busyLabel, variant, call, next) => (
    <button
      key={label}
      type="button"
      className={`button button--${variant}`}
      disabled={busy}
      onClick={() => run(label, call, next)}
    >
      {busy && busyAction === label ? busyLabel : label}
    </button>
  );

  const remove = () => friendsApi.remove(userId);
  let buttons;
  if (relationship === 'request_sent') {
    buttons = act('Cancel request', 'Cancelling…', 'quiet', remove, 'none');
  } else if (relationship === 'request_received') {
    buttons = [
      act('Accept', 'Accepting…', 'primary', () => friendsApi.respond(userId, 'accept'), 'friends'),
      act('Decline', 'Declining…', 'quiet', () => friendsApi.respond(userId, 'decline'), 'declined'),
    ];
  } else if (relationship === 'friends') {
    buttons = (
      <>
        {!compact && (
          <Link className="button button--primary" to={`/messages/${userId}`}>
            Message
          </Link>
        )}
        {confirmUnfriend ? (
          <>
            {act('Confirm unfriend', 'Removing…', 'danger', remove, 'none')}
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setConfirmUnfriend(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setConfirmUnfriend(true)}
          >
            Unfriend
          </button>
        )}
      </>
    );
  } else {
    // 'none' or 'declined' or undefined
    buttons = act('Add friend', 'Requesting…', 'primary', () => friendsApi.send(userId), 'request_sent');
  }

  return (
    <div className="actions">
      {buttons}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
