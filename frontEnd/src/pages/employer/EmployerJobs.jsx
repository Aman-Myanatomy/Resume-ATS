import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowRight, Briefcase, CalendarDays, Check, Copy, ExternalLink, Flag, Inbox, Lock, MapPin, Pencil,
  PlusCircle, RotateCcw, Search, Sparkles, Star, UserPlus, Users, Video, Phone,
  GraduationCap, IndianRupee, Laptop, MessageCircle, Linkedin, Eye,
  PieChart, BarChart3, TrendingUp, Activity
} from 'lucide-react';
import { useGetEmployerJobsQuery, useGetEmployerOverviewQuery, useUpdateJobMutation } from '../../store/api/employerApi.js';
import {
  EMPLOYMENT_LABELS, WORK_MODE_LABELS, anonLabel, errorMessage, fitLabel, timeAgo,
  formatSalary, formatExperience, orgLine
} from '../../lib/format.js';
import { EmptyState, ErrorNote, ScoreRing, Skeleton, SkeletonList } from '../../components/ui.jsx';
import { publicJobLink, useCopy } from '../../lib/useCopy.js';
import { useCompanyStages } from '../../lib/stages.js';

const STATUS_LABEL = { open: 'Open', draft: 'Draft', closed: 'Closed', internal: 'Internal' };
const MODE_ICON = { video: Video, phone: Phone, onsite: MapPin };
const publicLink = publicJobLink;

