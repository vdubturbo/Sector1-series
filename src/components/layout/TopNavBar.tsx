'use client';

interface TopNavBarProps {
  children?: React.ReactNode;
}

export function TopNavBar({ children }: TopNavBarProps) {
  return (
    <header className="flex items-center gap-4 px-4 py-2 bg-bg-surface border-b border-border-default relative z-10">
      {/* Logo */}
      <div className="shrink-0">
        <span className="text-text-primary text-lg font-semibold tracking-wide uppercase" style={{ fontFamily: 'var(--font-sans)' }}>
          Sector1 <span className="text-accent-orange">Series</span>
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — user menu slot */}
      {children}
    </header>
  );
}
