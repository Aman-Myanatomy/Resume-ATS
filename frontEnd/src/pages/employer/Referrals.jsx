import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Handshake, Mail, Search, Trophy, Users } from 'lucide-react';
import { useGetEmployerCompanyQuery, useGetReferralsQuery } from '../../store/api/employerApi.js';
import { STAGE_LABELS, errorMessage, timeAgo } from '../../lib/format.js';
import { EmptyState, ErrorNote, ScoreRing, SkeletonList, StageBadge } from '../../components/ui.jsx';

const FILTERS = [
  ['all', 'All'],
  ['applied', 'Applied'],
  ['invited', 'Invited, not applied'],
  ['hired', 'Hired']
];

/** Every employee referral for the company: who referred whom, for which job, and how far they got. */
export default function Referrals() {
  const { data, error, isLoading, refetch } = useGetReferralsQuery();
  const { data: company } = useGetEmployerCompanyQuery();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const rows = data?.referrals || [];
  const visible = useMemo(() => rows
    .filter(r => filter === 'all' || (filter === 'hired' ? r.stageKind === 'hired' : r.status === filter))
    .filter(r => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [r.candidateName, r.candidateEmail, r.referrerName, r.job?.title, r.job?.jobCode].join(' ').toLowerCase().includes(q);
    }), [rows, filter, query]);

  const domains = company?.emailDomains || [];
  const stats = data?.stats;

  return (
    <div className="jb-page">
      <header className="jb-page-head">
        <div>
          <p className="eyebrow">REFERRALS</p>
          <h1 className="jb-h1">Employee referrals</h1>
          <p className="intro-copy">
            People your employees referred for external jobs. Referred applicants are tagged in each job's pipeline.
          </p>
        </div>
      </header>

      {company && !domains.length && (
        <p className="jb-warn-note">
          <Users size={15} aria-hidden="true" />
          <span>Referrals need your work email domain so employees are recognised. <Link to="/employer/company">Add it in Company profile</Link>.</span>
        </p>
      )}

      {isLoading && <SkeletonList count={4} label="Loading referrals…" />}
      <ErrorNote onRetry={refetch}>{error && errorMessage(error)}</ErrorNote>

      {stats && (
        <div className="jb-pipe-stats" aria-label="Referral summary">
          <div><strong>{stats.total}</strong><span>Referrals</span></div>
          <div><strong>{stats.applied}</strong><span>Applied</span></div>
          <div className={stats.invited ? 'attention' : ''}><strong>{stats.invited}</strong><span>Invited, not applied</span></div>
          <div><strong>{stats.interviewing}</strong><span>Interview or offer</span></div>
          <div><strong className="jb-good-text">{stats.hired}</strong><span>Hired</span></div>
        </div>
      )}

      {data && rows.length === 0 && (
        <EmptyState icon={Handshake} title="No referrals yet">
          {domains.length
            ? `Employees signed in with @${domains.join(', @')} see a "Refer someone" button on your external jobs and a "My company" page with their referral links.`
            : 'Add your work email domain in Company profile, then share your jobs with your team.'}
        </EmptyState>
      )}

      {rows.length > 0 && (
        <div className="jb-referrals-layout">
          <section className="jb-referrals-main" aria-label="Referrals">
            <div className="jb-jobs-toolbar">
              <div className="jb-stage-tabs" role="tablist" aria-label="Filter referrals">
                {FILTERS.map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
                    {label} <span>{id === 'all' ? stats.total : id === 'hired' ? stats.hired : stats[id]}</span>
                  </button>
                ))}
              </div>
              <label className="jb-job-search">
                <Search size={15} aria-hidden="true" />
                <span className="jb-sr">Search referrals</span>
                <input id="referral-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, job ID, referrer" />
              </label>
            </div>

            {visible.length === 0 && <EmptyState title="No referrals match" />}
            <div className="jb-stack">
              {visible.map(r => {
                const body = (
                  <>
                    {r.status === 'applied'
                      ? <ScoreRing score={r.score} status={r.scoreStatus} />
                      : <span className="jb-referral-pending" aria-hidden="true"><Mail size={16} /></span>}
                    <span className="jb-referral-main">
                      <strong>{r.candidateName}</strong>
                      <small className="jb-muted">
                        {r.job ? <><span className="jb-job-code">{r.job.jobCode}</span> {r.job.title}</> : 'Job removed'}
                      </small>
                      <small>
                        Referred by <strong>{r.referrerName}</strong>
                        {r.relationship && <> · {r.relationship}</>}
                        <span className="jb-muted"> · {timeAgo(r.createdAt)}</span>
                      </small>
                      {r.note && <small className="jb-referral-quote">“{r.note}”</small>}
                    </span>
                    <span className="jb-referral-side">
                      {r.status === 'applied'
                        ? <StageBadge stage={r.stage} label={r.stageLabel} kind={r.stageKind} />
                        : <span className="jb-source-tag">Invited · {r.candidateEmail}</span>}
                      {r.stageKind === 'hired' && r.job?.referralBonus && <small className="jb-good-text">Bonus due: {r.job.referralBonus}</small>}
                    </span>
                    {r.applicationId && <ChevronRight size={18} className="jb-muted" aria-hidden="true" />}
                  </>
                );
                return r.applicationId && r.job
                  ? <Link key={r.id} to={`/employer/jobs/${r.job.id}?a=${r.applicationId}`} className="jb-card jb-referral-row" title={`Open in pipeline (${r.stageLabel || STAGE_LABELS[r.stage]})`}>{body}</Link>
                  : <div key={r.id} className="jb-card jb-referral-row">{body}</div>;
              })}
            </div>
          </section>

          {data.topReferrers.length > 0 && (
            <aside className="jb-card jb-referrers" aria-label="Top referrers">
              <h2 className="jb-h3"><Trophy size={16} aria-hidden="true" /> Top referrers</h2>
              <ol>
                {data.topReferrers.map(p => (
                  <li key={p.email || p.name}>
                    <span className="mini-avatar" aria-hidden="true">{p.name?.[0]?.toUpperCase() || '?'}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small className="jb-muted">{p.referred} referred · {p.applied} applied{p.hired ? ` · ${p.hired} hired` : ''}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
