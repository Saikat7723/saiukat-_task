import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Shield } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../api/axios';
import campusNight from '../assets/campus-night.svg';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(token ? '' : 'This reset link is missing or invalid.');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/reset-password', { token, new_password: password });
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-campus" style={{ backgroundImage: `url(${campusNight})` }} aria-hidden="true" /><div className="login-vignette" aria-hidden="true" />
      <header className="login-header"><Link className="login-brand" to="/login" aria-label="Back to sign in"><span className="login-brand-mark"><Shield size={34} strokeWidth={1.8} /></span><span><strong>Library &amp; Attendance</strong><small>Smart Face Recognition &amp; Library Management</small></span></Link><nav className="login-nav"><Link to="/login">Sign in</Link></nav></header>
      <main className="login-main login-main-single">
        <section className="login-card auth-action-card" aria-labelledby="reset-password-title">
          <div className="login-card-heading"><span className="login-card-icon"><LockKeyhole size={43} strokeWidth={1.7} /></span><h2 id="reset-password-title">Set New Password</h2><p>Choose a strong password for your Library &amp; Attendance account.</p></div>
          {error && <div className="login-error" role="alert"><span>{error}</span></div>}
          {success && <div className="login-success" role="status"><CheckCircle2 size={18} /><span>{success}</span></div>}
          {!success && token && <form onSubmit={submit} className="login-form"><label className="login-field-label" htmlFor="new-password">New Password</label><div className="login-input-wrap"><LockKeyhole size={19} aria-hidden="true" /><input id="new-password" minLength={8} required type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><label className="login-field-label" htmlFor="confirm-password">Confirm Password</label><div className="login-input-wrap"><LockKeyhole size={19} aria-hidden="true" /><input id="confirm-password" minLength={8} required type={showPassword ? 'text' : 'password'} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="Enter the password again" /></div><button type="submit" disabled={loading} className="login-submit">{loading ? <span className="login-spinner" /> : <Shield size={19} />}{loading ? 'Saving...' : 'Reset Password'}{!loading && <ArrowRight size={20} />}</button></form>}
          <div className="login-divider"><span>OR</span></div><button type="button" className="auth-back-link" onClick={() => navigate('/login')}><ArrowLeft size={19} /> Back to Sign In</button>
        </section>
      </main>
      <footer className="login-footer"><span>© {new Date().getFullYear()} Library &amp; Attendance. All rights reserved.</span><span><Link to="/login">Privacy Policy</Link><b>|</b><Link to="/login">Terms of Service</Link></span></footer>
    </div>
  );
};
