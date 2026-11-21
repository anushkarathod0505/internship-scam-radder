import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Flag,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ScamReport, TrustedEmployer } from '../types/radar.ts';
import {
  formatRelativeTime,
  PATTERN_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '../utils/formatters.ts';

interface ReportDetailDrawerProps {
  report: ScamReport | null;
  employers: TrustedEmployer[];
  voterId: string;
  onClose: () => void;
  onVoteStatus: (reportId: string, action: 'confirm_scam' | 'mark_safe') => Promise<void>;
  onAddNote: (
    reportId: string,
    payload: {
      author: string;
      university: string;
      text: string;
      stance: 'corroborate' | 'dispute_safe';
    }
  ) => Promise<void>;
}

export const ReportDetailDrawer: React.FC<ReportDetailDrawerProps> = ({
  report,
  employers,
  voterId,
  onClose,
  onVoteStatus,
  onAddNote,
}) => {
  const [author, setAuthor] = useState('');
  const [university, setUniversity] = useState('');
  const [stance, setStance] = useState<'corroborate' | 'dispute_safe'>('corroborate');
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!report) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [report, onClose]);

  if (!report) return null;

  const matchedEmployer = report.matchedTrustedEmployerId
    ? employers.find((e) => e.id === report.matchedTrustedEmployerId) ?? null
    : null;

  const userFlagged = report.flaggedBy.includes(voterId);
  const userVotedSafe = report.safeVotedBy.includes(voterId);

  async function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!report) return;
    if (!noteText.trim()) {
      setErrorMsg('Write a brief evidence note before submitting.');
      return;
    }
    setErrorMsg(null);
    setIsSubmittingNote(true);
    try {
      await onAddNote(report.id, {
        author: author.trim() || 'Student Reviewer',
        university: university.trim() || 'Campus Community',
        text: noteText.trim(),
        stance,
      });
      setNoteText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save note.');
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleVote(action: 'confirm_scam' | 'mark_safe') {
    if (!report) return;
    setIsVoting(true);
    try {
      await onVoteStatus(report.id, action);
    } finally {
      setIsVoting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-report-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white h-full border-l border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold">
              {report.status === 'confirmed' && (
                <span className="inline-flex items-center gap-1 text-red-700">
                  <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  {STATUS_LABELS[report.status]}
                </span>
              )}
              {report.status === 'flagged' && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" />
                  {STATUS_LABELS[report.status]}
                </span>
              )}
              {report.status === 'verified_safe' && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {STATUS_LABELS[report.status]}
                </span>
              )}
              <span className="text-slate-400" aria-hidden="true">·</span>
              <span className="text-slate-600">{PATTERN_LABELS[report.pattern]}</span>
              <span className="text-slate-400" aria-hidden="true">·</span>
              <span className="text-slate-600">{SEVERITY_LABELS[report.severity]}</span>
            </div>
            <h2
              id="drawer-report-title"
              className="font-display text-xl font-bold text-slate-950 mt-1"
            >
              {report.companyName}
            </h2>
            <p className="text-sm text-slate-600">
              {report.roleTitle} · Found on {report.platform} · {formatRelativeTime(report.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report inspection"
            className="p-2 text-slate-500 hover:text-slate-950 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Reported Contact & Evidence */}
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Suspicious Domain / Recruiter Contact (non-clickable for safety)
              </div>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded font-mono text-sm text-slate-900 select-all break-all">
                {report.suspiciousDomainOrContact}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Student Evidence Summary
              </div>
              <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 border border-slate-200 rounded p-3.5">
                {report.postingSnippet}
              </p>
            </div>

            {report.redFlags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">
                  Identified Red Flags
                </div>
                <ul className="space-y-1.5">
                  {report.redFlags.map((flag) => (
                    <li
                      key={flag}
                      className="text-xs sm:text-sm text-red-800 flex items-start gap-2"
                    >
                      <span className="font-bold mt-0.5" aria-hidden="true">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Trusted Employer Cross-Reference */}
          {matchedEmployer && (
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-md space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Trusted Employer Registry Reference: {matchedEmployer.name}</span>
              </div>
              <div className="text-xs text-slate-700 space-y-1">
                <div>
                  Official domains:{' '}
                  <span className="font-mono font-semibold text-slate-950">
                    {matchedEmployer.officialDomains.join(', ')}
                  </span>
                </div>
                <div>
                  Verified ATS portals:{' '}
                  <span className="font-mono text-slate-800">
                    {matchedEmployer.atsPortals.join(', ')}
                  </span>
                </div>
                <p className="text-slate-600 pt-1">{matchedEmployer.hiringPolicyNote}</p>
              </div>
            </div>
          )}

          {/* Community Verification Votes */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Community Verification Consensus
              </span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {report.flagCount} scam flags · {report.safeVotes} safe votes
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isVoting}
                onClick={() => handleVote('confirm_scam')}
                className={`px-3 py-2 text-xs font-semibold rounded-md border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  userFlagged
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                }`}
              >
                <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular-nums">
                  {userFlagged ? 'Flagged Scam' : 'Confirm Scam'} ({report.flagCount})
                </span>
              </button>

              <button
                type="button"
                disabled={isVoting}
                onClick={() => handleVote('mark_safe')}
                className={`px-3 py-2 text-xs font-semibold rounded-md border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  userVotedSafe
                    ? 'bg-emerald-700 border-emerald-700 text-white'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular-nums">
                  {userVotedSafe ? 'Voted Safe' : 'Verify Safe'} ({report.safeVotes})
                </span>
              </button>
            </div>
          </div>

          {/* Community Evidence Notes */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-950">
              Community Evidence Notes ({report.notes.length})
            </h3>

            {report.notes.length === 0 ? (
              <p className="text-xs text-slate-500">
                No corroborating notes yet. Add recruiter aliases, email headers, or campus career office confirmations below.
              </p>
            ) : (
              <div className="space-y-3">
                {report.notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {note.author} · <span className="font-normal text-slate-600">{note.university}</span>
                      </span>
                      <span
                        className={`font-semibold ${
                          note.stance === 'dispute_safe' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {note.stance === 'dispute_safe' ? 'Verified Safe' : 'Corroborates Scam'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {note.text}
                    </p>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {formatRelativeTime(note.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleNoteSubmit} className="space-y-3 pt-2 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-800">
                Add student evidence note
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name or initials (optional)"
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="University (e.g. Purdue)"
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="note-stance"
                    checked={stance === 'corroborate'}
                    onChange={() => setStance('corroborate')}
                  />
                  <span>Corroborates scam</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="note-stance"
                    checked={stance === 'dispute_safe'}
                    onChange={() => setStance('dispute_safe')}
                  />
                  <span>Verified legitimate</span>
                </label>
              </div>

              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Share matching recruiter aliases, domain headers, or career center feedback..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />

              {errorMsg && (
                <p className="text-xs text-red-700" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmittingNote}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
              >
                {isSubmittingNote ? 'Posting...' : 'Post Evidence Note'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
