/** Where the API lives. The dev server runs on :3000 and the API on :4000; in production they share an origin. */
export const API_BASE = (typeof window !== 'undefined' && window.location.port === '3000')
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : '';

/** Turns an API-relative asset path (e.g. a company logo URL) into a loadable URL. */
export function assetUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}
