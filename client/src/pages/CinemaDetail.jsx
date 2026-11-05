import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { Cert, Empty, ErrorBox, Loader, Poster, useAsync } from '../components/ui.jsx';
import { toYmd } from '../utils.js';
import { DateStrip, ShowChip } from './Showtimes.jsx';

export default function CinemaDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || toYmd(new Date());
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => toYmd(new Date(Date.now() + i * 864e5))), []);
  const q = useAsync(() => api.get(`/theatres/${id}${qs({ date })}`), [id, date]);

  if (q.loading && !q.data) return <Loader />;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} /></div>;
  const { theatre, movies } = q.data;

  return (
    <>
      <div className="sub-header">
        <div className="container">
          <h1>{theatre.name}</h1>
          <p className="muted">{theatre.address}</p>
          <div className="amenities">{theatre.amenities.map((a) => <span key={a}>{a}</span>)}</div>
        </div>
      </div>
      <div className="container section">
        <DateStrip dates={dates} value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        {movies.length === 0 ? <Empty title="No more shows on this date" /> : (
          <div className="theatre-list">
            {movies.map(({ movie, shows }) => (
              <div key={movie.id} className="theatre-row">
                <Link to={`/movies/${movie.slug}`} className="cinema-movie">
                  <Poster src={movie.poster_url} alt={movie.title} />
                  <div>
                    <strong>{movie.title}</strong>
                    <div className="meta-row small"><Cert value={movie.certificate} /> {movie.genres.join(', ')}</div>
                  </div>
                </Link>
                <div className="show-chips">{shows.map((s) => <ShowChip key={s.id} show={s} />)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
