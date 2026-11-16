// Demo catalogue for CineVerse. Posters are the same ones the original static site used.

export const cities = [
  { name: 'Mumbai', slug: 'mumbai', state: 'Maharashtra' },
  { name: 'Delhi NCR', slug: 'delhi-ncr', state: 'Delhi' },
  { name: 'Bengaluru', slug: 'bengaluru', state: 'Karnataka' },
  { name: 'Pune', slug: 'pune', state: 'Maharashtra' },
  { name: 'Hyderabad', slug: 'hyderabad', state: 'Telangana' },
];

// Seat layouts. Categories are listed back-of-hall first (top of the seat map),
// the screen sits below the last category. `aisles` = column numbers after which a gap is drawn.
const rows = (from, to) => {
  const out = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) out.push(String.fromCharCode(c));
  return out;
};

export const layouts = {
  PVR: {
    categories: [
      { name: 'Sofa', price: 800, rows: ['L'], cols: 8, aisles: [4] },
      { name: 'Recliner', price: 600, rows: ['J', 'K'], cols: 12, aisles: [6] },
      { name: 'Premium', price: 400, rows: rows('D', 'I'), cols: 16, aisles: [4, 12] },
      { name: 'Classic', price: 250, rows: rows('A', 'C'), cols: 16, aisles: [4, 12] },
    ],
  },
  INOX: {
    categories: [
      { name: 'Sofa', price: 750, rows: ['K'], cols: 6, aisles: [3] },
      { name: 'Recliner', price: 550, rows: ['H', 'I', 'J'], cols: 10, aisles: [5] },
      { name: 'Premium', price: 380, rows: rows('C', 'G'), cols: 14, aisles: [3, 11] },
      { name: 'Classic', price: 230, rows: ['A', 'B'], cols: 14, aisles: [3, 11] },
    ],
  },
  Cinepolis: {
    categories: [
      { name: 'Sofa', price: 850, rows: ['M'], cols: 10, aisles: [5] },
      { name: 'Recliner', price: 650, rows: ['K', 'L'], cols: 12, aisles: [6] },
      { name: 'Premium', price: 420, rows: rows('D', 'J'), cols: 18, aisles: [5, 13] },
      { name: 'Classic', price: 260, rows: rows('A', 'C'), cols: 18, aisles: [5, 13] },
    ],
  },
  IMAX: {
    categories: [
      { name: 'Recliner', price: 900, rows: ['M', 'N'], cols: 14, aisles: [7] },
      { name: 'Premium', price: 650, rows: rows('E', 'L'), cols: 20, aisles: [5, 15] },
      { name: 'Classic', price: 450, rows: rows('A', 'D'), cols: 20, aisles: [5, 15] },
    ],
  },
  // 4DX halls are small: motion seats come in groups of four
  FOURDX: {
    categories: [
      { name: 'Premium', price: 520, rows: rows('D', 'H'), cols: 12, aisles: [4, 8] },
      { name: 'Classic', price: 420, rows: rows('A', 'C'), cols: 12, aisles: [4, 8] },
    ],
  },
  // Dolby Cinema / ICE: a luxury hall that is almost all recliners
  LUXE: {
    categories: [
      { name: 'Sofa', price: 1300, rows: ['H'], cols: 8, aisles: [4] },
      { name: 'Recliner', price: 950, rows: rows('C', 'G'), cols: 12, aisles: [6] },
      { name: 'Premium', price: 600, rows: ['A', 'B'], cols: 16, aisles: [4, 12] },
    ],
  },
};

const AMENITIES = {
  PVR: ['M-Ticket', 'Food & Beverage', 'Recliners', 'Wheelchair Access'],
  INOX: ['M-Ticket', 'Food & Beverage', 'Parking'],
  Cinepolis: ['M-Ticket', 'Food & Beverage', 'Parking', 'Recliners', 'Dolby Atmos'],
};

// Which seat layout a screen technology uses (anything not listed uses the cinema chain's standard hall)
const TECH_LAYOUT = { IMAX: 'IMAX', PXL: 'IMAX', '4DX': 'FOURDX', ICE: 'LUXE', Dolby: 'LUXE' };

