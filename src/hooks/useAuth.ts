'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthService, type UserProfile } from '@/services/authService';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const session = await AuthService.getSession();
      if (session?.user) {
        const profile = await AuthService.getUserProfile(session.user.id);
        setUser(profile);
        setAccessToken(session.access_token);
      } else {
        setUser(null);
        setAccessToken(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();

    const { data: { subscription } } = AuthService.onAuthStateChange(async (session) => {
      if (session?.user) {
        const profile = await AuthService.getUserProfile(session.user.id);
        setUser(profile);
        setAccessToken(session.access_token);
      } else {
        setUser(null);
        setAccessToken(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await AuthService.signIn(email, password);
    if (error) return error.message;
    await loadProfile();
    return null;
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await AuthService.signOut();
    setUser(null);
    setAccessToken(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    accessToken,
    signIn,
    signOut,
    refreshProfile: loadProfile,
  };
}
