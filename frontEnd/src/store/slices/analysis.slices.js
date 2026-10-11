import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { analyzeResumeApi, getAnalysesHistoryApi } from '../../services/api.services.js';
import { clearSession } from './auth.slices.js';

function getStoredAnalysis() {
  try {
    return JSON.parse(localStorage.getItem('resumely_analysis') || 'null');
  } catch {
    return null;
  }
}

/**
 * Async Thunk for Analyzing a Resume
 */
export const analyzeResume = createAsyncThunk(
  'analysis/analyzeResume',
  async ({ resume, jobDescription, file }, { getState, dispatch, rejectWithValue }) => {
    const state = getState();
    const token = state.auth.user?.token;

    if (!token) {
      return rejectWithValue('Authentication required to perform analysis.');
    }

    try {
      const data = await analyzeResumeApi(token, resume, jobDescription, file);
      try {
        localStorage.setItem('resumely_analysis', JSON.stringify(data.analysis));
      } catch {}
      return data;
    } catch (error) {
      if (error.status === 401) {
        dispatch(clearSession());
      }
      return rejectWithValue(error.message || 'Analysis failed. Please try again.');
    }
  }
);

/**
 * Async Thunk for Fetching User's Analysis History
 */
export const fetchAnalysisHistory = createAsyncThunk(
  'analysis/fetchHistory',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const token = getState().auth.user?.token;
    if (!token) {
      return rejectWithValue('Authentication required.');
    }

    try {
      const data = await getAnalysesHistoryApi(token);
      return data.analyses || [];
    } catch (error) {
      if (error.status === 401) {
        dispatch(clearSession());
      }
      return rejectWithValue(error.message || 'Failed to fetch analysis history.');
    }
  }
);

const initialState = {
  result: getStoredAnalysis(),
  history: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  loading: false,
  error: null
};

const analysisSlice = createSlice({
  name: 'analysis',
  initialState,
  reducers: {
    analysisStarted: (state) => {
      state.status = 'loading';
      state.loading = true;
      state.error = null;
    },
    analysisSucceeded: (state, action) => {
      state.result = action.payload.analysis;
      state.status = 'succeeded';
      state.loading = false;
      state.error = null;
      try {
        localStorage.setItem('resumely_analysis', JSON.stringify(action.payload.analysis));
      } catch {}
    },
    analysisFailed: (state, action) => {
      state.status = 'failed';
      state.loading = false;
      state.error = action.payload;
    },
    analysisCleared: (state) => {
      state.result = null;
      state.status = 'idle';
      state.loading = false;
      state.error = null;
      try {
        localStorage.removeItem('resumely_analysis');
      } catch {}
    }
  },
  extraReducers: (builder) => {
    builder
      // analyzeResume Thunk lifecycle
      .addCase(analyzeResume.pending, (state) => {
        state.status = 'loading';
        state.loading = true;
        state.error = null;
      })
      .addCase(analyzeResume.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.loading = false;
        state.result = action.payload.analysis;
        state.error = null;
      })
      .addCase(analyzeResume.rejected, (state, action) => {
        state.status = 'failed';
        state.loading = false;
        state.error = action.payload || 'Resume analysis failed.';
      })
      // fetchAnalysisHistory Thunk lifecycle
      .addCase(fetchAnalysisHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      });
  }
});

export const {
  analysisStarted,
  analysisSucceeded,
  analysisFailed,
  analysisCleared
} = analysisSlice.actions;

export default analysisSlice.reducer;

