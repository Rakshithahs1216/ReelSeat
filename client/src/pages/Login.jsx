import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor, redirectTarget, useAuth } from '../context/auth';
import Alert from '../components/Alert';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // While a login submission is in flight, handleSubmit owns the redirect (it may target the
  // page originally requested), so don't race it with the generic "already logged in" redirect.
  if (user && !submitting) return <Navigate to={homePathFor(user)} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u = await login(form.email, form.password);
      navigate(redirectTarget(u, location.state?.from?.pathname), { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Welcome back</h1>
        <p className="muted">Log in to book your seats.</p>
        <Alert onClose={() => setError('')}>{error}</Alert>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required autoFocus />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" value={form.password} onChange={update} required />
        </label>
        <button className="btn btn-primary btn-block" disabled={submitting || !form.email || !form.password}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
        <p className="muted center">
          New here? <Link to="/register">Create an account</Link>
        </p>
        <details className="demo-creds">
          <summary>Demo credentials</summary>
          <p>Admin: <code>admin@reelseat.com</code> / <code>Admin@123</code></p>
          <p>User: <code>user@reelseat.com</code> / <code>User@1234</code></p>
        </details>
      </form>
    </div>
  );
}
