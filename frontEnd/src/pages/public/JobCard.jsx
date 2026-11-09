import React from 'react';
import { Link } from 'react-router-dom';
import { Chips, CompanyLogo, JobMeta } from '../../components/ui.jsx';
import { timeAgo } from '../../lib/format.js';

export default function JobCard({ job, showCompany = true }) {
  return (
    <article className="jb-card jb-job-card">
      <CompanyLogo name={job.companyName} url={job.companyLogoUrl} />
      <div className="jb-job-body">
        <Link to={`/jobs/${job.id}`} className="jb-card-title jb-stretched">{job.title}</Link>
        {showCompany && <p className="jb-company-line">{job.companyName}</p>}
        {(job.jobCode || job.department) && (
          <p className="jb-card-org">
            {job.jobCode && <span className="jb-job-code">{job.jobCode}</span>}
            {[job.department, job.team].filter(Boolean).join(' · ')}
          </p>
        )}
        <JobMeta job={job} />
        <Chips items={job.skills} limit={5} />
      </div>
      <span className="jb-posted">{timeAgo(job.publishedAt)}</span>
    </article>
  );
}
