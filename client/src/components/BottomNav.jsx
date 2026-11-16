import { NavLink, useLocation } from 'react-router-dom';
import { Home, Film, Compass, Ticket, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  // Hide on seat picker and checkout pages for focused immersive booking flow
  if (location.pathname.startsWith('/shows/') || location.pathname.startsWith('/checkout/')) {
    return null;
  }

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/movies', label: 'Movies', icon: Film },
    { to: '/cinemas', label: 'Cinemas', icon: Compass },
    { to: '/bookings', label: 'Bookings', icon: Ticket, authRequired: true },
    { to: user ? '/profile' : '/login', label: user ? 'Profile' : 'Sign In', icon: User },
  ];

  return (
    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <div className="bottom-nav-inner">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} className="bottom-nav-icon" />
            <span className="bottom-nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
