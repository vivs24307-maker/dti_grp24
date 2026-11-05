import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Cert, ErrorBox, Loader, Modal, Poster, useAsync } from '../components/ui.jsx';
import { fmtDate, fmtDuration, fmtTime, inr, parseLocal } from '../utils.js';

export function canCancel(b) {
  return b.status === 'CONFIRMED' && parseLocal(b.starts_at) - Date.now() > 2 * 36e5;
}

export function CancelModal({ booking, open, onClose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const fee = booking.ticket_amount * 0.2;
  const refund = Math.max(0, booking.total - booking.convenience_fee - fee);
  const cancel = async () => {
    setBusy(true);
    try {
      const d = await api.post(`/bookings/${booking.code}/cancel`);
      toast(`Booking cancelled. ${inr(d.refund)} will be refunded.`, 'success');
      onDone(d.booking);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Cancel booking?">
      <dl className="bill">
        <div><dt>Amount paid</dt><dd>{inr(booking.total)}</dd></div>
        <div className="discount"><dt>Cancellation fee (20% of tickets)</dt><dd>−{inr(fee)}</dd></div>
        <div className="discount"><dt>Convenience fee (non-refundable)</dt><dd>−{inr(booking.convenience_fee)}</dd></div>
        <div className="total"><dt>Refund to source</dt><dd>{inr(refund)}</dd></div>
      </dl>
      <div className="row gap-sm end">
        <button className="btn btn-ghost" onClick={onClose}>Keep booking</button>
        <button className="btn btn-danger" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>
      </div>
    </Modal>
  );
}

export default function Ticket() {
  const { code } = useParams();
  const { state } = useLocation();
  const q = useAsync(() => api.get(`/bookings/${code}`), [code]);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (q.loading) return <Loader />;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} /></div>;
  const b = q.data.booking;
  const cancelled = b.status === 'CANCELLED';

  return (
    <div className="container section narrow">
      {state?.justBooked && (
        <div className="success-banner">
          <div className="check">✓</div>
          <div>
            <h2>Booking confirmed!</h2>
            <p className="muted">Your M-ticket is below. A copy is saved in <Link className="link" to="/bookings">My bookings</Link>.</p>
          </div>
        </div>
      )}

      <div className={`ticket ${cancelled ? 'cancelled' : ''}`}>
        <div className="ticket-top">
          <Poster src={b.poster_url} alt={b.movie_title} />
          <div>
            <h2>{b.movie_title}</h2>
            <div className="meta-row small"><Cert value={b.certificate} /> {b.language} · {b.format} · {fmtDuration(b.duration_min)}</div>
            <p><strong>{fmtDate(b.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })}</strong> · {fmtTime(b.starts_at)}</p>
            <p className="muted small">{b.theatre_name}, {b.theatre_address}</p>
          </div>
        </div>
        <div className="ticket-tear" />
        <div className="ticket-bottom">
          <div className="ticket-qr">
            {cancelled ? <div className="cancelled-stamp">CANCELLED</div> : (
              <QRCodeSVG value={`CINEVERSE:${b.code}:${b.seats.map((s) => s.id).join(',')}`} size={132} bgColor="#ffffff" fgColor="#111111" includeMargin />
            )}
          </div>
          <div className="ticket-details">
            <div><small className="muted">{b.screen_name}</small><strong className="seats">{b.seats.map((s) => s.id).join(', ')}</strong></div>
            <div><small className="muted">Booking ID</small><strong className="mono">{b.code}</strong></div>
            <div><small className="muted">Tickets</small><strong>{b.seats.length}</strong></div>
          </div>
        </div>
        {b.food.length > 0 && (
          <div className="ticket-food">
            <small className="muted">Food & beverages — collect at counter</small>
            {b.food.map((f) => <div key={f.id}>{f.emoji} {f.name} × {f.qty}</div>)}
          </div>
        )}
        <dl className="bill ticket-bill">
          <div><dt>Tickets</dt><dd>{inr(b.ticket_amount)}</dd></div>
          {b.food_amount > 0 && <div><dt>Food</dt><dd>{inr(b.food_amount)}</dd></div>}
          <div><dt>Convenience fee</dt><dd>{inr(b.convenience_fee)}</dd></div>
          {b.discount > 0 && <div className="discount"><dt>Discounts {b.coupon_code && `(${b.coupon_code})`}</dt><dd>−{inr(b.discount)}</dd></div>}
          <div className="total"><dt>Paid via {b.payment_method}</dt><dd>{inr(b.total)}</dd></div>
          {cancelled && <div className="discount"><dt>Refunded</dt><dd>{inr(b.refund_amount)}</dd></div>}
        </dl>
      </div>

      <div className="row gap-sm center-row">
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
        {canCancel(b) && <button className="btn btn-ghost danger-text" onClick={() => setCancelOpen(true)}>Cancel booking</button>}
        <Link to="/movies" className="btn btn-primary">Book another movie</Link>
      </div>

      <CancelModal booking={b} open={cancelOpen} onClose={() => setCancelOpen(false)}
        onDone={(nb) => { setCancelOpen(false); q.setData({ booking: nb }); }} />
    </div>
  );
}
