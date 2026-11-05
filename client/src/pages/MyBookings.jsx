import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Empty, ErrorBox, Loader, Poster, useAsync } from '../components/ui.jsx';
import { fmtDate, fmtTime, inr, parseLocal } from '../utils.js';

export default function MyBookings() {
  const q = useAsync(() => api.get('/bookings'), []);
  const [tab, setTab] = useState('upcoming');

  if (q.loading) return <Loader />;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} onRetry={q.reload} /></div>;

  const now = Date.now();
  const upcoming = q.data.bookings.filter((b) => b.status === 'CONFIRMED' && parseLocal(b.starts_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = q.data.bookings.filter((b) => !upcoming.includes(b));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="container section narrow">
      <div className="section-head">
        <h2>My bookings</h2>
        <div className="tabs">
          <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</button>
          <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>Past & cancelled ({past.length})</button>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon="🎟️" title={tab === 'upcoming' ? 'No upcoming shows' : 'Nothing here yet'}>
          <Link to="/movies" className="btn btn-primary">Browse movies</Link>
        </Empty>
      ) : (
        <div className="booking-list">
          {list.map((b) => (
            <Link key={b.id} to={`/bookings/${b.code}`} className={`card booking-card ${b.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>
              <Poster src={b.poster_url} alt={b.movie_title} />
              <div className="booking-info">
                <div className="row between">
                  <h3>{b.movie_title}</h3>
                  <span className={`status status-${b.status.toLowerCase()}`}>{b.status === 'CONFIRMED' && parseLocal(b.starts_at) < now ? 'WATCHED' : b.status}</span>
                </div>
                <p className="small">{fmtDate(b.starts_at)} · {fmtTime(b.starts_at)} · {b.language} {b.format}</p>
                <p className="muted small">{b.theatre_name}</p>
                <div className="row between">
                  <span className="small">🎟️ {b.seats.map((s) => s.id).join(', ')}</span>
                  <strong>{inr(b.total)}</strong>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
