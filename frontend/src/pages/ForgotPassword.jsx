import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Mail, Send, Shield, UserRound } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../api/axios';
import campusNight from '../assets/campus-night.svg';

export const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState(searchParams.get('role') === 'admin' ? 'admin' : 'student');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setMessage(null);
    setResetUrl('');
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/forgot-password', { email: email.trim(), account_type: accountType });
      setMessage(response.data.message);
      if (response.data.reset_url) setResetUrl(response.data.reset_url);
    } catch (err) {
      setError(err.response?.data?.detail || 'We could not process the reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-campus" style={{ backgroundImage: `url(${campusNight})` }} aria-hidden="true" />
      <div className="login-vignette" aria-hidden="true" />
      <header className="login-header">
        <Link className="login-brand" to="/login" aria-label="Back to sign in">
          <span className="login-brand-mark"><Shield size={34} strokeWidth={1.8} /></span>
          <span><strong>Library &amp; Attendance</strong><small>Smart Face Recognition &amp; Library Management</small></span>
        </Link>
        <nav className="login-nav" aria-label="Public navigation"><Link to="/login">Sign in</Link><a href="/login#help">Help Center</a></nav>
      </header>

      <main className="login-main login-main-single">
        <section className="login-card auth-action-card" aria-labelledby="forgot-password-title">
          <div className="login-card-heading">
            <span className="login-card-icon"><LockKeyhole size={43} strokeWidth={1.7} /></span>
            <h2 id="forgot-password-title">Forgot Password?</h2>
            <p>Enter your registered email and we’ll send a secure password reset link.</p>
          </div>

          {error && <div className="login-error" role="alert"><span>{error}</span></div>}
          {message && <div className="login-success" role="status"><CheckCircle2 size={18} /><span>{message}</span></div>}

          {!message && <form onSubmit={submit} className="login-form">
            <div className="login-role-switch" role="tablist" aria-label="Choose account type">
              <button type="button" role="tab" aria-selected={accountType === 'student'} onClick={() => setAccountType('student')} className={accountType === 'student' ? 'active' : ''}><UserRound size={17} /> Student</button>
              <button type="button" role="tab" aria-selected={accountType === 'admin'} onClick={() => setAccountType('admin')} className={accountType === 'admin' ? 'active' : ''}><Shield size={17} /> Admin</button>
            </div>
            <label className="login-field-label" htmlFor="reset-email">Email Address</label>
            <div className="login-input-wrap"><Mail size={19} aria-hidden="true" /><input id="reset-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="Enter your registered email" /></div>
            <button type="submit" disabled={loading} className="login-submit">{loading ? <span className="login-spinner" /> : <Send size={19} />}{loading ? 'Sending...' : 'Send Reset Link'}{!loading && <ArrowRight size={20} />}</button>
          </form>}

          {resetUrl && <div className="reset-link-box"><p>Mail delivery is not configured on this local server. Use the generated one-time link:</p><a href={resetUrl}>Open password reset page <ArrowRight size={16} /></a></div>}
          <div className="login-divider"><span>OR</span></div>
          <button type="button" className="auth-back-link" onClick={() => navigate('/login')}><ArrowLeft size={19} /> Back to Sign In</button>
        </section>
      </main>
      <footer className="login-footer"><span>© {new Date().getFullYear()} Library &amp; Attendance. All rights reserved.</span><span><Link to="/login">Privacy Policy</Link><b>|</b><Link to="/login">Terms of Service</Link></span></footer>
    </div>
  );
};
