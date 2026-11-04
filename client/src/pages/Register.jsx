import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../context/auth';
import Alert from '../components/Alert';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={homePathFor(user)} replace />;

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (form.password !== form.confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setSubmitting(true);
    try {
      const u = await register({ name: form.name, email: form.email, password: form.password });
      navigate(homePathFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details || {});
      setSubmitting(false);
    }
  };

  const fieldError = (name) => fieldErrors[name] && <small className="field-error">{fieldErrors[name]}</small>;

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Create account</h1>
        <p className="muted">It takes less than a minute.</p>
        <Alert onClose={() => setError('')}>{error}</Alert>
        <label>
          Full name
          <input name="name" autoComplete="name" value={form.name} onChange={update} required autoFocus />
          {fieldError('name')}
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required />
          {fieldError('email')}
        </label>
        <label>
          Password <span className="muted">(min 8 characters)</span>
          <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={update} required minLength={8} />
          {fieldError('password')}
        </label>
        <label>
          Confirm password
          <input name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={update} required />
          {fieldError('confirm')}
        </label>
        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="muted center">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
