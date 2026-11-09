import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bold, Building2, Globe2, Heading2, List, ListOrdered, Lock, Plus, Sparkles, Undo2, Wand2, X } from 'lucide-react';
import { SAMPLE_JOBS } from '../../constants/sampleJobs.js';
import {
  useCreateJobMutation, useGenerateJobDescriptionMutation, useGetEmployerCompanyQuery, useGetEmployerJobQuery, useUpdateJobMutation
} from '../../store/api/employerApi.js';
import { DEPARTMENTS, EMPLOYMENT_LABELS, WORK_MODE_LABELS, errorMessage } from '../../lib/format.js';
import { Markdown } from '../../lib/markdown.jsx';
import { ErrorNote, Skeleton } from '../../components/ui.jsx';

const EMPTY = {
  title: '', location: '', workMode: 'onsite', employmentType: 'full_time',
  experienceMin: '', experienceMax: '', salaryMinLpa: '', salaryMaxLpa: '',
  skills: '', description: '', screeningQuestions: [], status: 'open',
  visibility: 'external', department: '', team: '', project: '', hiringManager: '', openings: '1',
  referralsEnabled: true, referralBonus: ''
};

/** External vs internal posting, shown as two choice cards. */
function PostingType({ value, onChange, domains }) {
  const options = [
    { id: 'external', icon: Globe2, title: 'External', text: 'Listed on the public job board. Anyone can apply and your employees can refer people.' },
    { id: 'internal', icon: Lock, title: 'Internal', text: 'Only your employees can see and apply. For moves between departments, teams and projects.' }
  ];
  return (
    <div className="jb-choice-grid" role="radiogroup" aria-label="Posting type">
      {options.map(({ id, icon: Icon, title, text }) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} id={`job-visibility-${id}`}
          className={`jb-choice ${value === id ? 'active' : ''}`} onClick={() => onChange(id)}>
          <span className="jb-choice-icon"><Icon size={18} aria-hidden="true" /></span>
          <span className="jb-choice-body">
            <strong>{title}</strong>
            <small>{text}</small>
            {id === 'internal' && (
              <small className={domains.length ? 'jb-choice-meta' : 'jb-choice-meta jb-warn-text'}>
                {domains.length
                  ? `Visible to people signed in with @${domains.join(', @')}`
                  : 'Add your work email domain in Company profile first'}
              </small>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

const DESCRIPTION_TEMPLATE = `## What you will do
-
-

## What we're looking for
-
-

## Nice to have
- `;

const toLpa = value => (value ? String(value / 100000) : '');
// null (not undefined) so clearing a field while editing survives JSON and unsets it on the server.
const fromLpa = value => (value === '' || value == null ? null : Math.round(Number(value) * 100000));

/** Description editor with a tiny Markdown toolbar, a live preview tab and an AI writer button. */
function DescriptionField({ value, onChange, onGenerate, generating }) {
  const [tab, setTab] = useState('write');
  const ref = useRef(null);

  const generate = async () => {
    if (await onGenerate()) setTab('preview'); // show the formatted result
  };

  // Wrap the selection, or prefix each selected line.
  const apply = kind => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    let next;
    let caret;
    if (kind === 'bold') {
      const sel = value.slice(s, e) || 'bold text';
      next = `${value.slice(0, s)}**${sel}**${value.slice(e)}`;
      caret = s + sel.length + 4;
    } else {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const block = value.slice(lineStart, e);
      const prefix = { heading: '## ', bullet: '- ', number: '1. ' }[kind];
      const replaced = block.split('\n').map((line, i) => (kind === 'number' ? `${i + 1}. ` : prefix) + line.replace(/^(#{1,3}\s|[-*]\s|\d+\.\s)/, '')).join('\n');
      next = value.slice(0, lineStart) + replaced + value.slice(e);
      caret = lineStart + replaced.length;
    }
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  const length = value.trim().length;
  return (
    <div className="jb-md-editor">
      <div className="jb-md-toolbar">
        <div className="jb-seg" role="tablist" aria-label="Description editor">
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'active' : ''} onClick={() => setTab('write')}>Write</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button>
        </div>
        <button type="button" className="jb-btn jb-btn-sm jb-ai-btn" onClick={generate} disabled={generating}
          title="Writes a structured description from the title, skills and anything you've typed">
          <Sparkles size={15} aria-hidden="true" />
          {generating ? 'Writing…' : value.trim() ? 'Improve with AI' : 'Generate with AI'}
        </button>
        {tab === 'write' && (
          <div className="jb-md-tools">
            <button type="button" className="jb-icon-btn" onClick={() => apply('heading')} aria-label="Heading" title="Heading"><Heading2 size={16} /></button>
            <button type="button" className="jb-icon-btn" onClick={() => apply('bold')} aria-label="Bold" title="Bold"><Bold size={16} /></button>
            <button type="button" className="jb-icon-btn" onClick={() => apply('bullet')} aria-label="Bulleted list" title="Bulleted list"><List size={16} /></button>
            <button type="button" className="jb-icon-btn" onClick={() => apply('number')} aria-label="Numbered list" title="Numbered list"><ListOrdered size={16} /></button>
            {!value.trim() && <button type="button" className="text-button" onClick={() => onChange(DESCRIPTION_TEMPLATE)}>Use a template</button>}
          </div>
        )}
      </div>
      {tab === 'write' && !generating && (
        <p className="jb-ai-hint">
          <Sparkles size={13} aria-hidden="true" />
          {value.trim()
            ? 'Improve with AI keeps every point you wrote, fixes spelling and grammar, and formats it into sections.'
            : 'Leave this empty for a full draft from the job details, or jot rough notes (duties, must-haves, shift, perks) in any style and the AI will tidy them up.'}
        </p>
      )}
      {generating ? (
        <div className="jb-md-preview jb-ai-writing" role="status" aria-label="AI is writing the description">
          <Skeleton width="40%" height={18} />
          {[92, 86, 78, 88, 60].map((w, i) => <Skeleton key={i} width={`${w}%`} />)}
          <Skeleton width="45%" height={18} style={{ marginTop: 10 }} />
          {[80, 70, 84].map((w, i) => <Skeleton key={`b${i}`} width={`${w}%`} />)}
        </div>
      ) : tab === 'write' ? (
        <textarea id="job-description" ref={ref} rows={14} value={value} onChange={e => onChange(e.target.value)} required minLength={80} maxLength={12000}
          aria-label="Job description" placeholder="What the person will do, what you need (must-haves vs nice-to-haves), and why they should join." />
      ) : (
        <div className="jb-md-preview">{value.trim() ? <Markdown text={value} /> : <p className="jb-muted">Nothing to preview yet.</p>}</div>
      )}
      <small className={length < 80 ? 'jb-warn-text' : 'jb-muted'}>
        {length < 80 ? `${80 - length} more characters needed for fair scoring` : `${length.toLocaleString()} characters`} · Use ## for headings, - for bullets, **bold**
      </small>
    </div>
  );
}

export default function JobEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const existing = useGetEmployerJobQuery(id, { skip: !editing });
  const { data: company } = useGetEmployerCompanyQuery();
  const domains = company?.emailDomains || [];
  const [createJob, createState] = useCreateJobMutation();
  const [updateJob, updateState] = useUpdateJobMutation();
  const saving = createState.isLoading || updateState.isLoading;

  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [sampleNote, setSampleNote] = useState('');
  const [generateDescription, { isLoading: generating }] = useGenerateJobDescriptionMutation();
  const [aiNote, setAiNote] = useState(null); // { text, undo: previous values }
  const [aiError, setAiError] = useState('');

  /**
   * Sends what's filled in (plus any draft text as notes) to the AI writer. The description is
   * replaced; skills and screening questions are only filled when empty, so nothing typed is lost.
   * Returns true on success.
   */
  const generateWithAi = async () => {
    setAiError('');
    if (form.title.trim().length < 3) {
      setAiError('Add a job title first so the AI knows what to write about.');
      document.getElementById('job-title')?.focus();
      return false;
    }
    const previous = { description: form.description, skills: form.skills, screeningQuestions: form.screeningQuestions };
    try {
      const result = await generateDescription({
        title: form.title,
        location: form.location,
        workMode: form.workMode,
        employmentType: form.employmentType,
        experienceMin: form.experienceMin,
        experienceMax: form.experienceMax,
        salaryMinLpa: form.salaryMinLpa,
        salaryMaxLpa: form.salaryMaxLpa,
        skills: form.skills,
        notes: form.description
      }).unwrap();
      // Decide what to fill from the form as it was when the request was sent (the message needs it now,
      // not after React applies the update).
      const fillSkills = !previous.skills.trim() && result.skills.length > 0;
      const fillQuestions = !previous.screeningQuestions.some(q => q.question.trim()) && result.screeningQuestions.length > 0;
      const filled = [fillSkills && 'skills', fillQuestions && 'screening questions'].filter(Boolean);
      setForm(prev => ({
        ...prev,
        description: result.description,
        ...(fillSkills && !prev.skills.trim() ? { skills: result.skills.join(', ') } : {}),
        ...(fillQuestions && !prev.screeningQuestions.some(q => q.question.trim()) ? { screeningQuestions: result.screeningQuestions } : {})
      }));
      setSampleNote('');
      const suggested = filled.length ? ` Also suggested ${filled.join(' and ')}.` : '';
      const text = result.usedNotes
        ? `AI kept your points, fixed spelling and grammar, and organised them into sections.${suggested}${result.notesCoverage < 90 ? ' A few points may be reworded, so check nothing important is missing.' : ''} Review it before publishing.`
        : `AI wrote the description from the job details.${suggested} Review it before publishing.`;
      setAiNote({ text, undo: previous });
      return true;
    } catch (err) {
      setAiError(errorMessage(err, 'The AI could not write a description right now. Try again in a moment.'));
      return false;
    }
  };

  const undoAi = () => {
    if (!aiNote?.undo) return;
    setForm(prev => ({ ...prev, ...aiNote.undo }));
    setAiNote(null);
  };

  // Fill every field with the next sample job (cycles through the list on each click).
  const fillSample = () => {
    const sample = SAMPLE_JOBS[sampleIndex % SAMPLE_JOBS.length];
    setForm(prev => ({ ...prev, ...sample, screeningQuestions: sample.screeningQuestions.map(q => ({ ...q })) }));
    setSampleIndex(i => i + 1);
    setError('');
    setSampleNote(`Filled with a sample "${sample.title}" job. Review it, then publish or save as draft.`);
  };

  // Fill the form once when the job arrives (later cache refreshes must not wipe edits in progress).
  useEffect(() => {
    const job = existing.data;
    if (!editing || loaded || !job) return;
    setForm({
      title: job.title,
      location: job.location || '',
      workMode: job.workMode,
      employmentType: job.employmentType,
      experienceMin: job.experienceMin ?? '',
      experienceMax: job.experienceMax ?? '',
      salaryMinLpa: toLpa(job.salaryMin),
      salaryMaxLpa: toLpa(job.salaryMax),
      skills: job.skills.join(', '),
      description: job.description,
      screeningQuestions: job.screeningQuestions || [],
      status: job.status,
      visibility: job.visibility || 'external',
      department: job.department || '',
      team: job.team || '',
      project: job.project || '',
      hiringManager: job.hiringManager || '',
      openings: String(job.openings || 1),
      referralsEnabled: job.referralsEnabled !== false,
      referralBonus: job.referralBonus || ''
    });
    setLoaded(true);
  }, [editing, loaded, existing.data]);

  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));

  // Text boxes that only accept numbers (no browser spinner). Invalid keystrokes are simply ignored.
  const setYears = key => event => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 2);
    if (value === '' || Number(value) <= 50) setForm(prev => ({ ...prev, [key]: value === '' ? '' : String(Number(value)) }));
  };
  const setLpa = key => event => {
    let value = event.target.value.replace(/[^\d.]/g, '');
    const [whole, ...rest] = value.split('.');
    value = rest.length ? `${whole.slice(0, 3)}.${rest.join('').slice(0, 1)}` : whole.slice(0, 3);
    setForm(prev => ({ ...prev, [key]: value }));
  };
  const setOpenings = event => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 3);
    if (value === '' || Number(value) <= 500) setForm(prev => ({ ...prev, openings: value === '' ? '' : String(Number(value)) }));
  };
  const setQuestion = (index, changes) => setForm(prev => ({
    ...prev,
    screeningQuestions: prev.screeningQuestions.map((q, i) => (i === index ? { ...q, ...changes } : q))
  }));

  async function save(status) {
    setError('');
    const payload = {
      title: form.title,
      location: form.location,
      workMode: form.workMode,
      employmentType: form.employmentType,
      experienceMin: form.experienceMin === '' ? 0 : Number(form.experienceMin),
      experienceMax: form.experienceMax === '' ? null : Number(form.experienceMax),
      salaryMin: fromLpa(form.salaryMinLpa),
      salaryMax: fromLpa(form.salaryMaxLpa),
      skills: form.skills,
      description: form.description,
      screeningQuestions: form.screeningQuestions.filter(q => q.question.trim()),
      status,
      visibility: form.visibility,
      department: form.department,
      team: form.team,
      project: form.project,
      hiringManager: form.hiringManager,
      openings: form.openings === '' ? 1 : Number(form.openings),
      referralsEnabled: form.visibility === 'external' && form.referralsEnabled,
      referralBonus: form.visibility === 'external' && form.referralsEnabled ? form.referralBonus : ''
    };
    try {
      const job = editing ? await updateJob({ id, ...payload }).unwrap() : await createJob(payload).unwrap();
      navigate(`/employer/jobs/${job.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the job.'));
    }
  }

  const submit = event => {
    event.preventDefault();
    save(editing ? form.status : 'open');
  };

  if (editing && existing.error) return <div className="jb-page"><ErrorNote>{errorMessage(existing.error)}</ErrorNote></div>;
  if (!loaded) {
    return (
      <div className="jb-page jb-narrow" role="status" aria-label="Loading job">
        <Skeleton width="40%" height={32} />
        <div className="jb-card" style={{ marginTop: 20 }}>{[1, 2, 3, 4].map(i => <Skeleton key={i} height={44} style={{ marginBottom: 14 }} />)}</div>
      </div>
    );
  }

  return (
    <div className="jb-page jb-narrow">
      <Link to={editing ? `/employer/jobs/${id}` : '/employer'} className="jb-back"><ArrowLeft size={14} aria-hidden="true" /> Back</Link>
      <header className="jb-page-head">
        <div>
          <p className="eyebrow">{editing ? `EDIT JOB${existing.data?.jobCode ? ` · ${existing.data.jobCode}` : ''}` : 'NEW JOB'}</p>
          <h1 className="jb-h1">{editing ? form.title || 'Edit job' : 'Post a job'}</h1>
          <p className="intro-copy">The AI scores every applicant against the title, skills, experience and description below. Be specific about must-haves.</p>
        </div>
        {!editing && (
          <button type="button" className="jb-btn jb-btn-ghost" onClick={fillSample}>
            <Wand2 size={16} aria-hidden="true" /> {sampleIndex === 0 ? 'Fill sample job' : 'Try another sample'}
          </button>
        )}
      </header>
      {sampleNote && <p className="jb-success" role="status"><Wand2 size={15} aria-hidden="true" /> {sampleNote}</p>}

      <form className="jb-form" onSubmit={submit}>
        <section className="jb-card jb-form-section">
          <h2 className="jb-h3">Posting & team</h2>
          <PostingType value={form.visibility} domains={domains}
            onChange={visibility => setForm(prev => ({ ...prev, visibility }))} />
          {form.visibility === 'internal' && !domains.length && (
            <p className="jb-warn-note">
              <Building2 size={15} aria-hidden="true" />
              <span>Employees are recognised by their work email. <Link to="/employer/company">Add your email domain</Link> (e.g. yourcompany.com) before publishing an internal job.</span>
            </p>
          )}
          <div className="jb-grid-2">
            <label>Department
              <select id="job-department" value={form.department} onChange={set('department')} required>
                <option value="" disabled>Choose a department</option>
                {[...new Set([...DEPARTMENTS, ...(form.department ? [form.department] : [])])].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>Team <span className="jb-muted">(optional)</span>
              <input id="job-team" value={form.team} onChange={set('team')} placeholder="e.g. Platform, Mobile, India West" maxLength={80} />
            </label>
            <label>Project <span className="jb-muted">(optional)</span>
              <input id="job-project" value={form.project} onChange={set('project')} placeholder="e.g. Project Atlas" maxLength={80} />
            </label>
            <label>Hiring manager <span className="jb-muted">(optional)</span>
              <input id="job-manager" value={form.hiringManager} onChange={set('hiringManager')} placeholder="e.g. Ananya Rao" maxLength={80} />
            </label>
            <label>Number of openings
              <input id="job-openings" type="text" inputMode="numeric" autoComplete="off" value={form.openings} onChange={setOpenings} placeholder="1" />
            </label>
          </div>

          {form.visibility === 'external' && (
            <div className="jb-referral-settings">
              <label className="jb-toggle-row">
                <input id="job-referrals" type="checkbox" checked={form.referralsEnabled}
                  onChange={e => setForm(prev => ({ ...prev, referralsEnabled: e.target.checked }))} />
                <span>
                  <strong>Accept employee referrals</strong>
                  <small className="jb-muted">Employees get a personal referral link and can refer people by email. Referred applicants are tagged in your pipeline.</small>
                </span>
              </label>
              {form.referralsEnabled && (
                <label>Referral bonus <span className="jb-muted">(optional, shown to employees)</span>
                  <input id="job-bonus" value={form.referralBonus} onChange={set('referralBonus')} placeholder="e.g. ₹25,000 after 90 days" maxLength={120} />
                </label>
              )}
            </div>
          )}
        </section>

        <section className="jb-card jb-form-section">
          <h2 className="jb-h3">The role</h2>
          <label>Job title
            <input id="job-title" value={form.title} onChange={set('title')} placeholder="e.g. Backend Engineer (Node.js)" required minLength={3} maxLength={120} />
          </label>
          <div className="jb-grid-2">
            <label>Work mode
              <select id="job-workmode" value={form.workMode} onChange={set('workMode')}>
                {Object.entries(WORK_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Location {form.workMode === 'remote' && <span className="jb-muted">(optional)</span>}
              <input id="job-location" value={form.location} onChange={set('location')} placeholder="e.g. Bengaluru"
                required={form.workMode !== 'remote'} />
            </label>
            <label>Employment type
              <select id="job-type" value={form.employmentType} onChange={set('employmentType')}>
                {Object.entries(EMPLOYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <div className="jb-grid-2 jb-grid-tight">
              <label>Min experience (yrs)
                <input id="job-exp-min" type="text" inputMode="numeric" autoComplete="off" value={form.experienceMin} onChange={setYears('experienceMin')} placeholder="0" />
              </label>
              <label>Max experience (yrs)
                <input id="job-exp-max" type="text" inputMode="numeric" autoComplete="off" value={form.experienceMax} onChange={setYears('experienceMax')} placeholder="Any" />
              </label>
            </div>
            <label>Salary from (LPA)
              <input id="job-sal-min" type="text" inputMode="decimal" autoComplete="off" value={form.salaryMinLpa} onChange={setLpa('salaryMinLpa')} placeholder="e.g. 14" />
            </label>
            <label>Salary to (LPA)
              <input id="job-sal-max" type="text" inputMode="decimal" autoComplete="off" value={form.salaryMaxLpa} onChange={setLpa('salaryMaxLpa')} placeholder="e.g. 24" />
            </label>
          </div>
          <small className="jb-muted">LPA = lakhs per annum. Jobs that show salary get noticeably more applicants.</small>
        </section>

        <section className="jb-card jb-form-section">
          <h2 className="jb-h3">What you need</h2>
          <label>Required skills <span className="jb-muted">(comma separated, up to 20)</span>
            <input id="job-skills" value={form.skills} onChange={set('skills')} placeholder="Node.js, MongoDB, Redis, AWS" />
          </label>
          <div className="jb-label-block">
            <span className="jb-field-label">Job description</span>
            <DescriptionField value={form.description} onChange={description => setForm(prev => ({ ...prev, description }))}
              onGenerate={generateWithAi} generating={generating} />
            <ErrorNote>{aiError}</ErrorNote>
            {aiNote && (
              <p className="jb-success jb-ai-note" role="status">
                <Sparkles size={15} aria-hidden="true" />
                <span>{aiNote.text}</span>
                <button type="button" className="text-button" onClick={undoAi}><Undo2 size={14} aria-hidden="true" /> Undo</button>
              </p>
            )}
          </div>
        </section>

        <section className="jb-card jb-form-section">
          <h2 className="jb-h3">Screening questions <span className="jb-muted">(optional, up to 5)</span></h2>
          <p className="jb-muted jb-small">Yes/no questions. Set a required answer to flag candidates who don't meet a hard requirement. Flagged candidates are not rejected automatically.</p>
          {form.screeningQuestions.map((q, index) => (
            <div key={index} className="jb-question-row">
              <input id={`job-q-${index}`} value={q.question} onChange={e => setQuestion(index, { question: e.target.value })}
                placeholder="e.g. Can you join within 30 days?" maxLength={240} aria-label={`Question ${index + 1}`} />
              <select id={`job-q-${index}-req`} value={q.requiredAnswer} onChange={e => setQuestion(index, { requiredAnswer: e.target.value })} aria-label="Required answer">
                <option value="any">Any answer</option>
                <option value="yes">Must be Yes</option>
                <option value="no">Must be No</option>
              </select>
              <button type="button" className="jb-icon-btn" aria-label="Remove question"
                onClick={() => setForm(prev => ({ ...prev, screeningQuestions: prev.screeningQuestions.filter((_, i) => i !== index) }))}><X size={16} /></button>
            </div>
          ))}
          {form.screeningQuestions.length < 5 && (
            <button type="button" className="jb-btn jb-btn-ghost jb-btn-sm"
              onClick={() => setForm(prev => ({ ...prev, screeningQuestions: [...prev.screeningQuestions, { question: '', requiredAnswer: 'any' }] }))}>
              <Plus size={14} aria-hidden="true" /> Add question
            </button>
          )}
        </section>

        {editing && (
          <section className="jb-card jb-form-section">
            <h2 className="jb-h3">Status</h2>
            <div className="jb-seg">
              {[['open', 'Open: accepting applicants'], ['draft', 'Draft: hidden'], ['closed', 'Closed']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={form.status === value} className={form.status === value ? 'active' : ''}
                  onClick={() => setForm(prev => ({ ...prev, status: value }))}>{label}</button>
              ))}
            </div>
          </section>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="jb-form-actions">
          <button type="submit" className="jb-btn" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish job'}
          </button>
          {!editing && (
            <button type="button" className="jb-btn jb-btn-ghost" disabled={saving} onClick={() => save('draft')}>Save as draft</button>
          )}
        </div>
        {editing && <small className="jb-muted">Changing the title, skills, experience or description re-scores future applicants against the new version.</small>}
      </form>
    </div>
  );
}
