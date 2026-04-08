'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { UserProfile } from '@/services/authService';

interface UserMenuProps {
  user: UserProfile | null;
  isLoading: boolean;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignOut: () => Promise<void>;
}

export function UserMenu({ user, isLoading, onSignIn, onSignOut }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowLoginForm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);
    const error = await onSignIn(email, password);
    setIsSubmitting(false);
    if (error) {
      setLoginError(error);
    } else {
      setEmail('');
      setPassword('');
      setShowLoginForm(false);
      setIsOpen(false);
    }
  }, [email, password, onSignIn]);

  const handleSignOut = useCallback(async () => {
    setIsOpen(false);
    await onSignOut();
  }, [onSignOut]);

  if (isLoading) {
    return (
      <div className="w-9 h-9 rounded-full border-2 border-border-subtle bg-bg-elevated animate-pulse" />
    );
  }

  return (
    <div className="relative shrink-0 ml-2" ref={menuRef}>
      {/* Avatar button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full border-2 border-accent-orange bg-bg-elevated flex items-center justify-center overflow-hidden cursor-pointer hover:shadow-[0_0_8px_rgba(232,117,26,0.3)] transition-shadow"
        title={user?.full_name || user?.email || 'Account'}
      >
        {user?.profile_picture_url ? (
          <img src={user.profile_picture_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[200] min-w-52 bg-bg-card border border-border-subtle rounded shadow-lg shadow-black/40 overflow-hidden">
          {user ? (
            <>
              {/* User info header */}
              <div className="px-3 py-2.5 border-b border-border-default">
                <div className="text-sm font-semibold text-text-primary truncate">
                  {user.full_name || 'User'}
                </div>
                <div className="text-[0.625rem] text-text-muted truncate">{user.email}</div>
                <div className="text-[0.5625rem] text-accent-orange uppercase tracking-wider mt-0.5">
                  {user.role.replace('_', ' ')}
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <MenuItem icon="✏️" label="Edit Profile" onClick={() => setIsOpen(false)} />
                <MenuItem icon="📧" label="Contact Sector1" onClick={() => { setIsOpen(false); window.open('mailto:support@sector1.ai', '_blank'); }} />
                <div className="my-1 border-t border-border-default" />
                <MenuItem icon="❓" label="Help Center" onClick={() => { setIsOpen(false); window.open('https://sector1.ai/help', '_blank'); }} />
                <MenuItem icon="🚪" label="Sign Out" onClick={handleSignOut} variant="danger" />
              </div>
            </>
          ) : (
            <>
              {showLoginForm ? (
                <form onSubmit={handleSignIn} className="p-3">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Sign In
                  </div>
                  {loginError && (
                    <div className="text-[0.625rem] text-status-red mb-2 bg-status-red/10 border border-status-red/20 rounded px-2 py-1">
                      {loginError}
                    </div>
                  )}
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mb-2 px-2.5 py-1.5 bg-bg-elevated border border-border-subtle rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-orange"
                    autoFocus
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full mb-3 px-2.5 py-1.5 bg-bg-elevated border border-border-subtle rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-orange"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-1.5 bg-accent-orange text-white text-sm font-semibold rounded hover:bg-accent-amber transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowLoginForm(false); setLoginError(null); }}
                    className="w-full mt-1.5 py-1 text-text-muted text-xs hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="py-1">
                  <MenuItem icon="🔑" label="Sign In" onClick={() => setShowLoginForm(true)} />
                  <div className="my-1 border-t border-border-default" />
                  <MenuItem icon="📧" label="Contact Sector1" onClick={() => { setIsOpen(false); window.open('mailto:support@sector1.ai', '_blank'); }} />
                  <MenuItem icon="❓" label="Help Center" onClick={() => { setIsOpen(false); window.open('https://sector1.ai/help', '_blank'); }} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  variant,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors
        ${variant === 'danger'
          ? 'text-status-red hover:bg-status-red/10'
          : 'text-text-primary hover:bg-bg-hover'
        }
      `}
    >
      <span className="text-sm w-5 text-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
