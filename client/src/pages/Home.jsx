import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useCity } from '../context/CityContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Cert, ErrorBox, Loader, MovieCard, Poster, RatingBadge, useAsync } from '../components/ui.jsx';
import { fmtDuration } from '../utils.js';

const GENRE_EMOJI = { Action: '💥', Comedy: '😂', Drama: '🎭', Horror: '👻', 'Sci-Fi': '🚀', Biopic: '📜', Thriller: '🔪', Animation: '🎨', Romance: '💕', Musical: '🎵', Family: '👨‍👩‍👧' };

function Hero({ movies }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (movies.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % movies.length), 6000);
    return () => clearInterval(t);
  }, [movies.length]);
  const m = movies[i];
  if (!m) return null;
  return (
    <section className="hero">
      <div className="hero-bg" style={{ backgroundImage: `url("${m.backdrop_url || m.poster_url}")` }} key={m.id} />
      <div className="container hero-inner">
        <div className="hero-poster"><Poster src={m.poster_url} alt={m.title} /></div>
        <div className="hero-copy">
          <span className="pill">🔥 Trending in your city</span>
          <h1>{m.title}</h1>
          <div className="meta-row">
            <RatingBadge rating={m.rating} votes={m.votes} />
            <Cert value={m.certificate} />
            <span>{fmtDuration(m.duration_min)}</span>
            <span>{m.genres.join(', ')}</span>
          </div>
          <p className="hero-desc">{m.description}</p>
          <div className="hero-actions">
            <Link to={`/movies/${m.slug}/tickets`} className="btn btn-primary btn-lg">Book tickets</Link>
            <Link to={`/movies/${m.slug}`} className="btn btn-ghost btn-lg">More info</Link>
          </div>
          <div className="hero-dots">
            {movies.map((x, idx) => (
              <button key={x.id} className={idx === i ? 'active' : ''} onClick={() => setI(idx)} aria-label={`Show ${x.title}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { citySlug, city } = useCity();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([
      api.get(`/movies${qs({ city: citySlug, sort: 'popular' })}`),
      api.get('/movies?status=coming_soon'),
      api.get('/movies/filters'),
      api.get('/offers'),
    ]),
    [citySlug],
  );

  if (loading) return <Loader />;
  if (error) return <div className="container section"><ErrorBox error={error} onRetry={reload} /></div>;
  const [{ movies }, { movies: upcoming }, { genres }, { coupons }] = data;

  return (
    <>
      <Hero movies={movies.slice(0, 5)} />

      <section className="container section">
        <div className="section-head">
          <h2>Recommended movies {city && <span className="muted">in {city.name}</span>}</h2>
          <Link to="/movies" className="link">See all ›</Link>
        </div>
        <div className="scroller">
          {movies.slice(0, 12).map((m) => <MovieCard key={m.id} movie={m} />)}
        </div>
      </section>

      <section className="container section">
        <h2>Browse by genre</h2>
        <div className="genre-grid">
          {genres.map((g) => (
            <Link key={g} to={`/movies?genre=${encodeURIComponent(g)}`} className="genre-tile">
              <span>{GENRE_EMOJI[g] || '🎬'}</span>{g}
            </Link>
          ))}
        </div>
      </section>

      {(!user || user.plan !== 'Premium') && (
        <section className="container section">
          <div className="premium-banner">
            <div>
              <span className="pill pill-gold">★ CineVerse Premium</span>
              <h2>10% off every ticket. Zero convenience fees. Free popcorn.</h2>
              <p className="muted">All for ₹299 a month — pays for itself in a single weekend.</p>
            </div>
            <Link to={user ? '/profile' : '/register'} className="btn btn-gold btn-lg">Get Premium</Link>
          </div>
        </section>
      )}

      {coupons.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>Offers for you</h2>
            <Link to="/offers" className="link">All offers ›</Link>
          </div>
          <div className="offer-row">
            {coupons.map((c) => (
              <div key={c.code} className="offer-card">
                <div className="offer-code">{c.code}</div>
                <p>{c.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="container section">
          <h2>Coming soon</h2>
          <div className="scroller">
            {upcoming.map((m) => <MovieCard key={m.id} movie={m} />)}
          </div>
        </section>
      )}

      <section className="container section">
        <div className="feature-grid">
          <div className="feature"><span>🪑</span><h3>Pick your exact seat</h3><p className="muted">Live seat maps with recliners, sofas and more. Seats are held for you for 10 minutes while you pay.</p></div>
          <div className="feature"><span>🍿</span><h3>Pre-order snacks</h3><p className="muted">Skip the queue — add popcorn and combos to your booking.</p></div>
          <div className="feature"><span>📱</span><h3>M-Ticket with QR</h3><p className="muted">Show the QR code at the entrance. No printouts needed.</p></div>
          <div className="feature"><span>↩️</span><h3>Easy cancellation</h3><p className="muted">Changed plans? Cancel up to 2 hours before the show for a refund.</p></div>
        </div>
      </section>
    </>
  );
}
