import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="page page--narrow">
      <div className="empty">
        <h1 className="page__title">This page doesn't exist</h1>
        <p>Check the address, or head back to your feed.</p>
        <Link className="button button--primary" to="/">Go to feed</Link>
      </div>
    </section>
  );
}
