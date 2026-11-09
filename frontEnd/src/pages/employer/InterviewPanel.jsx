import React, { useState } from 'react';
import { CalendarCheck, CalendarPlus, CheckCircle2, MapPin, Phone, Video, XCircle } from 'lucide-react';
import { useScheduleInterviewMutation, useUpdateInterviewMutation } from '../../store/api/employerApi.js';
import { INTERVIEW_MODE_LABELS, errorMessage, formatDateTime } from '../../lib/format.js';

/** Default slot: tomorrow 11:00 local time, formatted for <input type="datetime-local">. */
function defaultSlot() {
  const d = new Date(Date.now() + 86400000);
  d.setHours(11, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MODE_ICON = { video: Video, phone: Phone, onsite: MapPin };
const LOCATION_HINT = {
  video: { label: 'Meeting link', placeholder: 'https://meet.google.com/…' },
  phone: { label: 'Phone number (optional)', placeholder: 'Leave empty if you will call the candidate' },
  onsite: { label: 'Office address', placeholder: 'e.g. 4th floor, Prestige Tower, MG Road, Bengaluru' }
};
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Interview list + scheduling form inside the applicant panel. */
export default function InterviewPanel({ application, disabled }) {
  const [schedule, scheduleState] = useScheduleInterviewMutation();
  const [updateInterview, updateState] = useUpdateInterviewMutation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ when: defaultSlot(), durationMins: 45, mode: 'video', location: '', note: '' });
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [pendingId, setPendingId] = useState(null);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError('');
    setSent('');
    try {
      const data = await schedule({
        id: application.id,
        scheduledAt: new Date(form.when).toISOString(),
        durationMins: Number(form.durationMins),
        mode: form.mode,
        location: form.location.trim(),
        note: form.note.trim()
      }).unwrap();
      setOpen(false);
      setSent(`Interview scheduled for ${formatDateTime(data.interview.scheduledAt)}. Calendar invites sent${data.stageMoved ? ' and moved to Interview' : ''}.`);
      setForm(prev => ({ ...prev, location: '', note: '' }));
    } catch (err) {
      setError(errorMessage(err, 'Could not schedule the interview.'));
    }
  }

  async function setStatus(interview, status) {
    setError('');
    setPendingId(`${status}-${interview.id}`);
    try {
      await updateInterview({ id: application.id, interviewId: interview.id, status }).unwrap();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  const blocked = ['rejected', 'hired'].includes(application.stage);
  const hint = LOCATION_HINT[form.mode];

  return (
    <section className="jb-interviews">
      <div className="jb-row-between">
        <small className="jb-label">Interviews</small>
        {!open && !blocked && (
          <button type="button" className="jb-btn jb-btn-sm" disabled={disabled} onClick={() => { setOpen(true); setSent(''); }}>
            <CalendarPlus size={14} aria-hidden="true" /> Schedule interview
          </button>
        )}
      </div>
      {sent && <p className="jb-success jb-small" role="status"><CalendarCheck size={15} aria-hidden="true" /> {sent}</p>}
      {blocked && application.interviews.length === 0 && <p className="jb-muted jb-small">Move the candidate to an active stage to schedule an interview.</p>}

      {open && (
        <form className="jb-interview-form" onSubmit={submit}>
          <div className="jb-grid-2">
            <label>Date &amp; time <span className="jb-muted">({TZ})</span>
              <input id="iv-when" type="datetime-local" value={form.when} onChange={set('when')} required />
            </label>
            <label>Duration
              <select id="iv-duration" value={form.durationMins} onChange={set('durationMins')}>
                {[30, 45, 60, 90].map(m => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </label>
          </div>
          <div className="jb-seg" role="radiogroup" aria-label="Interview type">
            {Object.entries(INTERVIEW_MODE_LABELS).map(([value, label]) => {
              const Icon = MODE_ICON[value];
              return (
                <button key={value} type="button" role="radio" aria-checked={form.mode === value}
                  className={form.mode === value ? 'active' : ''} onClick={() => setForm(prev => ({ ...prev, mode: value }))}>
                  <Icon size={14} aria-hidden="true" /> {label}
                </button>
              );
            })}
          </div>
          <label>{hint.label}
            <input id="iv-location" value={form.location} onChange={set('location')} placeholder={hint.placeholder}
              type={form.mode === 'video' ? 'url' : 'text'} maxLength={300} />
          </label>
          <label>Note for the candidate <span className="jb-muted">(optional)</span>
            <textarea id="iv-note" rows={2} value={form.note} onChange={set('note')} maxLength={1000} placeholder="e.g. Technical round, please keep your laptop ready." />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="jb-form-actions">
            <button type="submit" className="jb-btn jb-btn-sm" disabled={scheduleState.isLoading}>{scheduleState.isLoading ? 'Scheduling…' : 'Schedule & send invite'}</button>
            <button type="button" className="jb-link-btn" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
          </div>
          <small className="jb-muted">You and the candidate both get an email with a calendar invite.</small>
        </form>
      )}
      {!open && error && <div className="error" role="alert">{error}</div>}

      {application.interviews.length > 0 && (
        <ul className="jb-interview-list">
          {application.interviews.map(interview => {
            const Icon = MODE_ICON[interview.mode];
            return (
              <li key={interview.id} className={`jb-interview-item jb-iv-${interview.status}`}>
                <div>
                  <strong>{formatDateTime(interview.scheduledAt)}</strong>
                  <span className="jb-muted"> · {interview.durationMins} min · <Icon size={13} aria-hidden="true" /> {INTERVIEW_MODE_LABELS[interview.mode]}</span>
                  {interview.status !== 'scheduled' && <span className="jb-iv-status"> · {interview.status}</span>}
                </div>
                {interview.location && (
                  interview.mode === 'video'
                    ? <a href={interview.location} target="_blank" rel="noreferrer" className="jb-small">{interview.location}</a>
                    : <small className="jb-muted">{interview.location}</small>
                )}
                {interview.note && <small className="jb-muted">“{interview.note}”</small>}
                {interview.status === 'scheduled' && (
                  <div className="jb-inline-actions">
                    <button type="button" className="text-button" disabled={updateState.isLoading} onClick={() => setStatus(interview, 'completed')}>
                      <CheckCircle2 size={14} aria-hidden="true" /> Mark completed
                    </button>
                    <button type="button" className="text-button jb-danger-text" disabled={updateState.isLoading} onClick={() => setStatus(interview, 'cancelled')}>
                      <XCircle size={14} aria-hidden="true" /> {pendingId === `cancelled-${interview.id}` ? 'Cancelling…' : 'Cancel & notify'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
