import React, { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft, ArrowRight, Briefcase, Building2, Check, CheckCircle2, Copy,
  ExternalLink, FileText, GraduationCap, IndianRupee, Laptop, Lock, MapPin,
  Pencil, ShieldCheck, Sparkles, Users, Handshake, Hash
} from 'lucide-react';
import { useGetJobQuery } from '../../store/api/publicApi.js';
import {
  EMPLOYMENT_LABELS, WORK_MODE_LABELS, errorMessage, timeAgo, formatSalary, formatExperience, orgLine
} from '../../lib/format.js';
import { Markdown } from '../../lib/markdown.jsx';
import { CompanyLogo, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { publicJobLink, useCopy } from '../../lib/useCopy.js';
import ApplyPanel from './ApplyPanel.jsx';
import ReferralTools from '../../components/ReferralTools.jsx';

const SCHEMA_EMPLOYMENT = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR', internship: 'INTERN' };

/** Google for Jobs structured data (JobPosting JSON-LD). */
function useJobPostingSchema(job, company) {
  useEffect(() => {
    if (!job || job.status !== 'open') return undefined;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description.replace(/\n/g, '<br>'),
      datePosted: job.publishedAt,
      employmentType: SCHEMA_EMPLOYMENT[job.employmentType],
      hiringOrganization: { '@type': 'Organization', name: job.companyName, sameAs: company?.website || undefined },
      ...(job.workMode === 'remote'
        ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'India' } }
        : { jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location, addressCountry: 'IN' } } }),
      ...(job.salaryMin || job.salaryMax ? {
        baseSalary: {
          '@type': 'MonetaryAmount',
          currency: job.salaryCurrency,
          value: { '@type': 'QuantitativeValue', minValue: job.salaryMin || undefined, maxValue: job.salaryMax || undefined, unitText: 'YEAR' }
        }
      } : {})
    };
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.text = JSON.stringify(schema);
    document.head.appendChild(tag);
    const previousTitle = document.title;
    document.title = `${job.title} at ${job.companyName} | Resumely`;
    return () => {
      tag.remove();
      document.title = previousTitle;
    };
  }, [job, company]);
}

