'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TopNavBar } from '@/components/layout/TopNavBar';
import { SideNav } from '@/components/layout/SideNav';
import { UserMenu } from '@/components/ui/UserMenu';
import RulebookAdminDashboard from '@/components/rules/RulebookAdminDashboard';

export default function HomePage() {
  const { user, isLoading, accessToken, signIn, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState('rules');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNavBar>
        <UserMenu
          user={user}
          isLoading={isLoading}
          onSignIn={signIn}
          onSignOut={signOut}
        />
      </TopNavBar>

      <div className="flex flex-1 overflow-hidden">
        <SideNav activeItem={activeNav} onNavigate={setActiveNav} />

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
          {activeNav === 'rules' && (
            <div>
              <h1 className="text-2xl font-semibold text-text-primary tracking-wide uppercase mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
                Rules Management
              </h1>
              <p className="text-text-muted text-sm mb-6">
                Upload, process, and activate series rulebooks.
              </p>
              <RulebookAdminDashboard accessToken={accessToken} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
