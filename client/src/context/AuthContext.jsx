import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized, tokenStore } from '../api/client';
import { AuthContext } from './auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only show the loading state if there is a stored token that needs validating.
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  /** Log out only if `token` is still the active one (a newer login must not be undone). */
  const logoutIfCurrent = useCallback((token) => {
    if (tokenStore.get() === token) logout();
  }, [logout]);

  // Validate any stored token on startup.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    let cancelled = false;
    api.me()
      .then(({ user: u }) => { if (!cancelled && tokenStore.get() === token) setUser(u); })
      .catch(() => { if (!cancelled) logoutIfCurrent(token); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [logoutIfCurrent]);

  useEffect(() => onUnauthorized(logoutIfCurrent), [logoutIfCurrent]);

  const handleAuth = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
    // A fresh login supersedes any in-flight validation of a previously stored token.
    setLoading(false);
    return u;
  }, []);

  const login = useCallback((email, password) => api.login(email, password).then(handleAuth), [handleAuth]);
  const register = useCallback((data) => api.register(data).then(handleAuth), [handleAuth]);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