// [city slug, brand, name, address, screens[[name, technology]]]
// Technologies: Standard, IMAX, PXL, 4DX, ScreenX, ICE, Dolby  (see lib/formats.js)
export const theatres = [
  ['mumbai', 'PVR', 'PVR: Phoenix Palladium', 'Lower Parel, Mumbai', [['Audi 1', 'Standard'], ['IMAX', 'IMAX'], ['P[XL]', 'PXL'], ['4DX', '4DX']]],
  ['mumbai', 'INOX', 'INOX: R-City Mall', 'Ghatkopar West, Mumbai', [['Screen 1', 'Standard'], ['Screen 2', 'Standard'], ['ScreenX', 'ScreenX'], ['ICE', 'ICE']]],
  ['mumbai', 'Cinepolis', 'Cinepolis: Andheri West', 'Fun Republic, Andheri West, Mumbai', [['Audi 3', 'Standard'], ['4DX', '4DX'], ['Dolby Cinema', 'Dolby']]],
  ['delhi-ncr', 'PVR', 'PVR: Select Citywalk', 'Saket, New Delhi', [['Audi 2', 'Standard'], ['IMAX', 'IMAX'], ['P[XL]', 'PXL'], ['4DX', '4DX']]],
  ['delhi-ncr', 'INOX', 'INOX: Nehru Place', 'Nehru Place, New Delhi', [['Screen 1', 'Standard'], ['Screen 4', 'Standard'], ['ScreenX', 'ScreenX']]],
  ['delhi-ncr', 'Cinepolis', 'Cinepolis: DLF Avenue', 'Saket, New Delhi', [['Audi 1', 'Standard'], ['Dolby Cinema', 'Dolby']]],
  ['bengaluru', 'PVR', 'PVR: Orion Mall', 'Rajajinagar, Bengaluru', [['Audi 5', 'Standard'], ['IMAX', 'IMAX'], ['ScreenX', 'ScreenX']]],
  ['bengaluru', 'INOX', 'INOX: Garuda Mall', 'Magrath Road, Bengaluru', [['Screen 2', 'Standard'], ['ICE', 'ICE']]],
  ['bengaluru', 'Cinepolis', 'Cinepolis: Nexus Shantiniketan', 'Whitefield, Bengaluru', [['Audi 2', 'Standard'], ['Audi 4', 'Standard'], ['4DX', '4DX']]],
  ['pune', 'PVR', 'PVR: Pavilion Mall', 'Shivajinagar, Pune', [['Audi 1', 'Standard'], ['P[XL]', 'PXL'], ['4DX', '4DX']]],
  ['pune', 'INOX', 'INOX: Bund Garden', 'Bund Garden Road, Pune', [['Screen 1', 'Standard'], ['Screen 3', 'Standard'], ['IMAX', 'IMAX']]],
  ['pune', 'Cinepolis', 'Cinepolis: Seasons Mall', 'Magarpatta, Pune', [['Audi 6', 'Standard'], ['Dolby Cinema', 'Dolby']]],
  ['hyderabad', 'PVR', 'PVR: Inorbit Mall', 'HITEC City, Hyderabad', [['Audi 3', 'Standard'], ['IMAX', 'IMAX'], ['4DX', '4DX']]],
  ['hyderabad', 'INOX', 'INOX: GVK One', 'Banjara Hills, Hyderabad', [['Screen 2', 'Standard'], ['ScreenX', 'ScreenX'], ['ICE', 'ICE']]],
  ['hyderabad', 'Cinepolis', 'Cinepolis: Sarath City', 'Kondapur, Hyderabad', [['Audi 1', 'Standard'], ['Audi 7', 'Standard'], ['P[XL]', 'PXL']]],
].map(([city, brand, name, address, screens]) => ({
  city,
  brand,
  name,
  address,
  amenities: AMENITIES[brand],
  screens: screens.map(([sName, format]) => ({
    name: sName,
    format,
    layout: layouts[TECH_LAYOUT[format] || brand],
  })),
}));

