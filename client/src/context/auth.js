import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export const homePathFor = (user) => (user?.role === 'admin' ? '/admin' : '/movies');

/** Pick where to go after login: the originally requested page if the role allows it. */
export function redirectTarget(user, from) {
  if (from && from !== '/login' && (user.role === 'admin') === from.startsWith('/admin')) return from;
  return homePathFor(user);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
