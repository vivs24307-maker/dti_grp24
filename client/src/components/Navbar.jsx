import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCity } from '../context/CityContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { city, setPickerOpen } = useCity();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const search = (e) => {
    e.preventDefault();
    navigate(`/movies?q=${encodeURIComponent(q.trim())}`);
    setMobileOpen(false);
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="logo" onClick={() => setMobileOpen(false)}>
          <span className="logo-mark">▶</span><span>Cine<em>Verse</em></span>
        </Link>

        <form className="nav-search" onSubmit={search} role="search">
          <span aria-hidden>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search movies, actors, directors…" aria-label="Search" />
        </form>

        <button className="city-btn" onClick={() => setPickerOpen(true)}>
          📍 {city?.name || 'Select city'} <span className="caret">▾</span>
        </button>

        <button className="icon-btn hamburger" aria-label="Menu" onClick={() => setMobileOpen((o) => !o)}>☰</button>

        <nav className={`nav-links ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)}>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/cinemas">Cinemas</NavLink>
          <NavLink to="/offers">Offers</NavLink>
          {user ? (
            <div className="user-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              <button className="avatar-btn" onClick={() => setMenuOpen((o) => !o)}>
                <span className="avatar">{user.name[0]?.toUpperCase()}</span>
                <span className="hide-sm">Hi, {user.name.split(' ')[0]}</span>
                {user.plan === 'Premium' && <span className="pill pill-gold">★</span>}
              </button>
              {menuOpen && (
                <div className="dropdown" onClick={() => { setMenuOpen(false); setMobileOpen(false); }}>
                  <Link to="/bookings">🎟️ My bookings</Link>
                  <Link to="/profile">👤 Profile & membership</Link>
                  {user.role === 'admin' && <Link to="/admin">📊 Admin dashboard</Link>}
                  <button onClick={() => { logout(); navigate('/'); }}>↩ Log out</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
