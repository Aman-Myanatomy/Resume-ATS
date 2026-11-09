import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import { signOut, signOutHandled } from '../../store/slices/auth.slices.js';
import { analysisCleared } from '../../store/slices/analysis.slices.js';
import { homePath } from '../../lib/routes.js';
import { Brand } from '../../components/ui.jsx';
import NotificationBell from '../../components/NotificationBell.jsx';
import { ThemeToggle } from '../../components/ThemeControls.jsx';

function AccountMenu({ user }) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="jb-account" ref={ref}>
      <button type="button" className="jb-user-chip" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(v => !v)} title={user.email}>
        <span className="mini-avatar" aria-hidden="true">{user.name?.[0]?.toUpperCase() || 'U'}</span>
        <span className="jb-hide-sm">{user.name}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="jb-menu" role="menu">
          <div className="jb-menu-head">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <Link role="menuitem" to={user.role === 'employer' ? '/employer' : '/app/applications'} onClick={() => setOpen(false)}>
            <LayoutDashboard size={16} aria-hidden="true" /> {user.role === 'employer' ? 'Employer dashboard' : 'My applications'}
          </Link>
          <button role="menuitem" type="button" onClick={() => { dispatch(analysisCleared()); dispatch(signOut()); setOpen(false); }}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function PublicLayout() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const signedOut = useSelector(state => state.auth.signedOut);
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  const dashboardPath = user?.role === 'employer' ? '/employer' : '/app/applications';

  // The sign-out redirect has landed here; later visits to protected pages should go to login again.
  useEffect(() => {
    if (signedOut) dispatch(signOutHandled());
  }, [signedOut, dispatch]);

  return (
    <div className="jb-public">
      <header className="jb-header">
        <div className="jb-header-inner">
          <Brand to={user ? homePath(user) : '/'} />
          <nav className="jb-header-nav" aria-label="Main">
            <NavLink to="/jobs">Jobs</NavLink>
            {user
              ? <NavLink to={dashboardPath}>Dashboard</NavLink>
              : <Link to="/signup?role=employer">For employers</Link>}
          </nav>
          <div className="jb-header-actions">
            <ThemeToggle />
            {user ? (
              <>
                <NotificationBell />
                <AccountMenu user={user} />
              </>
            ) : (
              <>
                <Link to={`/login?next=${next}`} className="jb-link-btn">Sign in</Link>
                <Link to={`/signup?next=${next}`} className="jb-btn jb-btn-sm">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="jb-footer">
        <div className="jb-footer-inner">
          <div>
            <Brand to="/" />
            <p>Every application is AI-scored. Every decision is made by a person.</p>
          </div>
          <nav aria-label="Footer">
            <Link to="/jobs">Browse jobs</Link>
            {user ? (
              <Link to={dashboardPath}>Dashboard</Link>
            ) : (
              <>
                <Link to="/signup?role=employer">Post a job</Link>
                <Link to="/login">Sign in</Link>
              </>
            )}
          </nav>
          <small>© {new Date().getFullYear()} Resumely</small>
        </div>
      </footer>
    </div>
  );
}
