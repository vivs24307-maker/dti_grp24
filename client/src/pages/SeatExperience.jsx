import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { API_BASE, api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorBox, Loader, useAsync } from '../components/ui.jsx';
import SeatStage from '../components/SeatStage.jsx';

/** The 3D booking page: loads the show, keeps seats live, and hands the chosen seats to checkout. */
export default function SeatExperience() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const q = useAsync(() => api.get(`/shows/${id}`), [id, user?.id]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  // Live seat map: the server pushes an event the moment anyone holds, books or cancels a seat.
  // A slow poll stays on as a safety net in case the stream is blocked by a proxy.
  useEffect(() => {
    const refresh = () => api.get(`/shows/${id}`).then((d) => q.setData(d)).catch(() => {});
    let source;
    if ('EventSource' in window) {
      source = new EventSource(`${API_BASE}/shows/${id}/stream`);
      source.addEventListener('seats', refresh);
      source.onopen = () => setLive(true);
      source.onerror = () => setLive(false);
    }
    const poll = setInterval(refresh, 30000);
    return () => { source?.close(); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const classic = () => navigate(`/shows/${id}/seats?view=2d`, { replace: true });

  if (q.loading && !q.data) return <div className="stage-loading"><Loader label="Building the hall…" /></div>;
  if (q.error) return <div className="container section"><ErrorBox error={q.error} onRetry={q.reload} /></div>;
  const { show, unavailable, myHold, isPast } = q.data;

  const proceed = async (seats) => {
    if (!user) {
      toast('Please log in to book tickets');
      return navigate('/login', { state: { from: location.pathname } });
    }
    setBusy(true);
    try {
      const hold = await api.post(`/shows/${id}/hold`, { seats });
      navigate(`/checkout/${id}`, { state: { seats: hold.seats, expiresAt: hold.expiresAt } });
    } catch (err) {
      toast(err.message, 'error');
      q.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SeatStage
        show={show}
        unavailable={unavailable}
        initialSelected={myHold?.seats || []}
        busy={busy}
        disabled={isPast}
        notify={toast}
        onProceed={proceed}
        onExit={() => navigate(-1)}
        onClassicView={classic}
        onUnsupported={() => { toast('3D view is not supported on this device — showing the classic map'); classic(); }}
      />
      {live && <span className="stage-live" title="Seat availability updates in real time"><i />LIVE</span>}
    </>
  );
}
