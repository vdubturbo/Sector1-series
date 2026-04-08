'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TopNavBar } from '@/components/layout/TopNavBar';
import { SideNav } from '@/components/layout/SideNav';
import { UserMenu } from '@/components/ui/UserMenu';
import RulebookAdminDashboard from '@/components/rules/RulebookAdminDashboard';
import RulesChat from '@/components/rules/RulesChat';

export default function HomePage() {
  const { user, isLoading, isAuthenticated, accessToken, signIn, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState('teams-cars');

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

      {isAuthenticated ? (
        /* ── Authenticated: full app with sidebar ── */
        <div className="flex flex-1 overflow-hidden">
          <SideNav activeItem={activeNav} onNavigate={setActiveNav} />

          <main className="flex-1 overflow-auto p-6">
            {activeNav === 'teams-cars' && (
              <SectionPlaceholder title="Teams / Cars" description="Manage team registrations, car entries, and technical specifications." />
            )}
            {activeNav === 'drivers' && (
              <SectionPlaceholder title="Drivers" description="Driver profiles, license verification, and seat assignments." />
            )}
            {activeNav === 'motorsports-reg' && (
              <SectionPlaceholder title="Motorsports Reg" description="Registration platform integration and entry management." />
            )}
            {activeNav === 'branding' && (
              <SectionPlaceholder title="Branding" description="Series branding assets, guidelines, and livery approvals." />
            )}
            {activeNav === 'rules' && (
              <div>
                <h1 className="text-2xl font-semibold text-text-primary tracking-wide uppercase mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
                  Rules Management
                </h1>
                <p className="text-text-muted text-sm mb-6">
                  Upload, process, and activate series rulebooks.
                </p>
                <RulebookAdminDashboard accessToken={accessToken} />

                <div className="max-w-4xl mt-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="section-header flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Rules Assistant
                    </h2>
                    <img src="/images/wrl.png" alt="WRL" className="h-8 w-auto opacity-80" />
                  </div>
                  <RulesChat />
                </div>
              </div>
            )}
            {activeNav === 'schedule-events' && (
              <SectionPlaceholder title="Schedule / Events" description="Race calendar, event configuration, and session scheduling." />
            )}
            {activeNav === 'sponsors-partners' && (
              <SectionPlaceholder title="Sponsors / Partners" description="Sponsorship management, partner agreements, and activation tracking." />
            )}
            {activeNav === 'communications' && (
              <SectionPlaceholder title="Communications" description="Series announcements, notifications, and messaging." />
            )}
          </main>
        </div>
      ) : (
        /* ── Public: Rules Assistant only ── */
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto mt-8">
            <div className="relative mb-6">
              <h1 className="text-2xl font-semibold text-text-primary tracking-wide uppercase mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
                Rules Assistant
              </h1>
              <p className="text-text-muted text-sm pr-32">
                This is a development version only and only intended for guidance. Please consult the official rulebook for absolute answers.
              </p>
              <img src="/images/wrl.png" alt="WRL" className="absolute right-0 top-0 h-[108px] w-auto opacity-80" />
            </div>
            <RulesChat />
          </div>
        </main>
      )}
    </div>
  );
}

function SectionPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary tracking-wide uppercase mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
        {title}
      </h1>
      <p className="text-text-muted text-sm mb-6">{description}</p>
      <div className="bg-bg-card border border-border-default rounded-lg text-center py-16">
        <p className="text-text-muted text-sm">Coming soon</p>
      </div>
    </div>
  );
}
