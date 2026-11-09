import React, { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { refreshSession } from './store/slices/auth.slices.js';

import AuthPage from './pages/AuthPage.jsx';
import PublicLayout from './pages/public/PublicLayout.jsx';
import JobBoard from './pages/public/JobBoard.jsx';
import JobDetail from './pages/public/JobDetail.jsx';
import CompanyPage from './pages/public/CompanyPage.jsx';
import CandidateLayout from './pages/candidate/CandidateLayout.jsx';
import AnalyzePage from './pages/candidate/AnalyzePage.jsx';
import ResultsPage from './pages/candidate/ResultsPage.jsx';
import MyApplications from './pages/candidate/MyApplications.jsx';
import EmployerLayout from './pages/employer/EmployerLayout.jsx';
import EmployerJobs from './pages/employer/EmployerJobs.jsx';
import JobEditor from './pages/employer/JobEditor.jsx';
import JobPipeline from './pages/employer/JobPipeline.jsx';
import CompanySettings from './pages/employer/CompanySettings.jsx';
import Billing from './pages/employer/Billing.jsx';
import Interviews from './pages/employer/Interviews.jsx';
import Referrals from './pages/employer/Referrals.jsx';
import Workplace from './pages/candidate/Workplace.jsx';
import Landing from './pages/public/Landing.jsx';
import { ThemeController } from './components/ThemeControls.jsx';
import { EmptyState } from './components/ui.jsx';
import { homePath } from './lib/routes.js';

function RequireRole({ role, children }) {
  const user = useSelector(state => state.auth.user);
  const signedOut = useSelector(state => state.auth.signedOut);
  const location = useLocation();
  if (!user && signedOut) return <Navigate to="/jobs" replace />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if ((user.role || 'candidate') !== role) return <Navigate to={homePath(user)} replace />;
  return children;
}

/** "/" is the marketing landing page for visitors; signed-in users go straight to their workspace. */
function Home() {
  const user = useSelector(state => state.auth.user);
  return user ? <Navigate to={homePath(user)} replace /> : <Landing />;
}

export default function App() {
  const dispatch = useDispatch();
  const hasSession = useSelector(state => Boolean(state.auth.user?.token));

  // Pick up role/company changes (and upgrade sessions saved before roles existed).
  useEffect(() => {
    if (hasSession) dispatch(refreshSession());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
    <ThemeController />
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />

      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Navigate to="/" replace />} />
        <Route path="/jobs" element={<JobBoard />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/companies/:slug" element={<CompanyPage />} />
      </Route>

      <Route path="/app" element={<RequireRole role="candidate"><CandidateLayout /></RequireRole>}>
        <Route index element={<Navigate to="applications" replace />} />
        <Route path="applications" element={<MyApplications />} />
        <Route path="workplace" element={<Workplace />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="results" element={<ResultsPage />} />
      </Route>

      <Route path="/employer" element={<RequireRole role="employer"><EmployerLayout /></RequireRole>}>
        <Route index element={<EmployerJobs />} />
        <Route path="jobs/new" element={<JobEditor />} />
        <Route path="jobs/:id" element={<JobPipeline />} />
        <Route path="jobs/:id/edit" element={<JobEditor />} />
        <Route path="company" element={<CompanySettings />} />
        <Route path="billing" element={<Billing />} />
        <Route path="interviews" element={<Interviews />} />
        <Route path="referrals" element={<Referrals />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="*" element={
          <div className="jb-page">
            <EmptyState title="Page not found" action={<Link className="jb-btn" to="/jobs">Browse jobs</Link>}>
              The link may be old or mistyped.
            </EmptyState>
          </div>
        } />
      </Route>
    </Routes>
    </>
  );
}
