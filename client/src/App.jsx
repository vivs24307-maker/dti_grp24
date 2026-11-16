import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Footer from './components/Footer.jsx';
import CityModal from './components/CityModal.jsx';
import { Loader } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Movies from './pages/Movies.jsx';
import MovieDetail from './pages/MovieDetail.jsx';
import Showtimes from './pages/Showtimes.jsx';
import Cinemas from './pages/Cinemas.jsx';
import CinemaDetail from './pages/CinemaDetail.jsx';
import SeatLayout from './pages/SeatLayout.jsx';
import Checkout from './pages/Checkout.jsx';
import Ticket from './pages/Ticket.jsx';
import MyBookings from './pages/MyBookings.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Profile from './pages/Profile.jsx';
import Offers from './pages/Offers.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

// three.js is big, so the 3D hall is only downloaded when someone actually opens a seat map
const SeatExperience = lazy(() => import('./pages/SeatExperience.jsx'));

function SeatsRoute() {
  const [params] = useSearchParams();
  const preferredView = typeof window !== 'undefined' ? localStorage.getItem('cineverse_preferred_view') : null;
  // If view=2d in query or user explicitly chose 2d lite mode, render SeatLayout
  const is2d = params.get('view') === '2d' || (!params.get('view') && preferredView === '2d');
  if (is2d) return <SeatLayout />;
  return (
    <Suspense fallback={<div className="stage-loading"><Loader label="Building the hall…" /></div>}>
      <SeatExperience />
    </Suspense>
  );
}

function RequireAuth({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  // The seat map gets a focused, distraction-free layout like real booking apps
  const focused = pathname.startsWith('/shows/');

  return (
    <>
      <ScrollToTop />
      {!focused && <Navbar />}
      <main className={focused ? 'main-focused' : 'main'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieDetail />} />
          <Route path="/movies/:id/tickets" element={<Showtimes />} />
          <Route path="/cinemas" element={<Cinemas />} />
          <Route path="/cinemas/:id" element={<CinemaDetail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/shows/:id/seats" element={<SeatsRoute />} />
          <Route path="/checkout/:showId" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
          <Route path="/bookings/:code" element={<RequireAuth><Ticket /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!focused && <Footer />}
      <BottomNav />
      <CityModal />
    </>
  );
}
