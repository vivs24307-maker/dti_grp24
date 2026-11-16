import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCity } from '../context/CityContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-art">
        <h2>Lights. Camera. <span>Booked.</span></h2>
        <p>Thousands of shows across 5 cities. Pick your seat in seconds.</p>
        <div className="auth-art-seats" aria-hidden>
          {Array.from({ length: 40 }, (_, i) => <i key={i} className={[3, 11, 12, 22, 27, 33].includes(i) ? 'on' : ''} />)}
        </div>
      </div>
      <div className="auth-card card">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const from = location.state?.from || '/';

  if (user) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form.email, form.password);
      toast(`Welcome back, ${u.name.split(' ')[0]}!`, 'success');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Good to see you again 👋">
      <form onSubmit={submit} className="form">
        <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</button>
      </form>
      <div className="demo-creds">
        <small className="muted">Demo accounts (click to fill):</small>
        <button className="link small" onClick={() => setForm({ email: 'demo@cineverse.com', password: 'demo123' })}>demo@cineverse.com / demo123</button>
        <button className="link small" onClick={() => setForm({ email: 'admin@cineverse.com', password: 'admin123' })}>admin@cineverse.com / admin123</button>
      </div>
      <p className="muted small">New here? <Link className="link" to="/register" state={location.state}>Create an account</Link></p>
    </AuthShell>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const { city } = useCity();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const from = location.state?.from || '/';

  if (user) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      return setError('Password must be at least 8 characters and include a letter and a number');
    }
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, cityId: city?.id });
      toast('Account created — welcome to CineVerse! 🎉', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthShell title="Create account" subtitle="It takes less than a minute.">
      <form onSubmit={submit} className="form">
        <label>Full name<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
        <label>Email<input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
        <label>Phone <small className="muted">(optional)</small><input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
        <div className="form-row">
          <label>Password<input type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /></label>
          <label>Confirm<input type="password" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      </form>
      <p className="muted small">Already have an account? <Link className="link" to="/login" state={location.state}>Sign in</Link></p>
    </AuthShell>
  );
}
