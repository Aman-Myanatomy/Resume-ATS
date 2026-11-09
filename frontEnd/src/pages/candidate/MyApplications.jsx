import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  FileText,
  Filter,
  Inbox,
  Lightbulb,
  MapPin,
  Search,
  Send,
  Sparkles,
  Video,
  AlertCircle
} from 'lucide-react';
import { useGetMyApplicationsQuery, useGetMyResumeQuery } from '../../store/api/publicApi.js';
import { errorMessage, formatDateTime, INTERVIEW_MODE_LABELS, timeAgo, WORK_MODE_LABELS } from '../../lib/format.js';
import { CompanyLogo, EmptyState, ErrorNote, ScoreRing, SkeletonList, StageBadge } from '../../components/ui.jsx';
import ResumeCard from './ResumeCard.jsx';
import { usePolling, usePollWhile } from '../../lib/usePolling.js';

const DEFAULT_PROGRESS = ['applied', 'screening', 'interview', 'offer', 'hired'].map(key => ({
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1)
}));

/** Clear visual step tracker for company pipeline stages. */
function ProgressStepper({ stage, label, steps }) {
  if (stage === 'not_selected') {
    return (
      <div className="cand-rejected-notice">
        <AlertCircle size={15} aria-hidden="true" />
        <span>Application not selected for this opening &middot; Profile kept on file for future roles</span>
      </div>
    );
  }

  const list = steps?.length ? steps : DEFAULT_PROGRESS;
  const reached = list.findIndex(s => s.key === stage);

  return (
    <div className="cand-stepper-wrap" aria-label={`Progress: ${label || stage}, step ${reached + 1} of ${list.length}`}>
      <div className="cand-stepper">
        {list.map((step, index) => {
          const isDone = index < reached;
          const isCurrent = index === reached;
          const isUpcoming = index > reached;
          return (
            <div
              key={step.key}
              className={`cand-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} ${isUpcoming ? 'is-upcoming' : ''}`}
            >
              <div className="cand-step-node" title={step.label}>
                {isDone ? (
                  <Check size={12} strokeWidth={2.8} aria-hidden="true" />
                ) : isCurrent ? (
                  <span className="cand-step-dot" />
                ) : (
                  <span className="cand-step-num">{index + 1}</span>
                )}
              </div>
              <span className="cand-step-label">{step.label}</span>
              {index < list.length - 1 && (
                <div className={`cand-step-line ${index < reached ? 'line-filled' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Upcoming interview details banner shown to the candidate. */
export function InterviewNote({ interview }) {
  return (
    <div className="cand-iv-banner">
      <div className="cand-iv-icon">
        <CalendarClock size={20} aria-hidden="true" />
      </div>
      <div className="cand-iv-body">
        <div className="cand-iv-top">
          <strong>Interview Scheduled: {formatDateTime(interview.scheduledAt)}</strong>
          <span className="cand-iv-mode">{INTERVIEW_MODE_LABELS[interview.mode] || 'Interview'}</span>
        </div>
        <p className="cand-iv-sub">
          {interview.durationMins} min session
          {interview.interviewerNames?.length ? ` with ${interview.interviewerNames.join(', ')}` : ''}
        </p>
      </div>
      {interview.location && (
        interview.mode === 'video' ? (
          <a href={interview.location} target="_blank" rel="noreferrer" className="cand-iv-btn">
            <Video size={14} aria-hidden="true" /> Join Meeting
          </a>
        ) : (
          <span className="cand-iv-loc">{interview.location}</span>
        )
      )}
    </div>
  );
}

export default function MyApplications() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Poll while any fit score is still being prepared; RTK Query stops when pollingInterval is 0.
  const [poll, setPolling] = usePolling(5000);
  const { data: list = [], error, isLoading, refetch } = useGetMyApplicationsQuery(undefined, { pollingInterval: poll });
  usePollWhile(list, l => l.some(a => a.scoreStatus === 'pending' || a.scoreStatus === 'scoring'), setPolling);
  const resume = useGetMyResumeQuery();

  const kindOf = a => a.stageKind || a.stage;
  const active = list.filter(a => !['hired', 'not_selected'].includes(kindOf(a))).length;
  const interviews = list.filter(a => ['assessment', 'interview', 'offer'].includes(kindOf(a))).length;
  const archived = list.length - active;

  // Filter and search handling
  const filteredList = list.filter(app => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      app.job?.title?.toLowerCase().includes(q) ||
      app.job?.companyName?.toLowerCase().includes(q) ||
      app.job?.jobCode?.toLowerCase().includes(q) ||
      app.job?.location?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    const kind = kindOf(app);
    if (filter === 'active') return !['hired', 'not_selected'].includes(kind);
    if (filter === 'interviews') return ['assessment', 'interview', 'offer'].includes(kind);
    if (filter === 'archived') return ['hired', 'not_selected'].includes(kind);
    return true;
  });

  return (
    <div className="jb-page">
      {/* Header */}
      <header className="cand-page-header">
        <div className="cand-page-intro">
          <div className="cand-eyebrow">
            <Briefcase size={13} aria-hidden="true" />
            <span>Candidate Portal &middot; Job Applications</span>
          </div>
          <h1 className="cand-h1">My applications</h1>
          <p className="cand-lead">
            Live updates and status notifications directly connected to each employer's hiring pipeline.
          </p>
        </div>
        <div className="cand-header-actions">
          <Link to="/jobs" className="cand-btn-browse">
            Find more jobs <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Main 2-Column Grid */}
      <div className="jb-two-col cand-layout-grid">
        <section className="cand-main-col">
          {/* Top Metric Tiles */}
          {!isLoading && list.length > 0 && (
            <div className="cand-kpi-grid">
              <div className="cand-kpi-card">
                <div className="cand-kpi-header">
                  <div className="cand-kpi-icon kpi-blue">
                    <Send size={18} aria-hidden="true" />
                  </div>
                  <span className="cand-kpi-badge">Submitted</span>
                </div>
                <div className="cand-kpi-number">{list.length}</div>
                <div className="cand-kpi-label">Total Applied</div>
                <div className="cand-kpi-sub">Across verified employer listings</div>
              </div>

              <div className="cand-kpi-card">
                <div className="cand-kpi-header">
                  <div className="cand-kpi-icon kpi-amber">
                    <Clock size={18} aria-hidden="true" />
                  </div>
                  <span className="cand-kpi-badge">In Pipeline</span>
                </div>
                <div className="cand-kpi-number">{active}</div>
                <div className="cand-kpi-label">Active Review</div>
                <div className="cand-kpi-sub">Under active screening &amp; evaluation</div>
              </div>

              <div className="cand-kpi-card">
                <div className="cand-kpi-header">
                  <div className="cand-kpi-icon kpi-green">
                    <CalendarCheck size={18} aria-hidden="true" />
                  </div>
                  <span className="cand-kpi-badge">Next Stages</span>
                </div>
                <div className="cand-kpi-number">{interviews}</div>
                <div className="cand-kpi-label">Interviews &amp; Offers</div>
                <div className="cand-kpi-sub">{interviews > 0 ? 'Upcoming sessions scheduled' : 'Ready for interview rounds'}</div>
              </div>
            </div>
          )}

          {/* Filter Toolbar */}
          {!isLoading && list.length > 0 && (
            <div className="cand-toolbar">
              <div className="cand-tabs" role="tablist" aria-label="Application status filters">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'all'}
                  className={`cand-tab ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All Applications <span className="cand-tab-pill">{list.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'active'}
                  className={`cand-tab ${filter === 'active' ? 'active' : ''}`}
                  onClick={() => setFilter('active')}
                >
                  In Progress <span className="cand-tab-pill">{active}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'interviews'}
                  className={`cand-tab ${filter === 'interviews' ? 'active' : ''}`}
                  onClick={() => setFilter('interviews')}
                >
                  Interviews <span className="cand-tab-pill">{interviews}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'archived'}
                  className={`cand-tab ${filter === 'archived' ? 'active' : ''}`}
                  onClick={() => setFilter('archived')}
                >
                  Archived <span className="cand-tab-pill">{archived}</span>
                </button>
              </div>

              {list.length > 1 && (
                <div className="cand-search-box">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search role, company or location…"
                    aria-label="Search applications"
                  />
                  {search && (
                    <button type="button" className="cand-search-clear" onClick={() => setSearch('')}>
                      &times;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {isLoading && <SkeletonList count={3} label="Loading your applications…" />}
          <ErrorNote onRetry={refetch}>{error && errorMessage(error)}</ErrorNote>

          {!isLoading && !error && list.length === 0 && (
            <EmptyState
              icon={Inbox}
              title="No applications yet"
              action={<Link to="/jobs" className="jb-btn">Browse open jobs</Link>}
            >
              Explore verified roles, check your fit score, and apply in one click with your saved resume.
            </EmptyState>
          )}

          {!isLoading && list.length > 0 && filteredList.length === 0 && (
            <div className="cand-empty-filter">
              <Filter size={24} aria-hidden="true" />
              <p>No applications found matching your current filter.</p>
              <button type="button" className="jb-btn jb-btn-ghost jb-btn-sm" onClick={() => { setFilter('all'); setSearch(''); }}>
                Reset filters
              </button>
            </div>
          )}

          {/* Application Cards List */}
          <div className="cand-cards-stack">
            {filteredList.map(app => (
              <article key={app.id} className="cand-app-card">
                {/* Header Row */}
                <div className="cand-card-top">
                  <CompanyLogo name={app.job?.companyName || 'Job'} size="md" />

                  <div className="cand-card-heading">
                    <div className="cand-card-title-row">
                      {app.job ? (
                        <Link to={`/jobs/${app.job.id}`} className="cand-job-title">
                          {app.job.title}
                        </Link>
                      ) : (
                        <span className="cand-job-title jb-muted">Job removed</span>
                      )}

                      <div className="cand-card-status-badges">
                        <StageBadge stage={app.stage} label={app.stageLabel} kind={app.stageKind} />
                        {app.job?.status === 'closed' && (
                          <span className="cand-closed-badge">Job closed</span>
                        )}
                      </div>
                    </div>

                    <div className="cand-card-meta-row">
                      {app.job?.jobCode && (
                        <span className="jb-job-code">{app.job.jobCode}</span>
                      )}
                      <span className="cand-meta-chip">
                        <Building2 size={13} aria-hidden="true" />
                        <strong>{app.job?.companyName || 'Company'}</strong>
                      </span>
                      <span className="cand-meta-dot">&middot;</span>
                      <span className="cand-meta-chip">
                        <MapPin size={13} aria-hidden="true" />
                        {app.job?.location || (app.job?.workMode ? WORK_MODE_LABELS[app.job.workMode] : 'Location')}
                      </span>
                      {app.job?.workMode && app.job?.location && (
                        <>
                          <span className="cand-meta-dot">&middot;</span>
                          <span className="cand-meta-chip">
                            <Briefcase size={13} aria-hidden="true" />
                            {WORK_MODE_LABELS[app.job.workMode]}
                          </span>
                        </>
                      )}
                      <span className="cand-meta-dot">&middot;</span>
                      <span className="cand-meta-chip cand-meta-date">
                        <Clock size={13} aria-hidden="true" />
                        Applied {timeAgo(app.appliedAt)}
                      </span>

                      {app.source === 'internal' && (
                        <span className="jb-source-tag jb-source-internal">Internal</span>
                      )}
                      {app.source === 'referral' && (
                        <span className="jb-source-tag jb-source-referral">
                          Referred{app.referredBy ? ` by ${app.referredBy}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pipeline Stepper */}
                <div className="cand-card-stepper-section">
                  <div className="cand-section-label">
                    <span>Hiring Pipeline Stage</span>
                    <span className="cand-current-stage-hint">
                      Current: <strong>{app.stageLabel || app.stage}</strong>
                    </span>
                  </div>
                  <ProgressStepper stage={app.stage} label={app.stageLabel} steps={app.progress} />
                </div>

                {/* Fit Score & Assessment Box */}
                <div className="cand-card-fit-box">
                  <div className="cand-fit-left">
                    <ScoreRing score={app.score} status={app.scoreStatus} size="md" />
                    <div className="cand-fit-details">
                      <div className="cand-fit-badge-row">
                        <span className="cand-fit-heading">ATS Match Score</span>
                        {app.score != null && (
                          <span className={`cand-fit-badge ${app.score >= 75 ? 'fit-high' : app.score >= 50 ? 'fit-good' : 'fit-fair'}`}>
                            {app.score >= 75 ? 'Strong Match' : app.score >= 50 ? 'Good Fit' : 'Score Calibrated'}
                          </span>
                        )}
                        {(app.scoreStatus === 'pending' || app.scoreStatus === 'scoring') && (
                          <span className="cand-fit-badge fit-pending">
                            <Sparkles size={12} aria-hidden="true" /> Scoring with AI…
                          </span>
                        )}
                      </div>
                      <p className="cand-fit-summary">
                        {app.scoreStatus === 'pending' || app.scoreStatus === 'scoring'
                          ? 'AI is analyzing your resume against the job requirements in real-time…'
                          : app.score != null
                          ? `${Math.round(app.score)}% match based on required skills, experience & job criteria.`
                          : 'Your application has been received and queued for recruiter evaluation.'}
                      </p>
                    </div>
                  </div>

                  <Link to="/app/analyze" className="cand-optimize-link" title="Analyze your resume with AI ATS scanner">
                    <Sparkles size={13} aria-hidden="true" /> Check ATS Fit
                  </Link>
                </div>

                {/* Next Interview Banner */}
                {app.nextInterview && <InterviewNote interview={app.nextInterview} />}

                {/* Card Footer Actions */}
                <div className="cand-card-bottom">
                  <div className="cand-bottom-left">
                    <span className="cand-updated-time">
                      Updated {timeAgo(app.updatedAt || app.appliedAt)}
                    </span>
                  </div>
                  <div className="cand-bottom-actions">
                    <Link to="/jobs" className="cand-btn-subtle">
                      Explore similar jobs
                    </Link>
                    {app.job && (
                      <Link to={`/jobs/${app.job.id}`} className="cand-btn-view">
                        View Job Details <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="cand-side-col">
          <ResumeCard resume={resume.data} loading={resume.isLoading} />

          {/* ATS Booster Card */}
          <div className="cand-sidebar-card cand-booster-widget">
            <div className="cand-widget-badge">
              <Sparkles size={14} aria-hidden="true" />
              <span>AI ATS OPTIMIZER</span>
            </div>
            <h3 className="cand-widget-title">Boost your match rate</h3>
            <p className="cand-widget-copy">
              Employers prioritize candidates whose resumes align with key skills. Use our free ATS analyzer before applying to discover missing keywords and boost your score.
            </p>
            <Link to="/app/analyze" className="cand-widget-btn">
              <Sparkles size={14} aria-hidden="true" /> Scan Resume with AI
            </Link>
          </div>

          {/* Helpful Tips Card */}
          <div className="cand-sidebar-card cand-tips-widget">
            <h3 className="cand-widget-title">
              <Lightbulb size={16} aria-hidden="true" /> Application Process Tips
            </h3>
            <ul className="cand-tips-list">
              <li>
                <strong>Recruiter review speed:</strong> Hiring teams typically review new applicants within 3–5 business days.
              </li>
              <li>
                <strong>Live pipeline sync:</strong> As recruiters advance your profile through stages, your dashboard updates instantly.
              </li>
              <li>
                <strong>Calendar invites:</strong> Interview scheduling automatically sends a Google Calendar or Outlook invite with video links.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
