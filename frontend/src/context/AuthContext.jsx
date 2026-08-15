'use client';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { get, post, saveToken, clearToken, getToken } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: check if token exists, verify it
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    get('/api/auth/me')
      .then(data => { setUser(data.user); setLoading(false); })
      .catch(() => { clearToken(); setLoading(false); });
  }, []);

  const login = useCallback(async (values) => {
    const data = await post('/api/auth/login', values);
    saveToken(data.token);
    setUser(data.user);
    router.push(data.user?.role === 'municipality_head' ? '/municipality/dashboard' : '/dashboard');
    return data.user;
  }, [router]);

  const signup = useCallback(async (values) => {
    clearToken();
    const data = await post('/api/auth/signup', values);
    const appStatus = data.user?.wardRepresentativeApplication?.status;
    if (!data.token || data.pending || data.user?.status !== 'active' || appStatus === 'pending' || appStatus === 'rejected') {
      clearToken();
      setUser(null);
      router.push('/login');
      return data.user;
    }
    saveToken(data.token);
    setUser(data.user);
    router.push(data.user?.role === 'municipality_head' ? '/municipality/dashboard' : '/dashboard');
    return data.user;
  }, [router]);

  const verifyEmail = useCallback(async (otp) => {
    const data = await post('/api/auth/verify-email', { otp });
    setUser(data.user);
    return data.user;
  }, []);

  const resendEmailOtp = useCallback(async () => post('/api/auth/resend-email-otp', {}), []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, signup, logout, verifyEmail, resendEmailOtp }), [user, loading, login, signup, logout, verifyEmail, resendEmailOtp]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }




