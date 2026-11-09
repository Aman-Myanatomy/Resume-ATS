import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Monitor, Moon, Sun } from 'lucide-react';
import { setTheme } from '../store/slices/ui.slices.js';

/** Keeps <html data-theme> in sync with the Redux theme setting (and the OS when set to "system"). */
export function ThemeController() {
  const theme = useSelector(state => state.ui.theme);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media?.matches);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1411' : '#f5f7f2');
    };
    apply();
    if (theme !== 'system' || !media) return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return null;
}

const ORDER = ['system', 'light', 'dark'];
const META = {
  system: { icon: Monitor, label: 'Theme: match device' },
  light: { icon: Sun, label: 'Theme: light' },
  dark: { icon: Moon, label: 'Theme: dark' }
};

/** One button that cycles device → light → dark. */
export function ThemeToggle() {
  const dispatch = useDispatch();
  const theme = useSelector(state => state.ui.theme);
  const { icon: Icon, label } = META[theme];
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button type="button" className="jb-icon-btn jb-theme-btn" onClick={() => dispatch(setTheme(next))}
      aria-label={`${label}. Switch to ${META[next].label.replace('Theme: ', '')}`} title={label}>
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