export const movies = [
  {
    title: 'Dhurandhar', genres: ['Action', 'Thriller'], languages: ['Hindi'], duration_min: 214, certificate: 'A',
    release_date: '2025-12-05', director: 'Aditya Dhar',
    cast: ['Ranveer Singh', 'Akshaye Khanna', 'Sanjay Dutt', 'R. Madhavan', 'Arjun Rampal'],
    description: 'A high-stakes spy thriller following an Indian operative deep inside a dangerous network across the border.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/c/ce/Dhurandhar_poster.jpg',
  },
  {
    title: 'Michael', genres: ['Biopic', 'Drama', 'Musical'], languages: ['English'], duration_min: 130, certificate: 'UA',
    release_date: '2026-04-24', director: 'Antoine Fuqua',
    cast: ['Jaafar Jackson', 'Colman Domingo', 'Nia Long', 'Miles Teller'],
    description: 'The story of Michael Jackson, from the Jackson 5 to becoming the King of Pop.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Michael_%282026_film_poster%29.png/250px-Michael_%282026_film_poster%29.png',
  },
  {
    title: 'The Devil Wears Prada 2', genres: ['Drama', 'Comedy'], languages: ['English'], duration_min: 120, certificate: 'UA',
    release_date: '2026-05-01', director: 'David Frankel',
    cast: ['Meryl Streep', 'Anne Hathaway', 'Emily Blunt', 'Stanley Tucci'],
    description: 'Miranda Priestly returns as the fashion world and the magazine business change around her.',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BZmM3ZDU3ODItZmY5Yi00OTQ2LWE5OTctZTA5NDBhMWJkOGY3XkEyXkFqcGc@._V1_.jpg',
  },
  {
    title: 'Kalki 2898 AD', has_3d: 1, genres: ['Sci-Fi', 'Action'], languages: ['Telugu', 'Hindi', 'Tamil'], duration_min: 181, certificate: 'UA',
    release_date: '2024-06-27', director: 'Nag Ashwin',
    cast: ['Prabhas', 'Amitabh Bachchan', 'Kamal Haasan', 'Deepika Padukone'],
    description: 'A mythological sci-fi epic set in a dystopian future, where an unlikely hero must protect a child of prophecy.',
    poster_url: 'https://miro.medium.com/1*hb9nFJ8CLhdADfjCV4FRRg.jpeg',
  },
  {
    title: 'Stree 2', genres: ['Horror', 'Comedy'], languages: ['Hindi'], duration_min: 147, certificate: 'UA',
    release_date: '2024-08-15', director: 'Amar Kaushik',
    cast: ['Rajkummar Rao', 'Shraddha Kapoor', 'Pankaj Tripathi', 'Abhishek Banerjee'],
    description: 'The town of Chanderi faces a new terror, and the old gang must reunite to face the headless Sarkata.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/a/a1/Stree_2.jpg',
  },
  {
    title: 'Rockstar', genres: ['Drama', 'Musical', 'Romance'], languages: ['Hindi'], duration_min: 159, certificate: 'UA',
    release_date: '2011-11-11', director: 'Imtiaz Ali',
    cast: ['Ranbir Kapoor', 'Nargis Fakhri'],
    description: 'A college boy from Delhi chases the heartbreak he believes every great musician needs, and becomes a star.',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BOTc3NzAxMjg4M15BMl5BanBnXkFtZTcwMDc2ODQwNw@@._V1_.jpg',
  },
  {
    title: 'Jawan', genres: ['Action', 'Thriller'], languages: ['Hindi', 'Tamil', 'Telugu'], duration_min: 169, certificate: 'UA',
    release_date: '2023-09-07', director: 'Atlee',
    cast: ['Shah Rukh Khan', 'Nayanthara', 'Vijay Sethupathi', 'Deepika Padukone'],
    description: 'A man driven by a personal vendetta sets out to rectify the wrongs in society.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/3/39/Jawan_film_poster.jpg',
  },
  {
    title: 'Pathaan', genres: ['Action', 'Thriller'], languages: ['Hindi'], duration_min: 146, certificate: 'UA',
    release_date: '2023-01-25', director: 'Siddharth Anand',
    cast: ['Shah Rukh Khan', 'Deepika Padukone', 'John Abraham'],
    description: 'An exiled RAW agent returns to stop a rogue mercenary group planning an attack on India.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/c/c3/Pathaan_film_poster.jpg',
  },
  {
    title: 'Oppenheimer', genres: ['Biopic', 'Drama'], languages: ['English', 'Hindi'], duration_min: 180, certificate: 'UA',
    release_date: '2023-07-21', director: 'Christopher Nolan',
    cast: ['Cillian Murphy', 'Emily Blunt', 'Robert Downey Jr.', 'Matt Damon'],
    description: 'The story of J. Robert Oppenheimer and the creation of the atomic bomb.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4a/Oppenheimer_%28film%29.jpg/250px-Oppenheimer_%28film%29.jpg',
  },
  {
    title: '12th Fail', genres: ['Biopic', 'Drama'], languages: ['Hindi'], duration_min: 147, certificate: 'U',
    release_date: '2023-10-27', director: 'Vidhu Vinod Chopra',
    cast: ['Vikrant Massey', 'Medha Shankar'],
    description: 'Based on the true story of Manoj Kumar Sharma, who rose from poverty to crack the UPSC exam.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/f/f2/12th_Fail_poster.jpeg',
  },
  {
    title: 'Shaitaan', genres: ['Horror', 'Thriller'], languages: ['Hindi'], duration_min: 132, certificate: 'UA',
    release_date: '2024-03-08', director: 'Vikas Bahl',
    cast: ['Ajay Devgn', 'R. Madhavan', 'Jyothika', 'Janki Bodiwala'],
    description: "A family's weekend at their farmhouse turns into a nightmare when a stranger takes control of their daughter.",
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/f/f0/Shaitaan_2024_film_theatrical_poster.jpeg',
  },
  {
    title: 'Dune: Part Two', has_3d: 1, genres: ['Sci-Fi', 'Action'], languages: ['English', 'Hindi'], duration_min: 166, certificate: 'UA',
    release_date: '2024-03-01', director: 'Denis Villeneuve',
    cast: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson', 'Austin Butler'],
    description: 'Paul Atreides unites with the Fremen on a warpath of revenge against those who destroyed his family.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg',
  },
  {
    title: 'Animal', genres: ['Action', 'Drama'], languages: ['Hindi', 'Telugu'], duration_min: 201, certificate: 'A',
    release_date: '2023-12-01', director: 'Sandeep Reddy Vanga',
    cast: ['Ranbir Kapoor', 'Anil Kapoor', 'Bobby Deol', 'Rashmika Mandanna'],
    description: "A son's obsessive love for his father pulls him into a violent world of revenge.",
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/9/90/Animal_%282023_film%29_poster.jpg',
  },
  {
    title: 'RRR', has_3d: 1, genres: ['Action', 'Drama'], languages: ['Telugu', 'Hindi', 'Tamil'], duration_min: 187, certificate: 'UA',
    release_date: '2022-03-25', director: 'S. S. Rajamouli',
    cast: ['N. T. Rama Rao Jr.', 'Ram Charan', 'Alia Bhatt', 'Ajay Devgn'],
    description: 'A fictional tale of two legendary revolutionaries and their journey far away from home in the 1920s.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/d/d7/RRR_Poster.jpg',
  },
  {
    title: 'Inside Out 2', has_3d: 1, genres: ['Comedy', 'Animation', 'Family'], languages: ['English', 'Hindi'], duration_min: 96, certificate: 'U',
    release_date: '2024-06-14', director: 'Kelsey Mann',
    cast: ['Amy Poehler', 'Maya Hawke', 'Phyllis Smith'],
    description: "Riley is a teenager now, and Joy and friends must make room for some unexpected new emotions.",
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/f/f7/Inside_Out_2_poster.jpg',
  },
  {
    title: 'Welcome', genres: ['Comedy'], languages: ['Hindi'], duration_min: 159, certificate: 'U',
    release_date: '2007-12-21', director: 'Anees Bazmee',
    cast: ['Akshay Kumar', 'Katrina Kaif', 'Anil Kapoor', 'Nana Patekar', 'Paresh Rawal'],
    description: 'Two gangster brothers want to marry off their sister into a respectable family. Chaos follows.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Welcome_poster_2007.jpg/250px-Welcome_poster_2007.jpg',
  },
  {
    title: 'Spider-Man: Across the Spider-Verse', has_3d: 1, genres: ['Action', 'Animation'], languages: ['English', 'Hindi'], duration_min: 140, certificate: 'U',
    release_date: '2023-06-02', director: 'Joaquim Dos Santos, Kemp Powers, Justin K. Thompson',
    cast: ['Shameik Moore', 'Hailee Steinfeld', 'Oscar Isaac'],
    description: 'Miles Morales is catapulted across the Multiverse, where he meets a team of Spider-People.',
    poster_url: 'https://resizing.flixster.com/_l50Ahm00b-RO9Ao2s3AyMjUWiU=/ems.cHJkLWVtcy1hc3NldHMvbW92aWVzL2ExYTZmMWFkLWViZWItNDNhMS1iZTEwLTcxODk1YTk3NWFhMy53ZWJw',
  },
  {
    title: 'Interstellar', genres: ['Sci-Fi', 'Drama'], languages: ['English'], duration_min: 169, certificate: 'UA',
    release_date: '2014-11-07', director: 'Christopher Nolan',
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Michael Caine'],
    description: "A team of explorers travels through a wormhole in space in an attempt to ensure humanity's survival.",
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg',
  },
  {
    title: '3 Idiots', genres: ['Comedy', 'Drama'], languages: ['Hindi'], duration_min: 170, certificate: 'U',
    release_date: '2009-12-25', director: 'Rajkumar Hirani',
    cast: ['Aamir Khan', 'R. Madhavan', 'Sharman Joshi', 'Kareena Kapoor'],
    description: 'Two friends search for their long-lost college buddy and remember the days he taught them to think differently.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/d/df/3_idiots_poster.jpg',
  },
  {
    title: 'The Dark Knight', genres: ['Action', 'Thriller'], languages: ['English'], duration_min: 152, certificate: 'UA',
    release_date: '2008-07-18', director: 'Christopher Nolan',
    cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Gary Oldman'],
    description: 'Batman faces the Joker, a criminal mastermind who wants to plunge Gotham City into anarchy.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/1/1c/The_Dark_Knight_%282008_film%29.jpg',
  },
  {
    title: 'Ramayana: Rise of a Legend', featured: 1, has_3d: 1,
    tagline: 'Our truth. Our history.',
    genres: ['Mythology', 'Epic', 'Action'], languages: ['Hindi', 'English'], duration_min: 195, certificate: 'UA',
    release_date: '2026-11-05', director: 'Nitesh Tiwari',
    cast: ['Ranbir Kapoor', 'Sai Pallavi', 'Yash', 'Sunny Deol', 'Ravi Dubey'],
    description: 'The first part of the epic: Prince Rama, his wife Sita and his brother Lakshmana are sent into exile, and the demon king Ravana sets the great war in motion. Filmed for IMAX, with music by Hans Zimmer and A. R. Rahman.',
    // Original title-card artwork shipped with the app. Replace the file with the official poster,
    // or set a poster URL from the admin dashboard.
    poster_url: '/posters/ramayana.svg',
  },
];

