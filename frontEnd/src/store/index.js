import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer, { clearSession, signOut, loginUser, signupUser, setSession } from './slices/auth.slices.js';
import analysisReducer from './slices/analysis.slices.js';
import uiReducer, { UI_STORAGE_KEY } from './slices/ui.slices.js';
import { api } from './api/baseApi.js';
// Register all endpoint groups with the shared api slice.
import './api/publicApi.js';
import './api/employerApi.js';

const listener = createListenerMiddleware();

// A different user must never see the previous user's cached data.
listener.startListening({
  matcher: isAnyOf(clearSession, signOut, setSession, loginUser.fulfilled, signupUser.fulfilled),
  effect: (action, { dispatch }) => {
    dispatch(api.util.resetApiState());
  }
});

// Persist UI preferences (not the transient mobile menu state).
listener.startListening({
  predicate: action => action.type.startsWith('ui/') && action.type !== 'ui/setMobileNavOpen',
  effect: (action, { getState }) => {
    const { theme, blindScreening, pipelineView } = getState().ui;
    try {
      localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ theme, blindScreening, pipelineView }));
    } catch {}
  }
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    analysis: analysisReducer,
    ui: uiReducer,
    [api.reducerPath]: api.reducer
  },
  middleware: getDefaultMiddleware => getDefaultMiddleware().prepend(listener.middleware).concat(api.middleware),
  devTools: process.env.NODE_ENV !== 'production'
});

// Enables refetchOnFocus / refetchOnReconnect behaviours.
setupListeners(store.dispatch);

export default store;