function DetailSkeleton() {
  return (
    <div className="jb-page" aria-label="Loading job" role="status">
      <div className="jb-detail">
        <div className="jb-detail-main">
          <div className="jb-detail-head"><Skeleton width={64} height={64} radius={14} /><div className="jb-skel-lines"><Skeleton width="70%" height={30} /><Skeleton width="40%" /></div></div>
          <Skeleton width="80%" style={{ margin: '18px 0' }} />
          {[90, 95, 70, 85, 60].map((w, i) => <Skeleton key={i} width={`${w}%`} style={{ marginBottom: 10 }} />)}
        </div>
        <div className="jb-card"><Skeleton width="50%" height={18} /><Skeleton height={40} style={{ margin: '16px 0' }} /><Skeleton height={44} /></div>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { data, error, isLoading, refetch } = useGetJobQuery(id);
  // ?ref= from an employee's referral link; sent with the application so the referrer is credited.
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const currentUser = useSelector(state => state.auth?.user);
  const [copiedId, copy] = useCopy();
  const link = publicJobLink(id);

  useJobPostingSchema(data?.job, data?.company);

  if (isLoading) return <DetailSkeleton />;
  if (error) {
    return (
      <div className="jb-detail-wrap">
        <ErrorNote onRetry={error.status === 404 || error.status === 403 ? undefined : refetch}>{errorMessage(error)}</ErrorNote>
        <Link to="/jobs" className="text-button"><ArrowLeft size={14} aria-hidden="true" /> Back to all jobs</Link>
      </div>
    );
  }

  const { job, company, me } = data;
  const isEmployer = currentUser?.role === 'employer' || me?.role === 'employer';
  const salary = formatSalary(job);
  const exp = formatExperience(job);
  const place = job.workMode === 'remote' && !job.location ? 'Remote' : job.location;
  const canRefer = me?.isEmployee && job.visibility !== 'internal' && job.referralsEnabled && job.status === 'open';

  return (
    <div className="jb-detail-wrap">
      {/* Top Navigation & Breadcrumbs */}
      <div className="jb-detail-top-nav">
        <Link to="/jobs" className="jb-detail-back-link">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>All jobs</span>
          <span className="jb-muted">/</span>
          <span className="jb-muted">{company?.name || job.companyName}</span>
        </Link>

        <div className="jb-detail-nav-actions">
          <button
            type="button"
            className={`jb-btn jb-btn-sm ${copiedId === job.id ? 'jb-btn-copied' : 'jb-btn-ghost'}`}
            onClick={() => copy(job.id, link)}
            title="Copy public candidate link"
          >
            {copiedId === job.id ? <><Check size={13} aria-hidden="true" /> Link Copied</> : <><Copy size={13} aria-hidden="true" /> Copy Link</>}
          </button>

          {isEmployer && (
            <>
              <Link to={`/employer/jobs/${job.id}`} className="jb-btn jb-btn-sm jb-btn-ghost">
                <Users size={13} aria-hidden="true" />
                <span>Pipeline</span>
              </Link>
              <Link to={`/employer/jobs/${job.id}/edit`} className="jb-btn jb-btn-sm jb-btn-ghost">
                <Pencil size={13} aria-hidden="true" />
                <span>Edit Job</span>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="jb-detail">
        <article className="jb-detail-main">
          {/* Hero Job Header Card */}
          <div className="jb-job-hero-card">
            <div className="jb-hero-main-row">
              <div className="jb-hero-title-group">
                <CompanyLogo
                  name={job.companyName}
                  url={job.companyLogoUrl || company?.logoUrl}
                  size="lg"
                  className="jb-hero-logo"
                />
                <div className="jb-hero-headings">
                  <h1 className="jb-hero-job-title">{job.title}</h1>
                  <div className="jb-hero-company-line">
                    <Link to={`/companies/${job.companySlug}`}>{job.companyName}</Link>
                    <span>·</span>
                    <span>Posted {timeAgo(job.publishedAt)}</span>
                  </div>
                  <div className="jb-hero-org-line">
                    {job.jobCode && <span className="jb-job-code" title="Job ID"><Hash size={11} aria-hidden="true" />{job.jobCode}</span>}
                    {orgLine(job) && <span>{orgLine(job)}</span>}
                    {job.openings > 1 && <span>{job.openings} openings</span>}
                  </div>
                </div>
              </div>

              <div className="jb-hero-badges">
                {job.status === 'open' ? (
                  <span className="jb-live-status jb-live-status-open">
                    <span className="jb-pulse-dot" aria-hidden="true" />
                    Actively Hiring
                  </span>
                ) : (
                  <span className="jb-live-status jb-live-status-closed">
                    Closed
                  </span>
                )}
              </div>
            </div>

            {/* Quick Specs Highlights Grid */}
            <div className="jb-hero-specs-grid">
              <div className="jb-spec-tile">
                <span className="jb-spec-icon jb-spec-icon-green"><IndianRupee size={15} aria-hidden="true" /></span>
                <div>
                  <span>Salary Range</span>
                  <strong>{salary ? salary.replace('₹', '₹ ') : 'Competitive'}</strong>
                </div>
              </div>

              <div className="jb-spec-tile">
                <span className="jb-spec-icon jb-spec-icon-blue"><GraduationCap size={15} aria-hidden="true" /></span>
                <div>
                  <span>Experience</span>
                  <strong>{exp || 'Any experience'}</strong>
                </div>
              </div>

              <div className="jb-spec-tile">
                <span className="jb-spec-icon jb-spec-icon-purple"><Laptop size={15} aria-hidden="true" /></span>
                <div>
                  <span>Work Setup</span>
                  <strong>{WORK_MODE_LABELS[job.workMode] || 'On-site'}</strong>
                </div>
              </div>

              <div className="jb-spec-tile">
                <span className="jb-spec-icon jb-spec-icon-amber"><MapPin size={15} aria-hidden="true" /></span>
                <div>
                  <span>Location</span>
                  <strong>{place || 'Multiple locations'}</strong>
                </div>
              </div>
            </div>
          </div>

          {job.visibility === 'internal' && (
            <div className="jb-internal-banner">
              <Lock size={15} aria-hidden="true" />
              <span><strong>Internal job.</strong> Only {job.companyName} employees can see this and apply. Your application is marked as internal.</span>
            </div>
          )}
          {refCode && !me?.isEmployee && job.visibility !== 'internal' && job.status === 'open' && !me?.application && (
            <div className="jb-internal-banner jb-referred-banner">
              <Handshake size={15} aria-hidden="true" />
              <span><strong>You were referred.</strong> Someone at {job.companyName} recommended you. Apply here and your application reaches the team as a referral.</span>
            </div>
          )}

          {job.status === 'closed' && (
            <div className="jb-closed-note">
              <Lock size={15} aria-hidden="true" /> This job is closed and no longer accepting applications.
            </div>
          )}

          {/* Required Skills & Tech Stack */}
          {job.skills?.length > 0 && (
            <section className="jb-job-card-block">
              <h2 className="jb-job-card-block-title">
                <Sparkles size={16} aria-hidden="true" />
                <span>Skills &amp; Technologies Expected</span>
              </h2>
              <div className="jb-skills-wrap">
                {job.skills.map(skill => (
                  <span key={skill} className="jb-skill-pill">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Role Overview & Markdown Description */}
          <section className="jb-job-card-block">
            <h2 className="jb-job-card-block-title">
              <FileText size={16} aria-hidden="true" />
              <span>About the Role</span>
            </h2>
            <div className="jb-prose">
              <Markdown text={job.description} />
            </div>
          </section>

          {/* Screening Requirements */}
          {job.screeningQuestions?.length > 0 && (
            <section className="jb-job-card-block">
              <h2 className="jb-job-card-block-title">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Screening Questions</span>
              </h2>
              <div className="jb-criteria-list">
                {job.screeningQuestions.map((q, idx) => (
                  <div key={idx} className="jb-criteria-item">
                    <span>{q.question}</span>
                    <span className="jb-criteria-badge">
                      {q.requiredAnswer && q.requiredAnswer !== 'any'
                        ? `Must be ${q.requiredAnswer.toUpperCase()}`
                        : 'Yes / No'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* About Company */}
          {company && (
            <section className="jb-job-card-block">
              <h2 className="jb-job-card-block-title">
                <Building2 size={16} aria-hidden="true" />
                <span>About {company.name}</span>
              </h2>
              <div className="jb-about-company-content">
                {company.about ? <p style={{ margin: '0 0 10px', lineHeight: 1.55 }}>{company.about}</p> : <p className="jb-muted">No company description provided yet.</p>}
                <div className="jb-hero-company-line">
                  {company.location && <span>📍 {company.location}</span>}
                  {company.size && <span>👥 {company.size} employees</span>}
                  {EMPLOYMENT_LABELS[job.employmentType] && <span>💼 {EMPLOYMENT_LABELS[job.employmentType]}</span>}
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noreferrer" className="jb-website-link">
                      <ExternalLink size={12} /> {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
                <Link to={`/companies/${company.slug}`} className="text-button" style={{ display: 'inline-flex', marginTop: '12px' }}>
                  See all jobs at {company.name} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </section>
          )}
        </article>

        {/* Right Sticky Sidebar */}
        <aside className="jb-detail-side">
          {canRefer && (
            <section className="jb-card jb-refer-card" aria-label="Refer someone">
              <h2 className="jb-h3"><Handshake size={17} aria-hidden="true" /> Refer someone for this role</h2>
              <p className="jb-muted jb-small">You work at {job.companyName}. People who apply through your link or email invite are credited to you.</p>
              <ReferralTools job={job} />
              <small className="jb-muted">Interested yourself? Apply below. It's marked as an internal application.</small>
            </section>
          )}
          <ApplyPanel key={`${job.id}-${me?.application ? 'applied' : 'open'}`} job={job} me={me} refCode={refCode} />

          {/* Hiring Transparency Card */}
          <div className="jb-guarantee-card">
            <div className="jb-guar-item">
              <Sparkles size={14} aria-hidden="true" />
              <div>
                <strong>Instant AI Resume Fit Score</strong>
                <div>See how well your resume matches before you apply.</div>
              </div>
            </div>
            <div className="jb-guar-item">
              <CheckCircle2 size={14} aria-hidden="true" />
              <div>
                <strong>Direct Application</strong>
                <div>Delivered straight to {company?.name || job.companyName}'s hiring dashboard.</div>
              </div>
            </div>
            <div className="jb-guar-item">
              <ShieldCheck size={14} aria-hidden="true" />
              <div>
                <strong>Fair &amp; Unbiased Evaluation</strong>
                <div>AI-evaluated on verified technical skills and real experience.</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
