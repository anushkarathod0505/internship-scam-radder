import React from 'react';
import type { ScamPattern, ScamReport } from '../types/radar.ts';

interface ScamPatternsGuideProps {
  reports: ScamReport[];
}

const PATTERN_GUIDE: {
  pattern: ScamPattern;
  title: string;
  indicator: string;
  defense: string;
}[] = [
  {
    pattern: 'equipment_check',
    title: '01. Home-Office Equipment Check Fraud',
    indicator:
      'Sends a digital or paper check for $1,500–$3,500 and instructs you to pay their "certified IT vendor" via Zelle, wire, or gift cards before the check bounces.',
    defense:
      'Legitimate employers ship pre-provisioned laptops directly from corporate IT. Never deposit a hiring check or forward funds to a third-party vendor.',
  },
  {
    pattern: 'domain_spoof',
    title: '02. Lookalike Domain Impersonation',
    indicator:
      'Registers domains like stripe-onboarding.co or figma-careers.org that mimic well-known companies while routing outside official ATS portals.',
    defense:
      'Compare the exact @domain after the symbol against InternRadar’s Trusted Employers Registry. Subdomains only count if the root domain matches.',
  },
  {
    pattern: 'fake_interview',
    title: '03. Off-Platform Text-Only Interviews',
    indicator:
      'Directs students to Telegram, WhatsApp, or Signal for a questionnaire-style interview with no live video call or verifiable engineer.',
    defense:
      'Real internships always involve a live voice or video interview scheduled from a corporate calendar domain.',
  },
  {
    pattern: 'upfront_fee',
    title: '04. Upfront Training, Visa, or Screening Fees',
    indicator:
      'Charges $50–$400 for a "refundable background check," proprietary training module, or badge deposit prior to onboarding.',
    defense:
      'Employers absorb 100% of background checks, onboarding, and software licensing costs for legitimate interns.',
  },
  {
    pattern: 'data_harvest',
    title: '05. Premature Identity & Code Repo Traps',
    indicator:
      'Collects SSNs, passport scans, and W-4 forms before a formal ATS offer—or sends malicious take-home repositories in Discord DMs.',
    defense:
      'Submit tax and I-9 verification strictly inside verified portals (Workday, Greenhouse, Rippling) after signing a verified offer.',
  },
];

export const ScamPatternsGuide: React.FC<ScamPatternsGuideProps> = ({ reports }) => {
  return (
    <section
      id="patterns"
      aria-labelledby="patterns-heading"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-4 sm:px-6 border-b border-slate-200">
        <h2
          id="patterns-heading"
          className="font-display text-lg sm:text-xl font-bold text-slate-950"
        >
          Common Internship Scam Patterns
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Tactics observed across active student reports in the InternRadar database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        {PATTERN_GUIDE.map((item) => {
          const activeCount = reports.filter(
            (r) => r.pattern === item.pattern && r.status !== 'verified_safe'
          ).length;

          return (
            <div key={item.pattern} className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="text-xs font-mono font-semibold text-red-700 tabular-nums">
                  {activeCount} active report{activeCount === 1 ? '' : 's'}
                </div>
                <h3 className="font-display text-sm font-bold text-slate-950 leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.indicator}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200 text-xs text-slate-800 leading-relaxed">
                <strong className="font-semibold text-slate-950">Verification rule:</strong>{' '}
                {item.defense}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
