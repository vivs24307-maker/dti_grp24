// Screen technologies and the show formats they produce.
// A screen has one technology; each show on it is then either the 2D or the 3D flavour.

export const TECH = {
  Standard: { name: '2D & 3D', flat: '2D', stereo: '3D', factor: 1, blurb: 'Regular digital projection' },
  IMAX: { name: 'IMAX', flat: 'IMAX 2D', stereo: 'IMAX 3D', factor: 1, blurb: 'Giant floor-to-ceiling screen with IMAX sound' },
  PXL: { name: 'P[XL]', flat: 'P[XL]', stereo: 'P[XL] 3D', factor: 0.9, blurb: 'Extra-large premium screen with Dolby Atmos' },
  '4DX': { name: '4DX', flat: '4DX', stereo: '4DX 3D', factor: 1.35, blurb: 'Motion seats, wind, water and scent effects' },
  ScreenX: { name: 'ScreenX', flat: 'ScreenX', stereo: 'ScreenX 3D', factor: 1.25, blurb: '270° picture that wraps onto the side walls' },
  ICE: { name: 'ICE', flat: 'ICE', stereo: 'ICE 3D', factor: 0.85, blurb: 'Immersive LED side panels and laser projection' },
  Dolby: { name: 'Dolby Cinema', flat: 'Dolby Cinema', stereo: 'Dolby Cinema 3D', factor: 0.95, blurb: 'Dolby Vision picture with Dolby Atmos sound' },
};

/** Screens created before formats existed were stored as '2D' / '3D'. */
export function normaliseTech(value) {
  if (TECH[value]) return value;
  return 'Standard';
}

/** The name of the screen itself, e.g. "IMAX" (what a cinema lists among its screens). */
export const techName = (tech) => TECH[normaliseTech(tech)].name;
const TECH_ORDER = Object.keys(TECH);
export const sortTech = (list) => [...list].sort((a, b) => TECH_ORDER.indexOf(normaliseTech(a)) - TECH_ORDER.indexOf(normaliseTech(b)));

export function formatLabel(tech, is3d = false) {
  const t = TECH[normaliseTech(tech)];
  return is3d ? t.stereo : t.flat;
}

export function techFactor(tech, is3d = false) {
  return TECH[normaliseTech(tech)].factor * (is3d ? 1.1 : 1);
}

// The order formats are listed in (filters, movie pages): plain first, then the premium experiences
export const FORMAT_ORDER = Object.values(TECH).flatMap((t) => [t.flat, t.stereo]);
export const sortFormats = (list) =>
  [...list].sort((a, b) => (FORMAT_ORDER.indexOf(a) + 100) % 100 - (FORMAT_ORDER.indexOf(b) + 100) % 100);

/** What a format means, for the "about this experience" chips. */
export function describeFormat(label) {
  const tech = Object.values(TECH).find((t) => t.flat === label || t.stereo === label);
  if (!tech) return '';
  return label === tech.stereo && tech !== TECH.Standard ? `${tech.blurb} · in 3D` : label === '3D' ? '3D picture, glasses provided' : tech.blurb;
}
