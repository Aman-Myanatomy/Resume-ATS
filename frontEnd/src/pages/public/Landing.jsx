import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowRight, CalendarCheck, EyeOff, FileText, KanbanSquare, ListOrdered, ShieldCheck, Sparkles, UserCheck
} from 'lucide-react';
import { useGetPlansQuery, useGetStatsQuery } from '../../store/api/publicApi.js';
import { Chips, ScoreRing, StageBadge } from '../../components/ui.jsx';
import PlanCards from '../../components/PlanCards.jsx';

// Illustrative applicants for the hero mock (clearly labelled as an example on the page).
const EXAMPLE = [
  { score: 91, name: 'Candidate A', line: 'Excellent match · 4 yrs Node.js', matched: ['Node.js', 'MongoDB', 'Redis'], stage: 'interview' },
  { score: 82, name: 'Candidate B', line: 'Strong match · missing Redis', matched: ['Express', 'AWS'], stage: 'screening' },
  { score: 64, name: 'Candidate C', line: 'Partial match · projects only', matched: ['Node.js'], stage: 'applied' },
  { score: 38, name: 'Candidate D', line: 'Weak match · frontend profile', matched: [], stage: 'applied' }
];

const FEATURES = [
  { icon: ListOrdered, title: 'Ranked shortlist', text: 'Every applicant is scored against your job the moment they apply. Best fit first.' },
  { icon: FileText, title: 'Explainable fit report', text: 'Matched and missing skills, strengths, gaps and a section-by-section score. No black box.' },
  { icon: EyeOff, title: 'Blind screening', text: 'Hide names in one click so your team judges skills, not backgrounds.' },
  { icon: KanbanSquare, title: 'Pipeline board', text: 'Drag candidates from Applied to Hired. Candidates see status updates automatically.' },
  { icon: CalendarCheck, title: 'Interview scheduling', text: 'Pick a time and link. You and the candidate both get an email with a calendar invite.' },
  { icon: Sparkles, title: 'AI job writer', text: 'Turn rough notes into a clear, structured job description in seconds, with suggested skills and questions.' }
];

