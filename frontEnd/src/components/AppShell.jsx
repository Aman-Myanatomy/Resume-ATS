import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LogOut, Menu, X } from 'lucide-react';
import { signOut as signOutAction } from '../store/slices/auth.slices.js';
import { analysisCleared } from '../store/slices/analysis.slices.js';
import { setMobileNavOpen } from '../store/slices/ui.slices.js';
import { Brand } from './ui.jsx';
import NotificationBell from './NotificationBell.jsx';
import { ThemeToggle } from './ThemeControls.jsx';
import './Dashboard.css';

/**
 * Signed-in workspace layout (sidebar + top bar), shared by candidates and employers.
 * `nav` is a list of { to, label, icon (lucide component), end, external }.
 * On phones the sidebar becomes a slide-in drawer opened from the top bar.
 */
export default function AppShell({ nav, context }) {
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const user = useSelector(state => state.auth.user);
  const drawerOpen = useSelector(state => state.ui.mobileNavOpen);

  // Close the drawer whenever the route changes, and on Escape.
  useEffect(() => { dispatch(setMobileNavOpen(false)); }, [pathname, dispatch]);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = e => e.key === 'Escape' && dispatch(setMobileNavOpen(false));
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, dispatch]);

  // RequireRole sees signedOut=true and sends the user to /jobs.
  const signOut = () => {
    dispatch(analysisCleared());
    dispatch(signOutAction());
  };

  return (
    <main className={`app-shell ${drawerOpen ? 'drawer-open' : ''}`}>
      <div className="jb-drawer-scrim" onClick={() => dispatch(setMobileNavOpen(false))} aria-hidden="true" />
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="sidebar-top">
          <div className="jb-sidebar-brand">
            <Brand to={nav[0]?.to || '/'} />
            <button type="button" className="jb-icon-btn jb-drawer-close" onClick={() => dispatch(setMobileNavOpen(false))} aria-label="Close menu">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <nav>
            {nav.map(item => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => `${isActive ? 'nav-active' : ''} ${item.external ? 'nav-external' : ''}`}>
                  <span className="jb-nav-icon" aria-hidden="true"><Icon size={17} strokeWidth={2} /></span>
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="mini-avatar" aria-hidden="true">{user?.name ? user.name[0].toUpperCase() : 'U'}</div>
          <div className="jb-sidebar-user">
            <strong>{user?.name}</strong>
            <small>{user?.company?.name || user?.email}</small>
          </div>
          <button className="logout" onClick={signOut} title="Sign out" aria-label="Sign out" type="button">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="jb-topbar-left">
            <button type="button" className="jb-icon-btn jb-menu-btn" onClick={() => dispatch(setMobileNavOpen(true))} aria-label="Open menu" aria-expanded={drawerOpen}>
              <Menu size={20} aria-hidden="true" />
            </button>
            <span className="jb-topbar-context"><span className="status-dot"></span>{context}</span>
          </div>
          <div className="jb-topbar-right">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <div className="workspace-body">
          <Outlet />
        </div>
      </section>
    </main>
  );
}
