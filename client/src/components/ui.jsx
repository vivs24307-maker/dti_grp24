import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { certClass, titleCard } from '../utils.js';

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader" role="status">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function Empty({ icon = '🎞️', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-box">
      <span>⚠️ {error.message || String(error)}</span>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Poster({ src, alt, className = '' }) {
  const fallback = titleCard(alt);
  const [url, setUrl] = useState(src || fallback);
  useEffect(() => { setUrl(src || fallback); }, [src, fallback]);
  return <img className={className} src={url} alt={alt} loading="lazy" onError={() => setUrl(fallback)} />;
}

export function Cert({ value }) {
  return <span className={`cert ${certClass(value)}`}>{value}</span>;
}

export function RatingBadge({ rating, votes }) {
  if (!rating) return <span className="rating-badge muted">New</span>;
  return (
    <span className="rating-badge">
      <span className="star">★</span> {rating}/10 <span className="muted">· {votes} vote{votes === 1 ? '' : 's'}</span>
    </span>
  );
}

export function MovieCard({ movie }) {
  return (
    <Link to={`/movies/${movie.slug}`} className="movie-card">
      <div className="movie-card-poster">
        <Poster src={movie.poster_url} alt={movie.title} />
        <div className="movie-card-rating">
          {movie.rating ? <><span className="star">★</span> {movie.rating}/10 <span className="muted">{movie.votes} votes</span></> : <span>Coming soon</span>}
        </div>
      </div>
      <div className="movie-card-body">
        <h3 title={movie.title}>{movie.title}</h3>
        <p className="muted">{movie.genres.join(' / ')}</p>
      </div>
    </Link>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="modal-head">
            <h3>{title}</h3>
            {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Small hook for "load data, show spinner, show error" pages. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1), setData: (data) => setState((s) => ({ ...s, data })) };
}
