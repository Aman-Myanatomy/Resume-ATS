import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft, CalendarClock, Check, ClipboardCheck, Copy, ExternalLink, Eye, EyeOff, Flag, KanbanSquare, Linkedin, List,
  Lock, Mail, MessageCircle, Pencil, RotateCcw, Sparkles, Users, CheckCircle2, ChevronDown, ChevronUp,
  FileText, Info, Share2, ShieldAlert, Laptop, MapPin, Briefcase, GraduationCap, IndianRupee, Building2, UserCheck, Gift, Handshake
} from 'lucide-react';
import { useGetApplicantsQuery, useGetEmployerJobQuery, useMoveApplicationMutation, useUpdateJobMutation } from '../../store/api/employerApi.js';
import { setPipelineView, toggleBlindScreening } from '../../store/slices/ui.slices.js';
import {
  anonLabel, errorMessage, fitLabel, formatDateTime, formatExperience,
  formatSalary, timeAgo, WORK_MODE_LABELS, EMPLOYMENT_LABELS, SOURCE_LABELS, orgLine
} from '../../lib/format.js';
import { usePolling, usePollWhile } from '../../lib/usePolling.js';
import { publicJobLink, useCopy } from '../../lib/useCopy.js';
import { Markdown } from '../../lib/markdown.jsx';
import { Chips, EmptyState, ErrorNote, ScoreRing, Skeleton, SkeletonList, StageBadge } from '../../components/ui.jsx';
import ApplicantDetail from './ApplicantDetail.jsx';
import { stageMeta, useCompanyStages } from '../../lib/stages.js';
import KanbanBoard from './KanbanBoard.jsx';

const isPending = a => a.scoreStatus === 'pending' || a.scoreStatus === 'scoring';
const TOP_FIT = 75;
const STATUS_LABEL = { open: 'Open', draft: 'Draft', closed: 'Closed' };
const REQUIRED_LABEL = { yes: 'Must be Yes', no: 'Must be No', any: 'Any answer' };

