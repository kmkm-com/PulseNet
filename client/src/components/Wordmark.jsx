export default function Wordmark({ large = false }) {
  return (
    <span className={`wordmark${large ? ' wordmark--large' : ''}`}>
      <span className={`wordmark__title${large ? ' wordmark__title--large' : ''}`}>PulseNet</span>
      <span className="wordmark__subtitle">Social Network</span>
    </span>
  );
}
