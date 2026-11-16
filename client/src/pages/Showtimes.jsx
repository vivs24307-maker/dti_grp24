import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useCity } from '../context/CityContext.jsx';
import { Cert, Empty, ErrorBox, Loader, useAsync } from '../components/ui.jsx';
import { dayParts, fmtTime, inr } from '../utils.js';

export function DateStrip({ dates, value, onChange }) {
  return (
    <div className="date-strip">
      {dates.map((d) => {
        const p = dayParts(d);
        return (
          <button key={d} className={`date-pill ${d === value ? 'active' : ''}`} onClick={() => onChange(d)}>
            <small>{p.label}</small>
            <strong>{p.day}</strong>
            <small>{p.month}</small>
          </button>
        );
      })}
    </div>
  );
}

export function ShowChip({ show }) {
  const navigate = useNavigate();
  const fillClass = show.occupancy > 0.8 ? 'fast' : show.occupancy > 0.5 ? 'filling' : '';
  return (
    <button className={`show-chip ${fillClass}`} onClick={() => navigate(`/shows/${show.id}/seats`)}
      title={show.minPrice ? `${inr(show.minPrice)} – ${inr(show.maxPrice)} · ${show.screen}` : show.screen}>
      <strong>{fmtTime(show.startsAt)}</strong>
      <small>{show.format !== '2D' ? show.format : show.language}</small>
      {show.format !== '2D' && <small className="lang">{show.language}</small>}
    </button>
  );
}

export default function Showtimes() {
  const { id } = useParams();
  const { citySlug } = useCity();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || '';
  const language = params.get('language') || '';
  const format = params.get('format') || '';
  const [movieDates, setMovieDates] = useState([]);

  const q = useAsync(() => api.get(`/movies/${id}/shows${qs({ city: citySlug, date, language, format })}`), [id, citySlug, date, language, format]);
  const formatInfo = useAsync(() => api.get('/formats'), []);
  const about = (name) => formatInfo.data?.formats.find((f) => f.name === name)?.about || '';

  // If "today" has no shows left, jump to the first date that does
  useEffect(() => {
    if (!q.data) return;
    setMovieDates(q.data.dates);
    if (!date && q.data.theatres.length === 0 && q.data.dates[0] && q.data.dates[0] !== q.data.date) {
      setParams({ date: q.data.dates[0] }, { replace: true });
    }
  }, [q.data, date, setParams]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || next.get(key) === value) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (q.loading && !q.data) return <Loader />;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} onRetry={q.reload} /></div>;
  const { movie, city, theatres, languages, formats } = q.data;

  return (
    <>
      <div className="sub-header">
        <div className="container">
          <h1>{movie.title} <span className="muted small">— {movie.languages.join(', ')}</span></h1>
          <div className="meta-row">
            <Cert value={movie.certificate} />
            {movie.genres.map((g) => <span key={g} className="chip static">{g}</span>)}
          </div>
        </div>
      </div>

      <div className="container section">
        <div className="showtime-toolbar">
          <DateStrip dates={movieDates} value={q.data.date} onChange={(d) => update('date', d)} />
          <div className="chips">
            {languages.length > 1 && languages.map((l) => (
              <button key={l} className={`chip ${language === l ? 'active' : ''}`} onClick={() => update('language', l)}>{l}</button>
            ))}
            {formats.length > 1 && formats.map((f) => (
              <button key={f} className={`chip ${format === f ? 'active' : ''}`} onClick={() => update('format', f)} title={about(f)}>{f}</button>
            ))}
          </div>
        </div>

        {format && about(format) && <p className="format-about"><strong>{format}</strong> — {about(format)}</p>}

        <div className="legend small muted">
          <span><i className="dot dot-ok" /> Available</span>
          <span><i className="dot dot-filling" /> Filling fast</span>
          <span><i className="dot dot-fast" /> Almost full</span>
        </div>

        {theatres.length === 0 ? (
          <Empty icon="🎟️" title={`No shows in ${city.name} for this date`}>
            Try another date or <Link className="link" to="/movies">pick another movie</Link>.
          </Empty>
        ) : (
          <div className="theatre-list">
            {theatres.map((t) => (
              <div key={t.id} className="theatre-row">
                <div className="theatre-info">
                  <Link to={`/cinemas/${t.id}`}><strong>{t.name}</strong></Link>
                  <small className="muted">{t.address}</small>
                  <div className="amenities">{t.amenities.slice(0, 3).map((a) => <span key={a}>{a}</span>)}</div>
                </div>
                <div className="show-chips">
                  {t.shows.map((s) => <ShowChip key={s.id} show={s} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
