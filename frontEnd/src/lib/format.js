export const WORK_MODE_LABELS = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' };
export const EMPLOYMENT_LABELS = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' };

export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Data', 'Sales', 'Marketing', 'Customer Success',
  'Operations', 'Finance', 'Human Resources', 'Legal', 'Other'
];
export const VISIBILITY_LABELS = { external: 'External', internal: 'Internal' };
export const SOURCE_LABELS = { direct: 'Direct', referral: 'Referral', internal: 'Internal' };
export const RELATIONSHIP_OPTIONS = [
  ['former_colleague', 'Former colleague'],
  ['friend', 'Friend'],
  ['classmate', 'Classmate'],
  ['family', 'Family'],
  ['professional_network', 'Professional network'],
  ['other', 'Other']
];

/** "Engineering · Platform · Project Atlas" (skips empty parts). */
export function orgLine(job) {
  return [job?.department, job?.team, job?.project].filter(Boolean).join(' · ');
}

export const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
export const STAGE_LABELS = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  not_selected: 'Not moving forward'
};

/** Indian salaries read naturally in lakhs per annum: 1400000 → "14". */
function lakhs(value) {
  const l = value / 100000;
  return Number.isInteger(l) ? String(l) : l.toFixed(1).replace(/\.0$/, '');
}

export function formatSalary(job) {
  const { salaryMin: min, salaryMax: max, salaryCurrency: currency = 'INR' } = job;
  if (!min && !max) return null;
  if (currency !== 'INR') {
    const fmt = n => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
    return min && max ? `${fmt(min)} – ${fmt(max)}` : fmt(min || max);
  }
  if (min && max) return `₹${lakhs(min)}–${lakhs(max)} LPA`;
  return `₹${lakhs(min || max)} LPA${min ? '+' : ''}`;
}

export function formatExperience(job) {
  const min = job.experienceMin || 0;
  if (job.experienceMax != null) {
    if (min === 0 && job.experienceMax <= 1) return 'Fresher';
    return `${min}–${job.experienceMax} yrs`;
  }
  return min === 0 ? 'Any experience' : `${min}+ yrs`;
}

export function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

export function scoreTone(score) {
  if (score == null) return 'none';
  if (score >= 75) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

export const INTERVIEW_MODE_LABELS = { video: 'Video call', phone: 'Phone call', onsite: 'On-site' };

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
  }).format(new Date(date));
}

export function formatRupees(paise) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export const isCompanyAdmin = user => user?.companyRole === 'owner' || user?.companyRole === 'admin';

/** Stable anonymous label used in blind screening mode. */
export function anonLabel(id) {
  return `Candidate ${String(id).slice(-4).toUpperCase()}`;
}

/**
 * Readable message from any error shape: RTK Query ({ status, data: { error } }),
 * a thrown Error, or a string.
 */
export function errorMessage(err, fallback = 'Something went wrong.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.data?.error) return err.data.error;
  if (err.status === 'FETCH_ERROR') return 'Unable to reach the server. Check that the backend is running and try again.';
  if (err.status === 'PARSING_ERROR') return fallback;
  return err.message || err.error || fallback;
}

/** Fit label from the score (same bands as the server): 85+ Excellent, 70+ Strong, 50+ Partial, else Weak. */
export function verdictForScore(score) {
  if (score >= 85) return 'Excellent match';
  if (score >= 70) return 'Strong match';
  if (score >= 50) return 'Partial match';
  return 'Weak match';
}

/** Label to show for a fit report: derived from the score when there is one (older reports included). */
export function fitLabel(score, verdict) {
  return Number.isFinite(score) ? verdictForScore(score) : sentenceCase(verdict);
}

/** Sentence case for AI verdicts saved before they were normalised ("Good Match" → "Good match"). */
export function sentenceCase(text) {
  if (!text) return text;
  const t = String(text).trim();
  const words = t.split(/\s+/);
  // Only short Title-Case labels are changed; sentences and acronyms (ATS, API) stay as written.
  const titleCase = words.length <= 5 && words.every(w => /^[A-Z][a-z'’-]*$/.test(w) || /^[a-z]+$/.test(w));
  return titleCase ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
}
