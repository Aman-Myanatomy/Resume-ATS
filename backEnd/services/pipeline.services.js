import Company from '../models/company.models.js';
import Application from '../models/application.models.js';
import { httpError } from '../utils/http.utils.js';

/**
 * Hiring pipeline stages, configurable per company.
 *
 * Every pipeline starts with Applied and ends with Hired and Rejected (fixed: the system relies on them).
 * In between, a company defines its own stages, e.g. Screening → Assessment → Technical round → HR round → Offer.
 * Each stage has a stable `key` (stored on applications), a display `label`, and a `kind` that tells the
 * system what the stage means (for candidate emails, charts and auto-moving on interview scheduling).
 */

export const MIDDLE_KINDS = ['screening', 'assessment', 'interview', 'offer', 'other'];
export const STAGE_KINDS = ['applied', ...MIDDLE_KINDS, 'hired', 'rejected'];
const MAX_MIDDLE = 8;

const FIXED_START = { key: 'applied', label: 'Applied', kind: 'applied' };
const FIXED_END = [
  { key: 'hired', label: 'Hired', kind: 'hired' },
  { key: 'rejected', label: 'Rejected', kind: 'rejected' }
];

export const DEFAULT_STAGES = [
  FIXED_START,
  { key: 'screening', label: 'Screening', kind: 'screening' },
  { key: 'interview', label: 'Interview', kind: 'interview' },
  { key: 'offer', label: 'Offer', kind: 'offer' },
  ...FIXED_END
];

const plain = s => ({ key: s.key, label: s.label, kind: s.kind });

/** The company's full ordered stage list (defaults for companies that never customised it). */
export function companyStages(company) {
  const custom = company?.pipelineStages;
  return custom?.length ? custom.map(plain) : DEFAULT_STAGES.map(s => ({ ...s }));
}

export async function stagesForCompany(companyId) {
  const company = await Company.findById(companyId).select('pipelineStages');
  return companyStages(company);
}

/** Stages for many companies at once: Map(companyId -> stages). */
export async function stagesForCompanies(companyIds) {
  const ids = [...new Set(companyIds.map(String))];
  const companies = await Company.find({ _id: { $in: ids } }).select('pipelineStages');
  const map = new Map(companies.map(c => [String(c._id), companyStages(c)]));
  return id => map.get(String(id)) || DEFAULT_STAGES;
}

export function findStage(stages, key) {
  return stages.find(s => s.key === key) || null;
}

export function stageKind(stages, key) {
  return findStage(stages, key)?.kind || (STAGE_KINDS.includes(key) ? key : 'other');
}

export function stageLabel(stages, key) {
  return findStage(stages, key)?.label || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
}

function slug(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'stage';
}

/**
 * Validates the middle stages sent by the employer and returns the full list.
 * Input: [{ key?, label, kind }] in order. Existing keys are kept so applications stay in their stage.
 */
export function normalizeMiddleStages(input) {
  if (!Array.isArray(input)) throw httpError(400, 'Send the stages as a list.');
  if (input.length > MAX_MIDDLE) throw httpError(400, `Add up to ${MAX_MIDDLE} stages between Applied and Hired.`);
  const reserved = new Set(['applied', 'hired', 'rejected', 'not_selected']);
  const usedKeys = new Set(reserved);
  const usedLabels = new Set(['applied', 'hired', 'rejected']);

  const middle = input.map((raw, index) => {
    const label = String(raw?.label || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (label.length < 2) throw httpError(400, `Stage ${index + 1} needs a name (at least 2 characters).`);
    const lower = label.toLowerCase();
    if (usedLabels.has(lower)) throw httpError(400, `"${label}" is used twice. Give every stage a different name.`);
    usedLabels.add(lower);

    const kind = MIDDLE_KINDS.includes(raw?.kind) ? raw.kind : 'other';
    let key = /^[a-z0-9_]{2,30}$/.test(String(raw?.key || '')) && !usedKeys.has(raw.key) ? raw.key : slug(label);
    if (usedKeys.has(key)) {
      let n = 2;
      while (usedKeys.has(`${key}_${n}`)) n += 1;
      key = `${key}_${n}`;
    }
    usedKeys.add(key);
    return { key, label, kind };
  });

  return [FIXED_START, ...middle, ...FIXED_END].map(s => ({ ...s }));
}

/** Saves a company's stages. Refuses to drop a stage that still has applicants in it. */
export async function updatePipelineStages(companyId, input) {
  const company = await Company.findById(companyId).select('pipelineStages');
  if (!company) throw httpError(404, 'Company not found.');
  const next = normalizeMiddleStages(input);
  const current = companyStages(company);
  const nextKeys = new Set(next.map(s => s.key));
  const removed = current.filter(s => !nextKeys.has(s.key));

  if (removed.length) {
    const inUse = await Application.aggregate([
      { $match: { company: company._id, stage: { $in: removed.map(s => s.key) } } },
      { $group: { _id: '$stage', count: { $sum: 1 } } }
    ]);
    if (inUse.length) {
      const detail = inUse.map(r => `${stageLabel(current, r._id)} (${r.count})`).join(', ');
      throw httpError(409, `Move the applicants out of ${detail} before removing ${inUse.length > 1 ? 'these stages' : 'this stage'}.`);
    }
  }

  company.pipelineStages = next;
  await company.save();
  return next;
}

/**
 * Where scheduling an interview moves a candidate: the first interview-type stage, but only when the
 * candidate is still before it. Returns null when no move is needed.
 */
export function interviewStageFor(stages, currentKey) {
  const target = stages.findIndex(s => s.kind === 'interview');
  if (target === -1) return null;
  const current = stages.findIndex(s => s.key === currentKey);
  if (current === -1 || current >= target) return null;
  return stages[target].key;
}
