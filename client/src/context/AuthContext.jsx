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

  // Validate any stored token on startup.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    api.me()
      .then(({ user: u }) => { if (!cancelled) setUser(u); })
      .catch(() => { if (!cancelled) logout(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [logout]);

  useEffect(() => onUnauthorized(logout), [logout]);

  const handleAuth = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
    return u;
  }, []);

  const login = useCallback((email, password) => api.login(email, password).then(handleAuth), [handleAuth]);
  const register = useCallback((data) => api.register(data).then(handleAuth), [handleAuth]);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

