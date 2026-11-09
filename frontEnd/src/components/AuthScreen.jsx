import React from 'react';
import { Link } from 'react-router-dom';
import './AuthScreen.css';

const COPY = {
  candidate: {
    eyebrow: 'CAREER CLARITY, EDITED',
    title: 'Your next role starts with a sharper story.',
    body: 'See how well you fit a job before you apply, fix the gaps, and track every application in one place.',
    noteTitle: 'Know your fit first',
    noteBody: 'Every job shows your match score and what to improve.'
  },
  employer: {
    eyebrow: 'HIRING, RANKED',
    title: 'Every application arrives pre-scored.',
    body: 'Post a job and get a ranked shortlist with an explainable fit report for each candidate.',
    noteTitle: 'You make the decisions',
    noteBody: 'AI ranks and explains. Your team moves candidates forward.'
  }
};

export default function AuthScreen({
  authMode, switchMode, role, setRole,
  name, setName, email, setEmail, password, setPassword, companyName, setCompanyName,
  authenticate, error, loading
}) {
  const signup = authMode === 'signup';
  const copy = COPY[signup ? role : 'candidate'];

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Link to="/jobs" className="brand jb-brand-link"><span className="brand-mark">R</span> resumely</Link>
        <div className="art-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
        </div>
        <div className="art-note">
          <span>✦</span>
          <div>
            <strong>{copy.noteTitle}</strong>
            <small>{copy.noteBody}</small>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-inner">
          <Link to="/jobs" className="mobile-brand brand jb-brand-link"><span className="brand-mark">R</span> resumely</Link>
          <div className="auth-heading">
            <p className="eyebrow">WELCOME IN</p>
            <h2>{signup ? (role === 'employer' ? 'Start hiring.' : 'Build your edge.') : 'Welcome back.'}</h2>
            <p>{signup ? 'Free to start. No card needed.' : 'Pick up where you left off.'}</p>
          </div>

          {signup && (
            <div className="jb-role-toggle" role="radiogroup" aria-label="Account type">
              <button type="button" role="radio" aria-checked={role === 'candidate'}
                className={role === 'candidate' ? 'active' : ''} onClick={() => setRole('candidate')}>
                <strong>I want a job</strong><small>Find jobs, check fit, apply</small>
              </button>
              <button type="button" role="radio" aria-checked={role === 'employer'}
                className={role === 'employer' ? 'active' : ''} onClick={() => setRole('employer')}>
                <strong>I'm hiring</strong><small>Post jobs, rank applicants</small>
              </button>
            </div>
          )}

          <form onSubmit={authenticate}>
            {signup && (
              <label>
                Full name
                <input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your full name" autoComplete="name" required />
              </label>
            )}
            {signup && role === 'employer' && (
              <label>
                Company name
                <input id="auth-company" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Nimbus Labs" autoComplete="organization" required />
              </label>
            )}
            <label>
              {signup && role === 'employer' ? 'Work email' : 'Email address'}
              <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@domain.com" autoComplete="email" required />
            </label>
            <label>
              Password
              <input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" minLength="8"
                autoComplete={signup ? 'new-password' : 'current-password'} required />
            </label>

            {error && <div className="error" role="alert">{error}</div>}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : signup ? (role === 'employer' ? 'Create company workspace' : 'Create my account') : 'Sign in'}
              <span>→</span>
            </button>
          </form>

          <p className="switch-auth">
            {signup ? 'Already have an account?' : 'New to Resumely?'}{' '}
            <button type="button" onClick={switchMode}>
              {signup ? 'Sign in' : 'Create account'}
            </button>
          </p>
          <p className="switch-auth">
            <Link to="/jobs" className="text-button">Browse jobs without an account →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
