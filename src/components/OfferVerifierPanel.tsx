import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { ScamReport, VerificationResult } from '../types/radar.ts';

interface OfferVerifierPanelProps {
  onVerify: (payload: {
    companyName: string;
    contactOrUrl: string;
    postingText: string;
  }) => Promise<VerificationResult>;
  onReportFromScan: (prefill: {
    companyName: string;
    contactOrUrl: string;
    postingSnippet: string;
  }) => void;
  onInspectReport: (report: ScamReport) => void;
}

const SAMPLE_PRESETS = [
  {
    label: 'Spoofed Stripe Check',
    companyName: 'Stripe',
    contactOrUrl: 'hr@stripe-onboarding.co',
    postingText:
      'Congratulations! We are sending you an e-check of $2,450 so you can purchase your home office equipment from our approved vendor before starting.',
  },
  {
    label: 'Telegram Design Interview',
    companyName: 'Figma',
    contactOrUrl: 'recruiting@figma-careers.org',
    postingText:
      'Please download Telegram and message our hiring manager for a 20-minute text-only interview. Immediate hire after SSN verification.',
  },
  {
    label: 'Official NVIDIA Portal',
    companyName: 'NVIDIA',
    contactOrUrl: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite',
    postingText:
      'Your technical interview with the Deep Learning Infrastructure team is scheduled via Microsoft Teams with @nvidia.com engineers.',
  },
];

export const OfferVerifierPanel: React.FC<OfferVerifierPanelProps> = ({
  onVerify,
  onReportFromScan,
  onInspectReport,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactOrUrl, setContactOrUrl] = useState('');
  const [postingText, setPostingText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() && !contactOrUrl.trim() && !postingText.trim()) {
      setErrorMsg('Enter a company name, recruiter email/URL, or posting text to scan.');
      return;
    }
    setErrorMsg(null);
    setIsScanning(true);
    try {
      const verdict = await onVerify({
        companyName: companyName.trim(),
        contactOrUrl: contactOrUrl.trim(),
        postingText: postingText.trim(),
      });
      setResult(verdict);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to verify posting right now.');
    } finally {
      setIsScanning(false);
    }
  }

  async function runPreset(preset: (typeof SAMPLE_PRESETS)[number]) {
    setCompanyName(preset.companyName);
    setContactOrUrl(preset.contactOrUrl);
    setPostingText(preset.postingText);
    setErrorMsg(null);
    setIsScanning(true);
    try {
      const verdict = await onVerify({
        companyName: preset.companyName,
        contactOrUrl: preset.contactOrUrl,
        postingText: preset.postingText,
      });
      setResult(verdict);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsScanning(false);
    }
  }

  function handleReset() {
    setCompanyName('');
    setContactOrUrl('');
    setPostingText('');
    setResult(null);
    setErrorMsg(null);
  }

  return (
    <section
      id="verify"
      aria-labelledby="verify-heading"
      className="bg-white border border-slate-200 rounded-lg"
    >
      <div className="px-5 py-4 sm:px-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1
            id="verify-heading"
            className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-950 text-balance"
          >
            Verify an internship offer or recruiter domain
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Cross-check recruiter emails, application links, and offer messages against active student scam reports and verified employer domains.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-slate-500">Test sample:</span>
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => runPreset(preset)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-5 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="scan-company"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Claimed employer name
              </label>
              <input
                id="scan-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Stripe, Figma, Apex Labs"
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="scan-contact"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Recruiter email or job URL
              </label>
              <input
                id="scan-contact"
                type="text"
                value={contactOrUrl}
                onChange={(e) => setContactOrUrl(e.target.value)}
                placeholder="e.g. hr@stripe-onboarding.co"
                className="w-full px-3 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="scan-text"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Posting snippet or recruiter message
            </label>
            <textarea
              id="scan-text"
              rows={3}
              value={postingText}
              onChange={(e) => setPostingText(e.target.value)}
              placeholder="Paste any interview instructions, equipment check wording, salary claims, or deposit requests..."
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-red-700" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isScanning}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-950 hover:bg-slate-800 disabled:opacity-60 rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                {isScanning ? 'Scanning...' : 'Scan Posting'}
              </button>

              {(companyName || contactOrUrl || postingText || result) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <span className="hidden sm:inline text-xs text-slate-500">
              Checks domain spoofing · Active reports · Scam scripts
            </span>
          </div>
        </form>

        <div className="lg:col-span-5 p-5 sm:p-6 bg-slate-50/70 flex flex-col justify-between">
          {!result ? (
            <div className="h-full flex flex-col justify-center space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <span>How instant verification works</span>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <li>1. Compares recruiter domains against verified corporate &amp; ATS portals to expose lookalike typosquatting.</li>
                <li>2. Matches sender emails and posting wording against live community scam reports.</li>
                <li>3. Flags advance-fee check scams, off-platform Telegram interviews, and premature SSN/ID requests.</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {result.verdict === 'verified_trusted' && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  {(result.verdict === 'lookalike_spoof' || result.verdict === 'community_flagged') && (
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  {result.verdict === 'high_risk_signals' && (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  {result.verdict === 'unverified' && (
                    <HelpCircle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}

                  <div>
                    <div
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        result.verdict === 'verified_trusted'
                          ? 'text-emerald-700'
                          : result.verdict === 'lookalike_spoof' || result.verdict === 'community_flagged'
                            ? 'text-red-700'
                            : result.verdict === 'high_risk_signals'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                      }`}
                    >
                      {result.verdict === 'verified_trusted' && 'Verified Official Domain'}
                      {result.verdict === 'lookalike_spoof' && 'Critical · Domain Spoof Detected'}
                      {result.verdict === 'community_flagged' && 'Flagged by Student Community'}
                      {result.verdict === 'high_risk_signals' && 'High Risk · Scam Patterns Found'}
                      {result.verdict === 'unverified' && 'Unverified Sender'}
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-950 mt-0.5">
                      {result.headline}
                    </h2>
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {result.summary}
              </p>

              {result.detectedSignals.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-800">
                    Detected risk signals
                  </div>
                  <ul className="space-y-1">
                    {result.detectedSignals.map((sig) => (
                      <li key={sig.label} className="text-xs text-slate-700">
                        <span className="font-semibold text-red-700">{sig.label}:</span>{' '}
                        {sig.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.matchingReports.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-800">
                    Matching community reports ({result.matchingReports.length})
                  </div>
                  <div className="space-y-1.5">
                    {result.matchingReports.slice(0, 2).map((rep) => (
                      <button
                        key={rep.id}
                        type="button"
                        onClick={() => onInspectReport(rep)}
                        className="w-full text-left px-2.5 py-2 bg-white border border-slate-200 hover:border-slate-400 rounded text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            {rep.companyName}
                          </span>
                          <span className="font-mono text-red-700 tabular-nums shrink-0">
                            {rep.flagCount} flags
                          </span>
                        </div>
                        <div className="font-mono text-slate-500 truncate mt-0.5">
                          {rep.suspiciousDomainOrContact}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {result.verdict !== 'verified_trusted' && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-600">
                    Seen this scam in your inbox?
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onReportFromScan({
                        companyName,
                        contactOrUrl,
                        postingSnippet: postingText,
                      })
                    }
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Flag to Live Radar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
