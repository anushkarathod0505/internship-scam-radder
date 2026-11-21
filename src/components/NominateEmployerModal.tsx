import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface NominateEmployerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    industry: string;
    headquarters: string;
    officialDomain: string;
    atsPortal: string;
    hiringPolicyNote: string;
    nominatedBy: string;
  }) => Promise<void>;
}

export const NominateEmployerModal: React.FC<NominateEmployerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [officialDomain, setOfficialDomain] = useState('');
  const [atsPortal, setAtsPortal] = useState('');
  const [hiringPolicyNote, setHiringPolicyNote] = useState('');
  const [nominatedBy, setNominatedBy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !officialDomain.trim()) {
      setErrorMsg('Employer name and official corporate domain are required.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        industry: industry.trim() || 'Technology',
        headquarters: headquarters.trim() || 'United States',
        officialDomain: officialDomain.trim(),
        atsPortal: atsPortal.trim(),
        hiringPolicyNote:
          hiringPolicyNote.trim() ||
          'Verify recruiter correspondence strictly from the official corporate domain.',
        nominatedBy: nominatedBy.trim() || 'Student Contributor',
      });
      setName('');
      setIndustry('');
      setHeadquarters('');
      setOfficialDomain('');
      setAtsPortal('');
      setHiringPolicyNote('');
      setNominatedBy('');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to nominate employer.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nominate-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2
              id="nominate-modal-title"
              className="font-display text-lg font-bold text-slate-950"
            >
              Nominate Trusted Employer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enters as Pending Review and promotes to Community Verified at 3 student vouches.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close nomination modal"
            className="p-2 text-slate-500 hover:text-slate-950 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nom-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Company Name *
              </label>
              <input
                id="nom-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Anthropic"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="nom-domain" className="block text-xs font-semibold text-slate-700 mb-1">
                Official Domain *
              </label>
              <input
                id="nom-domain"
                type="text"
                required
                value={officialDomain}
                onChange={(e) => setOfficialDomain(e.target.value)}
                placeholder="e.g. anthropic.com"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nom-industry" className="block text-xs font-semibold text-slate-700 mb-1">
                Industry
              </label>
              <input
                id="nom-industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. AI Safety & Research"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="nom-hq" className="block text-xs font-semibold text-slate-700 mb-1">
                Headquarters
              </label>
              <input
                id="nom-hq"
                type="text"
                value={headquarters}
                onChange={(e) => setHeadquarters(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nom-ats" className="block text-xs font-semibold text-slate-700 mb-1">
              Official Careers / ATS URL (optional)
            </label>
            <input
              id="nom-ats"
              type="text"
              value={atsPortal}
              onChange={(e) => setAtsPortal(e.target.value)}
              placeholder="e.g. boards.greenhouse.io/anthropic"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label htmlFor="nom-policy" className="block text-xs font-semibold text-slate-700 mb-1">
              Verified Hiring Channel Notes
            </label>
            <textarea
              id="nom-policy"
              rows={2}
              value={hiringPolicyNote}
              onChange={(e) => setHiringPolicyNote(e.target.value)}
              placeholder="e.g. Recruiter outreach uses @anthropic.com; interviews scheduled via Greenhouse."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label htmlFor="nom-by" className="block text-xs font-semibold text-slate-700 mb-1">
              Nominated By (Student Org / Campus)
            </label>
            <input
              id="nom-by"
              type="text"
              value={nominatedBy}
              onChange={(e) => setNominatedBy(e.target.value)}
              placeholder="e.g. MIT EECS Undergraduate Association"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
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
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-950 hover:bg-slate-800 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Adding...' : 'Submit Employer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
