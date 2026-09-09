const API_URL = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('sk_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const api = {
  get: (path) => fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } }).then(handle),

  post: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }).then(handle),

  patch: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }).then(handle),

  upload: (path, formData, method = 'POST') =>
    fetch(`${API_URL}${path}`, {
      method, // don't set Content-Type — browser sets multipart boundary
      headers: { ...authHeaders() },
      body: formData,
    }).then(handle),

  del: (path) =>
    fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    }).then(handle),
};

export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('sk_user');
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem('sk_token');
  localStorage.removeItem('sk_user');
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}