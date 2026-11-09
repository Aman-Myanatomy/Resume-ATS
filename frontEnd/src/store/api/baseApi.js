import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE } from '../../services/config.js';
import { clearSession } from '../slices/auth.slices.js';

/**
 * RTK Query base API. Every server request in the app goes through here, so
 * responses are cached in the Redux store, de-duplicated, and refreshed by tags.
 * Endpoints are injected per domain in the sibling files (jobs, candidate, employer…).
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE}/api`,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.user?.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }
});

/** Signs the user out when a request made with a token comes back 401 (expired or removed). */
const baseQueryWithAuth = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && api.getState().auth.user?.token) {
    api.dispatch(clearSession());
  }
  return result;
};

export const TAGS = [
  'Stats', 'Plans', 'PublicJobs', 'PublicJob', 'CompanyPage',
  'MyApplications', 'MyResume', 'Workplace', 'Referrals',
  'Company', 'EmployerJobs', 'EmployerJob', 'Applicants', 'Application', 'Interviews',
  'Billing', 'Notifications'
];

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: TAGS,
  // Lists the user just changed elsewhere stay fresh without manual reloads.
  refetchOnMountOrArgChange: 30,
  endpoints: () => ({})
});

/** Builds multipart form data, skipping empty values and JSON-encoding objects/arrays. */
export function toFormData(fields) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    if (value instanceof Blob) body.append(key, value);
    else body.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return body;
}
