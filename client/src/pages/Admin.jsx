import { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Empty, ErrorBox, Loader, Poster, useAsync } from '../components/ui.jsx';
import { fmtDate, fmtTime, inr } from '../utils.js';

function Bars({ rows, label, value, format = (v) => v }) {
  const max = Math.max(...rows.map((r) => r[value]), 1);
  if (!rows.length) return <p className="muted small">No data yet.</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r[label]} className="bar-row">
          <span className="bar-label" title={r[label]}>{r[label]}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r[value] / max) * 100}%` }} /></div>
          <span className="bar-value">{format(r[value])}</span>
        </div>
      ))}
    </div>
  );
}

function Overview() {
  const q = useAsync(() => api.get('/admin/stats'), []);
  if (q.loading) return <Loader />;
  if (q.error) return <ErrorBox error={q.error} onRetry={q.reload} />;
  const { totals, byMovie, byCity, daily } = q.data;
  return (
    <>
      <div className="stat-grid">
        <div className="stat"><small>Revenue</small><strong>{inr(totals.revenue)}</strong></div>
        <div className="stat"><small>Bookings</small><strong>{totals.bookings}</strong></div>
        <div className="stat"><small>Tickets sold</small><strong>{totals.tickets}</strong></div>
        <div className="stat"><small>Users</small><strong>{totals.users}</strong><span className="muted small">{totals.premiumUsers} premium</span></div>
        <div className="stat"><small>Cancellations</small><strong>{totals.cancelled}</strong></div>
      </div>
      <div className="admin-charts">
        <div className="card"><h4>Revenue by movie</h4><Bars rows={byMovie} label="title" value="revenue" format={inr} /></div>
        <div className="card"><h4>Revenue by city</h4><Bars rows={byCity} label="city" value="revenue" format={inr} /></div>
        <div className="card"><h4>Bookings per day (last 14 days)</h4><Bars rows={daily} label="day" value="bookings" /></div>
      </div>
    </>
  );
}

function Bookings() {
  const q = useAsync(() => api.get('/admin/bookings?limit=100'), []);
  if (q.loading) return <Loader />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data.bookings.length) return <Empty title="No bookings yet" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Code</th><th>User</th><th>Movie</th><th>Show</th><th>Seats</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          {q.data.bookings.map((b) => (
            <tr key={b.id}>
              <td className="mono">{b.code}</td>
              <td>{b.user_name}<br /><small className="muted">{b.user_email}</small></td>
              <td>{b.movie_title}</td>
              <td>{b.theatre_name}<br /><small className="muted">{fmtDate(b.starts_at)} {fmtTime(b.starts_at)}</small></td>
              <td>{b.seats.map((s) => s.id).join(', ')}</td>
              <td>{inr(b.total)}</td>
              <td><span className={`status status-${b.status.toLowerCase()}`}>{b.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EMPTY_MOVIE = { has_3d: false, featured: false, title: '', genres: '', languages: 'Hindi', duration_min: 120, certificate: 'UA', release_date: '', director: '', cast: '', poster_url: '', description: '', status: 'now_showing' };

function Movies() {
  const toast = useToast();
  const q = useAsync(() => api.get('/admin/movies'), []);
  const [form, setForm] = useState(EMPTY_MOVIE);
  const [open, setOpen] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/movies', form);
      toast('Movie added', 'success');
      setForm(EMPTY_MOVIE);
      setOpen(false);
      q.reload();
    } catch (err) { toast(err.message, 'error'); }
  };

  const update = async (m, changes) => {
    try {
      await api.put(`/admin/movies/${m.id}`, changes);
      q.reload();
    } catch (err) { toast(err.message, 'error'); }
  };
  const setStatus = (m, status) => update(m, { status });
  const [posterFor, setPosterFor] = useState(null); // { id, url } while a poster link is being edited
  const savePoster = async (e) => {
    e.preventDefault();
    await update({ id: posterFor.id }, { poster_url: posterFor.url.trim() });
    setPosterFor(null);
    toast('Poster updated', 'success');
  };

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Close form' : '+ Add movie'}</button>
      {open && (
        <form className="card form admin-form" onSubmit={create}>
          <div className="form-row">
            <label>Title<input required value={form.title} onChange={set('title')} /></label>
            <label>Status
              <select value={form.status} onChange={set('status')}>
                <option value="now_showing">Now showing</option>
                <option value="coming_soon">Coming soon</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Genres (comma separated)<input required value={form.genres} onChange={set('genres')} placeholder="Action, Drama" /></label>
            <label>Languages<input required value={form.languages} onChange={set('languages')} placeholder="Hindi, English" /></label>
          </div>
          <div className="form-row">
            <label>Duration (min)<input type="number" min="30" max="300" value={form.duration_min} onChange={set('duration_min')} /></label>
            <label>Certificate
              <select value={form.certificate} onChange={set('certificate')}><option>U</option><option>UA</option><option>A</option></select>
            </label>
            <label>Release date<input type="date" value={form.release_date} onChange={set('release_date')} /></label>
          </div>
          <div className="form-row">
            <label>Director<input value={form.director} onChange={set('director')} /></label>
            <label>Cast (comma separated)<input value={form.cast} onChange={set('cast')} /></label>
          </div>
          <label>Poster URL<input type="url" value={form.poster_url} onChange={set('poster_url')} /></label>
          <div className="form-row">
            <label className="check"><input type="checkbox" checked={form.has_3d} onChange={(e) => setForm({ ...form, has_3d: e.target.checked })} /> Also released in 3D</label>
            <label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Headline film (first on the home page)</label>
          </div>
          <label>Description<textarea rows={3} value={form.description} onChange={set('description')} /></label>
          <button className="btn btn-primary">Save movie</button>
        </form>
      )}
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Poster</th><th>Title</th><th>Genres</th><th>Rating</th><th>Headline</th><th>3D</th><th>Status</th></tr></thead>
            <tbody>
              {q.data.movies.map((m) => (
                <tr key={m.id}>
                  <td>
                    <button className="thumb-btn" title="Change poster" onClick={() => setPosterFor({ id: m.id, url: m.poster_url || '' })}>
                      <Poster src={m.poster_url} alt={m.title} className="thumb" />
                    </button>
                  </td>
                  <td>
                    {m.title}<br /><small className="muted">{m.languages.join(', ')}</small>
                    {posterFor?.id === m.id && (
                      <form className="poster-edit" onSubmit={savePoster}>
                        <input id={`poster-${m.id}`} type="text" placeholder="Paste an image link (https://…)" value={posterFor.url} onChange={(e) => setPosterFor({ ...posterFor, url: e.target.value })} autoFocus />
                        <button className="btn btn-primary btn-sm">Save</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPosterFor(null)}>Cancel</button>
                      </form>
                    )}
                  </td>
                  <td>{m.genres.join(', ')}</td>
                  <td>{m.rating ? `${m.rating} (${m.votes})` : '—'}</td>
                  <td><button className={`toggle ${m.featured ? 'on' : ''}`} onClick={() => update(m, { featured: !m.featured })} aria-label="Headline film" /></td>
                  <td><button className={`toggle ${m.has_3d ? 'on' : ''}`} onClick={() => update(m, { has_3d: !m.has_3d })} aria-label="Released in 3D" /></td>
                  <td>
                    <select value={m.status} onChange={(e) => setStatus(m, e.target.value)}>
                      <option value="now_showing">Now showing</option>
                      <option value="coming_soon">Coming soon</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Shows() {
  const toast = useToast();
  const q = useAsync(() => Promise.all([api.get('/admin/movies'), api.get('/admin/screens')]), []);
  const [form, setForm] = useState({ movieId: '', screenId: '', startsAt: '', language: '', priceFactor: 1, is3d: false });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (q.loading) return <Loader />;
  if (q.error) return <ErrorBox error={q.error} />;
  const [{ movies }, { screens }] = q.data;
  const movie = movies.find((m) => m.id === Number(form.movieId));

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/shows', { ...form, language: form.language || movie?.languages[0] });
      toast('Show scheduled', 'success');
      setForm({ ...form, startsAt: '' });
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <form className="card form admin-form" onSubmit={create}>
      <h4>Schedule a new show</h4>
      <p className="muted small">The server also auto-schedules a rolling 7-day programme for every screen.</p>
      <label>Movie
        <select required value={form.movieId} onChange={set('movieId')}>
          <option value="">Select movie</option>
          {movies.filter((m) => m.status === 'now_showing').map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      </label>
      <label>Screen
        <select required value={form.screenId} onChange={set('screenId')}>
          <option value="">Select screen</option>
          {screens.map((s) => <option key={s.id} value={s.id}>{s.city_name} — {s.theatre_name} — {s.name} ({s.format})</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={form.is3d} onChange={(e) => setForm({ ...form, is3d: e.target.checked })} /> 3D show (IMAX 3D, 4DX 3D, ScreenX 3D… depending on the screen)</label>
      <div className="form-row">
        <label>Starts at<input type="datetime-local" required value={form.startsAt} onChange={set('startsAt')} /></label>
        <label>Language
          <select value={form.language} onChange={set('language')}>
            {(movie?.languages || []).map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label>Price multiplier<input type="number" step="0.05" min="0.5" max="3" value={form.priceFactor} onChange={set('priceFactor')} /></label>
      </div>
      <button className="btn btn-primary">Create show</button>
    </form>
  );
}

function Coupons() {
  const toast = useToast();
  const q = useAsync(() => api.get('/admin/coupons'), []);
  const [form, setForm] = useState({ code: '', description: '', type: 'PERCENT', value: 10, max_discount: '', min_amount: 0 });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/coupons', form);
      toast('Coupon created', 'success');
      setForm({ ...form, code: '', description: '' });
      q.reload();
    } catch (err) { toast(err.message, 'error'); }
  };
  const toggle = async (c) => {
    await api.patch(`/admin/coupons/${c.code}`, { active: !c.active });
    q.reload();
  };

  return (
    <>
      <form className="card form admin-form" onSubmit={create}>
        <h4>New coupon</h4>
        <div className="form-row">
          <label>Code<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
          <label>Type<select value={form.type} onChange={set('type')}><option value="PERCENT">Percent</option><option value="FLAT">Flat ₹</option></select></label>
          <label>Value<input type="number" min="1" required value={form.value} onChange={set('value')} /></label>
        </div>
        <div className="form-row">
          <label>Max discount (₹)<input type="number" min="0" value={form.max_discount} onChange={set('max_discount')} /></label>
          <label>Min ticket value (₹)<input type="number" min="0" value={form.min_amount} onChange={set('min_amount')} /></label>
        </div>
        <label>Description<input required value={form.description} onChange={set('description')} /></label>
        <button className="btn btn-primary">Create coupon</button>
      </form>
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Description</th><th>Rule</th><th>Active</th></tr></thead>
            <tbody>
              {q.data.coupons.map((c) => (
                <tr key={c.code}>
                  <td className="mono">{c.code}</td>
                  <td>{c.description}</td>
                  <td>{c.type === 'PERCENT' ? `${c.value}%` : inr(c.value)}{c.max_discount ? ` (max ${inr(c.max_discount)})` : ''}{c.min_amount ? `, min ${inr(c.min_amount)}` : ''}</td>
                  <td><button className={`toggle ${c.active ? 'on' : ''}`} onClick={() => toggle(c)} aria-label="Toggle active" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const TABS = { Overview, Bookings, Movies, Shows, Coupons };

export default function Admin() {
  const [tab, setTab] = useState('Overview');
  const Tab = TABS[tab];
  return (
    <div className="container section">
      <div className="section-head wrap">
        <h2>📊 Admin dashboard</h2>
        <div className="tabs">
          {Object.keys(TABS).map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>
      <div className="admin-body"><Tab /></div>
    </div>
  );
}
