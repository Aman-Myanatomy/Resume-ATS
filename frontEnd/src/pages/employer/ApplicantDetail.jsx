import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, Download, Eye, EyeOff, Handshake, RotateCw, Sparkles, X } from 'lucide-react';
import { useAddNoteMutation, useGetApplicationQuery, useMoveApplicationMutation, useRescoreMutation } from '../../store/api/employerApi.js';
import { STAGE_LABELS, anonLabel, errorMessage, fitLabel, timeAgo } from '../../lib/format.js';
import { usePolling, usePollWhile } from '../../lib/usePolling.js';
import { Chips, ErrorNote, ScoreRing, Skeleton } from '../../components/ui.jsx';
import InterviewPanel from './InterviewPanel.jsx';
import { useCompanyStages } from '../../lib/stages.js';

const isScoring = app => app.scoreStatus === 'pending' || app.scoreStatus === 'scoring';

export default function ApplicantDetail({ applicationId, jobId, blind, onClose, drawer = false }) {
  const stages = useCompanyStages();
  const [poll, setPolling] = usePolling(4000);
  const { data: app, error, isLoading, refetch } = useGetApplicationQuery(applicationId, { pollingInterval: poll });
  usePollWhile(app, isScoring, setPolling);

  const [moveApplication, moveState] = useMoveApplicationMutation();
  const [addNote, noteState] = useAddNoteMutation();
  const [rescore, rescoreState] = useRescoreMutation();
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [showResume, setShowResume] = useState(false);
  const busy = moveState.isLoading || noteState.isLoading || rescoreState.isLoading;

  useEffect(() => {
    const onKey = event => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async promise => {
    setActionError('');
    try {
      await promise.unwrap();
      return true;
    } catch (err) {
      setActionError(errorMessage(err));
      return false;
    }
  };

  const move = stage => run(moveApplication({ id: applicationId, stage, jobId }));
  const submitNote = async event => {
    event.preventDefault();
    if (!note.trim()) return;
    if (await run(addNote({ id: applicationId, text: note }))) setNote('');
  };
  const doRescore = () => run(rescore({ id: applicationId, jobId }));

  return (
    <aside className={`jb-detail-panel ${drawer ? 'jb-drawer' : ''}`} aria-label="Applicant details" role={drawer ? 'dialog' : undefined} aria-modal={drawer || undefined}>
      <div className="jb-detail-panel-head">
        <button type="button" className="jb-icon-btn" onClick={onClose} aria-label="Close applicant"><X size={18} aria-hidden="true" /></button>
      </div>
      {isLoading && (
        <div className="jb-detail-body" role="status" aria-label="Loading applicant">
          <div className="jb-applicant-head"><Skeleton width={60} height={60} radius={30} /><div className="jb-skel-lines"><Skeleton width={180} height={20} /><Skeleton width={140} /></div></div>
          <Skeleton height={36} /><Skeleton height={120} />
        </div>
      )}
      <ErrorNote onRetry={refetch}>{error && errorMessage(error)}</ErrorNote>

      {app && (
        <div className="jb-detail-body">
          <header className="jb-applicant-head">
            <ScoreRing score={app.score} status={app.scoreStatus} size="lg" />
            <div>
              <h2 className="jb-h2">{blind ? anonLabel(app.id) : app.candidateName}</h2>
              {!blind && <p className="jb-muted jb-select">{app.candidateEmail}</p>}
              <p className="jb-muted">Applied {timeAgo(app.appliedAt)} · {app.resumeName}</p>
            </div>
          </header>

          <section className="jb-move">
            <small className="jb-label">Move to stage</small>
            <div className="jb-move-buttons">
              {stages.map(({ key: stage, label, kind }) => (
                <button key={stage} type="button" disabled={busy}
                  className={`jb-move-btn jb-move-${kind} ${app.stage === stage ? 'current' : ''}`}
                  aria-pressed={app.stage === stage} onClick={() => app.stage !== stage && move(stage)}>
                  {label}
                </button>
              ))}
            </div>
          </section>
          <ErrorNote>{actionError}</ErrorNote>

          <InterviewPanel application={app} disabled={busy} />

          {app.referral && (
            <section className="jb-referral-note" aria-label="Referral">
              <Handshake size={16} aria-hidden="true" />
              <div>
                <strong>Referred by {app.referral.referrerName}</strong>
                <small className="jb-muted">
                  {[app.referral.referrerEmail, app.referral.relationship].filter(Boolean).join(' · ')}
                </small>
                {app.referral.note && <p>“{app.referral.note}”</p>}
              </div>
            </section>
          )}
          {app.source === 'internal' && (
            <p className="jb-referral-note jb-internal-note"><Building2 size={16} aria-hidden="true" /> <span><strong>Internal candidate.</strong> Current employee (work email). Coordinate with their manager before moving forward.</span></p>
          )}

          {app.knockoutFailed && (
            <p className="jb-flag-note"><AlertTriangle size={15} aria-hidden="true" /> This candidate answered a required screening question differently. Review their answers below before deciding.</p>
          )}

          {isScoring(app) && <p className="jb-scoring-banner"><Sparkles size={15} aria-hidden="true" /> AI fit report is being prepared…</p>}
          {app.scoreStatus === 'over_limit' && (
            <div className="jb-demo-note">
              Your plan's monthly AI scoring limit is used up, so this applicant isn't scored yet.{' '}
              <Link to="/employer/billing" className="text-button">Upgrade</Link>{' '}then{' '}
              <button type="button" className="text-button" onClick={doRescore} disabled={busy}>{rescoreState.isLoading ? 'Scoring…' : 'Score now'}</button>.
            </div>
          )}
          {app.scoreStatus === 'failed' && (
            <div className="error">
              Scoring failed: {app.scoreError || 'unknown error'}.{' '}
              <button type="button" className="text-button" onClick={doRescore} disabled={busy}>
                <RotateCw size={13} aria-hidden="true" /> {rescoreState.isLoading ? 'Retrying…' : 'Retry scoring'}
              </button>
            </div>
          )}

          {app.result && (
            <section className="jb-report">
              <h3 className="jb-h3">{fitLabel(app.score ?? app.result.score, app.result.verdict)}</h3>
              <p>{app.result.summary}</p>
              {app.result.keywords?.matched?.length > 0 && <div><small className="jb-label">Matched</small><Chips items={app.result.keywords.matched} tone="good" /></div>}
              {app.result.keywords?.missing?.length > 0 && <div><small className="jb-label">Missing</small><Chips items={app.result.keywords.missing} tone="bad" /></div>}
              <div className="jb-report-grid">
                <div>
                  <small className="jb-label">Strengths</small>
                  <ul className="jb-list">{(app.result.strengths || []).map(s => <li key={s}>{s}</li>)}</ul>
                </div>
                <div>
                  <small className="jb-label">Gaps</small>
                  <ul className="jb-list">{(app.result.improvements || []).map(s => <li key={s}>{s}</li>)}</ul>
                </div>
              </div>
              {app.result.sections?.length > 0 && (
                <div className="jb-sections">
                  {app.result.sections.map(section => (
                    <div key={section.name} className="jb-section-row" title={section.note}>
                      <span>{section.name}</span>
                      <span className="jb-bar"><i style={{ width: `${Math.max(0, Math.min(100, section.score))}%` }} /></span>
                      <span className="jb-num">{Math.round(section.score)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {app.answers?.length > 0 && (
            <section>
              <small className="jb-label">Screening answers</small>
              <ul className="jb-answers">
                {app.answers.map(a => <li key={a.question}><span>{a.question}</span><strong className={`jb-answer-${a.answer}`}>{a.answer === 'yes' ? 'Yes' : 'No'}</strong></li>)}
              </ul>
            </section>
          )}

          {app.coverNote && (
            <section>
              <small className="jb-label">Note from candidate</small>
              <p className="jb-quote">{app.coverNote}</p>
            </section>
          )}

          <section>
            <div className="jb-row-between">
              <small className="jb-label">Resume</small>
              <span className="jb-inline-actions">
                {app.resumeUrl && <a href={app.resumeUrl} target="_blank" rel="noreferrer" className="text-button"><Download size={14} aria-hidden="true" /> Original</a>}
                <button type="button" className="text-button" onClick={() => setShowResume(v => !v)}>
                  {showResume ? <><EyeOff size={14} aria-hidden="true" /> Hide text</> : <><Eye size={14} aria-hidden="true" /> Show text</>}
                </button>
              </span>
            </div>
            {showResume && <pre className="jb-resume-text">{app.resumeText}</pre>}
          </section>

          <section>
            <small className="jb-label">Notes</small>
            {app.notes.length === 0 && <p className="jb-muted jb-small">No notes yet. Notes are private and never shown to the candidate.</p>}
            <ul className="jb-notes">
              {app.notes.map(n => (
                <li key={n.id}><strong>{n.authorName}</strong> <span className="jb-muted">· {timeAgo(n.createdAt)}</span><p>{n.text}</p></li>
              ))}
            </ul>
            <form onSubmit={submitNote} className="jb-note-form">
              <textarea id="note-text" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a private note" maxLength={2000} aria-label="Note" />
              <button type="submit" className="jb-btn jb-btn-sm" disabled={noteState.isLoading || !note.trim()}>{noteState.isLoading ? 'Saving…' : 'Add note'}</button>
            </form>
          </section>

          {app.stageHistory?.length > 0 && (
            <section>
              <small className="jb-label">History</small>
              <ol className="jb-history">
                {app.stageHistory.map((h, i) => <li key={i}>{h.label || STAGE_LABELS[h.stage] || h.stage} <span className="jb-muted">· {timeAgo(h.at)}</span></li>)}
              </ol>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
