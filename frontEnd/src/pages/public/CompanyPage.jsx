import React from 'react';
import { useParams } from 'react-router-dom';
import { Briefcase, ExternalLink, MapPin, Users } from 'lucide-react';
import { useGetCompanyPageQuery } from '../../store/api/publicApi.js';
import { errorMessage } from '../../lib/format.js';
import { CompanyLogo, EmptyState, ErrorNote, Skeleton, SkeletonList } from '../../components/ui.jsx';
import JobCard from './JobCard.jsx';

export default function CompanyPage() {
  const { slug } = useParams();
  const { data, error, isLoading, refetch } = useGetCompanyPageQuery(slug);

  if (isLoading) {
    return (
      <div className="jb-page">
        <div className="jb-company-head"><Skeleton width={64} height={64} radius={14} /><div className="jb-skel-lines"><Skeleton width={220} height={26} /><Skeleton width={160} /></div></div>
        <SkeletonList count={2} />
      </div>
    );
  }
  if (error) return <div className="jb-page"><ErrorNote onRetry={refetch}>{errorMessage(error)}</ErrorNote></div>;

  const { company, jobs } = data;
  return (
    <div className="jb-page">
      <header className="jb-company-head">
        <CompanyLogo name={company.name} url={company.logoUrl} size="lg" />
        <div>
          <h1 className="jb-h1">{company.name}</h1>
          <p className="jb-meta">
            {company.location && <span><MapPin size={14} aria-hidden="true" />{company.location}</span>}
            {company.size && <span><Users size={14} aria-hidden="true" />{company.size} employees</span>}
            {company.website && <span><a href={company.website} target="_blank" rel="noreferrer">Website <ExternalLink size={13} aria-hidden="true" /></a></span>}
          </p>
        </div>
      </header>
      {company.about && <p className="jb-prose jb-company-about">{company.about}</p>}

      <h2 className="jb-h2">Open roles ({jobs.length})</h2>
      {jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title="No open roles right now">Check back soon.</EmptyState>
      ) : (
        <div className="jb-job-list">{jobs.map(job => <JobCard key={job.id} job={{ ...job, companyLogoUrl: job.companyLogoUrl || company.logoUrl }} showCompany={false} />)}</div>
      )}
    </div>
  );
}
