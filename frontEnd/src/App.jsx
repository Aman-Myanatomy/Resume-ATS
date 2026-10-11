import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AuthScreen from './components/AuthScreen.jsx';
import Dashboard from './components/Dashboard.jsx';
import { signupUser, loginUser, clearSession } from './store/slices/auth.slices.js';
import { analyzeResume } from './store/slices/analysis.slices.js';

export default function App() {
  const dispatch = useDispatch();
  const { user, loading: authLoading, error: authError } = useSelector(state => state.auth);
  const { result: analysis, loading: analysisLoading, error: analysisError } = useSelector(state => state.analysis);

  const [authMode, setAuthMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resume, setResume] = useState('');
  const [job, setJob] = useState('');
  const [file, setFile] = useState(null);
  const [activeTab, setActiveTab] = useState('analyze');
  const [localError, setLocalError] = useState('');

  const displayError = localError || authError || analysisError || '';
  const isLoading = authLoading || analysisLoading;

  async function handleAuthentication(event) {
    event.preventDefault();
    setLocalError('');

    try {
      if (authMode === 'signup') {
        await dispatch(signupUser({ name, email, password })).unwrap();
      } else {
        await dispatch(loginUser({ email, password })).unwrap();
      }
    } catch (err) {
      // Handled via Redux state rejection or unwrap
      setLocalError(typeof err === 'string' ? err : err.message || 'Authentication failed.');
    }
  }

  async function handleAnalysis() {
    if (!resume.trim() && !file) {
      setLocalError('Paste your resume or upload a file to begin.');
      return;
    }

    setLocalError('');

    try {
      await dispatch(
        analyzeResume({
          resume,
          jobDescription: job,
          file
        })
      ).unwrap();

      setActiveTab('results');
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : err.message || 'Analysis failed.');
    }
  }

  if (!user) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        name={name}
        setName={setName}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        authenticate={handleAuthentication}
        error={displayError}
        setError={setLocalError}
        loading={isLoading}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      setUser={() => dispatch(clearSession())}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      resume={resume}
      setResume={setResume}
      job={job}
      setJob={setJob}
      file={file}
      setFile={setFile}
      analysis={analysis}
      loading={isLoading}
      error={displayError}
      setError={setLocalError}
      analyze={handleAnalysis}
    />
  );
}