export const foodItems = [
  { name: 'Salted Popcorn (Regular)', category: 'Popcorn', price: 220, emoji: '🍿' },
  { name: 'Caramel Popcorn (Large)', category: 'Popcorn', price: 340, emoji: '🍿' },
  { name: 'Cheese Popcorn (Large)', category: 'Popcorn', price: 360, emoji: '🍿' },
  { name: 'Nachos with Salsa', category: 'Snacks', price: 260, emoji: '🌮' },
  { name: 'Veg Burger', category: 'Snacks', price: 240, emoji: '🍔' },
  { name: 'Chicken Hot Dog', category: 'Snacks', price: 280, emoji: '🌭', veg: 0 },
  { name: 'Pepsi (Medium)', category: 'Beverages', price: 180, emoji: '🥤' },
  { name: 'Cold Coffee', category: 'Beverages', price: 220, emoji: '🧋' },
  { name: 'Combo: Popcorn + 2 Pepsi', category: 'Combos', price: 520, emoji: '🎁' },
];

export const coupons = [
  { code: 'WELCOME50', description: '50% off on tickets, up to ₹150', type: 'PERCENT', value: 50, max_discount: 150, min_amount: 300 },
  { code: 'CINE100', description: 'Flat ₹100 off on tickets worth ₹500+', type: 'FLAT', value: 100, max_discount: null, min_amount: 500 },
  { code: 'STUDENT20', description: '20% off for students, up to ₹200', type: 'PERCENT', value: 20, max_discount: 200, min_amount: 0 },
];

export const users = [
  { name: 'Admin', email: 'admin@cineverse.com', password: 'admin123', role: 'admin', plan: 'Premium' },
  { name: 'Demo User', email: 'demo@cineverse.com', password: 'demo123', role: 'user', plan: 'Basic' },
];
