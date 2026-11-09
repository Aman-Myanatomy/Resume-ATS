import { useGetEmployerCompanyQuery } from '../store/api/employerApi.js';

/**
 * Hiring pipeline stages. Each company can define its own (Company profile → Hiring pipeline);
 * these defaults apply until it does. Same shape as the server: { key, label, kind }.
 * `kind` (applied, screening, assessment, interview, offer, other, hired, rejected) drives colours and charts.
 */
export const DEFAULT_STAGES = [
  { key: 'applied', label: 'Applied', kind: 'applied' },
  { key: 'screening', label: 'Screening', kind: 'screening' },
  { key: 'interview', label: 'Interview', kind: 'interview' },
  { key: 'offer', label: 'Offer', kind: 'offer' },
  { key: 'hired', label: 'Hired', kind: 'hired' },
  { key: 'rejected', label: 'Rejected', kind: 'rejected' }
];

export const STAGE_KIND_LABELS = {
  screening: 'Screening',
  assessment: 'Assessment / test',
  interview: 'Interview',
  offer: 'Offer',
  other: 'Other step'
};

/** The signed-in employer's stages (defaults while loading). */
export function useCompanyStages() {
  const { data } = useGetEmployerCompanyQuery();
  return data?.pipelineStages?.length ? data.pipelineStages : DEFAULT_STAGES;
}

export function stageMeta(stages, key) {
  const found = stages.find(s => s.key === key);
  if (found) return found;
  return { key, label: key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') : '', kind: 'other' };
}
