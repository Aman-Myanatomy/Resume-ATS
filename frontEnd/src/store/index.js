import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/auth.slices.js';
import analysisReducer from './slices/analysis.slices.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    analysis: analysisReducer
  },
  devTools: process.env.NODE_ENV !== 'production'
});

export default store;
