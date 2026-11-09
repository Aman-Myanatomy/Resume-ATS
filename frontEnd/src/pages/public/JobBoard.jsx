import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Search, SearchX } from 'lucide-react';
import { useSearchJobsQuery } from '../../store/api/publicApi.js';
import { DEPARTMENTS, EMPLOYMENT_LABELS, WORK_MODE_LABELS, errorMessage } from '../../lib/format.js';
import { EmptyState, ErrorNote, SkeletonList } from '../../components/ui.jsx';
import JobCard from './JobCard.jsx';

const PAGE_SIZE = 20;

export default function JobBoard() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get('q') || '',
    location: params.get('location') || '',
    workMode: params.get('workMode') || '',
    employmentType: params.get('employmentType') || '',
    department: params.get('department') || ''
  };
  const filterKey = JSON.stringify(filters);

  const [q, setQ] = useState(filters.q);
  const [location, setLocation] = useState(filters.location);
  // "Load more" requests the next page; the api slice appends it to the same list.
  // The page is tied to the filter set, so changing filters starts again at page 1 in the same render.
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = next => setPaging({ key: filterKey, page: next });

  useEffect(() => {
    setQ(filters.q);
    setLocation(filters.location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const { data, error, isLoading, isFetching, refetch } = useSearchJobsQuery({ ...filters, page, limit: PAGE_SIZE });
  const jobs = data?.jobs || [];
  const total = data?.total || 0;

  // Always carry what's typed in the boxes, so clicking a filter never wipes unsubmitted text.
  const update = changes => {
    const next = new URLSearchParams(params);
    const merged = { q: q.trim(), location: location.trim(), ...changes };
    Object.entries(merged).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next);
  };

  const submit = event => {
    event.preventDefault();
    update({});
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <section className="jb-hero">
        <div className="jb-hero-inner">
          <p className="eyebrow">JOBS WITH A FIT SCORE</p>
          <h1>Know your fit <em>before</em> you apply.</h1>
          <p className="jb-hero-copy">Every job shows how well your resume matches and what to fix. Employers see a ranked, explained shortlist.</p>
          <form className="jb-search" onSubmit={submit} role="search">
            <label className="jb-search-field">
              <span className="jb-sr">Role, skill or company</span>
              <Search size={18} aria-hidden="true" />
              <input id="search-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Role, skill or company" />
            </label>
            <label className="jb-search-field">
              <span className="jb-sr">Location</span>
              <MapPin size={18} aria-hidden="true" />
              <input id="search-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, e.g. Bengaluru" />
            </label>
            <button type="submit" className="jb-btn">Search</button>
          </form>
        </div>
      </section>

      <div className="jb-page jb-board">
        <div className="jb-filters" aria-label="Filters">
          <div className="jb-filter-group">
            {Object.entries(WORK_MODE_LABELS).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filters.workMode === value}
                className={`jb-filter ${filters.workMode === value ? 'active' : ''}`}
                onClick={() => update({ workMode: filters.workMode === value ? '' : value })}>
                {label}
              </button>
            ))}
          </div>
          <div className="jb-filter-group">
            {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filters.employmentType === value}
                className={`jb-filter ${filters.employmentType === value ? 'active' : ''}`}
                onClick={() => update({ employmentType: filters.employmentType === value ? '' : value })}>
                {label}
              </button>
            ))}
          </div>
          <select id="filter-department" className="jb-filter-select" value={filters.department} aria-label="Department"
            onChange={e => update({ department: e.target.value })}>
            <option value="">All departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {hasFilters && <button type="button" className="text-button" onClick={() => setParams({})}>Clear all</button>}
        </div>

        <p className="jb-result-count" aria-live="polite">
          {isLoading ? 'Searching…' : `${total} open ${total === 1 ? 'job' : 'jobs'}${filters.q ? ` for “${filters.q}”` : ''}`}
        </p>

        <ErrorNote onRetry={refetch}>{error && errorMessage(error, 'Could not load jobs.')}</ErrorNote>
        {isLoading && <SkeletonList count={4} label="Finding jobs…" />}

        {!isLoading && !error && jobs.length === 0 && (
          <EmptyState icon={SearchX} title="No jobs match these filters"
            action={hasFilters && <button type="button" className="jb-btn" onClick={() => setParams({})}>Show all jobs</button>}>
            Try a broader role name or remove a filter.
          </EmptyState>
        )}

        {!isLoading && (
          <div className={`jb-job-list ${isFetching ? 'jb-refreshing' : ''}`}>
            {jobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        )}

        {!isLoading && data && data.page < data.pages && (
          <button type="button" className="jb-btn jb-btn-ghost jb-load-more" disabled={isFetching} onClick={() => setPage(data.page + 1)}>
            {isFetching ? 'Loading…' : 'Load more jobs'}
          </button>
        )}
      </div>
    </>
  );
}
