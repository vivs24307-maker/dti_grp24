import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CinemaScene, webglAvailable } from '../three/CinemaScene.js';
import { bestSeats, buildHall, upgradeOffer } from '../three/hallLayout.js';
import { fmtDate, fmtTime, inr } from '../utils.js';

const PERKS = {
  Premium: ['Sweet spot for sound', 'Higher up, clearer sightline', 'Ideal distance from the screen'],
  Recliner: ['Full leather recliner', 'Footrest and extra legroom', 'Wide private armrests'],
  Sofa: ['Private two-seater sofa', 'Highest row in the house', 'The most legroom we have'],
};

/**
 * The immersive 3D seat picker: whole hall from above -> fly into a block -> pick seats ->
 * see the exact view from them on your ticket -> flip the ticket to upgrade.
 *
 * It only needs data + callbacks, so the same component powers the real booking page and the standalone demo.
 */
export default function SeatStage({
  show, unavailable, initialSelected = [], maxSeats = 10, busy = false, disabled = false,
  onProceed, onExit, onClassicView, onUnsupported, onSelectionChange, notify = () => {}, payLabel = 'Pay',
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  // Key on the layout's contents: live refreshes hand us a new (but identical) object every time,
  // and rebuilding the hall would throw away the whole 3D scene.
  const layoutKey = `${show.format}|${JSON.stringify(show.layout)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hall = useMemo(() => buildHall(show.layout, { format: show.format }), [layoutKey]);
  const taken = useMemo(() => new Set(unavailable), [unavailable]);

  const [mode, setMode] = useState('overview');
  const [activeBlock, setActiveBlock] = useState(null);
  const [selected, setSelected] = useState(initialSelected);
  const [party, setParty] = useState(Math.max(2, initialSelected.length));
  const [shot, setShot] = useState(null);
  const [vip, setVip] = useState(null); // frozen upgrade offer while the ticket is flipped
  const [lightsOff, setLightsOff] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ready, setReady] = useState(0); // bumps every time a scene is (re)created

  // The 3D engine lives outside React; it calls back through this ref so handlers are never stale.
  const handlers = useRef({});
  handlers.current.seat = (seat) => {
    if (disabled || vip) return;
    if (taken.has(seat.id)) return notify(`Seat ${seat.id} is already taken`, 'error');
    if (selected.includes(seat.id)) return setSelected(selected.filter((id) => id !== seat.id));
    if (selected.length >= maxSeats) return notify(`You can book up to ${maxSeats} seats at once`, 'error');
    setSelected([...selected, seat.id]);
  };

  useEffect(() => {
    if (!webglAvailable()) { onUnsupported?.(); return undefined; }
    let scene;
    try {
      scene = new CinemaScene(mountRef.current, {
        hall,
        movie: { title: show.movie.title, posterUrl: show.movie.poster_url },
        formatPrice: inr,
        onSeatClick: (seat) => handlers.current.seat(seat),
        onBlockClick: (block) => scene.flyToBlock(block.id),
        onModeChange: (m, block) => { setMode(m); setActiveBlock(block); },
      });
    } catch (err) {
      console.error(err);
      onUnsupported?.();
      return undefined;
    }
    sceneRef.current = scene;
    mountRef.current.__scene = scene; // exposed for automated tests
    setReady((n) => n + 1);
    return () => { scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hall]);

  useEffect(() => { sceneRef.current?.setUnavailable(unavailable); }, [unavailable, ready]);

  // Someone else grabbed a seat we had picked
  useEffect(() => {
    const lost = selected.filter((id) => taken.has(id));
    if (lost.length) {
      setSelected((sel) => sel.filter((id) => !taken.has(id)));
      notify(`Seat ${lost.join(', ')} was just booked by someone else`, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setSelected(selected);
    setShot(selected.length ? scene.snapshot(selected) : null);
    if (!selected.length) setSheetOpen(false);
    onSelectionChange?.(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ready]);

  useEffect(() => { sceneRef.current?.setHouseLights(lightsOff ? false : null); }, [lightsOff, ready]);

  // On wide screens the ticket covers the right edge, so nudge the 3D picture left to keep it centred
  const hasTicket = selected.length > 0;
  useEffect(() => {
    const apply = () => sceneRef.current?.setRightInset(hasTicket && window.innerWidth > 900 ? 340 : 0);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [hasTicket, ready]);

  const seatsInfo = selected.map((id) => hall.seatById.get(id)).filter(Boolean);
  const total = seatsInfo.reduce((sum, s) => sum + s.price, 0);
  const avgScore = seatsInfo.length ? (seatsInfo.reduce((sum, s) => sum + s.score, 0) / seatsInfo.length).toFixed(1) : null;
  const offer = useMemo(() => (selected.length ? upgradeOffer(hall, selected, taken) : null), [hall, selected, taken]);
  const block = activeBlock ? hall.blocks.get(activeBlock) : null;
  const summary = Object.entries(seatsInfo.reduce((acc, s) => ({ ...acc, [s.category]: (acc[s.category] || 0) + 1 }), {}))
    .map(([k, v]) => `${v} × ${k}`).join(', ');

  const flyToSelection = useCallback((ids) => {
    const first = hall.seatById.get(ids[0]);
    if (first) sceneRef.current?.flyToBlock(first.blockId);
  }, [hall]);

  const pickBest = (category) => {
    if (disabled) return;
    const ids = bestSeats(hall, taken, party, category ? (s) => s.category === category : undefined);
    if (ids.length < party) return notify('Not enough seats left together — try fewer seats', 'error');
    setSelected(ids);
    flyToSelection(ids);
    notify(`Best ${party} seat${party > 1 ? 's' : ''} found: ${ids.join(', ')}`, 'success');
  };

  // Upgrade: the ticket flips over and you are taken straight into the better seats
  const openUpgrade = () => {
    if (!offer) return;
    const scene = sceneRef.current;
    scene.setPreview(offer.seats);
    scene.flyToSeats(offer.seats);
    setVip({ ...offer, shot: scene.snapshot(offer.seats) });
    setSheetOpen(true);
  };
  const closeUpgrade = (accept) => {
    const scene = sceneRef.current;
    scene.setPreview([]);
    if (accept) {
      setSelected(vip.seats);
      flyToSelection(vip.seats);
      notify(`Upgraded to ${vip.category} ✨`, 'success');
    } else {
      flyToSelection(selected);
    }
    setVip(null);
  };

  const hint = disabled ? 'Bookings are closed for this show — you can still look around'
    : mode === 'overview' ? 'Hover a block to see its price · click to fly in · drag to orbit'
      : mode === 'block' ? (selected.length ? 'Tap more seats, or sit down to check the view' : 'Pick your seats · scroll to zoom · drag to look around')
        : vip ? `This is the ${vip.category} view. Take it, or keep your seats.`
          : hall.features.fourDX ? '4DX: your seat moves with the film. Move the mouse to look around.'
            : hall.features.screenX ? 'ScreenX: the picture wraps onto the side walls. Look left and right.'
              : hall.features.threeD ? 'Shown in 3D — glasses are handed out at the door. Move the mouse to look around.'
                : 'This is exactly what you will see. Move the mouse to look around.';

  return (
    <div className={`stage mode-${mode} ${lightsOff ? 'lights-off' : ''}`}>
      <div className="stage-mount" ref={mountRef} />

      <header className="stage-top">
        <button className="stage-btn round" onClick={onExit} aria-label="Back">‹</button>
        <div className="stage-title">
          <h1>{show.movie.title} {show.format && <span className="stage-format">{show.format}</span>}</h1>
          <p>{show.theatre_name} · {fmtDate(show.starts_at)}, {fmtTime(show.starts_at)} · {show.screen_name} · {show.language}</p>
        </div>
        <div className="stage-tools">
          <div className="stage-party" title="How many seats?">
            <button onClick={() => setParty(Math.max(1, party - 1))} aria-label="Fewer seats">−</button>
            <span>{party} <small>seat{party > 1 ? 's' : ''}</small></span>
            <button onClick={() => setParty(Math.min(maxSeats, party + 1))} aria-label="More seats">+</button>
          </div>
          <button className="stage-btn glow" onClick={() => pickBest()} disabled={disabled}>✨ <span>Best seats</span></button>
          <button className={`stage-btn ${lightsOff ? 'on' : ''}`} onClick={() => setLightsOff((v) => !v)} title="House lights">
            {lightsOff ? '🌙' : '💡'}
          </button>
          {onClassicView && <button className="stage-btn" onClick={onClassicView} title="Classic 2D seat map">2D</button>}
        </div>
      </header>

      <nav className="stage-crumbs" aria-label="Where you are">
        <button className={mode === 'overview' ? 'here' : ''} onClick={() => sceneRef.current?.flyToOverview()}>🏛 Whole hall</button>
        {block && (
          <>
            <i>›</i>
            <button className={mode === 'block' ? 'here' : ''} onClick={() => sceneRef.current?.flyToBlock(block.id)}>
              {block.category} · Block {block.code}
            </button>
          </>
        )}
        {mode === 'pov' && <><i>›</i><button className="here">👁 Your view</button></>}
      </nav>

      <div className="stage-legend">
        {hall.categories.map((c) => (
          <button key={c.name} onClick={() => {
            const blocks = [...hall.blocks.values()].filter((b) => b.category === c.name);
            sceneRef.current?.flyToBlock(blocks[Math.floor(blocks.length / 2)].id);
          }}>
            <i style={{ background: c.color }} />{c.name}<b>{inr(c.price)}</b>
          </button>
        ))}
        <span><i className="k-sel" />Yours</span>
        <span><i className="k-sold" />Taken</span>
      </div>

      <p className="stage-hint" key={hint}>{hint}</p>

      {mode === 'pov' && (
        <div className="stage-pov">
          {vip ? <span className="pill pill-gold">★ {vip.category} view</span> : <span className="pill pill-gold">★ View score {avgScore}/10</span>}
          <strong>{vip ? `Seats ${vip.seats.join(', ')}` : selected.length > 1 ? `Seats ${selected.join(', ')}` : `Row ${seatsInfo[0]?.row} · Seat ${seatsInfo[0]?.col}`}</strong>
          {!vip && <button className="stage-btn" onClick={() => flyToSelection(selected)}>← Back to seats</button>}
        </div>
      )}

      {selected.length > 0 && (
        <aside className={`eticket ${vip ? 'flipped' : ''} ${sheetOpen ? 'open' : ''}`}>
          <div className="eticket-inner">
            {/* ---------- front: your ticket ---------- */}
            <section className="eticket-face eticket-front" aria-hidden={Boolean(vip)}>
              <button className="eticket-grip" onClick={() => setSheetOpen((v) => !v)} aria-label="Expand ticket"><i /></button>
              <button className="eticket-view" onClick={() => sceneRef.current?.flyToSeats(selected)} title="Sit here">
                {shot ? <img src={shot} alt={`View of the screen from seat ${selected.join(', ')}`} /> : <div className="eticket-noshot" />}
                <span className="eticket-view-tag">VIEW FROM YOUR SEAT</span>
                <span className="eticket-score">★ {avgScore}</span>
                <span className="eticket-sit">👁 Sit here</span>
              </button>
              <div className="eticket-body">
                <h3>{show.movie.title}</h3>
                <p className="muted small">{fmtDate(show.starts_at)} · {fmtTime(show.starts_at)} · {show.screen_name}</p>
                <div className="eticket-seats">
                  {seatsInfo.map((s) => (
                    <button key={s.id} onClick={() => setSelected(selected.filter((id) => id !== s.id))} title="Remove seat">
                      {s.id}<i>×</i>
                    </button>
                  ))}
                </div>
              </div>
              <div className="eticket-tear" />
              <div className="eticket-foot">
                <div className="eticket-total">
                  <small>{summary}</small>
                  <strong>{inr(total)}</strong>
                </div>
                {offer && (
                  <button className="eticket-upgrade" onClick={openUpgrade}>
                    <span>✨ Upgrade to {offer.category}</span>
                    <b>+{inr(offer.extra)}</b>
                  </button>
                )}
                <button className="btn btn-primary btn-block btn-lg" disabled={busy || disabled} onClick={() => onProceed(selected)}>
                  {busy ? 'Holding your seats…' : `${payLabel} ${inr(total)} →`}
                </button>
              </div>
            </section>

            {/* ---------- back: the upgrade ---------- */}
            <section className="eticket-face eticket-back" aria-hidden={!vip}>
              {vip && (
                <>
                  <div className="eticket-view">
                    {vip.shot ? <img src={vip.shot} alt={`View from ${vip.category} seats`} /> : <div className="eticket-noshot" />}
                    <span className="eticket-view-tag gold">★ {vip.category.toUpperCase()} VIEW</span>
                  </div>
                  <div className="eticket-body">
                    <span className="pill pill-gold">VIP UPGRADE</span>
                    <h3>{vip.category} · {vip.seats.join(', ')}</h3>
                    <ul className="eticket-perks">
                      {(PERKS[vip.category] || PERKS.Premium).map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                  <div className="eticket-tear" />
                  <div className="eticket-foot">
                    <div className="eticket-total">
                      <small>{vip.seats.length} × {inr(vip.price)} · only</small>
                      <strong>+{inr(vip.extra)}</strong>
                    </div>
                    <button className="btn btn-gold btn-block btn-lg" onClick={() => closeUpgrade(true)}>Upgrade my seats</button>
                    <button className="btn btn-ghost btn-block" onClick={() => closeUpgrade(false)}>Keep {selected.join(', ')}</button>
                  </div>
                </>
              )}
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}
