// Tiny fetch wrapper: sends the session cookie, parses JSON and turns API errors into thrown Errors.
// The login token lives in an httpOnly cookie set by the server, so page scripts never see it.
export const API_BASE = import.meta.env.VITE_API_URL || '/api';
const BASE = API_BASE;

// Older versions kept the token in localStorage; make sure none is left lying around.
try { localStorage.removeItem('cineverse_token'); } catch { /* storage unavailable */ }

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The session expired or was never there: make sure the UI stops showing a signed-in user.
    if (res.status === 401) window.dispatchEvent(new Event('cineverse:logout'));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.details);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  patch: (p, b = {}) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

export const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const str = s.toString();
  return str ? `?${str}` : '';
};
