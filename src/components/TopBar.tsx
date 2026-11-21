import React from 'react';

export type NavSection = 'radar' | 'verify' | 'employers' | 'patterns';

interface TopBarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenReportModal: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string }[] = [
  { id: 'radar', label: 'Live Radar' },
  { id: 'verify', label: 'Verify Offer' },
  { id: 'employers', label: 'Trusted Employers' },
  { id: 'patterns', label: 'Scam Patterns' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigate,
  onOpenReportModal,
}) => {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1380px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#radar"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('radar');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
        >
          InternRadar
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  isActive
                    ? 'border-slate-950 text-slate-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-950 hover:border-slate-300'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenReportModal}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            Report Posting
          </button>
        </div>
      </div>
    </header>
  );
};
