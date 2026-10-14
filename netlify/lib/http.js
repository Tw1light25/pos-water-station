/** Small helpers for Netlify Functions v2 (Request in, Response out). */

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export function fail(message, status = 400) {
  return json({ error: message }, status);
}

/**
 * Wrap a handler so database or network errors become a clean 500 instead of an
 * unhandled crash. Details are logged, never returned.
 */
export function handler(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      console.error('[api]', request.method, new URL(request.url).pathname, error);
      return fail('Something went wrong on our side. Please try again.', 500);
    }
  };
}

export async function readJson(request, fallback = {}) {
  try {
    return await request.json();
  } catch {
    return fallback;
  }
}
