'use client';

interface TopNavBarProps {
  children?: React.ReactNode;
}

export function TopNavBar({ children }: TopNavBarProps) {
  return (
    <header className="flex items-center gap-4 px-4 py-2 bg-bg-surface border-b border-border-default relative z-10">
      {/* Logo */}
      <div className="shrink-0">
        <img
          src="/images/seriesmanagement.svg"
          alt="Series Management"
          className="h-7 w-auto"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — user menu slot */}
      {children}
    </header>
  );
}
