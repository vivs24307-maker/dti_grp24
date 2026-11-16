import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play, Ticket } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCity } from '../context/CityContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Cert, Empty, ErrorBox, Loader, Poster, RatingBadge, useAsync } from '../components/ui.jsx';
import { fmtDate, fmtDuration } from '../utils.js';
import TrailerModal from '../components/TrailerModal.jsx';

function ReviewForm({ movieId, mine, onSaved }) {
  const toast = useToast();
  const [rating, setRating] = useState(mine?.rating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(mine?.comment || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast('Tap a star to rate', 'error');
    setBusy(true);
    try {
      await api.post(`/movies/${movieId}/reviews`, { rating, comment });
      toast(mine ? 'Review updated' : 'Thanks for rating!', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card review-form" onSubmit={submit}>
      <h4>{mine ? 'Update your rating' : 'Rate this movie'}</h4>
      <div className="star-input" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button type="button" key={n} className={(hover || rating) >= n ? 'on' : ''}
            onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} aria-label={`${n} out of 10`}>★</button>
        ))}
        <span className="muted">{(hover || rating) ? `${hover || rating}/10` : ''}</span>
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you think? (optional)" rows={3} maxLength={1000} />
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Submit review'}</button>
    </form>
  );
}

export default function MovieDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { citySlug } = useCity();
  const [trailerOpen, setTrailerOpen] = useState(false);
  const movieQ = useAsync(() => api.get(`/movies/${id}?city=${citySlug}`), [id, citySlug]);
  const reviewsQ = useAsync(() => api.get(`/movies/${id}/reviews`), [id, user?.id]);

  if (movieQ.loading) return <Loader />;
  if (movieQ.error) return <div className="container section"><ErrorBox error={movieQ.error} /></div>;
  const m = movieQ.data.movie;

  return (
    <>
      <section className="movie-banner">
        <div className="movie-banner-bg" style={{ backgroundImage: `url("${m.backdrop_url || m.poster_url}")` }} />
        <div className="container movie-banner-inner">
          <div className="movie-banner-poster"><Poster src={m.poster_url} alt={m.title} /></div>
          <div className="movie-banner-info">
            <h1>{m.title}</h1>
            {m.tagline && <p className="hero-tagline">{m.tagline}</p>}
            <div className="rating-box">
              <RatingBadge rating={m.rating} votes={m.votes} />
              {user && <a href="#reviews" className="btn btn-ghost btn-sm">Rate now</a>}
            </div>
            <div className="chips">
              {m.languages.map((l) => <span key={l} className="chip static">{l}</span>)}
            </div>
            {m.formats?.length > 0 && (
              <div className="format-row">
                <small className="muted">Playing in</small>
                {m.formats.map((f) => (
                  <Link key={f.name} to={`/movies/${m.slug}/tickets?format=${encodeURIComponent(f.name)}`} className="format-chip" title={f.about}>{f.name}</Link>
                ))}
              </div>
            )}
            <p className="meta-row">
              <span>{fmtDuration(m.duration_min)}</span>·<span>{m.genres.join(', ')}</span>·<Cert value={m.certificate} />
              {m.release_date && <>·<span>{fmtDate(m.release_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span></>}
            </p>
            <div className="hero-actions" style={{ marginTop: '1.25rem' }}>
              {m.status === 'now_showing' ? (
                <Link to={`/movies/${m.slug}/tickets`} className="btn btn-primary btn-lg">
                  <Ticket size={18} /> Book tickets
                </Link>
              ) : (
                <span className="pill">Releasing soon</span>
              )}
              {m.trailer_url && (
                <button className="btn btn-ghost btn-lg" onClick={() => setTrailerOpen(true)}>
                  <Play size={18} /> Watch Trailer
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {trailerOpen && (
        <TrailerModal
          trailerUrl={m.trailer_url}
          title={m.title}
          onClose={() => setTrailerOpen(false)}
        />
      )}

      <div className="container section detail-grid">
        <div>
          <section className="block">
            <h2>About the movie</h2>
            <p className="lead">{m.description || 'No description yet.'}</p>
          </section>

          {m.cast?.length > 0 && (
            <section className="block">
              <h2>Cast & crew</h2>
              <div className="people">
                {m.cast.map((c) => (
                  <div key={c} className="person">
                    <div className="person-avatar">{c.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                    <span>{c}</span>
                  </div>
                ))}
                {m.director && (
                  <div className="person">
                    <div className="person-avatar director">🎬</div>
                    <span>{m.director}<br /><small className="muted">Director</small></span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="block" id="reviews">
            <h2>Reviews</h2>
            {user ? (
              !reviewsQ.loading && (
                <ReviewForm movieId={m.id} mine={reviewsQ.data?.mine} key={reviewsQ.data?.mine?.id || 'new'}
                  onSaved={() => { reviewsQ.reload(); movieQ.reload(); }} />
              )
            ) : (
              <p className="muted"><Link to="/login" state={{ from: `/movies/${m.slug}` }} className="link">Log in</Link> to rate this movie.</p>
            )}
            {reviewsQ.loading ? <Loader /> : reviewsQ.data?.reviews.length ? (
              <div className="reviews">
                {reviewsQ.data.reviews.map((r) => (
                  <div className="card review" key={r.id}>
                    <div className="row between">
                      <strong>{r.user_name}</strong>
                      <span className="rating-badge"><span className="star">★</span> {r.rating}/10</span>
                    </div>
                    {r.comment && <p>{r.comment}</p>}
                    <small className="muted">{new Date(r.created_at + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                  </div>
                ))}
              </div>
            ) : <Empty icon="💬" title="No reviews yet">Be the first to share your thoughts.</Empty>}
          </section>
        </div>
      </div>
    </>
  );
}
