import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCity } from '../context/CityContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Modal } from '../components/ui.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const { cities, chooseCity } = useCity();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', cityId: user.city_id || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    try {
      const d = await api.patch('/users/me', { name: form.name, phone: form.phone, ...(form.cityId ? { cityId: Number(form.cityId) } : {}) });
      setUser(d.user);
      const c = cities.find((x) => x.id === Number(form.cityId));
      if (c) chooseCity(c.slug);
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/me/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const upgrade = async () => {
    setBusy(true);
    try {
      const d = await api.post('/users/me/membership');
      setUser(d.user);
      setUpgradeOpen(false);
      toast('Welcome to CineVerse Premium ★', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancelPlan = async () => {
    if (!confirm('Cancel your Premium membership? You will lose discounts immediately.')) return;
    const d = await api.del('/users/me/membership');
    setUser(d.user);
    toast('Membership cancelled');
  };

  const isPremium = user.plan === 'Premium';

  return (
    <div className="container section profile-grid">
      <section className={`card membership ${isPremium ? 'is-premium' : ''}`}>
        <span className={`pill ${isPremium ? 'pill-gold' : ''}`}>{isPremium ? '★ PREMIUM MEMBER' : 'BASIC PLAN'}</span>
        <h2>{isPremium ? 'You are a Premium member' : 'Upgrade to Premium'}</h2>
        <ul className="perk-list">
          <li>🎟️ 10% off on every movie ticket</li>
          <li>💸 Zero convenience fee on all bookings</li>
          <li>🍿 Free regular popcorn with every booking</li>
          <li>⚡ Early access to blockbuster bookings</li>
        </ul>
        {isPremium ? (
          <>
            {user.plan_expires && <p className="muted small">Renews on {new Date(user.plan_expires).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            <div className="row gap-sm">
              <button className="btn btn-gold" onClick={() => setUpgradeOpen(true)}>Extend by 30 days</button>
              <button className="btn btn-ghost" onClick={cancelPlan}>Cancel plan</button>
            </div>
          </>
        ) : (
          <button className="btn btn-gold btn-lg" onClick={() => setUpgradeOpen(true)}>Get Premium · ₹299/month</button>
        )}
      </section>

      <section className="card">
        <h3>Your details</h3>
        <form className="form" onSubmit={save}>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Email<input value={user.email} disabled /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Home city
            <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
              <option value="">Select</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary">Save changes</button>
        </form>
      </section>

      <section className="card">
        <h3>Change password</h3>
        <form className="form" onSubmit={changePw}>
          <label>Current password<input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></label>
          <label>New password<input type="password" required minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></label>
          <button className="btn btn-ghost">Update password</button>
        </form>
      </section>

      <Modal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="CineVerse Premium">
        <dl className="bill">
          <div><dt>Premium · 30 days</dt><dd>₹299</dd></div>
          <div className="total"><dt>Amount payable</dt><dd>₹299</dd></div>
        </dl>
        <p className="muted small">Demo payment — nothing will be charged.</p>
        <button className="btn btn-gold btn-block btn-lg" disabled={busy} onClick={upgrade}>{busy ? 'Processing…' : 'Pay ₹299'}</button>
      </Modal>
    </div>
  );
}
