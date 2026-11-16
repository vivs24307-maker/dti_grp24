import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, MapPin, Sun, Moon, Menu, X, ChevronDown, Ticket, User, ShieldAlert, LogOut } from 'lucide-react';
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
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('cineverse_theme', next); } catch { /* private mode */ }
    setTheme(next);
  };

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const search = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
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
          <Search size={16} className="nav-search-icon" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, actors, directors…"
            aria-label="Search"
          />
        </form>

        <button className="city-btn" onClick={() => setPickerOpen(true)} aria-label="Choose your city">
          <MapPin size={15} className="city-btn-icon" />
          <span>{city?.name || 'Select city'}</span>
          <ChevronDown size={14} className="caret" />
        </button>

        <button
          className="theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title="Light / dark theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button
          className="icon-btn hamburger"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className={`nav-links ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)}>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/cinemas">Cinemas</NavLink>
          <NavLink to="/offers">Offers</NavLink>
          {user ? (
            <div className="user-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              <button className="avatar-btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
                <span className="avatar">{user.name[0]?.toUpperCase()}</span>
                <span className="hide-sm">Hi, {user.name.split(' ')[0]}</span>
                {user.plan === 'Premium' && <span className="pill pill-gold">★ VIP</span>}
              </button>
              {menuOpen && (
                <div className="dropdown" onClick={() => { setMenuOpen(false); setMobileOpen(false); }}>
                  <Link to="/bookings">
                    <Ticket size={16} /> My bookings
                  </Link>
                  <Link to="/profile">
                    <User size={16} /> Profile & membership
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin">
                      <ShieldAlert size={16} /> Admin dashboard
                    </Link>
                  )}
                  <button onClick={() => { logout(); navigate('/'); }}>
                    <LogOut size={16} /> Log out
                  </button>
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
