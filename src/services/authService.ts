import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole =
  | 'admin'
  | 'developer'
  | 'demo'
  | 'pending_setup'
  | 'team_owner'
  | 'race_engineer'
  | 'driver'
  | 'race_control'
  | 'media'
  | 'visitor';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  team_id?: string;
  profile_picture_url?: string;
  created_at: string;
  updated_at: string;
}

export class AuthService {
  static async signIn(email: string, password: string): Promise<{ session: Session | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { session: data.session, error: null };
    } catch (error) {
      return { session: null, error: error as Error };
    }
  }

  static async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  static async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  static async updateUserProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, 'full_name' | 'profile_picture_url'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  static getRolePermissions(role: UserRole) {
    const permissions: Record<UserRole, Record<string, boolean>> = {
      admin:         { canAccessAdmin: true,  canAccessRaceSetup: true,  canAccessTelemetry: true,  canManageUsers: true,  canViewAllData: true,  canExportData: true  },
      developer:     { canAccessAdmin: true,  canAccessRaceSetup: true,  canAccessTelemetry: true,  canManageUsers: false, canViewAllData: true,  canExportData: true  },
      demo:          { canAccessAdmin: false, canAccessRaceSetup: false, canAccessTelemetry: true,  canManageUsers: false, canViewAllData: true,  canExportData: false },
      team_owner:    { canAccessAdmin: false, canAccessRaceSetup: true,  canAccessTelemetry: true,  canManageUsers: false, canViewAllData: false, canExportData: true  },
      race_engineer: { canAccessAdmin: false, canAccessRaceSetup: true,  canAccessTelemetry: true,  canManageUsers: false, canViewAllData: false, canExportData: true  },
      driver:        { canAccessAdmin: false, canAccessRaceSetup: false, canAccessTelemetry: false, canManageUsers: false, canViewAllData: false, canExportData: false },
      race_control:  { canAccessAdmin: false, canAccessRaceSetup: false, canAccessTelemetry: true,  canManageUsers: false, canViewAllData: false, canExportData: false },
      media:         { canAccessAdmin: false, canAccessRaceSetup: false, canAccessTelemetry: false, canManageUsers: false, canViewAllData: false, canExportData: false },
      visitor:       { canAccessAdmin: false, canAccessRaceSetup: false, canAccessTelemetry: true,  canManageUsers: false, canViewAllData: true,  canExportData: false },
      pending_setup: { canAccessAdmin: false, canAccessRaceSetup: false, canAccessTelemetry: true,  canManageUsers: false, canViewAllData: true,  canExportData: false },
    };
    return permissions[role] || permissions.visitor;
  }

  static onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }
}
