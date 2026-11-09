import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarX2, ChevronRight, MapPin, Phone, Video } from 'lucide-react';
import { useGetInterviewsQuery } from '../../store/api/employerApi.js';
import { INTERVIEW_MODE_LABELS, errorMessage } from '../../lib/format.js';
import { EmptyState, ErrorNote, SkeletonList } from '../../components/ui.jsx';

const MODE_ICON = { video: Video, phone: Phone, onsite: MapPin };

function dayKey(date) {
  const d = new Date(date);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, new Date())) return 'Today';
  if (same(d, new Date(Date.now() + 86400000))) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Interviews() {
  const { data = [], error, isLoading, refetch } = useGetInterviewsQuery();

  const groups = [];
  for (const interview of data) {
    const key = dayKey(interview.scheduledAt);
    if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
    groups[groups.length - 1].items.push(interview);
  }

  return (
    <div className="jb-page jb-narrow">
      <header className="jb-page-head">
        <div>
          <p className="eyebrow">SCHEDULE</p>
          <h1 className="jb-h1">Upcoming interviews</h1>
          <p className="intro-copy">Schedule interviews from an applicant's panel. You and the candidate both get an email with a calendar invite.</p>
        </div>
      </header>

      {isLoading && <SkeletonList count={3} label="Loading interviews…" />}
      <ErrorNote onRetry={refetch}>{error && errorMessage(error)}</ErrorNote>
      {!isLoading && !error && groups.length === 0 && (
        <EmptyState icon={CalendarX2} title="No interviews scheduled"
          action={<Link to="/employer" className="jb-btn">Go to jobs</Link>}>
          Open a job, select an applicant and use "Schedule interview".
        </EmptyState>
      )}

      {groups.map(group => (
        <section key={group.key} className="jb-day">
          <h2 className="jb-label">{group.key}</h2>
          <div className="jb-stack">
            {group.items.map(i => {
              const Icon = MODE_ICON[i.mode];
              return (
                <Link key={i.id} to={`/employer/jobs/${i.jobId}?a=${i.applicationId}`} className="jb-card jb-interview-row">
                  <span className="jb-interview-time">
                    <strong>{new Date(i.scheduledAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</strong>
                    <small>{i.durationMins} min</small>
                  </span>
                  <span className="jb-interview-main">
                    <strong>{i.candidateName}</strong>
                    <small className="jb-muted"><Icon size={12} aria-hidden="true" /> {INTERVIEW_MODE_LABELS[i.mode]} · {i.jobTitle}</small>
                  </span>
                  <ChevronRight size={18} className="jb-muted" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
