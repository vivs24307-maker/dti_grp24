import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="logo"><span className="logo-mark">▶</span><span>Cine<em>Verse</em></span></div>
          <p className="muted">Movies, seats and snacks — booked in under a minute.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/movies">Now showing</Link>
          <Link to="/movies?status=coming_soon">Coming soon</Link>
          <Link to="/cinemas">Cinemas</Link>
        </div>
        <div>
          <h4>Account</h4>
          <Link to="/bookings">My bookings</Link>
          <Link to="/profile">CineVerse Premium</Link>
          <Link to="/offers">Offers</Link>
        </div>
        <div>
          <h4>About</h4>
          <p className="muted small">A college DTI project by Group 24. Payments are simulated — no real money is charged.</p>
        </div>
      </div>
      <div className="container footer-bottom muted small">© {new Date().getFullYear()} CineVerse · Made with 🍿</div>
    </footer>
  );
}
