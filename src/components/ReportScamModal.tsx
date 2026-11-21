import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { ScamPattern, TrustedEmployer } from '../types/radar.ts';
import { extractDomainFromInput, findTrustedEmployerMatch } from '../utils/scamScanner.ts';

interface ReportScamModalProps {
  isOpen: boolean;
  employers: TrustedEmployer[];
  initialValues?: {
    companyName?: string;
    contactOrUrl?: string;
    postingSnippet?: string;
  } | null;
  onClose: () => void;
  onSubmit: (payload: {
    companyName: string;
    roleTitle: string;
    platform: string;
    suspiciousDomainOrContact: string;
    postingSnippet: string;
    pattern: ScamPattern;
    reporterLabel: string;
    university: string;
  }) => Promise<void>;
}

const PLATFORMS = [
  'LinkedIn',
  'Handshake',
  'Indeed',
  'Cold Email',
  'Discord / Slack',
  'University Board',
  'Other',
];

const PATTERNS: { value: ScamPattern; label: string }[] = [
  { value: 'equipment_check', label: 'Equipment Check / Reimbursement Scam' },
  { value: 'domain_spoof', label: 'Lookalike Domain / Recruiter Spoof' },
  { value: 'fake_interview', label: 'Off-Platform Telegram / WhatsApp Interview' },
  { value: 'upfront_fee', label: 'Upfront Training, Visa, or Screening Fee' },
  { value: 'data_harvest', label: 'Premature SSN / Banking / Malware Repo' },
];

export const ReportScamModal: React.FC<ReportScamModalProps> = ({
  isOpen,
  employers,
  initialValues,
  onClose,
  onSubmit,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [platform, setPlatform] = useState('LinkedIn');
  const [suspiciousDomainOrContact, setSuspiciousDomainOrContact] = useState('');
  const [pattern, setPattern] = useState<ScamPattern>('domain_spoof');
  const [postingSnippet, setPostingSnippet] = useState('');
  const [reporterLabel, setReporterLabel] = useState('');
  const [university, setUniversity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCompanyName(initialValues?.companyName ?? '');
      setSuspiciousDomainOrContact(initialValues?.contactOrUrl ?? '');
      setPostingSnippet(initialValues?.postingSnippet ?? '');
      setErrorMsg(null);
    }
  }, [isOpen, initialValues]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const liveMatch = useMemo(() => {
    const domain = extractDomainFromInput(suspiciousDomainOrContact);
    return findTrustedEmployerMatch(companyName, domain, employers);
  }, [companyName, suspiciousDomainOrContact, employers]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !companyName.trim() ||
      !roleTitle.trim() ||
      !suspiciousDomainOrContact.trim() ||
      !postingSnippet.trim()
    ) {
      setErrorMsg('Please fill out company name, role title, suspicious domain/contact, and what happened.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        companyName: companyName.trim(),
        roleTitle: roleTitle.trim(),
        platform,
        suspiciousDomainOrContact: suspiciousDomainOrContact.trim(),
        postingSnippet: postingSnippet.trim(),
        pattern,
        reporterLabel: reporterLabel.trim() || 'Anonymous Student',
        university: university.trim() || 'Campus Community',
      });
      setRoleTitle('');
      setPostingSnippet('');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200 rounded-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2
              id="report-modal-title"
              className="font-display text-lg font-bold text-slate-950"
            >
              Report Suspicious Internship Posting
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Broadcasts immediately to the Live Scam Radar for all connected students.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
            className="p-2 text-slate-500 hover:text-slate-950 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rep-company" className="block text-xs font-semibold text-slate-700 mb-1">
                Claimed Company / Alias *
              </label>
              <input
                id="rep-company"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Stripe Talent Portal (Spoof)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="rep-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Internship Role Title *
              </label>
              <input
                id="rep-role"
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Remote SWE Intern"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rep-contact" className="block text-xs font-semibold text-slate-700 mb-1">
                Suspicious Domain, Email, or URL *
              </label>
              <input
                id="rep-contact"
                type="text"
                required
                value={suspiciousDomainOrContact}
                onChange={(e) => setSuspiciousDomainOrContact(e.target.value)}
                placeholder="e.g. hr@stripe-onboarding.co"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="rep-platform" className="block text-xs font-semibold text-slate-700 mb-1">
                Platform Found
              </label>
              <select
                id="rep-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {liveMatch.spoofedEmployer && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Domain does not match official <strong>{liveMatch.spoofedEmployer.name}</strong> domains (
                <span className="font-mono">
                  {liveMatch.spoofedEmployer.officialDomains.join(', ')}
                </span>
                ). This report will be linked as an active impersonation alert.
              </span>
            </div>
          )}

          <div>
            <label htmlFor="rep-pattern" className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Scam Tactic
            </label>
            <select
              id="rep-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value as ScamPattern)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {PATTERNS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rep-snippet" className="block text-xs font-semibold text-slate-700 mb-1">
              What Happened / Evidence Snippet *
            </label>
            <textarea
              id="rep-snippet"
              rows={3}
              required
              value={postingSnippet}
              onChange={(e) => setPostingSnippet(e.target.value)}
              placeholder="Describe the red flags, check amount, chat app requested, or recruiter alias..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rep-author" className="block text-xs font-semibold text-slate-700 mb-1">
                Your Name / Initials (optional)
              </label>
              <input
                id="rep-author"
                type="text"
                value={reporterLabel}
                onChange={(e) => setReporterLabel(e.target.value)}
                placeholder="Anonymous Student"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="rep-uni" className="block text-xs font-semibold text-slate-700 mb-1">
                University / Campus (optional)
              </label>
              <input
                id="rep-uni"
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g. University of Michigan"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-red-700" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-950 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Publishing Alert...' : 'Publish Scam Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