export default function Landing() {
  const user = useSelector(state => state.auth.user);
  const { data: stats } = useGetStatsQuery();
  const { data: plans } = useGetPlansQuery();

  useEffect(() => {
    document.title = 'Resumely | Hire from a ranked shortlist';
    return () => { document.title = 'Resumely | AI-ranked hiring and jobs'; };
  }, []);

  const employerCta = user?.role === 'employer' ? '/employer' : '/signup?role=employer';

  return (
    <div className="jb-landing">
      <section className="jb-land-hero">
        <div className="jb-land-hero-inner">
          <div className="jb-land-copy">
            <p className="eyebrow">ATS + JOB BOARD FOR INDIA'S GROWING TEAMS</p>
            <h1>Hire from a ranked shortlist, not a pile of resumes.</h1>
            <p className="jb-land-lede">
              Resumely scores every application against your job and explains why. Your team reviews the best candidates first,
              moves them through a simple pipeline, and schedules interviews in a click.
            </p>
            <div className="jb-land-ctas">
              <Link to={employerCta} className="jb-btn jb-btn-lg">{user?.role === 'employer' ? 'Go to dashboard' : 'Start hiring free'} <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link to="/jobs" className="jb-btn jb-btn-ghost jb-btn-lg">I'm looking for a job</Link>
            </div>
            <p className="jb-land-note">
              Free plan · No card needed
              {stats && <> · <strong>{stats.openJobs}</strong> open jobs from <strong>{stats.companies}</strong> companies</>}
            </p>
          </div>

          <figure className="jb-card jb-land-mock" aria-label="Example: ranked applicants for a job">
            <div className="jb-land-mock-head">
              <div>
                <strong>Backend Engineer · Node.js</strong>
                <small>142 applicants · ranked by fit</small>
              </div>
              <span className="jb-land-mock-pill"><Sparkles size={13} aria-hidden="true" /> AI ranked</span>
            </div>
            <ol className="jb-land-mock-list">
              {EXAMPLE.map((a, i) => (
                <li key={a.name}>
                  <span className="jb-rank">#{i + 1}</span>
                  <ScoreRing score={a.score} status="scored" />
                  <span className="jb-land-mock-main">
                    <strong>{a.name}</strong>
                    <small>{a.line}</small>
                    <Chips items={a.matched} tone="good" limit={3} />
                  </span>
                  <StageBadge stage={a.stage} />
                </li>
              ))}
            </ol>
            <figcaption>Example data. Names hidden with blind screening.</figcaption>
          </figure>
        </div>
      </section>

      <section className="jb-land-section">
        <div className="jb-land-inner">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2 className="jb-land-h2">From job post to shortlist in minutes</h2>
          <ol className="jb-steps">
            <li>
              <span className="jb-step-num">1</span>
              <h3>Post a job</h3>
              <p>Add the role, must-have skills and optional yes/no screening questions. It goes live on the job board instantly.</p>
            </li>
            <li>
              <span className="jb-step-num">2</span>
              <h3>Applicants arrive scored</h3>
              <p>Each resume is read and scored against your job within about a minute, with a clear report of matches and gaps.</p>
            </li>
            <li>
              <span className="jb-step-num">3</span>
              <h3>Your team decides</h3>
              <p>Review the top of the list, add notes, schedule interviews and move people forward. Candidates are kept informed.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="jb-land-section jb-land-alt">
        <div className="jb-land-inner">
          <p className="eyebrow">FOR EMPLOYERS</p>
          <h2 className="jb-land-h2">Everything a small hiring team needs</h2>
          <div className="jb-feature-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="jb-feature">
                <span className="jb-feature-icon"><Icon size={20} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="jb-land-section">
        <div className="jb-land-inner jb-land-split">
          <div>
            <p className="eyebrow">FOR JOB SEEKERS</p>
            <h2 className="jb-land-h2">Know your fit before you apply</h2>
            <p className="jb-land-text">
              Every job shows how well your resume matches and exactly what to fix. Improve it, apply in one click with your saved resume,
              and track every application's status in one place.
            </p>
            <Link to="/jobs" className="jb-btn">Browse open jobs <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className="jb-card jb-land-fit" aria-label="Example fit check">
            <div className="jb-fit-head">
              <ScoreRing score={78} status="scored" size="lg" />
              <div>
                <strong>Good match</strong>
                <p className="jb-muted">Strong Node.js and MongoDB experience. Add Redis and quantify your impact to rank higher.</p>
              </div>
            </div>
            <div><small className="jb-label">You match</small><Chips items={['Node.js', 'Express', 'MongoDB', 'AWS']} tone="good" /></div>
            <div><small className="jb-label">Missing from your resume</small><Chips items={['Redis', 'Design docs']} tone="bad" /></div>
            <small className="jb-muted">Example fit check</small>
          </div>
        </div>
      </section>

      <section className="jb-land-section jb-land-alt">
        <div className="jb-land-inner">
          <p className="eyebrow">TRUST</p>
          <h2 className="jb-land-h2">AI ranks. People decide.</h2>
          <div className="jb-trust-grid">
            <div><UserCheck size={20} aria-hidden="true" /><h3>No automatic rejections</h3><p>The AI orders and explains. Only your team moves or rejects candidates.</p></div>
            <div><ShieldCheck size={20} aria-hidden="true" /><h3>Resumes stay private</h3><p>A resume is shared only with the company the candidate applies to.</p></div>
            <div><FileText size={20} aria-hidden="true" /><h3>Grounded scoring</h3><p>Scores are based only on what the resume actually says, never on guesses.</p></div>
          </div>
        </div>
      </section>

      {plans && (
        <section className="jb-land-section">
          <div className="jb-land-inner">
            <p className="eyebrow">PRICING</p>
            <h2 className="jb-land-h2">Start free. Upgrade when you're hiring more.</h2>
            <PlanCards plans={plans} renderAction={plan => (
              <Link to={user?.role === 'employer' ? '/employer/billing' : '/signup?role=employer'} className={`jb-btn jb-btn-block ${plan.id === 'growth' ? '' : 'jb-btn-ghost'}`}>
                {plan.price ? `Choose ${plan.name}` : 'Start free'}
              </Link>
            )} />
          </div>
        </section>
      )}

      <section className="jb-land-cta">
        <div className="jb-land-inner">
          <h2>Your next great hire is already in the pile.</h2>
          <p>Post your first job free and see a ranked shortlist today.</p>
          <Link to={employerCta} className="jb-btn jb-btn-lg jb-btn-light">{user?.role === 'employer' ? 'Go to dashboard' : 'Start hiring free'} <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
