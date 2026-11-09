import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AuthScreen from '../components/AuthScreen.jsx';
import { loginUser, signupUser, clearAuthError } from '../store/slices/auth.slices.js';
import { homePath } from '../lib/routes.js';
import { errorMessage } from '../lib/format.js';

/** Only allow same-site relative redirects after sign-in. */
function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

export default function AuthPage({ mode }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading } = useSelector(state => state.auth);

  const next = safeNext(params.get('next'));
  const [role, setRole] = useState(params.get('role') === 'employer' ? 'employer' : 'candidate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(clearAuthError());
    setError('');
  }, [mode, dispatch]);

  if (user) return <Navigate to={next || homePath(user)} replace />;

  async function authenticate(event) {
    event.preventDefault();
    setError('');
    try {
      const session = mode === 'signup'
        ? await dispatch(signupUser({ name, email, password, role, companyName })).unwrap()
        : await dispatch(loginUser({ email, password })).unwrap();
      navigate(next || homePath(session), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Authentication failed.'));
    }
  }

  const switchMode = () => {
    const query = new URLSearchParams();
    if (next) query.set('next', next);
    if (role === 'employer') query.set('role', 'employer');
    navigate(`/${mode === 'signup' ? 'login' : 'signup'}${query.toString() ? `?${query}` : ''}`);
  };

  return (
    <AuthScreen
      authMode={mode}
      switchMode={switchMode}
      role={role}
      setRole={setRole}
      name={name}
      setName={setName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      companyName={companyName}
      setCompanyName={setCompanyName}
      authenticate={authenticate}
      error={error}
      loading={loading}
    />
  );
}
