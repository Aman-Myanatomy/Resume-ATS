import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowDown, ArrowUp, CheckCircle2, ExternalLink, GitBranch, Hash, ImagePlus, Lock, Plus, Trash2, Users, X } from 'lucide-react';
import {
  useGetEmployerCompanyQuery, useRemoveLogoMutation, useUpdateEmployerCompanyMutation, useUpdatePipelineMutation, useUploadLogoMutation
} from '../../store/api/employerApi.js';
import { DEFAULT_STAGES, STAGE_KIND_LABELS } from '../../lib/stages.js';
import { refreshSession } from '../../store/slices/auth.slices.js';
import { errorMessage, isCompanyAdmin } from '../../lib/format.js';
import { CompanyLogo, ErrorNote, Skeleton } from '../../components/ui.jsx';

const SIZES = ['', '1-10', '11-50', '51-200', '201-1000', '1000+'];
const LOGO_PX = 256;

/** Draws the chosen image centred on a square canvas and returns a small PNG blob. */
function resizeToSquarePng(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Choose a PNG, JPG or WebP image.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = LOGO_PX;
      canvas.height = LOGO_PX;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(LOGO_PX / img.width, LOGO_PX / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (LOGO_PX - w) / 2, (LOGO_PX - h) / 2, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

function LogoField({ company, canEdit }) {
  const [upload, uploadState] = useUploadLogoMutation();
  const [remove, removeState] = useRemoveLogoMutation();
  const [error, setError] = useState('');

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const blob = await resizeToSquarePng(file);
      await upload(blob).unwrap();
    } catch (err) {
      setError(errorMessage(err, 'Could not upload the logo.'));
    }
  }

  return (
    <div className="jb-logo-field">
      <CompanyLogo name={company.name} url={company.logoUrl} size="xl" />
      <div className="jb-logo-field-main">
        <strong>Company logo</strong>
        <small className="jb-muted">Square works best. PNG, JPG or WebP. Shown on every job and your careers page.</small>
        {canEdit && (
          <div className="jb-form-actions">
            <label className="jb-btn jb-btn-sm jb-btn-ghost jb-file-btn">
              <ImagePlus size={15} aria-hidden="true" /> {uploadState.isLoading ? 'Uploading…' : company.logoUrl ? 'Replace logo' : 'Upload logo'}
              <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={choose} disabled={uploadState.isLoading} />
            </label>
            {company.logoUrl && (
              <button type="button" className="jb-link-btn jb-danger-text" onClick={() => remove()} disabled={removeState.isLoading}>
                <Trash2 size={14} aria-hidden="true" /> Remove
              </button>
            )}
          </div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </div>
  );
}

// One-click additions for common hiring steps.
const STAGE_PRESETS = [
  { label: 'Assessment', kind: 'assessment' },
  { label: 'Technical round', kind: 'interview' },
  { label: 'HR round', kind: 'interview' },
  { label: 'Background check', kind: 'other' }
];

/**
 * Hiring pipeline editor. Applied, Hired and Rejected are fixed; the steps in between are the company's own.
 * Each step has a type so candidate emails, charts and interview scheduling understand it.
 */
function PipelineEditor({ company, canEdit }) {
  const [updatePipeline, { isLoading: saving }] = useUpdatePipelineMutation();
  const middleOf = stages => (stages?.length ? stages : DEFAULT_STAGES)
    .filter(s => !['applied', 'hired', 'rejected'].includes(s.key))
    .map(s => ({ ...s, id: s.key }));
  const [steps, setSteps] = useState(() => middleOf(company.pipelineStages));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const change = next => { setSteps(next); setSaved(false); setError(''); };
  const update = (index, changes) => change(steps.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  const moveStep = (index, delta) => {
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    change(next);
  };
  const add = preset => change([...steps, { id: `new-${Date.now()}-${steps.length}`, key: '', label: preset?.label || '', kind: preset?.kind || 'other' }]);
  const reset = () => change(middleOf(DEFAULT_STAGES));

  async function submit(event) {
    event.preventDefault();
    try {
      const { pipelineStages } = await updatePipeline(steps.map(({ key, label, kind }) => ({ key: key || undefined, label, kind }))).unwrap();
      setSteps(middleOf(pipelineStages));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the pipeline.'));
    }
  }

  const usedLabels = new Set(steps.map(s => s.label.trim().toLowerCase()));
  return (
    <form className="jb-form jb-card jb-form-section" onSubmit={submit} style={{ marginTop: 16 }}>
      <h2 className="jb-h3"><GitBranch size={17} aria-hidden="true" /> Hiring pipeline</h2>
      <p className="jb-muted jb-small">
        The stages every applicant moves through, in order. Add steps like an assessment or extra interview rounds.
        The type tells Resumely what a step means: candidates get the right email, and scheduling an interview moves them to your first interview step.
      </p>

      <ol className="jb-stage-editor">
        <li className="jb-stage-fixed"><Lock size={13} aria-hidden="true" /> <strong>Applied</strong> <small className="jb-muted">Every applicant starts here</small></li>
        {steps.map((step, index) => (
          <li key={step.id} className="jb-stage-row">
            <span className="jb-stage-num" aria-hidden="true">{index + 2}</span>
            <input id={`stage-label-${index}`} value={step.label} onChange={e => update(index, { label: e.target.value })}
              placeholder="Stage name" maxLength={30} required minLength={2} aria-label={`Stage ${index + 2} name`} disabled={!canEdit} />
            <select id={`stage-kind-${index}`} value={step.kind} onChange={e => update(index, { kind: e.target.value })}
              aria-label={`Stage ${index + 2} type`} disabled={!canEdit}>
              {Object.entries(STAGE_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {canEdit && (
              <span className="jb-stage-actions">
                <button type="button" className="jb-icon-btn" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label="Move up"><ArrowUp size={15} /></button>
                <button type="button" className="jb-icon-btn" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} aria-label="Move down"><ArrowDown size={15} /></button>
                <button type="button" className="jb-icon-btn" onClick={() => change(steps.filter((_, i) => i !== index))} aria-label={`Remove ${step.label || 'stage'}`}><X size={15} /></button>
              </span>
            )}
          </li>
        ))}
        <li className="jb-stage-fixed"><Lock size={13} aria-hidden="true" /> <strong>Hired</strong> <small className="jb-muted">and</small> <strong>Rejected</strong> <small className="jb-muted">always come last</small></li>
      </ol>

      {canEdit && steps.length < 8 && (
        <div className="jb-stage-presets">
          <button type="button" className="jb-btn jb-btn-ghost jb-btn-sm" onClick={() => add()}><Plus size={14} aria-hidden="true" /> Add stage</button>
          {STAGE_PRESETS.filter(p => !usedLabels.has(p.label.toLowerCase())).map(p => (
            <button key={p.label} type="button" className="jb-chip-btn" onClick={() => add(p)}><Plus size={12} aria-hidden="true" /> {p.label}</button>
          ))}
        </div>
      )}
      <small className="jb-muted">Up to 8 steps. A step that still has applicants can't be removed until you move them.</small>

      <ErrorNote>{error}</ErrorNote>
      {canEdit && (
        <div className="jb-form-actions">
          <button type="submit" className="jb-btn" disabled={saving}>{saving ? 'Saving…' : 'Save pipeline'}</button>
          <button type="button" className="text-button" onClick={reset}>Reset to default</button>
          {saved && <span className="jb-saved" role="status"><CheckCircle2 size={15} aria-hidden="true" /> Saved. Every job now uses these stages.</span>}
        </div>
      )}
    </form>
  );
}

/** Work email domains: anyone signed in with one of these is an employee (internal jobs + referrals). */
function EmployeeAccess({ company, canEdit }) {
  const [updateCompany, { isLoading: saving }] = useUpdateEmployerCompanyMutation();
  const [value, setValue] = useState((company.emailDomains || []).join(', '));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      const { company: updated } = await updateCompany({ emailDomains: value }).unwrap();
      setValue(updated.emailDomains.join(', '));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the email domains.'));
    }
  }

  const domains = company.emailDomains || [];
  return (
    <form className="jb-form jb-card jb-form-section" onSubmit={submit} style={{ marginTop: 16 }}>
      <h2 className="jb-h3"><Users size={17} aria-hidden="true" /> Employees, internal jobs and referrals</h2>
      <p className="jb-muted jb-small">
        Employees sign in to Resumely as job seekers using their work email. Anyone whose email ends with one of
        these domains can see and apply to your <strong>internal jobs</strong>, and refer people for your external jobs.
      </p>
      <fieldset className="jb-fieldset" disabled={!canEdit}>
        <label>Work email domains <span className="jb-muted">(comma separated, up to 5)</span>
          <input id="co-domains" value={value} onChange={e => { setValue(e.target.value); setSaved(false); }}
            placeholder="e.g. yourcompany.com, yourcompany.in" autoComplete="off" />
        </label>
      </fieldset>
      <small className="jb-muted">Public providers like gmail.com can't be used. {domains.length ? `Employees today: anyone with @${domains.join(', @')}.` : 'Add a domain to enable internal jobs and referrals.'}</small>
      <div className="jb-info-row">
        <Hash size={15} aria-hidden="true" />
        <span>Job ID prefix: <strong>{company.jobPrefix || 'set on your first job'}</strong>. Every job gets an ID like <code>{company.jobPrefix || 'ABC'}-1001</code> that candidates and employees can search for.</span>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {canEdit && (
        <div className="jb-form-actions">
          <button type="submit" className="jb-btn" disabled={saving}>{saving ? 'Saving…' : 'Save domains'}</button>
          {saved && <span className="jb-saved" role="status"><CheckCircle2 size={15} aria-hidden="true" /> Saved</span>}
        </div>
      )}
    </form>
  );
}

export default function CompanySettings() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const canEdit = isCompanyAdmin(user);
  const { data: company, error: loadError, isLoading } = useGetEmployerCompanyQuery();
  const [updateCompany, { isLoading: saving }] = useUpdateEmployerCompanyMutation();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the form once; later cache refreshes (e.g. a logo change) must not wipe unsaved edits.
  useEffect(() => {
    if (company && !form) setForm(company);
  }, [company, form]);

  const set = key => event => {
    setSaved(false);
    setForm(prev => ({ ...prev, [key]: event.target.value }));
  };

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const { company: updated } = await updateCompany({
        name: form.name, website: form.website, location: form.location, size: form.size, about: form.about
      }).unwrap();
      setForm(updated);
      setSaved(true);
      dispatch(refreshSession()); // company name shows in the sidebar
    } catch (err) {
      setError(errorMessage(err, 'Could not save.'));
    }
  }

  if (loadError) return <div className="jb-page"><ErrorNote>{errorMessage(loadError)}</ErrorNote></div>;
  if (isLoading || !form) {
    return (
      <div className="jb-page jb-narrow" role="status" aria-label="Loading company">
        <Skeleton width="35%" height={32} />
        <div className="jb-card" style={{ marginTop: 20 }}>{[1, 2, 3].map(i => <Skeleton key={i} height={44} style={{ marginBottom: 14 }} />)}</div>
      </div>
    );
  }

  return (
    <div className="jb-page jb-narrow">
      <header className="jb-page-head">
        <div>
          <p className="eyebrow">COMPANY PROFILE</p>
          <h1 className="jb-h1">{form.name}</h1>
          <p className="intro-copy">Shown on every job and on your public careers page.</p>
        </div>
        <Link to={`/companies/${form.slug}`} className="jb-btn jb-btn-ghost"><ExternalLink size={15} aria-hidden="true" /> View careers page</Link>
      </header>

      {!canEdit && <p className="jb-demo-note">Only owners and admins can edit the company profile.</p>}

      <section className="jb-card jb-form-section">
        <LogoField company={company} canEdit={canEdit} />
      </section>

      <form className="jb-form jb-card jb-form-section" onSubmit={submit} style={{ marginTop: 16 }}>
        <fieldset className="jb-fieldset" disabled={!canEdit}>
          <label>Company name
            <input id="co-name" value={form.name} onChange={set('name')} required maxLength={120} />
          </label>
          <div className="jb-grid-2">
            <label>Website
              <input id="co-website" type="url" value={form.website} onChange={set('website')} placeholder="https://" />
            </label>
            <label>Headquarters
              <input id="co-location" value={form.location} onChange={set('location')} placeholder="e.g. Pune" />
            </label>
            <label>Company size
              <select id="co-size" value={form.size} onChange={set('size')}>
                {SIZES.map(size => <option key={size} value={size}>{size ? `${size} employees` : 'Not specified'}</option>)}
              </select>
            </label>
          </div>
          <label>About the company
            <textarea id="co-about" rows={6} value={form.about} onChange={set('about')} maxLength={4000}
              placeholder="What you build, who you serve, what it's like to work with you." />
          </label>
        </fieldset>
        <ErrorNote>{error}</ErrorNote>
        {canEdit && (
          <div className="jb-form-actions">
            <button type="submit" className="jb-btn" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
            {saved && <span className="jb-saved" role="status"><CheckCircle2 size={15} aria-hidden="true" /> Saved</span>}
          </div>
        )}
      </form>

      <PipelineEditor company={company} canEdit={canEdit} />
      <EmployeeAccess company={company} canEdit={canEdit} />
    </div>
  );
}
