import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorBox, Loader, useAsync } from '../components/ui.jsx';
import { inr } from '../utils.js';

export default function Offers() {
  const q = useAsync(() => api.get('/offers'), []);
  const toast = useToast();
  if (q.loading) return <Loader />;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} /></div>;

  const copy = (code) => {
    navigator.clipboard?.writeText(code).then(() => toast(`Copied ${code}`, 'success')).catch(() => {});
  };

  return (
    <div className="container section">
      <h2>Offers & coupons</h2>
      <p className="muted">Apply these at checkout. One coupon per booking. Premium discount stacks with coupons!</p>
      <div className="offers-grid">
        {q.data.coupons.map((c) => (
          <div key={c.code} className="card offer-big">
            <div className="offer-amount">{c.type === 'PERCENT' ? `${c.value}% OFF` : `${inr(c.value)} OFF`}</div>
            <p>{c.description}</p>
            <p className="muted small">
              {c.min_amount > 0 ? `Min. ticket value ${inr(c.min_amount)}` : 'No minimum'}
              {c.max_discount ? ` · Max discount ${inr(c.max_discount)}` : ''}
            </p>
            <button className="coupon-code" onClick={() => copy(c.code)} title="Copy code">{c.code} ⧉</button>
          </div>
        ))}
        <div className="card offer-big premium-offer">
          <div className="offer-amount">★ PREMIUM</div>
          <p>10% off every ticket + zero convenience fee + free popcorn.</p>
          <Link to="/profile" className="btn btn-gold">Join for ₹299</Link>
        </div>
      </div>
    </div>
  );
}
