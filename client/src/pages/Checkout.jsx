import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Cert, ErrorBox, Loader, Modal, Poster, useAsync } from '../components/ui.jsx';
import { fmtDate, fmtTime, inr } from '../utils.js';

const METHODS = [
  { id: 'UPI', label: 'UPI', icon: '📲', hint: 'GPay, PhonePe, Paytm' },
  { id: 'CARD', label: 'Debit / Credit card', icon: '💳', hint: 'Visa, Mastercard, RuPay' },
  { id: 'NETBANKING', label: 'Net banking', icon: '🏦', hint: 'All major banks' },
  { id: 'WALLET', label: 'Wallets', icon: '👛', hint: 'Amazon Pay, Mobikwik' },
];

const seatBreakdown = (seats) => {
  const counts = {};
  for (const s of seats) counts[s.category] = (counts[s.category] || 0) + 1;
  return Object.entries(counts).map(([k, v]) => `${v} × ${k}`).join(', ');
};

function useCountdown(expiresAt) {
  const [left, setLeft] = useState(() => (expiresAt ? expiresAt - Date.now() : 0));
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setLeft(expiresAt - Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return Math.max(0, left);
}

export default function Checkout() {
  const { showId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const showQ = useAsync(() => api.get(`/shows/${showId}`), [showId]);
  const foodQ = useAsync(() => api.get('/food'), []);
  const offersQ = useAsync(() => api.get('/offers'), []);

  const hold = showQ.data?.myHold;
  const seats = useMemo(() => hold?.seats || state?.seats || [], [hold, state]);
  const expiresAt = hold?.expiresAt || state?.expiresAt;
  const left = useCountdown(expiresAt);

  const [food, setFood] = useState({}); // id -> qty
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payStep, setPayStep] = useState(null);

  const foodList = useMemo(() => Object.entries(food).filter(([, q]) => q > 0).map(([id, qty]) => ({ id: Number(id), qty })), [food]);

  const refreshQuote = useCallback(async (couponCode = coupon) => {
    if (!seats.length) return;
    try {
      const d = await api.post('/bookings/preview', { showId: Number(showId), seats, food: foodList, coupon: couponCode });
      setQuote(d.quote);
      setQuoteErr(null);
      return true;
    } catch (err) {
      if (couponCode) throw err;
      setQuoteErr(err);
      return false;
    }
  }, [seats, foodList, coupon, showId]);

  useEffect(() => {
    refreshQuote().catch((err) => {
      // A previously applied coupon is no longer valid (e.g. basket changed)
      setCoupon(null);
      toast(err.message, 'error');
    });
  }, [refreshQuote, toast]);

  const applyCoupon = async (code) => {
    const c = (code ?? couponInput).trim().toUpperCase();
    if (!c) return;
    try {
      await refreshQuote(c);
      setCoupon(c);
      setCouponInput(c);
      toast(`Coupon ${c} applied 🎉`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const removeCoupon = () => { setCoupon(null); setCouponInput(''); };

  const releaseAndBack = async () => {
    await api.del(`/shows/${showId}/hold`).catch(() => {});
    navigate(`/shows/${showId}/seats`, { replace: true });
  };

  const pay = async () => {
    setPaying(true);
    setPayStep('Contacting your bank…');
    // Simulated payment gateway delay so the flow feels real
    await new Promise((r) => setTimeout(r, 900));
    setPayStep('Confirming your seats…');
    try {
      const d = await api.post('/bookings', { showId: Number(showId), seats, food: foodList, coupon, paymentMethod: method });
      navigate(`/bookings/${d.booking.code}`, { replace: true, state: { justBooked: true } });
    } catch (err) {
      setPayStep(null);
      setPaying(false);
      toast(err.message, 'error');
      if (err.status === 409) navigate(`/shows/${showId}/seats`, { replace: true });
    }
  };

  if (showQ.loading) return <Loader />;
  if (showQ.error) return <div className="container section"><ErrorBox error={showQ.error} /></div>;
  const show = showQ.data.show;

  if (!seats.length || (expiresAt && left === 0)) {
    return (
      <div className="container section narrow center">
        <div className="card">
          <h2>⏰ Your seat hold has expired</h2>
          <p className="muted">Seats are reserved for 10 minutes. Please choose them again.</p>
          <Link to={`/shows/${showId}/seats`} className="btn btn-primary">Pick seats again</Link>
        </div>
      </div>
    );
  }

  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const categories = [...new Set(foodQ.data?.items.map((i) => i.category) || [])];

  return (
    <div className="container section checkout">
      <div className={`timer ${left < 120000 ? 'urgent' : ''}`}>
        ⏳ Complete payment in <strong>{mm}:{ss}</strong>
        <button className="link" onClick={releaseAndBack}>Change seats</button>
      </div>

      <div className="checkout-grid">
        <div className="checkout-main">
          <section className="card">
            <h3>🍿 Grab a bite!</h3>
            <p className="muted small">Pre-book snacks and skip the queue at the counter.</p>
            {foodQ.loading ? <Loader /> : categories.map((cat) => (
              <div key={cat}>
                <h4 className="food-cat">{cat}</h4>
                <div className="food-grid">
                  {foodQ.data.items.filter((i) => i.category === cat).map((item) => {
                    const qty = food[item.id] || 0;
                    return (
                      <div key={item.id} className="food-item">
                        <span className="food-emoji">{item.emoji}</span>
                        <div className="food-info">
                          <span className={`veg-mark ${item.veg ? 'veg' : 'nonveg'}`} />
                          <strong>{item.name}</strong>
                          <span className="muted">{inr(item.price)}</span>
                        </div>
                        {qty === 0 ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => setFood({ ...food, [item.id]: 1 })}>Add</button>
                        ) : (
                          <div className="stepper">
                            <button onClick={() => setFood({ ...food, [item.id]: qty - 1 })} aria-label="Remove one">−</button>
                            <span>{qty}</span>
                            <button onClick={() => setFood({ ...food, [item.id]: Math.min(qty + 1, 10) })} aria-label="Add one">+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <h3>🏷️ Offers</h3>
            {coupon ? (
              <div className="applied-coupon">
                <span>✅ <strong>{coupon}</strong> applied — you save {inr(quote?.couponDiscount)}</span>
                <button className="link" onClick={removeCoupon}>Remove</button>
              </div>
            ) : (
              <>
                <form className="coupon-form" onSubmit={(e) => { e.preventDefault(); applyCoupon(); }}>
                  <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Enter coupon code" />
                  <button className="btn btn-ghost">Apply</button>
                </form>
                <div className="offer-row compact">
                  {offersQ.data?.coupons.map((c) => (
                    <button key={c.code} className="offer-card" onClick={() => applyCoupon(c.code)}>
                      <div className="offer-code">{c.code}</div>
                      <p className="small">{c.description}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="card">
            <h3>💸 Payment method</h3>
            <div className="pay-methods">
              {METHODS.map((m) => (
                <label key={m.id} className={`pay-method ${method === m.id ? 'active' : ''}`}>
                  <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <span className="pay-icon">{m.icon}</span>
                  <span><strong>{m.label}</strong><br /><small className="muted">{m.hint}</small></span>
                </label>
              ))}
            </div>
            <p className="muted small">🔒 This is a demo — no real payment is taken.</p>
          </section>
        </div>

        <aside className="card summary">
          <div className="summary-movie">
            <Poster src={show.movie.poster_url} alt={show.movie.title} />
            <div>
              <h3>{show.movie.title}</h3>
              <div className="meta-row small"><Cert value={show.movie.certificate} /> {show.language} · {show.format}</div>
              <p className="small">{show.theatre_name}</p>
              <p className="small muted">{fmtDate(show.starts_at)} · {fmtTime(show.starts_at)}</p>
            </div>
          </div>
          <div className="summary-seats">
            <span className="muted small">{show.screen_name}</span>
            <strong>{seats.join(', ')}</strong>
          </div>

          {quoteErr && <ErrorBox error={quoteErr} />}
          {quote && (
            <dl className="bill">
              <div><dt>Tickets ({quote.seats.length})</dt><dd>{inr(quote.ticketAmount)}</dd></div>
              <div className="sub"><dt>{seatBreakdown(quote.seats)}</dt><dd /></div>
              <div><dt>Convenience fee {user?.plan === 'Premium' && <span className="pill pill-gold">FREE</span>}</dt><dd>{inr(quote.convenienceFee)}</dd></div>
              {quote.foodAmount > 0 && <div><dt>Food & beverages</dt><dd>{inr(quote.foodAmount)}</dd></div>}
              {quote.membershipDiscount > 0 && <div className="discount"><dt>Premium discount (10%)</dt><dd>−{inr(quote.membershipDiscount)}</dd></div>}
              {quote.couponDiscount > 0 && <div className="discount"><dt>Coupon {quote.couponCode}</dt><dd>−{inr(quote.couponDiscount)}</dd></div>}
              <div className="total"><dt>Amount payable</dt><dd>{inr(quote.total)}</dd></div>
            </dl>
          )}
          {quote?.perks?.length > 0 && <div className="perks">{quote.perks.map((p) => <span key={p}>★ {p}</span>)}</div>}
          {user?.plan !== 'Premium' && quote && (
            <p className="small muted">💡 Premium members would save {inr(Math.round(quote.ticketAmount * 0.1 + quote.convenienceFee))} on this booking. <Link to="/profile" className="link">Learn more</Link></p>
          )}
          <button className="btn btn-primary btn-block btn-lg" disabled={!quote || paying} onClick={pay}>
            {paying ? 'Processing…' : `Pay ${quote ? inr(quote.total) : ''}`}
          </button>
          <p className="muted small center">By paying you agree to the cancellation policy: cancel up to 2h before the show, 20% of the ticket price is deducted.</p>
        </aside>
      </div>

      <Modal open={Boolean(payStep)}>
        <div className="center pay-progress">
          <div className="spinner big" />
          <h3>{payStep}</h3>
          <p className="muted">Please don't close this window.</p>
        </div>
      </Modal>
    </div>
  );
}