/** Shown while a job has no applicants: share hub, 3-step AI pipeline flow, waiting state, JD preview, and scoring rubric. */
function EmptyPipeline({ job, copied, onCopy, onPublish, busy, knockouts }) {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const link = publicJobLink(job.id);
  const text = `We're hiring: ${job.title} at ${job.companyName}. Apply here: ${link}`;
  const share = [
    { label: 'WhatsApp', icon: MessageCircle, cls: 'jb-share-wa', href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { label: 'LinkedIn', icon: Linkedin, cls: 'jb-share-li', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}` },
    { label: 'Email', icon: Mail, cls: 'jb-share-mail', href: `mailto:?subject=${encodeURIComponent(`Job opening: ${job.title}`)}&body=${encodeURIComponent(text)}` }
  ];
  const experience = job.experienceMax != null ? `${job.experienceMin || 0}–${job.experienceMax} years` : `${job.experienceMin || 0}+ years`;
  const salary = formatSalary(job);
  const isLongDesc = (job.description || '').length > 350;

  return (
    <div className="jb-empty-pipeline-layout">
      {/* Left / Main Column */}
      <div className="jb-column-main">
        {job.status === 'open' ? (
          <section className="jb-share-card-redesigned" aria-labelledby="share-heading">
            <div className="jb-card-badge-header">
              <div className="jb-card-icon-circle">
                <Share2 size={20} aria-hidden="true" />
              </div>
              <div className="jb-card-head-text">
                <h2 id="share-heading">Share this job link to get applicants</h2>
                <p>Post the link on job boards, LinkedIn, WhatsApp, or email. Every candidate who applies is parsed and scored by AI automatically.</p>
              </div>
            </div>

            {/* Modern URL Copy Bar */}
            <div className="jb-link-bar">
              <ExternalLink size={15} className="jb-link-bar-icon" aria-hidden="true" />
              <input
                id="pipeline-link"
                className="jb-link-bar-input"
                readOnly
                value={link}
                onFocus={e => e.target.select()}
                aria-label="Public job application link"
              />
              <button
                type="button"
                className={`jb-btn jb-btn-sm jb-link-bar-btn ${copied ? 'jb-btn-copied' : ''}`}
                onClick={onCopy}
              >
                {copied ? <><Check size={14} aria-hidden="true" /> Copied!</> : <><Copy size={14} aria-hidden="true" /> Copy link</>}
              </button>
            </div>

            {/* Direct Share Channels */}
            <div className="jb-share-channels">
              {share.map(({ label, icon: Icon, cls, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={`jb-share-btn ${cls}`}
                  title={`Share on ${label}`}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}</span>
                </a>
              ))}
              <Link
                to={`/jobs/${job.id}`}
                target="_blank"
                rel="noreferrer"
                className="jb-share-btn jb-share-preview"
                title="Open candidate application experience in new tab"
              >
                <Eye size={14} aria-hidden="true" />
                <span>Preview as candidate</span>
              </Link>
            </div>

            {/* 3-Step AI Candidate Evaluation Workflow */}
            <div className="jb-flow-section">
              <h3 className="jb-flow-title">How candidates are processed</h3>
              <div className="jb-flow-grid">
                <div className="jb-flow-card">
                  <div className="jb-flow-card-head">
                    <span className="jb-flow-icon jb-flow-icon-1"><FileText size={15} /></span>
                    <span className="jb-flow-step-num">Step 1</span>
                  </div>
                  <strong>Candidates Apply</strong>
                  <p>Submit resume, profile details, and answer screening questions.</p>
                </div>
                <div className="jb-flow-card">
                  <div className="jb-flow-card-head">
                    <span className="jb-flow-icon jb-flow-icon-2"><Sparkles size={15} /></span>
                    <span className="jb-flow-step-num">Step 2</span>
                  </div>
                  <strong>AI Fit Analysis</strong>
                  <p>Resume is parsed in ~30s against required skills, experience & knockout rules.</p>
                </div>
                <div className="jb-flow-card">
                  <div className="jb-flow-card-head">
                    <span className="jb-flow-icon jb-flow-icon-3"><CheckCircle2 size={15} /></span>
                    <span className="jb-flow-step-num">Step 3</span>
                  </div>
                  <strong>Ranked Review</strong>
                  <p>Applicants appear ranked by fit score (0–100%) so you interview the best first.</p>
                </div>
              </div>
            </div>
          </section>
        ) : job.status === 'draft' ? (
          <section className="jb-share-card-redesigned">
            <div className="jb-card-badge-header">
              <div className="jb-card-icon-circle" style={{ background: 'var(--paper)', color: 'var(--muted)' }}>
                <FileText size={20} aria-hidden="true" />
              </div>
              <div className="jb-card-head-text">
                <h2>This job is in Draft mode</h2>
                <p>It's hidden from candidates and the job board. Publish it to activate the application link and start accepting applicants.</p>
              </div>
            </div>
            <div>
              <button type="button" className="jb-btn" disabled={busy} onClick={onPublish}>
                <Sparkles size={14} aria-hidden="true" /> Publish job now
              </button>
            </div>
          </section>
        ) : (
          <section className="jb-share-card-redesigned">
            <div className="jb-card-badge-header">
              <div className="jb-card-icon-circle" style={{ background: 'var(--neutral-bg)', color: 'var(--neutral-strong)' }}>
                <Lock size={20} aria-hidden="true" />
              </div>
              <div className="jb-card-head-text">
                <h2>This job is currently closed</h2>
                <p>It is no longer accepting new candidate applications. You can reopen it at any time from the top of the page.</p>
              </div>
            </div>
          </section>
        )}

        {/* Live Candidate Pipeline Awaiting Submissions */}
        <section className="jb-pipeline-waiting-card" aria-label="Pipeline status">
          <div className="jb-waiting-radar" aria-hidden="true">
            <Users size={24} />
          </div>
          <div>
            <h3>Waiting for your first applicant</h3>
            <p>Your pipeline is live and ready. As soon as candidates apply via your link, they will appear here with an instant AI score and fit summary.</p>
          </div>
          <div className="jb-waiting-actions">
            <Link to={`/jobs/${job.id}`} target="_blank" rel="noreferrer" className="jb-btn jb-btn-ghost jb-btn-sm">
              <Eye size={14} aria-hidden="true" /> Test application flow
            </Link>
            <button type="button" className="jb-btn jb-btn-sm" onClick={onCopy}>
              <Copy size={14} aria-hidden="true" /> {copied ? 'Link copied!' : 'Copy application link'}
            </button>
          </div>
          <div className="jb-waiting-tip">
            <span>💡 Pro-tip: Sharing the link on LinkedIn or developer communities usually gets your first applicants in under 24 hours.</span>
          </div>
        </section>

        {/* Published Job Description Preview Card */}
        {job.description && (
          <section className="jb-jd-preview-card" aria-labelledby="jd-preview-title">
            <div className="jb-jd-head">
              <h3 id="jd-preview-title">
                <FileText size={16} aria-hidden="true" />
                Published Job Description
              </h3>
              <Link to={`/employer/jobs/${job.id}/edit`} className="jb-link-btn jb-small">
                <Pencil size={13} aria-hidden="true" /> Edit JD
              </Link>
            </div>
            <div className={`jb-jd-body ${showFullDesc || !isLongDesc ? 'expanded' : ''}`}>
              <Markdown text={job.description} />
              {!showFullDesc && isLongDesc && <div className="jb-jd-fade" aria-hidden="true" />}
            </div>
            {isLongDesc && (
              <div>
                <button
                  type="button"
                  className="jb-jd-toggle"
                  onClick={() => setShowFullDesc(prev => !prev)}
                >
                  {showFullDesc ? (
                    <><ChevronUp size={14} aria-hidden="true" /> Show less</>
                  ) : (
                    <><ChevronDown size={14} aria-hidden="true" /> Read full job description</>
                  )}
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Right / Sidebar Column */}
      <div className="jb-column-sidebar">
        {/* Scoring Criteria Card */}
        <aside className="jb-criteria-card" aria-labelledby="criteria-heading">
          <div className="jb-criteria-head">
            <div className="jb-criteria-head-title">
              <h3 id="criteria-heading"><ClipboardCheck size={16} aria-hidden="true" /> Scoring Criteria</h3>
              <small>AI evaluates resumes against this rubric</small>
            </div>
            <Link to={`/employer/jobs/${job.id}/edit`} className="jb-btn jb-btn-ghost jb-btn-sm">
              <Pencil size={13} aria-hidden="true" /> Edit
            </Link>
          </div>

          <div className="jb-crit-section">
            <span className="jb-crit-label">Required Skills ({job.skills?.length || 0})</span>
            {job.skills?.length ? (
              <div className="jb-skills-wrap">
                {job.skills.map(s => (
                  <span key={s} className="jb-skill-pill">{s}</span>
                ))}
              </div>
            ) : (
              <p className="jb-muted jb-small">No skills listed. Adding specific tech skills makes candidate scoring sharper.</p>
            )}
          </div>

          <div className="jb-crit-stats-grid">
            <div className="jb-crit-stat-box">
              <small>Experience</small>
              <strong>{experience}</strong>
            </div>
            <div className="jb-crit-stat-box">
              <small>Knockout Rules</small>
              <strong>{knockouts} of {job.screeningQuestions?.length || 0}</strong>
            </div>
          </div>

          <div className="jb-crit-section">
            <span className="jb-crit-label">Screening Questions ({job.screeningQuestions?.length || 0})</span>
            {job.screeningQuestions?.length ? (
              <ul className="jb-screening-list-modern">
                {job.screeningQuestions.map(q => {
                  const isKnockout = q.requiredAnswer !== 'any';
                  return (
                    <li key={q.question} className="jb-screening-item">
                      <span className="jb-screening-q-text">{q.question}</span>
                      <div className="jb-screening-badge-row">
                        {isKnockout ? (
                          <span className="jb-knockout-badge">
                            <ShieldAlert size={12} aria-hidden="true" />
                            Knockout ({REQUIRED_LABEL[q.requiredAnswer]})
                          </span>
                        ) : (
                          <span className="jb-info-badge">
                            <Info size={12} aria-hidden="true" />
                            Informational ({REQUIRED_LABEL[q.requiredAnswer]})
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="jb-muted jb-small">No screening questions configured.</p>
            )}
          </div>
        </aside>

        {/* Quick Job Facts Card */}
        <section className="jb-specs-card" aria-label="Job specifications">
          <h3>Job Quick Specs</h3>
          <div className="jb-spec-row">
            <span>Employment Type</span>
            <strong>{EMPLOYMENT_LABELS[job.employmentType] || 'Full-time'}</strong>
          </div>
          <div className="jb-spec-row">
            <span>Work Mode</span>
            <strong>{WORK_MODE_LABELS[job.workMode] || 'On-site'}</strong>
          </div>
          <div className="jb-spec-row">
            <span>Location</span>
            <strong>{job.location || 'Remote'}</strong>
          </div>
          {salary && (
            <div className="jb-spec-row">
              <span>Salary / CTC</span>
              <strong style={{ color: 'var(--green)' }}>{salary}</strong>
            </div>
          )}
          <div className="jb-spec-row">
            <span>Published</span>
            <strong>{timeAgo(job.publishedAt || job.createdAt)}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function JobPipeline() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('a');
  const view = useSelector(state => state.ui.pipelineView);
  const blind = useSelector(state => state.ui.blindScreening);
  const [stage, setStage] = useState('all');
  const [sort, setSort] = useState('score');
  const [source, setSource] = useState('all');
  const [actionError, setActionError] = useState('');
  const [copiedId, copy] = useCopy();

  const job = useGetEmployerJobQuery(id);
  // Poll quietly while any AI score is still being produced.
  const [poll, setPolling] = usePolling(4000);
  const applicants = useGetApplicantsQuery({ jobId: id, sort }, { pollingInterval: poll });
  const all = applicants.data || [];
  usePollWhile(all, list => list.some(isPending), setPolling);
  const [moveApplication] = useMoveApplicationMutation();
  const [updateJob, { isLoading: updating }] = useUpdateJobMutation();

  const stages = useCompanyStages();
  const counts = useMemo(() => stages.reduce((acc, s) => ({ ...acc, [s.key]: all.filter(a => a.stage === s.key).length }), {}), [all, stages]);
  const stageLabelOf = key => stageMeta(stages, key).label;
  const summary = useMemo(() => {
    const scored = all.filter(a => a.score != null);
    return {
      total: all.length,
      toReview: all.filter(a => a.stage === 'applied').length,
      topFit: scored.filter(a => a.score >= TOP_FIT).length,
      avg: scored.length ? Math.round(scored.reduce((sum, a) => sum + a.score, 0) / scored.length) : null,
      interviews: all.filter(a => a.nextInterviewAt).length,
      referrals: all.filter(a => a.source === 'referral').length,
      internal: all.filter(a => a.source === 'internal').length
    };
  }, [all]);
  const visible = all
    .filter(a => stage === 'all' || a.stage === stage)
    .filter(a => source === 'all' || (a.source || 'direct') === source);
  const pending = all.some(isPending);
  const hasApplicants = all.length > 0;

  const select = applicantId => {
    const next = new URLSearchParams(params);
    applicantId ? next.set('a', applicantId) : next.delete('a');
    setParams(next, { replace: true });
  };

  const move = async (card, toStage) => {
    setActionError('');
    try {
      await moveApplication({ id: card.id, stage: toStage, jobId: id }).unwrap();
    } catch (err) {
      setActionError(`Couldn't move ${blind ? anonLabel(card.id) : card.candidateName}: ${errorMessage(err)}`);
    }
  };

  const setStatus = async next => {
    setActionError('');
    try {
      await updateJob({ id, status: next }).unwrap();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not update the job.'));
    }
  };

  if (job.isLoading) {
    return (
      <div className="jb-page jb-wide" role="status" aria-label="Loading pipeline">
        <Skeleton width="30%" height={32} />
        <div style={{ marginTop: 24 }}><SkeletonList count={4} /></div>
      </div>
    );
  }
  if (job.error) return <div className="jb-page"><ErrorNote onRetry={job.refetch}>{errorMessage(job.error)}</ErrorNote></div>;

  const j = job.data;
  const boardDetail = view === 'board' && selectedId;
  const knockouts = (j.screeningQuestions || []).filter(q => q.requiredAnswer !== 'any').length;
  const salary = formatSalary(j);

  return (
    <div className="jb-page jb-wide">
      {/* Breadcrumb Navigation */}
      <nav className="jb-crumbs" aria-label="Breadcrumb">
        <Link to="/employer" className="jb-crumb-back">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>All jobs</span>
        </Link>
        <span className="jb-crumb-sep">/</span>
        <span className="jb-crumb-title">{j.title}</span>
      </nav>

      {/* Modern Job Header Card */}
      <header className="jb-pipe-header-card">
        <div className="jb-pipe-header-main">
          <div className="jb-pipe-title-row">
            <h1 className="jb-pipe-heading">{j.title}</h1>
            <span className={`jb-live-status jb-live-status-${j.status}`}>
              <span className="jb-pulse-dot" aria-hidden="true" />
              {j.status === 'open' ? 'Active · Accepting Applications' : STATUS_LABEL[j.status]}
            </span>
            {j.visibility === 'internal' && (
              <span className="jb-visibility-badge" title="Only your employees can see and apply"><Lock size={11} aria-hidden="true" /> Internal</span>
            )}
          </div>

          <div className="jb-pipe-org">
            {j.jobCode && <span className="jb-job-code">{j.jobCode}</span>}
            {orgLine(j) && <span><Building2 size={13} aria-hidden="true" /> {orgLine(j)}</span>}
            {j.hiringManager && <span><UserCheck size={13} aria-hidden="true" /> Hiring manager: {j.hiringManager}</span>}
            <span><Users size={13} aria-hidden="true" /> {j.openings || 1} opening{(j.openings || 1) > 1 ? 's' : ''}</span>
            {j.visibility !== 'internal' && (j.referralsEnabled
              ? <span><Gift size={13} aria-hidden="true" /> Referrals on{j.referralBonus ? ` · ${j.referralBonus}` : ''}</span>
              : <span className="jb-muted">Referrals off</span>)}
          </div>

          {/* Clean metadata badge row */}
          <div className="jb-pipe-tags">
            {j.location && (
              <span className="jb-pipe-tag" title="Location">
                <MapPin size={13} aria-hidden="true" />
                {j.location}
              </span>
            )}
            <span className="jb-pipe-tag" title="Work Mode">
              <Laptop size={13} aria-hidden="true" />
              {WORK_MODE_LABELS[j.workMode] || 'On-site'}
            </span>
            <span className="jb-pipe-tag" title="Employment Type">
              <Briefcase size={13} aria-hidden="true" />
              {EMPLOYMENT_LABELS[j.employmentType] || 'Full-time'}
            </span>
            <span className="jb-pipe-tag" title="Experience Required">
              <GraduationCap size={13} aria-hidden="true" />
              {formatExperience(j)}
            </span>
            {salary && (
              <span className="jb-pipe-tag jb-pipe-tag-salary" title="Salary Range">
                <IndianRupee size={13} aria-hidden="true" />
                {salary.replace('₹', '')}
              </span>
            )}
          </div>

          <div className="jb-pipe-subtext">
            <span>{j.status === 'draft' ? `Draft created ${timeAgo(j.createdAt)}` : `Posted ${timeAgo(j.publishedAt || j.createdAt)}`}</span>
            <span className="jb-bullet-sep">·</span>
            <span className="jb-ai-active-indicator"><Sparkles size={13} aria-hidden="true" /> AI screening active</span>
            {hasApplicants && (
              <>
                <span className="jb-bullet-sep">·</span>
                <span>Ranked by AI match score</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="jb-pipe-header-actions">
          {j.status === 'open' && (
            <button
              type="button"
              className={`jb-btn jb-btn-sm ${copiedId === j.id ? 'jb-btn-copied' : 'jb-btn-ghost'}`}
              onClick={() => copy(j.id, publicJobLink(j.id))}
              title="Copy candidate application link"
            >
              {copiedId === j.id ? (
                <><Check size={14} aria-hidden="true" /> Copied!</>
              ) : (
                <><Copy size={14} aria-hidden="true" /> Copy link</>
              )}
            </button>
          )}

          {j.status === 'open' && (
            <Link
              to={`/jobs/${id}`}
              target="_blank"
              rel="noreferrer"
              className="jb-btn jb-btn-ghost jb-btn-sm"
              title={j.visibility === 'internal' ? 'Open the page employees see' : 'Open public job application page in new tab'}
            >
              <ExternalLink size={14} aria-hidden="true" />
              <span>{j.visibility === 'internal' ? 'Job page' : 'Public page'}</span>
            </Link>
          )}

          <Link to={`/employer/jobs/${id}/edit`} className="jb-btn jb-btn-sm" title="Edit job details and screening questions">
            <Pencil size={14} aria-hidden="true" />
            <span>Edit job</span>
          </Link>

          {j.status === 'open' && (
            <button
              type="button"
              className="jb-btn jb-btn-ghost jb-btn-sm jb-btn-subtle-danger"
              disabled={updating}
              onClick={() => setStatus('closed')}
              title="Stop accepting new applications"
            >
              <Lock size={13} aria-hidden="true" />
              <span>Close job</span>
            </button>
          )}

          {j.status === 'closed' && (
            <button
              type="button"
              className="jb-btn jb-btn-sm jb-btn-light"
              disabled={updating}
              onClick={() => setStatus('open')}
              title="Reopen job"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Reopen</span>
            </button>
          )}
        </div>
      </header>

      <ErrorNote>{actionError}</ErrorNote>

      {/* Telemetry / Summary stats bar */}
      {hasApplicants ? (
        <div className="jb-pipe-stats" aria-label="Pipeline summary">
          <div><strong>{summary.total}</strong><span>Applicants</span></div>
          <div className={summary.toReview ? 'attention' : ''}><strong>{summary.toReview}</strong><span>To review</span></div>
          <div><strong className="jb-good-text">{summary.topFit}</strong><span>Top fit (75+)</span></div>
          <div><strong>{summary.avg ?? '–'}</strong><span>Avg fit score</span></div>
          <div><strong>{summary.interviews}</strong><span>Interviews scheduled</span></div>
          {j.visibility === 'internal'
            ? <div><strong>{summary.internal}</strong><span>Internal applicants</span></div>
            : <div><strong>{summary.referrals}</strong><span>Referred</span></div>}
        </div>
      ) : j.status === 'open' ? (
        <div className="jb-readiness-bar" aria-label="Job readiness overview">
          <div className="jb-readiness-tile">
            <strong>0</strong>
            <span>Total Applicants</span>
            <small>Awaiting submissions</small>
          </div>
          <div className="jb-readiness-tile jb-readiness-tile-active">
            <strong>Active</strong>
            <span>AI Resume Screening</span>
            <small>Evaluates in ~30 seconds</small>
          </div>
          <div className="jb-readiness-tile">
            <strong>{j.skills?.length || 0} Skills</strong>
            <span>Target Criteria</span>
            <small>In evaluation rubric</small>
          </div>
          <div className="jb-readiness-tile">
            <strong>{knockouts} Rules</strong>
            <span>Knockout Filters</span>
            <small>Auto-filter criteria</small>
          </div>
        </div>
      ) : null}

      {hasApplicants && (
        <div className="jb-toolbar">
          {view === 'list' ? (
            <div className="jb-stage-tabs" role="tablist" aria-label="Filter by stage">
              <button type="button" role="tab" aria-selected={stage === 'all'} className={stage === 'all' ? 'active' : ''} onClick={() => setStage('all')}>
                All <span>{all.length}</span>
              </button>
              {stages.map(s => (
                <button key={s.key} type="button" role="tab" aria-selected={stage === s.key} className={stage === s.key ? 'active' : ''} onClick={() => setStage(s.key)}>
                  {s.label} <span>{counts[s.key] || 0}</span>
                </button>
              ))}
            </div>
          ) : <p className="jb-muted jb-small"><Users size={14} aria-hidden="true" /> Drag cards between stages</p>}
          <div className="jb-toolbar-right">
            <div className="jb-seg jb-view-toggle" role="radiogroup" aria-label="View">
              <button type="button" role="radio" aria-checked={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => dispatch(setPipelineView('list'))}>
                <List size={15} aria-hidden="true" /> List
              </button>
              <button type="button" role="radio" aria-checked={view === 'board'} className={view === 'board' ? 'active' : ''} onClick={() => dispatch(setPipelineView('board'))}>
                <KanbanSquare size={15} aria-hidden="true" /> Board
              </button>
            </div>
            <label className="jb-switch">
              <input id="blind-toggle" type="checkbox" checked={blind} onChange={() => dispatch(toggleBlindScreening())} />
              <EyeOff size={15} aria-hidden="true" />
              <span>Blind screening</span>
            </label>
            {view === 'list' && (summary.referrals > 0 || summary.internal > 0) && (
              <select id="pipeline-source" value={source} onChange={e => setSource(e.target.value)} aria-label="Filter by source">
                <option value="all">All sources</option>
                <option value="referral">Referrals ({summary.referrals})</option>
                <option value="internal">Internal ({summary.internal})</option>
                <option value="direct">Direct ({all.length - summary.referrals - summary.internal})</option>
              </select>
            )}
            {view === 'list' && (
              <select id="pipeline-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort applicants">
                <option value="score">Best fit first</option>
                <option value="recent">Newest first</option>
              </select>
            )}
          </div>
        </div>
      )}

      {pending && <p className="jb-scoring-banner"><Sparkles size={15} aria-hidden="true" /> AI is scoring new applicants. The list updates by itself.</p>}
      {applicants.isLoading && <SkeletonList count={4} label="Loading applicants…" />}
      <ErrorNote onRetry={applicants.refetch}>{applicants.error && errorMessage(applicants.error)}</ErrorNote>

      {!hasApplicants && !applicants.isLoading && !applicants.error && (
        <EmptyPipeline
          job={j}
          copied={copiedId === j.id}
          onCopy={() => copy(j.id, publicJobLink(j.id))}
          onPublish={() => setStatus('open')}
          busy={updating}
          knockouts={knockouts}
        />
      )}

      {view === 'board' && hasApplicants && (
        <KanbanBoard stages={stages} applicants={all} blind={blind} selectedId={selectedId} onSelect={select} onMove={move} />
      )}

      {view === 'list' && hasApplicants && (
        <div className={`jb-pipeline ${selectedId ? 'has-detail' : ''}`}>
          <section className="jb-applicant-list" aria-label="Applicants">
            {visible.length === 0 && <EmptyState title={source !== 'all' ? `No ${SOURCE_LABELS[source].toLowerCase()} applicants${stage !== 'all' ? ` in ${stageLabelOf(stage)}` : ''}` : `No one in ${stageLabelOf(stage)}`} />}
            {visible.map((a, index) => (
              <button key={a.id} type="button" className={`jb-applicant ${selectedId === a.id ? 'selected' : ''}`} onClick={() => select(a.id)}>
                <span className="jb-rank">{sort === 'score' && stage === 'all' && source === 'all' && a.score != null ? `#${index + 1}` : ''}</span>
                <ScoreRing score={a.score} status={a.scoreStatus} />
                <span className="jb-applicant-main">
                  <span className="jb-applicant-name">
                    {blind ? anonLabel(a.id) : a.candidateName}
                    {a.knockoutFailed && <span className="jb-flag" title="Answered a required screening question differently"><Flag size={11} aria-hidden="true" /> Screening flag</span>}
                    {a.source === 'referral' && (
                      <span className="jb-source-tag jb-source-referral" title={a.referrerName ? `Referred by ${a.referrerName}` : 'Employee referral'}>
                        <Handshake size={11} aria-hidden="true" /> {blind ? 'Referral' : `Referred by ${a.referrerName?.split(' ')[0] || 'employee'}`}
                      </span>
                    )}
                    {a.source === 'internal' && (
                      <span className="jb-source-tag jb-source-internal" title="Current employee"><Building2 size={11} aria-hidden="true" /> Internal</span>
                    )}
                  </span>
                  <span className="jb-applicant-verdict">
                    {a.scoreStatus === 'failed' ? 'Scoring failed. Open to retry.'
                      : a.scoreStatus === 'over_limit' ? 'Not scored: monthly AI limit reached'
                        : (a.score != null ? fitLabel(a.score, a.verdict) : '') || (a.scoreStatus === 'scored' ? '' : 'Scoring…')}
                    <span className="jb-muted"> · {timeAgo(a.appliedAt)}</span>
                  </span>
                  <Chips items={a.matched} tone="good" limit={4} />
                </span>
                <span className="jb-applicant-side">
                  <StageBadge stage={a.stage} {...stageMeta(stages, a.stage)} />
                  {a.nextInterviewAt && <small className="jb-iv-chip" title="Next interview"><CalendarClock size={12} aria-hidden="true" /> {formatDateTime(a.nextInterviewAt)}</small>}
                  {a.noteCount > 0 && <small className="jb-muted">{a.noteCount} note{a.noteCount > 1 ? 's' : ''}</small>}
                </span>
              </button>
            ))}
          </section>

          {selectedId && <ApplicantDetail key={selectedId} applicationId={selectedId} jobId={id} blind={blind} onClose={() => select(null)} />}
        </div>
      )}

      {boardDetail && (
        <div className="jb-drawer-wrap">
          <div className="jb-drawer-backdrop" onClick={() => select(null)} aria-hidden="true" />
          <ApplicantDetail key={selectedId} applicationId={selectedId} jobId={id} blind={blind} onClose={() => select(null)} drawer />
        </div>
      )}
    </div>
  );
}
