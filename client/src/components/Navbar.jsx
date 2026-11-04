import { Link, NavLink, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../context/auth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to={user ? homePathFor(user) : '/login'} className="brand">
          <span className="brand-mark" aria-hidden="true">🎬</span> ReelSeat
        </Link>
        {user && (
          <nav className="nav-links" aria-label="Main">
            {user.role === 'admin' ? (
              <NavLink to="/admin">Admin panel</NavLink>
            ) : (
              <>
                <NavLink to="/movies">Movies</NavLink>
                <NavLink to="/bookings">My bookings</NavLink>
              </>
            )}
            <span className="nav-user" title={user.email}>
              {user.name}
              {user.role === 'admin' && <span className="badge">admin</span>}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
          </nav>
        )}
      </div>
    </header>
  );
}
