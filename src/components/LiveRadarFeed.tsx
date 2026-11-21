import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Flag,
  MessageSquare,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type {
  ReportStatus,
  ScamPattern,
  ScamReport,
} from '../types/radar.ts';
import {
  formatRelativeTime,
  PATTERN_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '../utils/formatters.ts';

interface LiveRadarFeedProps {
  reports: ScamReport[];
  isLoading: boolean;
  wsStatus: 'connecting' | 'connected' | 'reconnecting';
  activeWatchers: number;
  voterId: string;
  onToggleFlag: (reportId: string) => Promise<void>;
  onInspectReport: (report: ScamReport) => void;
  onOpenReportModal: () => void;
}

type PatternFilter = 'all' | ScamPattern;
type StatusFilter = 'all' | ReportStatus;
type SortMode = 'newest' | 'most_flagged' | 'severity';

const PATTERN_FILTERS: { id: PatternFilter; label: string }[] = [
  { id: 'all', label: 'All Tactics' },
  { id: 'equipment_check', label: 'Equipment Check' },
  { id: 'domain_spoof', label: 'Domain Spoof' },
  { id: 'fake_interview', label: 'Fake Interview' },
  { id: 'upfront_fee', label: 'Fee / Deposit' },
  { id: 'data_harvest', label: 'Data Harvest' },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All Statuses' },
  { id: 'confirmed', label: 'Confirmed Scam' },
  { id: 'flagged', label: 'Under Review' },
  { id: 'verified_safe', label: 'Verified Safe' },
];

const SEVERITY_RANK: Record<ScamReport['severity'], number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

export const LiveRadarFeed: React.FC<LiveRadarFeedProps> = ({
  reports,
  isLoading,
  wsStatus,
  activeWatchers,
  voterId,
  onToggleFlag,
  onInspectReport,
  onOpenReportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [patternFilter, setPatternFilter] = useState<PatternFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingFlagId, setPendingFlagId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const confirmedCount = reports.filter((r) => r.status === 'confirmed').length;
    const reviewCount = reports.filter((r) => r.status === 'flagged').length;
    const totalFlags = reports.reduce((sum, r) => sum + r.flagCount, 0);
    const impersonatedCount = reports.filter((r) => r.matchedTrustedEmployerId !== null && r.status !== 'verified_safe').length;
    return { confirmedCount, reviewCount, totalFlags, impersonatedCount };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reports.filter((r) => {
      if (patternFilter !== 'all' && r.pattern !== patternFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.companyName.toLowerCase().includes(q) ||
        r.roleTitle.toLowerCase().includes(q) ||
        r.suspiciousDomainOrContact.toLowerCase().includes(q) ||
        r.platform.toLowerCase().includes(q) ||
        r.postingSnippet.toLowerCase().includes(q) ||
        (r.matchedTrustedEmployerName?.toLowerCase().includes(q) ?? false)
      );
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'most_flagged') {
        return b.flagCount - a.flagCount;
      }
      if (sortMode === 'severity') {
        const diff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (diff !== 0) return diff;
        return b.flagCount - a.flagCount;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reports, searchQuery, patternFilter, statusFilter, sortMode]);

  async function handleCopyContact(e: React.MouseEvent, id: string, value: string) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // Clipboard blocked in restricted context
    }
  }

  async function handleFlagClick(e: React.MouseEvent, reportId: string) {
    e.stopPropagation();
    setPendingFlagId(reportId);
    try {
      await onToggleFlag(reportId);
    } finally {
      setPendingFlagId(null);
    }
  }

  return (
    <section id="radar" aria-labelledby="radar-heading" className="space-y-4">
      {/* Compact Workspace Summary Strip (4-column KPI strip with tabular numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="px-5 py-3.5">
          <div className="text-xs font-medium text-slate-500">Confirmed Scam Alerts</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-950 tabular-nums">
            {stats.confirmedCount}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs font-medium text-slate-500">Under Community Review</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-950 tabular-nums">
            {stats.reviewCount}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs font-medium text-slate-500">Employer Spoofs Caught</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-950 tabular-nums">
            {stats.impersonatedCount}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs font-medium text-slate-500">Total Student Confirmations</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-950 tabular-nums">
            {stats.totalFlags}
          </div>
        </div>
      </div>

      {/* Main 2-column Workspace: Left Rail (250px) + High-Density Real-Time Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Filter & Live Stream Rail */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-4 space-y-5">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              {wsStatus === 'connected' && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>
                {wsStatus === 'connected'
                  ? 'Real-time feed connected'
                  : wsStatus === 'connecting'
                    ? 'Connecting feed...'
                    : 'Reconnecting feed...'}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {activeWatchers} online
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Scam Tactic</div>
            <div className="flex flex-col gap-1">
              {PATTERN_FILTERS.map((item) => {
                const active = patternFilter === item.id;
                const count =
                  item.id === 'all'
                    ? reports.length
                    : reports.filter((r) => r.pattern === item.id).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPatternFilter(item.id)}
                    className={`w-full px-2.5 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      active
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span
                      className={`font-mono tabular-nums ${
                        active ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700">Verification Status</div>
            <div className="flex flex-col gap-1">
              {STATUS_FILTERS.map((item) => {
                const active = statusFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id)}
                    className={`w-full px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      active
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Main Radar Table / Feed */}
        <div className="lg:col-span-9 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2
                id="radar-heading"
                className="font-display text-lg font-bold text-slate-950"
              >
                Live Scam Radar Feed
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Showing {filteredReports.length} of {reports.length} reported internship postings
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-64">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search company, domain, role..."
                  aria-label="Search reported postings"
                  className="w-full pl-9 pr-3 py-1.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>

              <select
                aria-label="Sort reports"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="px-3 py-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
              >
                <option value="newest">Sort: Newest</option>
                <option value="most_flagged">Sort: Most Flagged</option>
                <option value="severity">Sort: Severity</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-slate-200" aria-busy="true" aria-label="Loading reports">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div key={idx} className="px-5 py-4 space-y-2 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                No reported postings match your current filters
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Clear your search query or report a new suspicious internship posting so other students can verify it.
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPatternFilter('all');
                    setStatusFilter('all');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={onOpenReportModal}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer"
                >
                  Report Posting
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredReports.map((report) => {
                const userFlagged = report.flaggedBy.includes(voterId);
                return (
                  <article
                    key={report.id}
                    onClick={() => onInspectReport(report)}
                    className="px-5 py-4 hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Primary Title + Unboxed Metadata */}
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <h3 className="font-display text-base font-bold text-slate-950 truncate">
                            {report.companyName}
                          </h3>
                          <span className="text-sm text-slate-600 truncate">
                            {report.roleTitle}
                          </span>
                        </div>

                        {/* Unboxed metadata separator line */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              report.status === 'confirmed'
                                ? 'text-red-700'
                                : report.status === 'verified_safe'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                            }`}
                          >
                            {report.status === 'confirmed' && (
                              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            {report.status === 'flagged' && (
                              <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            {report.status === 'verified_safe' && (
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            {STATUS_LABELS[report.status]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">
                            {PATTERN_LABELS[report.pattern]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{SEVERITY_LABELS[report.severity]}</span>
                          <span aria-hidden="true">·</span>
                          <span>{report.platform}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {formatRelativeTime(report.createdAt)}
                          </span>
                        </div>

                        {/* Non-clickable monospace suspicious domain / email with copy button */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <code className="text-xs font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded select-all">
                            {report.suspiciousDomainOrContact}
                          </code>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleCopyContact(e, report.id, report.suspiciousDomainOrContact)
                            }
                            aria-label="Copy reported domain or email"
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                          >
                            {copiedId === report.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" aria-hidden="true" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          {report.matchedTrustedEmployerName && (
                            <span className="text-xs text-slate-500">
                              · Impersonates{' '}
                              <strong className="font-semibold text-slate-700">
                                {report.matchedTrustedEmployerName}
                              </strong>
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {report.postingSnippet}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                          <span>
                            Reported by {report.reporterLabel} ({report.university})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <MessageSquare className="w-3 h-3" aria-hidden="true" />
                            {report.notes.length} note{report.notes.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>

                      {/* Right Interactive Action Column */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={pendingFlagId === report.id}
                          onClick={(e) => handleFlagClick(e, report.id)}
                          aria-pressed={userFlagged}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                            userFlagged
                              ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="tabular-nums">
                            {userFlagged ? 'Flagged' : 'Flag Too'} ({report.flagCount})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectReport(report);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-950 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Inspect Case
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
