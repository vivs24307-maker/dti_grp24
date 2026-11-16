import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorBox, Loader, Modal, useAsync } from '../components/ui.jsx';
import { fmtDate, fmtTime, inr } from '../utils.js';

const COUNT_ICONS = ['🚲', '🛵', '🛺', '🚗', '🚗', '🚙', '🚙', '🚐', '🚐', '🚌'];

function TicketCountModal({ open, value, onPick, onClose, categories }) {
  const [n, setN] = useState(value || 2);
  useEffect(() => { setN(value || 2); }, [value]);
  return (
    <Modal open={open} onClose={onClose} title="How many seats?">
      <div className="count-icon">{COUNT_ICONS[n - 1]}</div>
      <div className="count-row">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
          <button key={i} className={`count-btn ${n === i ? 'active' : ''}`} onClick={() => setN(i)}>{i}</button>
        ))}
      </div>
      <div className="count-prices">
        {categories.map((c) => (
          <div key={c.name}><small className="muted">{c.name.toUpperCase()}</small><strong>{inr(c.price)}</strong></div>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => onPick(n)}>Select seats</button>
    </Modal>
  );
}

export default function SeatLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const q = useAsync(() => api.get(`/shows/${id}`), [id, user?.id]);
  const [count, setCount] = useState(0);
  const [askCount, setAskCount] = useState(true);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  // Restore an existing hold (e.g. user came back from checkout)
  useEffect(() => {
    const hold = q.data?.myHold;
    if (hold && !selected.length) {
      setSelected(hold.seats);
      setCount(hold.seats.length);
      setAskCount(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.myHold]);

  // Refresh availability every 15s so users see seats being taken live
  useEffect(() => {
    const t = setInterval(() => {
      api.get(`/shows/${id}`).then((d) => q.setData(d)).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const show = q.data?.show;
  const unavailable = useMemo(() => new Set(q.data?.unavailable || []), [q.data]);

  // Drop selected seats that someone else just grabbed
  useEffect(() => {
    const lost = selected.filter((s) => unavailable.has(s));
    if (lost.length) {
      setSelected((sel) => sel.filter((s) => !unavailable.has(s)));
      toast(`Seat ${lost.join(', ')} was just booked by someone else`, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unavailable]);

  const priceOf = useMemo(() => {
    const map = new Map();
    show?.layout.categories.forEach((c) => c.rows.forEach((r) => {
      for (let i = 1; i <= c.cols; i++) map.set(`${r}${i}`, { price: c.price, category: c.name });
    }));
    return map;
  }, [show]);

  if (q.loading && !q.data) return <Loader />;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} onRetry={q.reload} /></div>;

  const isFree = (seatId) => priceOf.has(seatId) && !unavailable.has(seatId);

  const clickSeat = (row, col, cols) => {
    const seatId = `${row}${col}`;
    if (!isFree(seatId)) return;
    if (!count) return setAskCount(true);
    if (selected.includes(seatId)) return setSelected(selected.filter((s) => s !== seatId));

    // Like real apps: auto-select neighbouring seats to the right until we have `count` seats
    const base = selected.length >= count ? [] : [...selected];
    const need = count - base.length;
    const picks = [];
    for (let c = col; c <= cols && picks.length < need; c++) {
      const sid = `${row}${c}`;
      if (!isFree(sid) || base.includes(sid)) break;
      picks.push(sid);
    }
    setSelected([...base, ...picks]);
  };

  const total = selected.reduce((s, sid) => s + (priceOf.get(sid)?.price || 0), 0);

  const proceed = async () => {
    if (!user) {
      toast('Please log in to book tickets');
      return navigate('/login', { state: { from: location.pathname } });
    }
    setBusy(true);
    try {
      const hold = await api.post(`/shows/${id}/hold`, { seats: selected });
      navigate(`/checkout/${id}`, { state: { seats: hold.seats, expiresAt: hold.expiresAt } });
    } catch (err) {
      toast(err.message, 'error');
      q.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="seat-page">
      <header className="seat-header">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div>
          <h1>{show.movie.title}</h1>
          <p className="muted small">
            {show.theatre_name} | {fmtDate(show.starts_at)}, {fmtTime(show.starts_at)} | {show.screen_name} · {show.format} · {show.language}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          try { localStorage.setItem('cineverse_preferred_view', '3d'); } catch { /* ignore */ }
          navigate(`/shows/${id}/seats`, { replace: true });
        }}>🧊 3D view</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAskCount(true)}>{count || '–'} Tickets ✎</button>
      </header>

      {q.data.isPast && <div className="container"><ErrorBox error={{ message: 'This show has already started. Bookings are closed.' }} /></div>}

      <div className="seat-scroll">
        <div className="seat-map">
          {show.layout.categories.map((cat) => (
            <div key={cat.name} className="seat-category">
              <div className="cat-label">{inr(cat.price)} {cat.name.toUpperCase()}</div>
              {cat.rows.map((row) => (
                <div key={row} className="seat-row">
                  <span className="row-label">{row}</span>
                  {Array.from({ length: cat.cols }, (_, i) => i + 1).map((col) => {
                    const sid = `${row}${col}`;
                    const sold = unavailable.has(sid);
                    const sel = selected.includes(sid);
                    return (
                      <span key={sid} className={cat.aisles?.includes(col) ? 'seat-wrap aisle' : 'seat-wrap'}>
                        <button
                          className={`seat seat-${cat.name.toLowerCase()} ${sold ? 'sold' : ''} ${sel ? 'selected' : ''}`}
                          disabled={sold || q.data.isPast}
                          onClick={() => clickSeat(row, col, cat.cols)}
                          aria-label={`Seat ${sid}, ${cat.name}, ${inr(cat.price)}${sold ? ', sold' : ''}`}
                          aria-pressed={sel}
                        >{col}</button>
                      </span>
                    );
                  })}
                  <span className="row-label">{row}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="screen-wrap">
            <div className="screen" />
            <p className="muted small">All eyes this way please!</p>
          </div>
        </div>
      </div>

      <div className="seat-legend">
        <span><i className="seat-key" /> Available</span>
        <span><i className="seat-key selected" /> Selected</span>
        <span><i className="seat-key sold" /> Sold</span>
      </div>

      {selected.length > 0 && (
        <div className="pay-bar">
          <div>
            <strong>{selected.length} seat{selected.length > 1 ? 's' : ''}: {selected.join(', ')}</strong>
            {selected.length < count && <small className="muted"> · pick {count - selected.length} more</small>}
          </div>
          <button className="btn btn-primary btn-lg" disabled={busy || selected.length !== count} onClick={proceed}>
            {busy ? 'Holding seats…' : `Pay ${inr(total)}`}
          </button>
        </div>
      )}

      <TicketCountModal
        open={askCount && !q.data.isPast}
        value={count}
        categories={show.layout.categories}
        onClose={count ? () => setAskCount(false) : () => navigate(-1)}
        onPick={(n) => {
          setCount(n);
          setSelected((s) => s.slice(0, n));
          setAskCount(false);
        }}
      />
    </div>
  );
}
