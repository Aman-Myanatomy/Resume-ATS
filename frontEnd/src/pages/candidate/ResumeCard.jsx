import React, { useState } from 'react';
import { CheckCircle2, FileText, Sparkles, Upload } from 'lucide-react';
import { useSaveMyResumeMutation } from '../../store/api/publicApi.js';
import { errorMessage, timeAgo } from '../../lib/format.js';
import { Skeleton } from '../../components/ui.jsx';

/** Shows the candidate's saved resume and lets them replace it. */
export default function ResumeCard({ resume, loading }) {
  const [save, { isLoading: saving }] = useSaveMyResumeMutation();
  const [error, setError] = useState('');

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      await save({ file }).unwrap(); // the MyResume tag refreshes this card
    } catch (err) {
      setError(errorMessage(err, 'Could not save that resume.'));
    }
  }

  // Format file extension badge (e.g. PDF, DOCX)
  const ext = resume?.fileName ? resume.fileName.split('.').pop()?.toUpperCase() : 'DOC';

  return (
    <div className="cand-sidebar-card cand-resume-box">
      <div className="cand-resume-header">
        <div className="cand-resume-title-wrap">
          <FileText size={16} aria-hidden="true" />
          <h3 className="cand-resume-heading">Active Resume</h3>
        </div>
        {resume && (
          <span className="cand-resume-pill">
            <CheckCircle2 size={12} aria-hidden="true" /> Saved
          </span>
        )}
      </div>

      {loading ? (
        <div className="cand-resume-skeleton">
          <Skeleton width="85%" height={16} />
          <Skeleton width="60%" height={12} />
        </div>
      ) : resume ? (
        <div className="cand-resume-doc-preview">
          <div className="cand-doc-icon-tile">
            <span className="cand-doc-ext">{ext}</span>
            <FileText size={20} aria-hidden="true" />
          </div>
          <div className="cand-doc-info">
            <strong className="cand-doc-name" title={resume.fileName}>
              {resume.fileName}
            </strong>
            <p className="cand-doc-meta">
              {resume.words} words &middot; Updated {timeAgo(resume.updatedAt)}
            </p>
            <span className="cand-doc-ready-tag">
              <CheckCircle2 size={12} aria-hidden="true" /> 1-Click Apply Ready
            </span>
          </div>
        </div>
      ) : (
        <div className="cand-resume-empty">
          <p>No resume saved yet. Upload one to unlock 1-click applications &amp; instant AI fit scoring.</p>
        </div>
      )}

      <div className="cand-resume-actions">
        <label className={`cand-resume-upload-btn ${saving ? 'is-uploading' : ''}`}>
          <Upload size={14} aria-hidden="true" />
          <span>{saving ? 'Reading & parsing resume…' : resume ? 'Replace resume file' : 'Upload resume file'}</span>
          <input
            id="resume-card-file"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={upload}
            disabled={saving}
          />
        </label>
        <span className="cand-resume-format-hint">PDF, DOCX or TXT &middot; Up to 5 MB</span>
      </div>

      {error && <div className="cand-resume-error" role="alert">{error}</div>}
    </div>
  );
}
