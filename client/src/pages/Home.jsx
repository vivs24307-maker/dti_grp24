import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play,
  Box,
  Ticket,
  ChevronRight,
  Flame,
  Laugh,
  Ghost,
  Rocket,
  Palette,
  Heart,
  Music,
  Users,
  Film,
  Armchair,
  Popcorn,
  QrCode,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api, qs } from '../api.js';
import { useCity } from '../context/CityContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Cert, ErrorBox, MovieCard, Poster, RatingBadge, useAsync } from '../components/ui.jsx';
import { fmtDuration } from '../utils.js';
import { HeroSkeleton, SectionSkeleton } from '../components/Skeleton.jsx';
import TrailerModal from '../components/TrailerModal.jsx';

const GENRE_ICONS = {
  Action: Flame,
  Comedy: Laugh,
  Drama: Film,
  Horror: Ghost,
  'Sci-Fi': Rocket,
  Biopic: Film,
  Thriller: Film,
  Animation: Palette,
  Romance: Heart,
  Musical: Music,
  Family: Users,
};

function Hero({ movies, citySlug }) {
  const [i, setI] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const jumpIn = async (movie) => {
    try {
      const { show } = await api.get(`/movies/${movie.id}/next-show${qs({ city: citySlug })}`);
      navigate(`/shows/${show.id}/seats`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (movies.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % movies.length), 9000);
    return () => clearInterval(t);
  }, [movies.length]);

  const m = movies[i];
  if (!m) return null;

  return (
    <>
      <section className="hero">
        <div className="hero-bg" style={{ backgroundImage: `url("${m.backdrop_url || m.poster_url}")` }} key={m.id} />
        <div className="container hero-inner">
          <div className="hero-poster">
            <Poster src={m.poster_url} alt={m.title} />
          </div>
          <div className="hero-copy">
            <span className={`pill ${m.featured ? 'pill-gold' : ''}`}>
              {m.featured ? '★ The Headline Film · Now in Cinemas' : '🔥 Trending in your city'}
            </span>
            <h1>{m.title}</h1>
            {m.tagline && <p className="hero-tagline">{m.tagline}</p>}
            <div className="meta-row">
              <RatingBadge rating={m.rating} votes={m.votes} />
              <Cert value={m.certificate} />
              <span>{fmtDuration(m.duration_min)}</span>
              <span>{m.genres.join(', ')}</span>
              {m.has_3d && <span className="chip static">3D</span>}
            </div>
            <p className="hero-desc">{m.description}</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => jumpIn(m)}>
                <Box size={18} /> Pick seats in 3D
              </button>
              {m.trailer_url && (
                <button className="btn btn-ghost btn-lg" onClick={() => setTrailerOpen(true)}>
                  <Play size={18} /> Watch Trailer
                </button>
              )}
              <Link to={`/movies/${m.slug}/tickets`} className="btn btn-ghost btn-lg">
                <Ticket size={18} /> All showtimes
              </Link>
            </div>
            <div className="hero-dots">
              {movies.map((x, idx) => (
                <button
                  key={x.id}
                  className={idx === i ? 'active' : ''}
                  onClick={() => setI(idx)}
                  aria-label={`Show ${x.title}`}
                />
              ))}
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
    </>
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

  if (loading) {
    return (
      <>
        <HeroSkeleton />
        <SectionSkeleton count={6} />
      </>
    );
  }

  if (error) {
    return (
      <div className="container section">
        <ErrorBox error={error} onRetry={reload} />
      </div>
    );
  }

  const [{ movies }, { movies: upcoming }, { genres }, { coupons }] = data;

  return (
    <>
      <Hero movies={movies.slice(0, 5)} citySlug={citySlug} />

      <section className="container section">
        <div className="section-head">
          <h2>Recommended movies {city && <span className="muted">in {city.name}</span>}</h2>
          <Link to="/movies" className="link flex-center-inline">
            See all <ChevronRight size={16} />
          </Link>
        </div>
        <div className="scroller">
          {movies.slice(0, 12).map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>Browse by genre</h2>
        <div className="genre-grid">
          {genres.map((g) => {
            const Icon = GENRE_ICONS[g] || Film;
            return (
              <Link key={g} to={`/movies?genre=${encodeURIComponent(g)}`} className="genre-tile">
                <Icon size={20} className="genre-icon" />
                <span>{g}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {(!user || user.plan !== 'Premium') && (
        <section className="container section">
          <div className="premium-banner">
            <div>
              <span className="pill pill-gold flex-center-inline">
                <Sparkles size={14} /> CineVerse Premium
              </span>
              <h2>10% off every ticket. Zero convenience fees. Free popcorn.</h2>
              <p className="muted">All for ₹299 a month — pays for itself in a single weekend.</p>
            </div>
            <Link to={user ? '/profile' : '/register'} className="btn btn-gold btn-lg">
              Get Premium
            </Link>
          </div>
        </section>
      )}

      {coupons.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>Offers for you</h2>
            <Link to="/offers" className="link flex-center-inline">
              All offers <ChevronRight size={16} />
            </Link>
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
            {upcoming.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        </section>
      )}

      <section className="container section">
        <div className="feature-grid">
          <div className="feature">
            <Armchair size={26} className="feature-icon" />
            <h3>Pick your exact seat</h3>
            <p className="muted">Live 3D & 2D seat maps with recliners, sofas and more. Seats are held for 10 minutes while you pay.</p>
          </div>
          <div className="feature">
            <Popcorn size={26} className="feature-icon" />
            <h3>Pre-order snacks</h3>
            <p className="muted">Skip the theatre queue — add popcorn tubs and combos directly to your booking.</p>
          </div>
          <div className="feature">
            <QrCode size={26} className="feature-icon" />
            <h3>M-Ticket with QR</h3>
            <p className="muted">Show the digital QR pass directly on your phone. No printouts needed.</p>
          </div>
          <div className="feature">
            <RotateCcw size={26} className="feature-icon" />
            <h3>Easy cancellation</h3>
            <p className="muted">Plans changed? Cancel up to 2 hours before the showtime for a direct refund.</p>
          </div>
        </div>
      </section>
    </>
  );
}
