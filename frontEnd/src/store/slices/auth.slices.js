import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authenticateApi } from '../../services/api.services.js';

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem('resumely_user') || 'null');
  } catch {
    return null;
  }
}

/**
 * Async Thunk for User Registration
 */
export const signupUser = createAsyncThunk(
  'auth/signupUser',
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      const data = await authenticateApi('signup', { name, email, password });
      const session = { ...data.user, token: data.token };
      localStorage.setItem('resumely_user', JSON.stringify(session));
      return session;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async Thunk for User Login
 */
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await authenticateApi('login', { email, password });
      const session = { ...data.user, token: data.token };
      localStorage.setItem('resumely_user', JSON.stringify(session));
      return session;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  user: getStoredSession(),
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (state, action) => {
      state.user = action.payload;
      try {
        localStorage.setItem('resumely_user', JSON.stringify(action.payload));
      } catch {}
    },
    clearSession: (state) => {
      state.user = null;
      state.status = 'idle';
      state.loading = false;
      state.error = null;
      try {
        localStorage.removeItem('resumely_user');
      } catch {}
    },
    clearAuthError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Signup
      .addCase(signupUser.pending, (state) => {
        state.status = 'loading';
        state.loading = true;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.loading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.status = 'failed';
        state.loading = false;
        state.error = action.payload || 'Failed to sign up.';
      })
      // Login
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.loading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.loading = false;
        state.error = action.payload || 'Failed to log in.';
      });
  }
});

export const { setSession, clearSession, clearAuthError } = authSlice.actions;
export default authSlice.reducer;