function StatTile({ icon: Icon, value, label, hint, tone, color = 'green' }) {
  return (
    <div className={`jb-kpi ${tone ? `jb-kpi-${tone}` : ''}`}>
      <span className={`jb-kpi-icon jb-kpi-icon-${color}`}><Icon size={16} aria-hidden="true" /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}

function PipelineBar({ pipeline }) {
  const stages = useCompanyStages();
  const total = stages.reduce((sum, s) => sum + (pipeline[s.key] || 0), 0);
  return (
    <div className="jb-pipebar-wrap">
      <div className="jb-pipebar" role="img" aria-label={stages.map(s => `${s.label} ${pipeline[s.key] || 0}`).join(', ')}>
        {stages.map(s => (pipeline[s.key] ? <span key={s.key} className={`jb-pipe-${s.kind}`} style={{ flexGrow: pipeline[s.key] }} /> : null))}
      </div>
      <div className="jb-pipe-legend">
        {stages.filter(s => pipeline[s.key]).map(s => (
          <span key={s.key}><i className={`jb-pipe-${s.kind}`} />{s.label} {pipeline[s.key]}</span>
        ))}
        <span className="jb-muted">· {total} total</span>
      </div>
    </div>
  );
}

function DonutChart({ data, size = 110, strokeWidth = 14, centerVal, centerLabel }) {
  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="jb-donut-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="jb-donut-svg">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={strokeWidth}
            strokeOpacity="0.5"
          />
          <text x={center} y={center - 2} textAnchor="middle" className="jb-donut-center-val">{centerVal ?? 0}</text>
          <text x={center} y={center + 12} textAnchor="middle" className="jb-donut-center-sub">{centerLabel ?? 'Pipeline'}</text>
        </svg>
      </div>
    );
  }

  let accumulated = 0;
  return (
    <div className="jb-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="jb-donut-svg">
        {data.map(slice => {
          if (!slice.value) return null;
          const ratio = slice.value / total;
          const strokeDasharray = `${ratio * circumference} ${circumference}`;
          const strokeDashoffset = -accumulated * circumference;
          accumulated += ratio;
          return (
            <circle
              key={slice.key || slice.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(-90 ${center} ${center})`}
              className="jb-donut-slice"
            />
          );
        })}
        <text x={center} y={center - 2} textAnchor="middle" className="jb-donut-center-val">{centerVal ?? total}</text>
        <text x={center} y={center + 12} textAnchor="middle" className="jb-donut-center-sub">{centerLabel ?? 'Candidates'}</text>
      </svg>
    </div>
  );
}

function FunnelChart({ stages, total }) {
  return (
    <div className="jb-funnel-col">
      {stages.map(st => {
        const pct = total > 0 ? Math.round((st.count / total) * 100) : 0;
        return (
          <div key={st.key} className="jb-funnel-item">
            <div className="jb-funnel-top">
              <span className="jb-funnel-top-left">
                <span className="jb-legend-dot" style={{ background: st.color }} />
                <span>{st.label}</span>
              </span>
              <span className="jb-funnel-top-right">
                <strong>{st.count}</strong>
                <span>{total > 0 ? `${pct}%` : '0%'}</span>
              </span>
            </div>
            <div className="jb-funnel-bar-bg">
              <div
                className="jb-funnel-bar-fill"
                style={{
                  width: total > 0 ? `${Math.max(pct, 5)}%` : '0%',
                  background: st.color
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobRow({ job, copiedId, onCopy, onStatus, busy }) {
  const total = job.applicationCount || 0;
  const posted = job.publishedAt || job.createdAt;
  const link = publicLink(job.id);
  const salary = formatSalary(job);

  return (
    <article className={`jb-job-card-sleek jb-job-card-${job.status}`}>
      {/* Top Header: Title, Status, and Action Buttons */}
      <div className="jb-job-card-top">
        <div className="jb-job-card-heading">
          <Link to={`/employer/jobs/${job.id}`} className="jb-job-card-title">
            {job.title}
          </Link>
          <span className={`jb-live-status jb-live-status-${job.status}`}>
            <span className="jb-pulse-dot" aria-hidden="true" />
            {STATUS_LABEL[job.status]}
          </span>
          {job.visibility === 'internal' && (
            <span className="jb-visibility-badge" title="Only your employees can see and apply">
              <Lock size={11} aria-hidden="true" /> Internal
            </span>
          )}
          <span className="jb-job-card-org">
            {job.jobCode && <span className="jb-job-code">{job.jobCode}</span>}
            {orgLine(job) && <span>{orgLine(job)}</span>}
            {job.openings > 1 && <span>{job.openings} openings</span>}
          </span>
        </div>

        <div className="jb-job-card-actions">
          {job.status === 'open' && (
            <button
              type="button"
              className={`jb-btn jb-btn-sm ${copiedId === job.id ? 'jb-btn-copied' : 'jb-btn-ghost'}`}
              onClick={() => onCopy(job.id, link)}
              title="Copy candidate application link"
            >
              {copiedId === job.id ? (
                <><Check size={13} aria-hidden="true" /> Copied link</>
              ) : (
                <><Copy size={13} aria-hidden="true" /> Copy link</>
              )}
            </button>
          )}

          <Link
            to={`/employer/jobs/${job.id}/edit`}
            className="jb-btn jb-btn-ghost jb-btn-sm"
            title="Edit job details"
          >
            <Pencil size={13} aria-hidden="true" />
            <span>Edit</span>
          </Link>

          {job.status === 'open' && (
            <Link
              to={`/jobs/${job.id}`}
              target="_blank"
              rel="noreferrer"
              className="jb-btn jb-btn-ghost jb-btn-sm"
              title={job.visibility === 'internal' ? 'View the job page employees see' : 'View public candidate application page'}
            >
              <ExternalLink size={13} aria-hidden="true" />
              <span>{job.visibility === 'internal' ? 'Job page' : 'Public page'}</span>
            </Link>
          )}

          {job.status === 'open' && (
            <button
              type="button"
              className="jb-btn jb-btn-ghost jb-btn-sm jb-btn-subtle-danger"
              disabled={busy}
              onClick={() => onStatus(job, 'closed')}
              title="Close job listing"
            >
              <Lock size={13} aria-hidden="true" />
              <span>Close</span>
            </button>
          )}

          {job.status === 'closed' && (
            <button
              type="button"
              className="jb-btn jb-btn-sm jb-btn-light"
              disabled={busy}
              onClick={() => onStatus(job, 'open')}
              title="Reopen job"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reopen</span>
            </button>
          )}
        </div>
      </div>

      {/* Meta Chips */}
      <div className="jb-job-card-meta">
        {job.location && (
          <span className="jb-pipe-tag" title="Location">
            <MapPin size={12} aria-hidden="true" />
            {job.location}
          </span>
        )}
        <span className="jb-pipe-tag" title="Work Mode">
          <Laptop size={12} aria-hidden="true" />
          {WORK_MODE_LABELS[job.workMode] || 'On-site'}
        </span>
        <span className="jb-pipe-tag" title="Employment Type">
          <Briefcase size={12} aria-hidden="true" />
          {EMPLOYMENT_LABELS[job.employmentType] || 'Full-time'}
        </span>
        {formatExperience(job) && (
          <span className="jb-pipe-tag" title="Experience">
            <GraduationCap size={12} aria-hidden="true" />
            {formatExperience(job)}
          </span>
        )}
        {salary && (
          <span className="jb-pipe-tag jb-pipe-tag-salary" title="Salary Range">
            <IndianRupee size={12} aria-hidden="true" />
            {salary.replace('₹', '')}
          </span>
        )}
        <span className="jb-emp-posted-meta">
          · {job.status === 'draft' ? `Created ${timeAgo(job.createdAt)}` : `Posted ${timeAgo(posted)}`}
          {job.lastAppliedAt && <> · Last applicant {timeAgo(job.lastAppliedAt)}</>}
        </span>
      </div>

      {/* Bottom Pipeline Summary Strip */}
      <div className="jb-job-card-bottom">
        {total > 0 ? (
          <div className="jb-job-metrics-row">
            <div className="jb-job-metric-chip">
              <strong>{total}</strong> <span>Applicants</span>
            </div>
            <div className={`jb-job-metric-chip ${job.pipeline.applied > 0 ? 'attention' : ''}`}>
              <strong>{job.pipeline.applied}</strong> <span>To review</span>
            </div>
            <div className="jb-job-metric-chip">
              <strong className="jb-good-text">{job.topFit}</strong> <span>Top fit (75+)</span>
            </div>
            <div className="jb-job-metric-chip">
              <strong>{job.avgScore ?? '–'}</strong> <span>Avg score</span>
            </div>
            {job.referrals > 0 && (
              <div className="jb-job-metric-chip">
                <strong>{job.referrals}</strong> <span>Referred</span>
              </div>
            )}
            {job.internalApplicants > 0 && (
              <div className="jb-job-metric-chip">
                <strong>{job.internalApplicants}</strong> <span>Internal</span>
              </div>
            )}
          </div>
        ) : (
          <div className="jb-job-mini-pipeline">
            <div className="jb-pipe-step" title="Applied candidates">
              <span className="jb-pipe-step-dot" />
              <span>Applied (0)</span>
            </div>
            <span className="jb-pipe-step-line" />
            <div className="jb-pipe-step ready" title="AI fit auto-scoring active">
              <Sparkles size={11} className="jb-pipe-step-sparkle" aria-hidden="true" />
              <span>AI Scoring Active</span>
            </div>
            <span className="jb-pipe-step-line" />
            <div className="jb-pipe-step" title="Interviews scheduled">
              <span className="jb-pipe-step-dot" />
              <span>Interviews (0)</span>
            </div>
            <span className="jb-pipe-step-line" />
            <div className="jb-pipe-step" title="Job offers">
              <span className="jb-pipe-step-dot" />
              <span>Offers (0)</span>
            </div>
          </div>
        )}

        <Link
          to={`/employer/jobs/${job.id}`}
          className="jb-btn jb-btn-sm jb-btn-primary-action"
        >
          {total > 0 ? (
            <>Review applicants ({total}) <ArrowRight size={14} aria-hidden="true" /></>
          ) : (
            <>View pipeline & criteria <ArrowRight size={14} aria-hidden="true" /></>
          )}
        </Link>
      </div>

      {total > 0 && <PipelineBar pipeline={job.pipeline} />}
    </article>
  );
}

export default function EmployerJobs() {
  const blind = useSelector(state => state.ui.blindScreening);
  const overview = useGetEmployerOverviewQuery();
  const { data: jobs = [], error, isLoading, refetch } = useGetEmployerJobsQuery();
  const [updateJob, { isLoading: updating }] = useUpdateJobMutation();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState('');
  const [copiedId, copy] = useCopy();

  const counts = useMemo(() => ({
    all: jobs.length,
    open: jobs.filter(j => j.status === 'open').length,
    draft: jobs.filter(j => j.status === 'draft').length,
    closed: jobs.filter(j => j.status === 'closed').length,
    internal: jobs.filter(j => j.visibility === 'internal').length
  }), [jobs]);

  // Work first: open jobs with the most people waiting for review, then recent activity; drafts, then closed.
  const STATUS_ORDER = { open: 0, draft: 1, closed: 2 };
  const activity = j => new Date(j.lastAppliedAt || j.publishedAt || j.createdAt).getTime();
  const visible = jobs
    .filter(j => status === 'all' || (status === 'internal' ? j.visibility === 'internal' : j.status === status))
    .filter(j => !query.trim() || [j.title, j.location, j.jobCode, j.department, j.team, j.project, j.hiringManager]
      .join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      || (b.pipeline.applied - a.pipeline.applied)
      || (activity(b) - activity(a)));

  const changeStatus = async (job, next) => {
    setActionError('');
    try {
      await updateJob({ id: job.id, status: next }).unwrap();
    } catch (err) {
      setActionError(errorMessage(err, `Could not update "${job.title}".`));
    }
  };

  const stats = overview.data?.stats;
  const top = overview.data?.topToReview || [];
  const interviews = overview.data?.upcomingInterviews || [];
  const hasActivity = top.length > 0 || interviews.length > 0;

  // Aggregate real numbers across all jobs for visualization
  const pipelineTotals = useMemo(() => {
    const totals = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 };
    let totalApplicants = 0;
    let topFitCount = 0;
    jobs.forEach(j => {
      // Grouped by stage kind, so custom stages (e.g. "Technical round") still land in the right bucket.
      const byKind = j.pipelineByKind || j.pipeline || {};
      Object.keys(totals).forEach(k => {
        totals[k] += (byKind[k] || 0);
      });
      // Assessments and other custom steps sit between screening and interview in these charts.
      totals.screening += (byKind.assessment || 0) + (byKind.other || 0);
      totalApplicants += (j.applicationCount || 0);
      topFitCount += (j.topFit || 0);
    });
    return { totals, totalApplicants, topFitCount };
  }, [jobs]);

  const [showSample, setShowSample] = useState(false);

  // Sample data to preview rich charts when totalApplicants is 0
  const samplePipeline = {
    total: 38,
    totals: { applied: 16, screening: 11, interview: 6, offer: 3, hired: 2, rejected: 4 },
    topFit: 24,
    conversionRates: [
      { key: 'applied', label: '1. Applications Ingested', count: 38, color: '#3b82f6' },
      { key: 'screening', label: '2. AI Fit Scored (≥50)', count: 32, color: '#8b5cf6' },
      { key: 'interview', label: '3. Shortlisted for Interview', count: 12, color: '#f59e0b' },
      { key: 'offer', label: '4. Offer & Hired', count: 5, color: '#10b981' }
    ]
  };

  const activeTotals = showSample ? samplePipeline.totals : pipelineTotals.totals;
  const activeTotal = showSample ? samplePipeline.total : pipelineTotals.totalApplicants;

  const stageSlices = [
    { key: 'applied', label: 'Applied', value: activeTotals.applied, color: '#3b82f6' },
    { key: 'screening', label: 'Screening', value: activeTotals.screening, color: '#8b5cf6' },
    { key: 'interview', label: 'Interview', value: activeTotals.interview, color: '#f59e0b' },
    { key: 'offer', label: 'Offer', value: activeTotals.offer, color: '#10b981' },
    { key: 'hired', label: 'Hired', value: activeTotals.hired, color: '#059669' },
    { key: 'rejected', label: 'Archived', value: activeTotals.rejected, color: '#94a3b8' },
  ];

  const funnelStages = showSample ? samplePipeline.conversionRates : [
    { key: 'applied', label: '1. Applications Ingested', count: pipelineTotals.totalApplicants, color: '#3b82f6' },
    { key: 'screening', label: '2. AI Fit Scored', count: (pipelineTotals.totals.screening + pipelineTotals.totals.interview + pipelineTotals.totals.offer + pipelineTotals.totals.hired), color: '#8b5cf6' },
    { key: 'interview', label: '3. Shortlisted for Interview', count: (pipelineTotals.totals.interview + pipelineTotals.totals.offer + pipelineTotals.totals.hired), color: '#f59e0b' },
    { key: 'offer', label: '4. Offer & Hired', count: (pipelineTotals.totals.offer + pipelineTotals.totals.hired), color: '#10b981' }
  ];

  return (
    <div className="jb-page">
      <header className="jb-page-head">
        <div>
          <p className="eyebrow">HIRING</p>
          <h1 className="jb-h1">Jobs &amp; pipeline</h1>
          <p className="intro-copy">Start with the best-fit candidates below. Every applicant is scored against the job as soon as they apply.</p>
        </div>
        <Link to="/employer/jobs/new" className="jb-btn"><PlusCircle size={16} aria-hidden="true" /> Post a job</Link>
      </header>

      {/* Unified Executive Overview Panel: Visual Charts & Real-time Metrics */}
      <section className="jb-overview-panel" aria-label="Hiring Overview & Pipeline Intelligence">
        <div className="jb-overview-panel-head">
          <div className="jb-overview-panel-title">
            <PieChart size={17} style={{ color: 'var(--green)' }} aria-hidden="true" />
            <div>
              <h2>Pipeline &amp; Hiring Intelligence</h2>
              <p>{counts.open} open {counts.open === 1 ? 'role' : 'roles'} live · AI scoring active</p>
            </div>
          </div>

          <div className="jb-chart-toggle" role="group" aria-label="Toggle analytics preview mode">
            <button
              type="button"
              className={`jb-chart-toggle-btn ${!showSample ? 'active' : ''}`}
              onClick={() => setShowSample(false)}
            >
              Live Data ({pipelineTotals.totalApplicants})
            </button>
            <button
              type="button"
              className={`jb-chart-toggle-btn ${showSample ? 'active' : ''}`}
              onClick={() => setShowSample(true)}
              title="Preview charts with sample candidate flow"
            >
              <Sparkles size={11} aria-hidden="true" /> Sample Flow Preview
            </button>
          </div>
        </div>

        <div className="jb-overview-columns">
          {/* Column 1: Stage Distribution Donut & Legend */}
          <div className="jb-overview-col">
            <div className="jb-overview-col-title">
              <span className="label">
                <PieChart size={13} aria-hidden="true" />
                <span>Stage Breakdown</span>
              </span>
              <span className={`jb-col-badge ${activeTotal > 0 ? 'jb-col-badge-green' : ''}`}>
                {activeTotal > 0 ? `${activeTotal} in pipeline` : '0 candidates'}
              </span>
            </div>

            <div className="jb-donut-box">
              <DonutChart
                data={stageSlices}
                centerVal={activeTotal}
                centerLabel={activeTotal === 1 ? 'Candidate' : 'Candidates'}
              />
              <div className="jb-donut-legend-col">
                {stageSlices.map(s => {
                  const pct = activeTotal > 0 ? Math.round((s.value / activeTotal) * 100) : 0;
                  return (
                    <div key={s.key} className="jb-legend-row" title={`${s.label}: ${s.value} (${pct}%)`}>
                      <span className="jb-legend-left">
                        <span className="jb-legend-dot" style={{ background: s.color }} />
                        <span>{s.label}</span>
                      </span>
                      <span className="jb-legend-val">{s.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Column 2: Hiring Funnel Conversion Bars */}
          <div className="jb-overview-col">
            <div className="jb-overview-col-title">
              <span className="label">
                <BarChart3 size={13} aria-hidden="true" />
                <span>Hiring Funnel</span>
              </span>
              <span className="jb-col-badge">
                {activeTotal > 0 ? 'Conversion' : 'Pipeline Ready'}
              </span>
            </div>

            <FunnelChart
              stages={funnelStages}
              total={funnelStages[0]?.count || 0}
            />
          </div>

          {/* Column 3: 2x2 Mini KPI Grid & Quality / Work Modes */}
          <div className="jb-overview-col">
            <div className="jb-overview-col-title">
              <span className="label">
                <TrendingUp size={13} aria-hidden="true" />
                <span>Key Metrics &amp; Roles</span>
              </span>
              <span className="jb-col-badge jb-col-badge-green">
                {counts.open} Active Roles
              </span>
            </div>

            <div className="jb-mini-kpi-grid">
              <div className="jb-mini-kpi-tile">
                <span className="jb-mini-kpi-icon jb-mini-kpi-icon-green"><Briefcase size={14} aria-hidden="true" /></span>
                <div>
                  <strong>{counts.open}</strong>
                  <span>Open Jobs</span>
                </div>
              </div>

              <div className="jb-mini-kpi-tile">
                <span className="jb-mini-kpi-icon jb-mini-kpi-icon-blue"><UserPlus size={14} aria-hidden="true" /></span>
                <div>
                  <strong>{showSample ? '18' : (stats?.newThisWeek ?? 0)}</strong>
                  <span>New (7d)</span>
                </div>
              </div>

              <div className="jb-mini-kpi-tile">
                <span className="jb-mini-kpi-icon jb-mini-kpi-icon-amber"><Inbox size={14} aria-hidden="true" /></span>
                <div>
                  <strong>{showSample ? '6' : (stats?.awaitingReview ?? 0)}</strong>
                  <span>To Review</span>
                </div>
              </div>

              <div className="jb-mini-kpi-tile">
                <span className="jb-mini-kpi-icon jb-mini-kpi-icon-purple"><CalendarDays size={14} aria-hidden="true" /></span>
                <div>
                  <strong>{showSample ? '3' : (stats?.interviewsNext7Days ?? 0)}</strong>
                  <span>Interviews</span>
                </div>
              </div>
            </div>

            <div className="jb-col3-footer">
              <div className="jb-col3-track-head">
                <span>AI Fit Quality</span>
                <strong>{showSample ? '24 High Match (63%)' : `${pipelineTotals.topFitCount} High Match`}</strong>
              </div>
              <div className="jb-col3-track">
                <span className="jb-col3-seg" style={{ width: showSample ? '63%' : '0%', background: '#10b981' }} title="Top Fit (75+)" />
                <span className="jb-col3-seg" style={{ width: showSample ? '26%' : '0%', background: '#3b82f6' }} title="Good Fit (50-74)" />
                <span className="jb-col3-seg" style={{ width: showSample ? '11%' : '0%', background: '#f59e0b' }} title="Under Review" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {jobs.length > 0 && hasActivity && (
        <div className="jb-dash-grid">
          <section className="jb-card jb-dash-card" aria-labelledby="top-review">
            <div className="jb-row-between">
              <h2 id="top-review" className="jb-h3"><Star size={16} aria-hidden="true" /> Top candidates to review</h2>
              {top.length > 0 && <small className="jb-muted">Highest fit, not reviewed yet</small>}
            </div>
            {overview.isLoading ? <SkeletonList count={2} lines={2} /> : top.length === 0 ? (
              <div className="jb-dash-empty-modern">
                <span className="jb-dash-empty-icon"><Star size={18} aria-hidden="true" /></span>
                <div>
                  <strong>No applicants waiting for review</strong>
                  <p>As soon as candidates apply to your open jobs, the highest-fit scored candidates will appear here first.</p>
                </div>
              </div>
            ) : (
              <ul className="jb-dash-list">
                {top.map(a => (
                  <li key={a.id}>
                    <Link to={`/employer/jobs/${a.jobId}?a=${a.id}`} className="jb-dash-item">
                      <ScoreRing score={a.score} status="scored" />
                      <span className="jb-dash-main">
                        <strong>{blind ? anonLabel(a.id) : a.candidateName}
                          {a.knockoutFailed && <span className="jb-flag" title="Answered a required screening question differently"><Flag size={11} aria-hidden="true" /> Flag</span>}
                        </strong>
                        <small>{fitLabel(a.score)} · {a.jobTitle} · applied {timeAgo(a.appliedAt)}</small>
                      </span>
                      <ArrowRight size={16} className="jb-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="jb-card jb-dash-card" aria-labelledby="upcoming">
            <div className="jb-row-between">
              <h2 id="upcoming" className="jb-h3"><CalendarDays size={16} aria-hidden="true" /> Upcoming interviews</h2>
              <Link to="/employer/interviews" className="text-button">View all</Link>
            </div>
            {overview.isLoading ? <SkeletonList count={2} lines={2} avatar={false} /> : interviews.length === 0 ? (
              <div className="jb-dash-empty-modern">
                <span className="jb-dash-empty-icon"><CalendarDays size={18} aria-hidden="true" /></span>
                <div>
                  <strong>No interviews in next 7 days</strong>
                  <p>Schedule an interview directly from any candidate profile to keep your hiring moving.</p>
                </div>
              </div>
            ) : (
              <ul className="jb-dash-list">
                {interviews.map(i => {
                  const Icon = MODE_ICON[i.mode] || CalendarDays;
                  const d = new Date(i.scheduledAt);
                  return (
                    <li key={i.id}>
                      <Link to={`/employer/jobs/${i.jobId}?a=${i.applicationId}`} className="jb-dash-item">
                        <span className="jb-date-chip">
                          <small>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</small>
                          <strong>{d.getDate()}</strong>
                        </span>
                        <span className="jb-dash-main">
                          <strong>{blind ? anonLabel(i.applicationId) : i.candidateName}</strong>
                          <small><Icon size={12} aria-hidden="true" /> {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {i.durationMins} min · {i.jobTitle}</small>
                        </span>
                        <ArrowRight size={16} className="jb-muted" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}


      <section aria-labelledby="your-jobs" className="jb-jobs-section">
        <div className="jb-jobs-toolbar">
          <h2 id="your-jobs" className="jb-h2">Your jobs</h2>
          {jobs.length > 0 && (
            <>
              <div className="jb-stage-tabs" role="tablist" aria-label="Filter jobs by status">
                {['all', 'open', 'draft', 'closed', ...(counts.internal ? ['internal'] : [])].map(s => (
                  <button key={s} type="button" role="tab" aria-selected={status === s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
                    {s === 'all' ? 'All' : STATUS_LABEL[s]} <span>{counts[s]}</span>
                  </button>
                ))}
              </div>
              <label className="jb-job-search">
                <Search size={15} aria-hidden="true" />
                <span className="jb-sr">Search jobs</span>
                <input id="job-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, job ID, team" />
              </label>
            </>
          )}
        </div>

        <ErrorNote>{actionError}</ErrorNote>
        {isLoading && <SkeletonList count={2} avatar={false} label="Loading jobs…" />}
        <ErrorNote onRetry={refetch}>{error && errorMessage(error)}</ErrorNote>

        {!isLoading && !error && jobs.length === 0 && (
          <EmptyState icon={Briefcase} title="Post your first job" action={<Link to="/employer/jobs/new" className="jb-btn">Post a job</Link>}>
            It goes live on the Resumely job board right away. Use "Fill sample job" or "Generate with AI" to write it in a minute.
          </EmptyState>
        )}
        {!isLoading && jobs.length > 0 && visible.length === 0 && (
          <EmptyState icon={Users} title="No jobs match">
            {query ? `Nothing matches "${query}".` : `You have no ${STATUS_LABEL[status]?.toLowerCase()} jobs.`}
          </EmptyState>
        )}

        <div className="jb-stack">
          {visible.map(job => (
            <JobRow key={job.id} job={job} copiedId={copiedId} onCopy={copy} onStatus={changeStatus} busy={updating} />
          ))}
        </div>
      </section>
    </div>
  );
}
