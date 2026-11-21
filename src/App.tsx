/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar, type NavSection } from './components/TopBar.tsx';
import { OfferVerifierPanel } from './components/OfferVerifierPanel.tsx';
import { LiveRadarFeed } from './components/LiveRadarFeed.tsx';
import { TrustedEmployersDirectory } from './components/TrustedEmployersDirectory.tsx';
import { ScamPatternsGuide } from './components/ScamPatternsGuide.tsx';
import { ReportDetailDrawer } from './components/ReportDetailDrawer.tsx';
import { ReportScamModal } from './components/ReportScamModal.tsx';
import { NominateEmployerModal } from './components/NominateEmployerModal.tsx';
import type {
  RadarWsEvent,
  ScamPattern,
  ScamReport,
  TrustedEmployer,
  VerificationResult,
} from './types/radar.ts';
import { getOrCreateVoterId } from './utils/formatters.ts';

export default function App() {
  const [voterId] = useState<string>(() => getOrCreateVoterId());
  const [reports, setReports] = useState<ScamReport[]>([]);
  const [employers, setEmployers] = useState<TrustedEmployer[]>([]);
  const [activeWatchers, setActiveWatchers] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting'>(
    'connecting'
  );

  const [activeSection, setActiveSection] = useState<NavSection>('verify');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportPrefill, setReportPrefill] = useState<{
    companyName?: string;
    contactOrUrl?: string;
    postingSnippet?: string;
  } | null>(null);
  const [isNominateModalOpen, setIsNominateModalOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 3200);
  }, []);

  const fetchFullState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        reports: ScamReport[];
        employers: TrustedEmployer[];
        activeWatchers: number;
      };
      setReports(data.reports);
      setEmployers(data.employers);
      setActiveWatchers(data.activeWatchers);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to reach InternRadar server.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFullState();
  }, [fetchFullState]);

  // WebSocket real-time synchronization with idempotent event handlers & reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let retryDelay = 1200;
    let isDisposed = false;

    function connect() {
      if (isDisposed) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws`;
        ws = new WebSocket(wsUrl);
      } catch {
        setWsStatus('reconnecting');
        return;
      }

      ws.onopen = () => {
        setWsStatus('connected');
        retryDelay = 1200;
        void fetchFullState();
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as RadarWsEvent;
          if (payload.type === 'presence:count') {
            setActiveWatchers(Math.max(1, payload.count));
          } else if (payload.type === 'report:created') {
            setReports((prev) => {
              if (prev.some((r) => r.id === payload.report.id)) return prev;
              return [payload.report, ...prev];
            });
          } else if (payload.type === 'report:updated') {
            setReports((prev) =>
              prev.map((r) => (r.id === payload.report.id ? payload.report : r))
            );
          } else if (payload.type === 'employer:created') {
            setEmployers((prev) => {
              if (prev.some((e) => e.id === payload.employer.id)) return prev;
              return [payload.employer, ...prev];
            });
          } else if (payload.type === 'employer:updated') {
            setEmployers((prev) =>
              prev.map((e) => (e.id === payload.employer.id ? payload.employer : e))
            );
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      ws.onclose = () => {
        if (isDisposed) return;
        setWsStatus('reconnecting');
        reconnectTimer = window.setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.6, 10_000);
          connect();
        }, retryDelay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [fetchFullState]);

  function handleNavigate(section: NavSection) {
    setActiveSection(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleVerifyPosting(payload: {
    companyName: string;
    contactOrUrl: string;
    postingText: string;
  }): Promise<VerificationResult> {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Verification failed.');
    }
    return data as VerificationResult;
  }

  async function handleCreateReport(payload: {
    companyName: string;
    roleTitle: string;
    platform: string;
    suspiciousDomainOrContact: string;
    postingSnippet: string;
    pattern: ScamPattern;
    reporterLabel: string;
    university: string;
  }) {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, voterId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to publish report.');
    }
    const created = data as ScamReport;
    setReports((prev) => {
      if (prev.some((r) => r.id === created.id)) return prev;
      return [created, ...prev];
    });
    showToast(`Alert published for ${created.companyName}`);
    handleNavigate('radar');
  }

  async function handleToggleFlag(reportId: string) {
    const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Unable to update flag.');
      return;
    }
    const updated = data as ScamReport;
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleVoteStatus(
    reportId: string,
    action: 'confirm_scam' | 'mark_safe'
  ) {
    const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Unable to record vote.');
      return;
    }
    const updated = data as ScamReport;
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    showToast(
      action === 'mark_safe'
        ? 'Recorded community safe verification vote'
        : 'Confirmed suspicious scam report'
    );
  }

  async function handleAddNote(
    reportId: string,
    payload: {
      author: string;
      university: string;
      text: string;
      stance: 'corroborate' | 'dispute_safe';
    }
  ) {
    const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to post note.');
    }
    const updated = data as ScamReport;
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    showToast('Evidence note added to case');
  }

  async function handleToggleVouch(employerId: string) {
    const res = await fetch(`/api/employers/${encodeURIComponent(employerId)}/vouch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Unable to update vouch.');
      return;
    }
    const updated = data as TrustedEmployer;
    setEmployers((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  async function handleNominateEmployer(payload: {
    name: string;
    industry: string;
    headquarters: string;
    officialDomain: string;
    atsPortal: string;
    hiringPolicyNote: string;
    nominatedBy: string;
  }) {
    const res = await fetch('/api/employers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, voterId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to nominate employer.');
    }
    const created = data as TrustedEmployer;
    setEmployers((prev) => {
      if (prev.some((e) => e.id === created.id)) return prev;
      return [created, ...prev];
    });
    showToast(`${created.name} added to Trusted Employers Registry`);
  }

  const selectedReport =
    selectedReportId ? reports.find((r) => r.id === selectedReportId) ?? null : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onOpenReportModal={() => {
          setReportPrefill(null);
          setIsReportModalOpen(true);
        }}
      />

      {/* Mobile section jump bar (non-sticky so sticky height stays well under 15%) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium text-slate-600">
        <button type="button" onClick={() => handleNavigate('radar')} className="whitespace-nowrap shrink-0 hover:text-slate-950">
          Live Radar
        </button>
        <button type="button" onClick={() => handleNavigate('verify')} className="whitespace-nowrap shrink-0 hover:text-slate-950">
          Verify Offer
        </button>
        <button type="button" onClick={() => handleNavigate('employers')} className="whitespace-nowrap shrink-0 hover:text-slate-950">
          Trusted Employers
        </button>
        <button type="button" onClick={() => handleNavigate('patterns')} className="whitespace-nowrap shrink-0 hover:text-slate-950">
          Scam Patterns
        </button>
      </div>

      <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {loadError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4 text-sm text-red-800"
          >
            <span>Could not sync radar database: {loadError}</span>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                void fetchFullState();
              }}
              className="px-3 py-1 text-xs font-semibold bg-white border border-red-300 rounded hover:bg-red-100 cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        <OfferVerifierPanel
          onVerify={handleVerifyPosting}
          onReportFromScan={(prefill) => {
            setReportPrefill(prefill);
            setIsReportModalOpen(true);
          }}
          onInspectReport={(rep) => setSelectedReportId(rep.id)}
        />

        <LiveRadarFeed
          reports={reports}
          isLoading={isLoading}
          wsStatus={wsStatus}
          activeWatchers={activeWatchers}
          voterId={voterId}
          onToggleFlag={handleToggleFlag}
          onInspectReport={(rep) => setSelectedReportId(rep.id)}
          onOpenReportModal={() => {
            setReportPrefill(null);
            setIsReportModalOpen(true);
          }}
        />

        <TrustedEmployersDirectory
          employers={employers}
          reports={reports}
          voterId={voterId}
          onToggleVouch={handleToggleVouch}
          onOpenNominateModal={() => setIsNominateModalOpen(true)}
        />

        <ScamPatternsGuide reports={reports} />
      </main>

      <footer className="bg-white border-t border-slate-200 mt-8">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <strong className="font-semibold text-slate-800">InternRadar</strong> · Community-driven internship threat intelligence and verified employer registry.
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setReportPrefill(null);
                setIsReportModalOpen(true);
              }}
              className="hover:text-slate-900 underline underline-offset-2 cursor-pointer"
            >
              Report a Posting
            </button>
            <button
              type="button"
              onClick={() => setIsNominateModalOpen(true)}
              className="hover:text-slate-900 underline underline-offset-2 cursor-pointer"
            >
              Nominate Trusted Employer
            </button>
          </div>
        </div>
      </footer>

      <ReportDetailDrawer
        report={selectedReport}
        employers={employers}
        voterId={voterId}
        onClose={() => setSelectedReportId(null)}
        onVoteStatus={handleVoteStatus}
        onAddNote={handleAddNote}
      />

      <ReportScamModal
        isOpen={isReportModalOpen}
        employers={employers}
        initialValues={reportPrefill}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleCreateReport}
      />

      <NominateEmployerModal
        isOpen={isNominateModalOpen}
        onClose={() => setIsNominateModalOpen(false)}
        onSubmit={handleNominateEmployer}
      />

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-950 text-white text-xs sm:text-sm font-medium rounded-md shadow-lg border border-slate-800"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
