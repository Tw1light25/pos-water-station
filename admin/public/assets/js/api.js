/**
 * Tiny fetch wrapper for the admin API.
 * Redirects to the login page when the session has expired.
 */

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401) {
    window.location.assign('/login');
    throw new Error('Not authenticated');
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    // Some failures carry extra detail (e.g. which lines are over stock).
    error.data = data;
    throw error;
  }
  return data;
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const del = (path) => api(path, { method: 'DELETE' });
