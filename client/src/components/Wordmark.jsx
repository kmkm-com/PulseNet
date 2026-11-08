// "PulseNet" with the heartbeat trace running underneath it.
// The trace draws itself once on page load (skipped for reduced motion).
export default function Wordmark({ large = false }) {
  return (
    <span className={`wordmark${large ? ' wordmark--large' : ''}`}>
      <span className="wordmark__text">PulseNet</span>
      <svg className="wordmark__trace" viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="0,9 52,9 58,2 65,15 71,5 75,9 120,9" />
      </svg>
    </span>
  );
}
