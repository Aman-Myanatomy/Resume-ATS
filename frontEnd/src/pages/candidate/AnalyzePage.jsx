import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Analyzer from '../../components/Analyzer.jsx';
import { analyzeResume } from '../../store/slices/analysis.slices.js';
import { errorMessage } from '../../lib/format.js';

/** The original free-form resume analyzer: any resume against any pasted job description. */
export default function AnalyzePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(state => state.analysis.loading);
  const [resume, setResume] = useState('');
  const [job, setJob] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  async function analyze() {
    if (!resume.trim() && !file) {
      setError('Paste your resume or upload a file to begin.');
      return;
    }
    setError('');
    try {
      await dispatch(analyzeResume({ resume, jobDescription: job, file })).unwrap();
      navigate('/app/results');
    } catch (err) {
      setError(errorMessage(err, 'Analysis failed.'));
    }
  }

  return <Analyzer {...{ resume, setResume, job, setJob, file, setFile, analyze, loading, error, setError }} />;
}
