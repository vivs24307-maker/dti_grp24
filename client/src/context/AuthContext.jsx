import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The session cookie is httpOnly, so the only way to know if we're signed in is to ask the server.
  useEffect(() => {
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('cineverse:logout', onLogout);
    return () => window.removeEventListener('cineverse:logout', onLogout);
  }, []);

  const handleAuth = (data) => {
    setUser(data.user);
    return data.user;
  };

  const login = useCallback((email, password) => api.post('/auth/login', { email, password }).then(handleAuth), []);
  const register = useCallback((payload) => api.post('/auth/register', payload).then(handleAuth), []);
  const logout = useCallback(() => {
    setUser(null);
    return api.post('/auth/logout').catch(() => {});
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
