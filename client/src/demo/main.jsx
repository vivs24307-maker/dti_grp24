// Standalone demo of the 3D seat picker: no server needed, bookings are simulated in the browser.
// Build it into a single self-contained HTML file with `npm run build:demo`.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SeatStage from '../components/SeatStage.jsx';
import { ToastProvider, useToast } from '../context/ToastContext.jsx';
import { inr } from '../utils.js';
import '../styles.css';
import './demo.css';

const rows = (from, to) => {
  const out = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) out.push(String.fromCharCode(c));
  return out;
};

const LAYOUT = {
  categories: [
    { name: 'Sofa', price: 850, rows: ['M'], cols: 10, aisles: [5] },
    { name: 'Recliner', price: 650, rows: ['K', 'L'], cols: 12, aisles: [6] },
    { name: 'Premium', price: 420, rows: rows('E', 'J'), cols: 18, aisles: [5, 13] },
    { name: 'Classic', price: 260, rows: rows('A', 'D'), cols: 18, aisles: [5, 13] },
  ],
};

const pad = (n) => String(n).padStart(2, '0');
function tomorrowEvening() {
  const d = new Date(Date.now() + 864e5);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:30`;
}

const SHOW = {
  movie: { title: 'The Last Signal', poster_url: null, certificate: 'UA' },
  theatre_name: 'CineVerse Demo Hall',
  screen_name: 'Screen 1',
  format: 'Dolby Atmos',
  language: 'English',
  starts_at: tomorrowEvening(),
  layout: LAYOUT,
};

const ALL_SEATS = LAYOUT.categories.flatMap((c) => c.rows.flatMap((r) => Array.from({ length: c.cols }, (_, i) => `${r}${i + 1}`)));

// A believable house: about a third sold, mostly in pairs, busier in the middle of each row
function initialTaken() {
  let seed = 20240607;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const taken = new Set();
  for (const cat of LAYOUT.categories) {
    for (const row of cat.rows) {
      for (let col = 1; col <= cat.cols; col++) {
        const centred = 1 - Math.abs(col - (cat.cols + 1) / 2) / (cat.cols / 2);
        if (rand() < 0.1 + centred * 0.2) {
          taken.add(`${row}${col}`);
          if (col < cat.cols && rand() < 0.6) taken.add(`${row}${col + 1}`);
        }
      }
    }
  }
  return taken;
}

function Demo() {
  const toast = useToast();
  const [taken, setTaken] = useState(initialTaken);
  const [round, setRound] = useState(0);
  const [booked, setBooked] = useState(null);
  const [no3d, setNo3d] = useState(false);
  const mine = useRef([]);

  // Pretend other people are booking: every few seconds a free seat gets taken, live
  useEffect(() => {
    const t = setInterval(() => {
      setTaken((prev) => {
        const free = ALL_SEATS.filter((id) => !prev.has(id) && !mine.current.includes(id));
        if (free.length < 60) return prev;
        const next = new Set(prev);
        next.add(free[Math.floor(Math.random() * free.length)]);
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const unavailable = useMemo(() => [...taken], [taken]);
  const priceOf = (id) => LAYOUT.categories.find((c) => c.rows.includes(id[0])).price;

  return (
    <>
      <SeatStage
        key={round}
        show={SHOW}
        unavailable={unavailable}
        notify={toast}
        payLabel="Book"
        onSelectionChange={(ids) => { mine.current = ids; }}
        onProceed={(seats) => setBooked(seats)}
        onExit={() => setRound((r) => r + 1)}
        onUnsupported={() => setNo3d(true)}
      />
      <span className="stage-live demo-pill"><i />DEMO · seats update live</span>

      {no3d && (
        <div className="modal-backdrop">
          <div className="modal demo-done">
            <h3>3D is switched off in this browser</h3>
            <p className="muted">The hall needs WebGL. Try a recent Chrome, Edge, Safari or Firefox with hardware acceleration turned on.</p>
          </div>
        </div>
      )}

      {booked && (
        <div className="modal-backdrop">
          <div className="modal demo-done" role="dialog" aria-modal="true" aria-label="Booking confirmed">
            <div className="check">✓</div>
            <h3>Seats booked (demo)</h3>
            <p className="muted">
              {booked.join(', ')} · {inr(booked.reduce((sum, id) => sum + priceOf(id), 0))}
            </p>
            <p className="muted small">
              In the full CineVerse app this step holds your seats for 10 minutes and takes you to checkout with snacks, coupons and a QR ticket.
            </p>
            <button
              id="demo-again"
              className="btn btn-primary btn-block"
              onClick={() => {
                setTaken((prev) => new Set([...prev, ...booked]));
                mine.current = [];
                setBooked(null);
                setRound((r) => r + 1);
              }}
            >
              Book more seats
            </button>
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <Demo />
  </ToastProvider>,
);
