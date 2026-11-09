import React, { useState } from 'react';
import { Check, Copy, Gift, Link2, Send, UserPlus } from 'lucide-react';
import { useGetReferralLinkMutation, useInviteReferralMutation } from '../store/api/publicApi.js';
import { RELATIONSHIP_OPTIONS, errorMessage } from '../lib/format.js';
import { ErrorNote } from './ui.jsx';

const EMPTY = { candidateName: '', candidateEmail: '', relationship: '', note: '' };

/**
 * Referral actions for an employee on one external job:
 *  - copy their personal referral link (anyone applying through it is credited to them)
 *  - refer a specific person by email (they get an email with the link)
 */
export default function ReferralTools({ job, compact = false }) {
  const [getLink, linkState] = useGetReferralLinkMutation();
  const [invite, inviteState] = useInviteReferralMutation();
  const [link, setLink] = useState(job.referralLink || '');
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(!compact);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const copyLink = async () => {
    setError('');
    try {
      const url = link || (await getLink(job.id).unwrap()).url;
      setLink(url);
      await navigator.clipboard?.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(errorMessage(err, 'Could not create your referral link.'));
    }
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    setSent('');
    try {
      await invite({ jobId: job.id, ...form }).unwrap();
      setSent(`Referral sent. ${form.candidateName.split(' ')[0]} will get an email with a link to apply.`);
      setForm(EMPTY);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the referral.'));
    }
  };

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const idBase = `ref-${job.id}`;

  return (
    <div className={`jb-ref-tools ${compact ? 'compact' : ''}`}>
      {!compact && job.referralBonus && (
        <p className="jb-ref-bonus"><Gift size={15} aria-hidden="true" /> Referral bonus: <strong>{job.referralBonus}</strong></p>
      )}
      <div className="jb-ref-actions">
        <button type="button" className={`jb-btn jb-btn-sm ${copied ? 'jb-btn-copied' : 'jb-btn-ghost'}`} onClick={copyLink} disabled={linkState.isLoading}>
          {copied ? <><Check size={14} aria-hidden="true" /> Link copied</> : <><Link2 size={14} aria-hidden="true" /> {linkState.isLoading ? 'Creating…' : 'Copy my referral link'}</>}
        </button>
        {compact && (
          <button type="button" className="jb-btn jb-btn-sm" onClick={() => setOpen(v => !v)} aria-expanded={open}>
            <UserPlus size={14} aria-hidden="true" /> Refer by email
          </button>
        )}
      </div>
      {link && <p className="jb-ref-link"><Copy size={12} aria-hidden="true" /> <code>{link}</code></p>}

      {open && (
        <form className="jb-ref-form" onSubmit={submit}>
          <div className="jb-grid-2">
            <label>Their name
              <input id={`${idBase}-name`} value={form.candidateName} onChange={set('candidateName')} required minLength={2} maxLength={120} placeholder="Full name" />
            </label>
            <label>Their email
              <input id={`${idBase}-email`} type="email" value={form.candidateEmail} onChange={set('candidateEmail')} required maxLength={200} placeholder="name@example.com" />
            </label>
          </div>
          <label>How do you know them?
            <select id={`${idBase}-rel`} value={form.relationship} onChange={set('relationship')} required>
              <option value="" disabled>Choose one</option>
              {RELATIONSHIP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Why are they a good fit? <span className="jb-muted">(optional, shared with the hiring team)</span>
            <textarea id={`${idBase}-note`} rows={3} value={form.note} onChange={set('note')} maxLength={1000}
              placeholder="e.g. We worked together for 2 years; she led our payments API work." />
          </label>
          <button type="submit" className="jb-btn jb-btn-sm" disabled={inviteState.isLoading}>
            <Send size={14} aria-hidden="true" /> {inviteState.isLoading ? 'Sending…' : 'Send referral'}
          </button>
        </form>
      )}
      {sent && <p className="jb-success" role="status"><Check size={15} aria-hidden="true" /> {sent}</p>}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
