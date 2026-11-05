import { useCity } from '../context/CityContext.jsx';
import { Modal } from './ui.jsx';

const ICONS = { mumbai: '🌊', 'delhi-ncr': '🏛️', bengaluru: '🌳', pune: '⛰️', hyderabad: '🕌' };

export default function CityModal() {
  const { cities, city, chooseCity, pickerOpen, setPickerOpen } = useCity();
  return (
    <Modal
      open={pickerOpen}
      onClose={city ? () => setPickerOpen(false) : undefined}
      title="Select your city"
    >
      <p className="muted" style={{ marginBottom: 16 }}>We'll show you movies and showtimes near you.</p>
      <div className="city-grid">
        {cities.map((c) => (
          <button key={c.id} className={`city-tile ${city?.slug === c.slug ? 'active' : ''}`} onClick={() => chooseCity(c.slug)}>
            <span className="city-icon">{ICONS[c.slug] || '🏙️'}</span>
            <strong>{c.name}</strong>
            <span className="muted small">{c.theatres} cinemas</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
