'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthService, type UserProfile } from '@/services/authService';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const session = await AuthService.getSession();
      if (session?.user) {
        const profile = await AuthService.getUserProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
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
      } else {
        setUser(null);
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
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    signIn,
    signOut,
    refreshProfile: loadProfile,
  };
}
