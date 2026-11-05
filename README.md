# 🎬 CineVerse — Movie Ticket Booking Platform

CineVerse started as a set of static HTML pages for our DTI college project (Group 24).
**v2 turns it into a full stack app** inspired by BookMyShow / District: a React frontend, an
Express REST API and a SQLite database, with real seat locking, payments flow, QR tickets and an admin dashboard.

> The original static version is kept in [`legacy/`](legacy/) for reference.

---

## ✨ Features

### For movie-goers
- **City selection** – Mumbai, Delhi NCR, Bengaluru, Pune, Hyderabad; everything (movies, cinemas, shows) is filtered by city.
- **Movie catalogue** – search (title / cast / director), filter by genre & language, sort by popularity / rating / newest, "Now showing" & "Coming soon".
- **Movie pages** – synopsis, cast & crew, certificate, runtime, user **ratings & reviews** (1–10 ★).
- **Showtimes** – 7-day date strip, shows grouped by cinema, language/format filters (2D / 3D / IMAX / 4DX),
  colour-coded availability (*available / filling fast / almost full*).
- **Cinemas** – browse cinemas in your city and see everything playing at one cinema.
- **Interactive seat map** – Sofa / Recliner / Premium / Classic tiers with different prices, aisles, live sold seats
  (refreshes every 15s), and "pick N seats" auto-selection like real ticketing apps.
- **Seat holds** – seats are locked for **10 minutes** while you pay, so two people can never buy the same seat.
- **Checkout** – food & beverage pre-order, coupon codes, convenience fee + GST, payment method selection (simulated), countdown timer.
- **M-Ticket** – booking confirmation with a **QR code**, printable / save as PDF.
- **My bookings** – upcoming & past bookings, **cancellation with refund** (up to 2 hours before the show, 20% fee).
- **CineVerse Premium** membership – 10% off tickets, zero convenience fee, free popcorn (₹299 / 30 days, simulated payment).
- **Accounts** – sign up, log in (JWT), edit profile, change password.

### For admins (`/admin`)
- Dashboard with revenue, bookings, tickets sold, users, cancellations, revenue by movie / city, bookings per day.
- All bookings table.
- Add movies, change their status (now showing / coming soon / archived).
- Schedule shows on any screen (with overlap detection).
- Create and enable/disable coupon codes.

---

## 🛠️ Tech stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 19, React Router 7, Vite 8, plain CSS (custom design system, responsive) |
| Backend   | Node.js 22+, Express 5, JWT auth, bcrypt password hashing, Helmet, rate limiting |
| Database  | SQLite via `better-sqlite3` (zero setup — the DB file is created automatically) |
| Tests     | Node's built-in test runner + Supertest (API integration tests) |

---

## 🚀 Getting started

**Requirements:** Node.js **22 or newer** (`node -v`).

```bash
git clone https://github.com/vivs24307-maker/dti_grp24.git
cd dti_grp24
npm run install:all     # installs root, server and client dependencies
npm run dev             # starts API on :5000 and React app on :5173
```

Open **http://localhost:5173** 🎉

The database is created and filled with demo data on first start. Shows are generated automatically
for the next 7 days and topped up every hour, so the demo never "runs out" of showtimes.

### Demo accounts

| Role  | Email                  | Password  |
|-------|------------------------|-----------|
| Admin | `admin@cineverse.com`  | `admin123` |
| User  | `demo@cineverse.com`   | `demo123`  |

### Demo coupons
`WELCOME50` · `CINE100` · `STUDENT20`

### Other commands

```bash
npm test          # run API tests
npm run seed      # wipe the database and re-seed demo data
npm run build     # build the React app into client/dist
npm start         # run the API; it also serves client/dist if it was built (single server, port 5000)
```

Configuration (optional): copy `server/.env.example` to `server/.env` and change `JWT_SECRET` etc.

---

## 📂 Project structure

```
dti_grp24/
├── client/                 React frontend (Vite)
│   └── src/
│       ├── pages/          Home, Movies, MovieDetail, Showtimes, SeatLayout, Checkout, Ticket, Admin, ...
│       ├── components/     Navbar, Footer, CityModal, shared UI (MovieCard, Modal, Loader, ...)
│       ├── context/        Auth, City and Toast React contexts
│       ├── api.js          fetch wrapper (adds JWT, handles errors)
│       └── styles.css      design system + all styles
├── server/                 Express REST API
│   ├── src/
│   │   ├── routes/         auth, users, catalog (movies/cinemas/food/offers), shows, bookings, admin
│   │   ├── lib/            pricing, seat holds/booking helpers, show scheduler, validation
│   │   ├── middleware/     JWT auth guards
│   │   ├── db.js           SQLite schema
│   │   ├── seed.js         demo data loader
│   │   └── seedData.js     cities, cinemas, seat layouts, movies, food, coupons
│   └── test/               API integration tests
└── legacy/                 original static HTML version (v1)
```

## 🗄️ Database design

```
cities ─< theatres ─< screens ─< shows >─ movies ─< reviews >─ users
                                   │                              │
                                   ├─< seat_holds  (temporary, 10 min) ─┤
                                   └─< booked_seats >─ bookings >───────┘
coupons, food_items
```

- `screens.layout` stores the seat map as JSON (categories, rows, columns, aisles, prices).
- `booked_seats` has a primary key on `(show_id, seat_id)` — the database itself guarantees a seat can only be sold once.
- `seat_holds` are short-lived locks created when you click **Pay**; a booking is only accepted for seats you currently hold.
- Prices are always calculated on the server (`server/src/lib/pricing.js`), never trusted from the browser.

## 🔌 API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register`, `/api/auth/login` | Create account / log in → JWT |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/cities` | Cities |
| GET  | `/api/movies?city=&genre=&language=&q=&status=&sort=` | Movie list |
| GET  | `/api/movies/:idOrSlug` | Movie details |
| GET  | `/api/movies/:id/shows?city=&date=` | Showtimes grouped by cinema |
| GET/POST | `/api/movies/:id/reviews` | Reviews |
| GET  | `/api/theatres?city=`, `/api/theatres/:id?date=` | Cinemas |
| GET  | `/api/shows/:id` | Seat layout + unavailable seats |
| POST/DELETE | `/api/shows/:id/hold` | Hold / release seats |
| POST | `/api/bookings/preview` | Price breakdown |
| POST | `/api/bookings` | Confirm booking |
| GET  | `/api/bookings`, `/api/bookings/:code` | My bookings / one ticket |
| POST | `/api/bookings/:code/cancel` | Cancel with refund |
| GET  | `/api/food`, `/api/offers` | Snacks menu, coupons |
| POST/DELETE | `/api/users/me/membership` | Buy / cancel Premium |
| *    | `/api/admin/*` | Stats, bookings, movies, shows, coupons (admin only) |

---

## 🗺️ Ideas for next steps
- Real payment gateway (Razorpay test mode)
- Email / SMS tickets
- Events, concerts and dining sections (District style)
- Trailers on movie pages, wishlists, "notify me" for coming soon
- Deploy (Render / Railway for the API, Vercel / Netlify for the frontend) and switch to PostgreSQL

*Payments in this project are simulated. No real money is charged.*
