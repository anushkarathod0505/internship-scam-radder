import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Plus,
  Search,
  ShieldCheck,
  ThumbsUp,
} from 'lucide-react';
import type {
  EmployerTrustTier,
  ScamReport,
  TrustedEmployer,
} from '../types/radar.ts';
import { TIER_LABELS } from '../utils/formatters.ts';

interface TrustedEmployersDirectoryProps {
  employers: TrustedEmployer[];
  reports: ScamReport[];
  voterId: string;
  onToggleVouch: (employerId: string) => Promise<void>;
  onOpenNominateModal: () => void;
}

type TierFilter = 'all' | EmployerTrustTier;

const TIER_FILTERS: { id: TierFilter; label: string }[] = [
  { id: 'all', label: 'All Employers' },
  { id: 'campus_confirmed', label: 'Campus Confirmed' },
  { id: 'community_verified', label: 'Community Verified' },
  { id: 'pending', label: 'Pending Review' },
];

export const TrustedEmployersDirectory: React.FC<TrustedEmployersDirectoryProps> = ({
  employers,
  reports,
  voterId,
  onToggleVouch,
  onOpenNominateModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [pendingVouchId, setPendingVouchId] = useState<string | null>(null);

  const spoofCountsByEmployer = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      if (r.matchedTrustedEmployerId && r.status !== 'verified_safe') {
        map.set(
          r.matchedTrustedEmployerId,
          (map.get(r.matchedTrustedEmployerId) ?? 0) + 1
        );
      }
    }
    return map;
  }, [reports]);

  const filteredEmployers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employers
      .filter((emp) => {
        if (tierFilter !== 'all' && emp.tier !== tierFilter) return false;
        if (!q) return true;
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.industry.toLowerCase().includes(q) ||
          emp.officialDomains.some((d) => d.toLowerCase().includes(q)) ||
          emp.atsPortals.some((a) => a.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.vouchCount - a.vouchCount);
  }, [employers, searchQuery, tierFilter]);

  async function handleVouch(employerId: string) {
    setPendingVouchId(employerId);
    try {
      await onToggleVouch(employerId);
    } finally {
      setPendingVouchId(null);
    }
  }

  return (
    <section
      id="employers"
      aria-labelledby="employers-heading"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-4 sm:px-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2
            id="employers-heading"
            className="font-display text-lg sm:text-xl font-bold text-slate-950"
          >
            Community Trusted Employers Registry
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Official corporate hiring domains and ATS portals verified by students and campus career offices. Pending nominations promote automatically at 3 community vouches.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNominateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nominate Employer
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="px-5 py-3 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-md">
          {TIER_FILTERS.map((item) => {
            const active = tierFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTierFilter(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter company, domain, ATS..."
            aria-label="Filter trusted employers"
            className="w-full pl-9 pr-3 py-1.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* High-Density Employer Table */}
      {filteredEmployers.length === 0 ? (
        <div className="px-6 py-12 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            No trusted employers match "{searchQuery}"
          </p>
          <p className="text-xs text-slate-500">
            Verify an employer’s official domain and nominate it to help fellow students avoid lookalike scams.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/40">
                <th className="py-3 px-5">Employer</th>
                <th className="py-3 px-4">Verified Domain &amp; ATS</th>
                <th className="py-3 px-4">Recruiting Guardrails</th>
                <th className="py-3 px-4">Trust Tier</th>
                <th className="py-3 px-4 text-right">Spoofs</th>
                <th className="py-3 px-5 text-right">Community Vouch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredEmployers.map((emp) => {
                const userVouched = emp.vouchedBy.includes(voterId);
                const spoofCount = spoofCountsByEmployer.get(emp.id) ?? 0;

                return (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50/70 transition-colors align-top"
                  >
                    <td className="py-3.5 px-5 min-w-[180px]">
                      <div className="font-display font-bold text-slate-950">
                        {emp.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {emp.industry} · {emp.headquarters}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 min-w-[210px]">
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        {emp.officialDomains.join(', ')}
                      </div>
                      <div className="font-mono text-xs text-slate-500 mt-0.5 break-all">
                        {emp.atsPortals.join(' · ')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-sm">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {emp.hiringPolicyNote}
                      </p>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Verified via {emp.nominatedBy}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          emp.tier === 'campus_confirmed'
                            ? 'text-emerald-700'
                            : emp.tier === 'community_verified'
                              ? 'text-slate-900'
                              : 'text-amber-700'
                        }`}
                      >
                        {emp.tier === 'campus_confirmed' && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        )}
                        {emp.tier === 'community_verified' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                        )}
                        {emp.tier === 'pending' && (
                          <Clock className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        )}
                        {TIER_LABELS[emp.tier]}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                      {spoofCount > 0 ? (
                        <span className="font-semibold text-red-700">
                          {spoofCount} active
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={pendingVouchId === emp.id}
                        onClick={() => handleVouch(emp.id)}
                        aria-pressed={userVouched}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                          userVouched
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="tabular-nums">
                          {userVouched ? 'Vouched' : 'Vouch'} ({emp.vouchCount})
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
