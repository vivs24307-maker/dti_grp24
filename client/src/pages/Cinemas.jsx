import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCity } from '../context/CityContext.jsx';
import { Empty, ErrorBox, Loader, useAsync } from '../components/ui.jsx';

const BRAND_COLORS = { PVR: '#f5c518', INOX: '#3b82f6', Cinepolis: '#22c55e' };

export default function Cinemas() {
  const { citySlug } = useCity();
  const [brand, setBrand] = useState('');
  const q = useAsync(() => api.get(`/theatres?city=${citySlug}`), [citySlug]);

  if (q.loading) return <Loader />;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} onRetry={q.reload} /></div>;
  const { city, theatres } = q.data;
  const brands = [...new Set(theatres.map((t) => t.brand))];
  const shown = brand ? theatres.filter((t) => t.brand === brand) : theatres;

  return (
    <div className="container section">
      <div className="section-head wrap">
        <h2>Cinemas in {city.name}</h2>
        <div className="chips">
          {brands.map((b) => (
            <button key={b} className={`chip ${brand === b ? 'active' : ''}`} onClick={() => setBrand(brand === b ? '' : b)}>{b}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? <Empty title="No cinemas found" /> : (
        <div className="cinema-grid">
          {shown.map((t) => (
            <Link key={t.id} to={`/cinemas/${t.id}`} className="card cinema-card">
              <div className="cinema-logo" style={{ background: BRAND_COLORS[t.brand] || '#888' }}>{t.brand[0]}</div>
              <div>
                <strong>{t.name}</strong>
                <p className="muted small">{t.address}</p>
                <div className="amenities">
                  {t.formats.map((f) => <span key={f}>{f}</span>)}
                  {t.amenities.map((a) => <span key={a}>{a}</span>)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
