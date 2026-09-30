import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Mail,
  Moon,
  ScanFace,
  Shield,
  Sun,
  UserRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import campusNight from '../assets/campus-night.svg';

const featureItems = [
  { icon: ScanFace, title: 'Face Recognition Attendance', description: 'Automatic and secure', tone: 'blue' },
  { icon: BookOpen, title: 'Library Management', description: 'Issue, return and track books', tone: 'violet' },
  { icon: BarChart3, title: 'Real-time Records', description: 'View attendance and in/out history', tone: 'green' },
  { icon: ShieldCheck, title: 'Secure Access', description: 'For students and administrators', tone: 'amber' }
];

export const Login = () => {
  const [loginType, setLoginType] = useState('student');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [lightTheme, setLightTheme] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(usernameOrEmail.trim(), password, remember, loginType);
      navigate(user.role === 'student' ? '/student/dashboard' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid login credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate(`/forgot-password?role=${loginType}`);
  };

  return (
    <div className={`login-page ${lightTheme ? 'login-page-light' : ''}`}>
      <div className="login-campus" style={{ backgroundImage: `url(${campusNight})` }} aria-hidden="true" />
      <div className="login-vignette" aria-hidden="true" />

      <header className="login-header">
        <a className="login-brand" href="#home" aria-label="Library and Attendance home">
          <span className="login-brand-mark"><BookOpen size={34} strokeWidth={1.8} /></span>
          <span>
            <strong>Library &amp; Attendance</strong>
            <small>Smart Face Recognition &amp; Library Management</small>
          </span>
        </a>
        <nav className="login-nav" aria-label="Public navigation">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#help">Help Center</a>
          <button type="button" className="theme-toggle" onClick={() => setLightTheme(value => !value)} aria-label="Toggle color theme">
            {lightTheme ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </nav>
      </header>

      <main className="login-main" id="home">
        <section className="login-hero" id="about">
          <p className="login-eyebrow">WELCOME TO</p>
          <h1>Library &amp;<br /><span>Attendance</span></h1>
          <div className="login-hero-rule" />
          <p className="login-hero-copy">Smart campus with face recognition and library management.</p>
          <div className="login-trust-row">
            <span><UserRound size={19} /> Live students</span>
            <span><BookOpen size={19} /> Library</span>
            <span><ShieldCheck size={19} /> Secure access</span>
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-heading">
            <span className="login-card-icon"><BookOpen size={43} strokeWidth={1.7} /></span>
            <h2 id="login-title">Library &amp; Attendance</h2>
            <p>Smart Face Recognition &amp; Library Management SaaS</p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-role-switch" role="tablist" aria-label="Choose account type">
              <button type="button" role="tab" aria-selected={loginType === 'student'} onClick={() => { setLoginType('student'); setError(null); }} className={loginType === 'student' ? 'active' : ''}>
                Student
              </button>
              <button type="button" role="tab" aria-selected={loginType === 'admin'} onClick={() => { setLoginType('admin'); setError(null); }} className={loginType === 'admin' ? 'active' : ''}>
                Admin
              </button>
            </div>

            <label className="login-field-label" htmlFor="login-identifier">{loginType === 'student' ? 'Roll No / Email' : 'Admin Email'}</label>
            <div className="login-input-wrap">
              <Mail size={19} aria-hidden="true" />
              <input id="login-identifier" type="text" value={usernameOrEmail} onChange={e => setUsernameOrEmail(e.target.value)} required autoComplete="username" placeholder={loginType === 'student' ? 'Enter your roll number or email' : 'Enter your admin email'} />
            </div>

            <label className="login-field-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <Lock size={19} aria-hidden="true" />
              <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="login-form-options">
              <label className="remember-control">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <span className="remember-box" aria-hidden="true">✓</span>
                Remember me
              </label>
              <button type="button" className="forgot-link" onClick={handleForgotPassword}>Forgot Password?</button>
            </div>

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? <span className="login-spinner" /> : <Shield size={19} />}
              {loading ? 'Signing in...' : 'Sign In to Dashboard'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </form>

          <div className="login-divider"><span>Or continue with</span></div>
          <div className="login-socials">
            <button type="button" onClick={() => setError('Google sign-in is not configured for this institution.')}><span className="google-mark">G</span> Google</button>
            <button type="button" onClick={() => setError('Microsoft sign-in is not configured for this institution.')}><span className="microsoft-mark"><i /><i /><i /><i /></span> Microsoft</button>
          </div>
          <p className="login-help-note">Use the credentials issued by your institution.</p>
        </section>

        <aside className="login-features" id="help" aria-label="Platform features">
          {featureItems.map(({ icon: Icon, title, description, tone }) => (
            <div className={`login-feature login-feature-${tone}`} key={title}>
              <span className="login-feature-icon"><Icon size={27} strokeWidth={1.8} /></span>
              <span><strong>{title}</strong><small>{description}</small></span>
            </div>
          ))}
        </aside>
      </main>

      <footer className="login-footer">
        <span>© {new Date().getFullYear()} Library &amp; Attendance. All rights reserved.</span>
        <span><a href="#privacy">Privacy Policy</a><b>|</b><a href="#terms">Terms of Service</a><b>|</b><a href="#help">Help Center</a></span>
      </footer>
    </div>
  );
};
