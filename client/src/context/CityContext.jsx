import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const CityContext = createContext(null);
const KEY = 'cineverse_city';

export function CityProvider({ children }) {
  const [cities, setCities] = useState([]);
  const [slug, setSlug] = useState(() => localStorage.getItem(KEY));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    api.get('/cities').then((d) => setCities(d.cities)).catch(() => {});
  }, []);

  // First visit: ask the user where they are, like every ticketing app does
  useEffect(() => {
    if (!slug) setPickerOpen(true);
  }, [slug]);

  const chooseCity = (s) => {
    localStorage.setItem(KEY, s);
    setSlug(s);
    setPickerOpen(false);
  };

  const city = cities.find((c) => c.slug === slug) || null;
  const value = useMemo(
    () => ({ cities, city, citySlug: slug || 'mumbai', chooseCity, pickerOpen, setPickerOpen }),
    [cities, city, slug, pickerOpen],
  );
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export const useCity = () => useContext(CityContext);
