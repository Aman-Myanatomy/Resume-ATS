import { createSlice } from '@reduxjs/toolkit';

/**
 * UI preferences (client-only state). Persisted to localStorage by the store listener,
 * so they survive reloads on this device.
 */
const STORAGE_KEY = 'resumely_ui';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

const saved = loadPrefs();

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: ['light', 'dark', 'system'].includes(saved.theme) ? saved.theme : 'system',
    blindScreening: Boolean(saved.blindScreening),
    pipelineView: saved.pipelineView === 'board' ? 'board' : 'list',
    mobileNavOpen: false // never persisted
  },
  reducers: {
    setTheme: (state, action) => { state.theme = action.payload; },
    toggleBlindScreening: state => { state.blindScreening = !state.blindScreening; },
    setPipelineView: (state, action) => { state.pipelineView = action.payload; },
    setMobileNavOpen: (state, action) => { state.mobileNavOpen = action.payload; }
  }
});

export const { setTheme, toggleBlindScreening, setPipelineView, setMobileNavOpen } = uiSlice.actions;
export const UI_STORAGE_KEY = STORAGE_KEY;
export default uiSlice.reducer;
