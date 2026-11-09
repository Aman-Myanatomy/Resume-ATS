import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Briefcase, GraduationCap, IndianRupee, Laptop, ArrowUp, AlertCircle, RotateCw } from 'lucide-react';
import { STAGE_LABELS, scoreTone, WORK_MODE_LABELS, EMPLOYMENT_LABELS, formatSalary, formatExperience } from '../lib/format.js';
import { assetUrl } from '../services/config.js';

export function ScoreRing({ score, status, size = 'md' }) {
  if (status === 'pending' || status === 'scoring') {
    return <span className={`jb-score jb-score-${size} jb-score-pending`} title="AI is scoring this application" aria-label="Scoring">···</span>;
  }
  if (status === 'over_limit') {
    return (
      <span className={`jb-score jb-score-${size} jb-score-none`} title="Monthly AI scoring limit reached. Upgrade to score." aria-label="Not scored: plan limit">
        <ArrowUp size={size === 'lg' ? 22 : 16} aria-hidden="true" />
      </span>
    );
  }
  if (status === 'failed' || score == null) {
    return <span className={`jb-score jb-score-${size} jb-score-none`} title="Not scored" aria-label="Not scored">–</span>;
  }
  return (
    <span className={`jb-score jb-score-${size} jb-tone-${scoreTone(score)}`} title={`Fit score ${score}/100`} aria-label={`Fit score ${Math.round(score)} out of 100`}>
      {Math.round(score)}
    </span>
  );
}

/** Stage pill. Custom stages pass their own label; `kind` picks the colour (falls back to the key). */
export function StageBadge({ stage, label, kind }) {
  return <span className={`jb-stage jb-stage-${kind || stage}`}>{label || STAGE_LABELS[stage] || stage}</span>;
}

// Six calm brand-adjacent hues so companies without a logo are still easy to tell apart.
const LOGO_HUES = [
  ['#f5d779', '#17211d'], ['#c8e66b', '#17211d'], ['#9fd3c0', '#10302a'],
  ['#f2b8a2', '#3b1d14'], ['#b9c7f2', '#16224a'], ['#d9c2f0', '#2d1a46']
];

/** Company logo, or a coloured initial chosen from the company name. */
export function CompanyLogo({ name = '?', url, size = 'md' }) {
  const src = assetUrl(url);
  if (src) {
    return <img className={`jb-logo jb-logo-${size}`} src={src} alt={`${name} logo`} loading="lazy" width="48" height="48" />;
  }
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [bg, fg] = LOGO_HUES[hash % LOGO_HUES.length];
  return (
    <span className={`jb-logo jb-logo-${size} jb-logo-initial`} style={{ background: bg, color: fg }} aria-hidden="true">
      {name.trim()[0]?.toUpperCase() || '?'}
    </span>
  );
}

export function JobMeta({ job }) {
  const salary = formatSalary(job);
  const place = job.workMode === 'remote' && !job.location ? 'Remote' : job.location;
  return (
    <div className="jb-meta">
      {place && <span><MapPin size={14} aria-hidden="true" />{place}</span>}
      <span><Laptop size={14} aria-hidden="true" />{WORK_MODE_LABELS[job.workMode]}</span>
      <span><Briefcase size={14} aria-hidden="true" />{EMPLOYMENT_LABELS[job.employmentType]}</span>
      <span><GraduationCap size={14} aria-hidden="true" />{formatExperience(job)}</span>
      {salary && <span className="jb-meta-salary"><IndianRupee size={14} aria-hidden="true" />{salary.replace('₹', '')}</span>}
    </div>
  );
}

export function Chips({ items = [], tone = 'plain', limit }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return null;
  return (
    <div className="jb-chips">
      {shown.map(item => <span key={item} className={`jb-chip jb-chip-${tone}`}>{item}</span>)}
      {limit && items.length > limit && <span className="jb-chip jb-chip-more">+{items.length - limit}</span>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div className="jb-loading" role="status"><span className="jb-spinner" aria-hidden="true" />{label}</div>;
}

// ---------- Skeletons (shape of the content that's coming) ----------

export function Skeleton({ width = '100%', height = 12, radius = 6, style }) {
  return <span className="jb-skel" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3, avatar = true }) {
  return (
    <div className="jb-card jb-skel-card" aria-hidden="true">
      {avatar && <Skeleton width={44} height={44} radius={12} />}
      <div className="jb-skel-lines">
        <Skeleton width="45%" height={16} />
        {Array.from({ length: lines - 1 }, (_, i) => <Skeleton key={i} width={`${80 - i * 18}%`} />)}
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4, lines = 3, avatar = true, label = 'Loading…' }) {
  return (
    <div className="jb-stack" role="status" aria-label={label}>
      <span className="jb-sr">{label}</span>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} lines={lines} avatar={avatar} />)}
    </div>
  );
}

/** Shows an error. Plan-limit messages (they mention "upgrade") get a link to the Billing page. */
export function ErrorNote({ children, onRetry }) {
  if (!children) return null;
  const isPlanLimit = typeof children === 'string' && /upgrade/i.test(children);
  return (
    <div className="error jb-error" role="alert">
      <span className="jb-error-text"><AlertCircle size={16} aria-hidden="true" />{children}</span>
      {isPlanLimit && <Link to="/employer/billing" className="text-button">See plans <ArrowUpRight size={14} aria-hidden="true" /></Link>}
      {onRetry && <button type="button" className="text-button" onClick={() => onRetry()}><RotateCw size={14} aria-hidden="true" /> Try again</button>}
    </div>
  );
}

export function EmptyState({ title, children, action, icon: Icon }) {
  return (
    <div className="jb-empty">
      {Icon && <span className="jb-empty-icon"><Icon size={22} aria-hidden="true" /></span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand jb-brand-link">
      <span className="brand-mark">R</span> resumely
    </Link>
  );
}
