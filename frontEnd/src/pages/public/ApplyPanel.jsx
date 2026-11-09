import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2, Check, CheckCircle2, ClipboardPaste, Copy, Eye, FileText, Lock,
  Pencil, ShieldCheck, Sparkles, Upload, Users
} from 'lucide-react';
import { useApplyToJobMutation, useCheckFitMutation } from '../../store/api/publicApi.js';
import { errorMessage, fitLabel, STAGE_LABELS, timeAgo } from '../../lib/format.js';
import { Chips, ScoreRing, StageBadge } from '../../components/ui.jsx';
import { publicJobLink, useCopy } from '../../lib/useCopy.js';
import { InterviewNote } from '../candidate/MyApplications.jsx';

function FitResult({ analysis }) {
  return (
    <div className="jb-fit">
      <div className="jb-fit-head">
        <ScoreRing score={analysis.score} status="scored" size="lg" />
        <div>
          <strong>{fitLabel(analysis.score, analysis.verdict)}</strong>
          <p className="jb-muted">{analysis.summary}</p>
        </div>
      </div>
      {analysis.keywords?.matched?.length > 0 && (
        <div><small className="jb-label">You match</small><Chips items={analysis.keywords.matched} tone="good" limit={8} /></div>
      )}
      {analysis.keywords?.missing?.length > 0 && (
        <div><small className="jb-label">Missing from your resume</small><Chips items={analysis.keywords.missing} tone="bad" limit={8} /></div>
      )}
      {analysis.improvements?.length > 0 && (
        <div>
          <small className="jb-label">Fix before applying</small>
          <ul className="jb-list">{analysis.improvements.slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

const SOURCES = [
  { id: 'saved', label: 'Saved', icon: FileText },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'paste', label: 'Paste', icon: ClipboardPaste }
];

/** Right-hand panel on a job page: sign-in prompt, fit check + apply form, or application status. */
export default function ApplyPanel({ job, me, refCode }) {
  const location = useLocation();
  const next = encodeURIComponent(location.pathname);
  const [checkFit, fitState] = useCheckFitMutation();
  const [apply, applyState] = useApplyToJobMutation();
  const [copiedId, copy] = useCopy();
  const link = publicJobLink(job.id);
  const [previewAsCandidate, setPreviewAsCandidate] = useState(false);

  const [source, setSource] = useState(me?.savedResume ? 'saved' : 'upload');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState(() => job.screeningQuestions.map(() => ''));
  const [coverNote, setCoverNote] = useState('');
  const [fit, setFit] = useState(me?.lastFit?.analysis || null);
  const [error, setError] = useState('');
  const busy = fitState.isLoading ? 'fit' : applyState.isLoading ? 'apply' : '';

  const isEmployer = me?.role === 'employer';
  const hasResume = source === 'upload' ? Boolean(file) : source === 'paste' ? Boolean(text.trim()) : Boolean(me?.savedResume);

  const fitTooltip = isEmployer
    ? "Only candidate accounts can run fit analysis. Sign in with a job seeker account."
    : !hasResume
      ? (source === 'upload' ? "Please choose a resume file first" : "Please paste your resume text first")
      : "Check how well your resume matches this job before applying";

  const isFitDisabled = Boolean(busy) || isEmployer || !hasResume;

  const submitTooltip = isEmployer
    ? "Only candidate accounts can submit applications. Sign in with a job seeker account."
    : !hasResume
      ? "Please upload or paste your resume first"
      : undefined;

  const isSubmitDisabled = Boolean(busy) || isEmployer || !hasResume;

  if (!me) {
    return (
      <div className="jb-card jb-apply">
        <span className="jb-apply-icon"><Sparkles size={20} aria-hidden="true" /></span>
        <h2 className="jb-h3">Interested in this role?</h2>
        <p className="jb-muted">Create a free account to see your fit score for this job and apply in one click.</p>
        <Link to={`/signup?next=${next}`} className="jb-btn jb-btn-block">Create account &amp; check my fit</Link>
        <Link to={`/login?next=${next}`} className="jb-btn jb-btn-ghost jb-btn-block">I already have an account</Link>
      </div>
    );
  }

  if (me.role === 'employer' && !previewAsCandidate) {
    return (
      <div className="jb-employer-sidebar-card">
        <div className="jb-emp-side-head">
          <span className="jb-emp-side-icon"><Building2 size={18} aria-hidden="true" /></span>
          <div>
            <strong>Employer Preview Mode</strong>
            <p>You are viewing your public job listing</p>
          </div>
        </div>

        <div className="jb-copy-link-box">
          <label>Candidate Application Link</label>
          <div className="jb-copy-link-row">
            <input className="jb-copy-link-input" readOnly value={link} />
            <button
              type="button"
              className={`jb-btn jb-btn-sm ${copiedId === job.id ? 'jb-btn-copied' : ''}`}
              onClick={() => copy(job.id, link)}
              title="Copy candidate application link"
            >
              {copiedId === job.id ? <><Check size={13} aria-hidden="true" /> Copied</> : <><Copy size={13} aria-hidden="true" /> Copy</>}
            </button>
          </div>
        </div>

        <div className="jb-emp-actions-group">
          <Link to={`/employer/jobs/${job.id}`} className="jb-btn jb-btn-block">
            <Users size={15} aria-hidden="true" /> View Candidates &amp; Pipeline
          </Link>
          <Link to={`/employer/jobs/${job.id}/edit`} className="jb-btn jb-btn-ghost jb-btn-block">
            <Pencil size={15} aria-hidden="true" /> Edit Job Details
          </Link>
          <button
            type="button"
            className="jb-btn jb-btn-sm jb-btn-ghost jb-btn-block"
            onClick={() => setPreviewAsCandidate(true)}
            title="Preview candidate application form"
          >
            <Eye size={14} aria-hidden="true" /> Test Apply &amp; AI Fit Checker
          </button>
          <Link to="/employer" className="text-button" style={{ textAlign: 'center', marginTop: '4px' }}>
            ← Back to Employer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (me.application) {
    const app = me.application;
    const scoring = app.scoreStatus === 'pending' || app.scoreStatus === 'scoring';
    return (
      <div className="jb-card jb-apply">
        <p className="eyebrow"><CheckCircle2 size={13} aria-hidden="true" /> APPLIED {timeAgo(app.appliedAt).toUpperCase()}</p>
        <div className="jb-fit-head">
          <ScoreRing score={app.score} status={app.scoreStatus} size="lg" />
          <div>
            <strong>Status: {app.stageLabel || STAGE_LABELS[app.stage]}</strong>
            <p className="jb-muted">{scoring ? 'Your fit report is being prepared for the employer.' : 'The employer will update your status as they review.'}</p>
          </div>
        </div>
        <StageBadge stage={app.stage} label={app.stageLabel} kind={app.stageKind} />
        {app.nextInterview && <InterviewNote interview={app.nextInterview} />}
        <Link to="/app/applications" className="jb-btn jb-btn-ghost jb-btn-block">Track all my applications</Link>
      </div>
    );
  }

  if (job.status !== 'open') {
    return (
      <div className="jb-card jb-apply">
        <span className="jb-apply-icon"><Lock size={20} aria-hidden="true" /></span>
        <h2 className="jb-h3">Applications closed</h2>
        <p className="jb-muted">This employer is no longer accepting applications.</p>
      </div>
    );
  }

  const resumeInput = () => {
    if (source === 'upload') return file ? { file } : null;
    if (source === 'paste') return text.trim() ? { text } : null;
    return {};
  };
  const missingResume = () => setError(source === 'upload' ? 'Choose a resume file first.' : 'Paste your resume text first.');

  async function runFit() {
    if (isEmployer) return;
    const input = resumeInput();
    if (!input) return missingResume();
    setError('');
    try {
      const data = await checkFit({ jobId: job.id, ...input }).unwrap();
      setFit(data.analysis);
      if (source !== 'saved') setSource('saved');
    } catch (err) {
      setError(errorMessage(err, 'Could not check your fit.'));
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (isEmployer) return;
    const input = resumeInput();
    if (!input) return missingResume();
    const unanswered = job.screeningQuestions.findIndex((_, i) => !answers[i]);
    if (unanswered !== -1) return setError(`Answer: "${job.screeningQuestions[unanswered].question}"`);
    setError('');
    try {
      // On success the job query refetches (tag invalidation) and this panel switches to the status view.
      await apply({ jobId: job.id, ...input, coverNote: coverNote.trim() || undefined, answers, ref: refCode || undefined }).unwrap();
    } catch (err) {
      setError(errorMessage(err, 'Could not submit your application.'));
    }
  }

  const sources = SOURCES.filter(s => s.id !== 'saved' || me.savedResume || source === 'saved');

  return (
    <form className="jb-card jb-apply" onSubmit={submit}>
      {me.role === 'employer' && previewAsCandidate && (
        <div className="jb-preview-notice">
          <span>Candidate Application Preview Mode</span>
          <button type="button" onClick={() => setPreviewAsCandidate(false)}>Exit Preview</button>
        </div>
      )}
      <h2 className="jb-h3">Apply for this job</h2>

      <fieldset className="jb-fieldset">
        <legend className="jb-label">Resume</legend>
        <div className="jb-seg" role="radiogroup" aria-label="Resume source">
          {sources.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={source === id} className={source === id ? 'active' : ''} onClick={() => setSource(id)}>
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        {source === 'saved' && (
          <p className="jb-resume-name"><FileText size={15} aria-hidden="true" /> {me.savedResume?.fileName || 'Your saved resume'}
            {me.savedResume && <small className="jb-muted"> · updated {timeAgo(me.savedResume.updatedAt)}</small>}</p>
        )}
        {source === 'upload' && (
          <label className="jb-dropzone">
            <Upload size={18} aria-hidden="true" />
            <span>{file ? file.name : 'Choose a PDF, DOCX or TXT (max 5 MB)'}</span>
            <input id="apply-file" type="file" accept=".pdf,.docx,.txt" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        )}
        {source === 'paste' && (
          <textarea id="apply-text" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="Paste your full resume text" aria-label="Resume text" />
        )}
      </fieldset>

      <button
        type="button"
        className="jb-btn jb-btn-ghost jb-btn-block"
        onClick={runFit}
        disabled={isFitDisabled}
        title={fitTooltip}
      >
        <Sparkles size={16} aria-hidden="true" />
        {busy === 'fit' ? 'Checking your fit… (up to 30s)' : fit ? 'Re-check my fit' : 'Check my fit first'}
      </button>
      {fit && <FitResult analysis={fit} />}

      {job.screeningQuestions.map((q, index) => (
        <fieldset key={q.question} className="jb-fieldset">
          <legend className="jb-question">{q.question}</legend>
          <div className="jb-seg">
            {['yes', 'no'].map(value => (
              <button key={value} type="button" aria-pressed={answers[index] === value}
                className={answers[index] === value ? 'active' : ''}
                onClick={() => setAnswers(prev => prev.map((a, i) => (i === index ? value : a)))}>
                {value === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <label className="jb-label-block">
        Note to the hiring team <span className="jb-muted">(optional)</span>
        <textarea id="apply-note" rows={3} maxLength={2000} value={coverNote} onChange={e => setCoverNote(e.target.value)}
          placeholder="Why this role? Notice period?" />
      </label>

      {error && !isEmployer && <div className="error" role="alert">{error}</div>}

      <button
        type="submit"
        className="primary-button"
        disabled={isSubmitDisabled}
        title={submitTooltip}
      >
        {busy === 'apply' ? 'Submitting…' : 'Submit application'} <span>→</span>
      </button>
      <small className="jb-muted">Your resume is scored against this job and shared only with {job.companyName}.</small>
    </form>
  );
}
