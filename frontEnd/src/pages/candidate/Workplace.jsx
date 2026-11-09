import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, Gift, Handshake, Lock, Mail } from 'lucide-react';
import { useGetWorkplaceQuery } from '../../store/api/publicApi.js';
import { EMPLOYMENT_LABELS, WORK_MODE_LABELS, errorMessage, formatExperience, orgLine, timeAgo } from '../../lib/format.js';
import { CompanyLogo, EmptyState, ErrorNote, SkeletonList, StageBadge } from '../../components/ui.jsx';
import ReferralTools from '../../components/ReferralTools.jsx';

function JobLine({ job }) {
  return (
    <small className="jb-muted">
      <span className="jb-job-code">{job.jobCode}</span>
      {[orgLine(job), job.location || WORK_MODE_LABELS[job.workMode], EMPLOYMENT_LABELS[job.employmentType], formatExperience(job)]
        .filter(Boolean).join(' · ')}
    </small>
  );
}

/**
 * "At {company}" page for employees (job seekers signed in with a work email that matches a company's domain):
 * internal openings they can apply to, external jobs they can refer people for, and their referrals.
 */
export default function Workplace() {
  const { data, error, isLoading, refetch } = useGetWorkplaceQuery();

  useEffect(() => {
    if (data?.company) document.title = `At ${data.company.name} | Resumely`;
    return () => { document.title = 'Resumely | AI-ranked hiring and jobs'; };
  }, [data?.company]);

  if (isLoading) return <div className="jb-page"><SkeletonList count={3} label="Loading your company…" /></div>;
  if (error) return <div className="jb-page"><ErrorNote onRetry={refetch}>{errorMessage(error)}</ErrorNote></div>;

  if (!data.company) {
    return (
      <div className="jb-page jb-narrow">
        <EmptyState icon={Building2} title="Your company isn't on Resumely yet"
          action={<Link to="/jobs" className="jb-btn">Browse jobs</Link>}>
          Internal jobs and referrals appear here when you sign in with a work email (yours ends in @{data.domain || 'unknown'})
          and your employer has added that domain in their Resumely company profile.
        </EmptyState>
      </div>
    );
  }

  const { company, internalJobs, referralJobs, referrals, stats } = data;

  return (
    <div className="jb-page">
      <header className="jb-page-head">
        <div className="jb-workplace-head">
          <CompanyLogo name={company.name} url={company.logoUrl} size="lg" />
          <div>
            <p className="eyebrow">YOUR COMPANY</p>
            <h1 className="jb-h1">At {company.name}</h1>
            <p className="intro-copy">Internal openings you can move into, and jobs you can refer people for. You're recognised as an employee by your @{data.domain} email.</p>
          </div>
        </div>
      </header>

      <div className="jb-pipe-stats" aria-label="Your referrals">
        <div><strong>{internalJobs.length}</strong><span>Internal openings</span></div>
        <div><strong>{stats.referred}</strong><span>People referred</span></div>
        <div><strong>{stats.applied}</strong><span>Applied</span></div>
        <div><strong>{stats.interviewing}</strong><span>Interview or offer</span></div>
        <div><strong className="jb-good-text">{stats.hired}</strong><span>Hired</span></div>
      </div>

      <section className="jb-workplace-section" aria-labelledby="internal-jobs">
        <h2 id="internal-jobs" className="jb-h2"><Lock size={18} aria-hidden="true" /> Internal openings</h2>
        <p className="jb-muted jb-small">Only {company.name} employees can see these. Your application is marked as internal for the hiring team.</p>
        {internalJobs.length === 0 ? (
          <p className="jb-card jb-muted">No internal openings right now.</p>
        ) : (
          <div className="jb-stack">
            {internalJobs.map(job => (
              <article key={job.id} className="jb-card jb-workplace-job">
                <div className="jb-workplace-job-main">
                  <Link to={`/jobs/${job.id}`} className="jb-workplace-title">{job.title}</Link>
                  <JobLine job={job} />
                  <small className="jb-muted">Posted {timeAgo(job.publishedAt)}{job.openings > 1 ? ` · ${job.openings} openings` : ''}</small>
                </div>
                {job.applied
                  ? <span className="jb-source-tag jb-source-internal"><CheckCircle2 size={12} aria-hidden="true" /> Applied</span>
                  : <Link to={`/jobs/${job.id}`} className="jb-btn jb-btn-sm">View and apply <ArrowRight size={14} aria-hidden="true" /></Link>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="jb-workplace-section" aria-labelledby="refer-jobs">
        <h2 id="refer-jobs" className="jb-h2"><Handshake size={18} aria-hidden="true" /> Refer someone</h2>
        <p className="jb-muted jb-small">Share your personal link, or refer a person by email. Anyone who applies through it is credited to you.</p>
        {referralJobs.length === 0 ? (
          <p className="jb-card jb-muted">No jobs are open for referrals right now.</p>
        ) : (
          <div className="jb-stack">
            {referralJobs.map(job => (
              <article key={job.id} className="jb-card jb-workplace-job jb-workplace-refer">
                <div className="jb-workplace-job-main">
                  <Link to={`/jobs/${job.id}`} className="jb-workplace-title">{job.title}</Link>
                  <JobLine job={job} />
                  <small>
                    {job.referralBonus && <span className="jb-good-text"><Gift size={12} aria-hidden="true" /> {job.referralBonus}</span>}
                    {job.referred > 0 && <span className="jb-muted">{job.referralBonus ? ' · ' : ''}You've referred {job.referred}</span>}
                  </small>
                </div>
                <ReferralTools job={job} compact />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="jb-workplace-section" aria-labelledby="my-referrals">
        <h2 id="my-referrals" className="jb-h2">Your referrals</h2>
        {referrals.length === 0 ? (
          <p className="jb-card jb-muted">You haven't referred anyone yet.</p>
        ) : (
          <div className="jb-card jb-table-wrap">
            <table className="jb-table jb-referral-table">
              <thead>
                <tr><th scope="col">Person</th><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Referred</th></tr>
              </thead>
              <tbody>
                {referrals.map(r => (
                  <tr key={r.id}>
                    <th scope="row">
                      {r.candidateName}
                      <small className="jb-muted">{r.kind === 'link' ? 'Applied via your link' : r.candidateEmail}</small>
                    </th>
                    <td>{r.job ? <><span className="jb-job-code">{r.job.jobCode}</span> {r.job.title}</> : '–'}</td>
                    <td>
                      {r.status === 'invited'
                        ? <span className="jb-source-tag"><Mail size={11} aria-hidden="true" /> Invited</span>
                        : <StageBadge stage={r.applicationStage || 'applied'} label={r.applicationStageLabel} kind={r.applicationStageKind} />}
                    </td>
                    <td className="jb-muted">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <small className="jb-muted">You see progress only. Scores and the hiring team's notes stay private.</small>
      </section>
    </div>
  );
}
