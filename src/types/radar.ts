export type ScamPattern =
  | 'equipment_check'
  | 'domain_spoof'
  | 'fake_interview'
  | 'upfront_fee'
  | 'data_harvest';

export type ReportStatus = 'flagged' | 'confirmed' | 'verified_safe';

export type SeverityLevel = 'critical' | 'high' | 'medium';

export interface EvidenceNote {
  id: string;
  author: string;
  university: string;
  text: string;
  stance: 'corroborate' | 'dispute_safe';
  createdAt: string;
}

export interface ScamReport {
  id: string;
  companyName: string;
  roleTitle: string;
  platform: string;
  suspiciousDomainOrContact: string;
  postingSnippet: string;
  pattern: ScamPattern;
  severity: SeverityLevel;
  status: ReportStatus;
  redFlags: string[];
  matchedTrustedEmployerId: string | null;
  matchedTrustedEmployerName: string | null;
  reporterLabel: string;
  university: string;
  flagCount: number;
  flaggedBy: string[];
  safeVotes: number;
  safeVotedBy: string[];
  notes: EvidenceNote[];
  createdAt: string;
  updatedAt: string;
}

export type EmployerTrustTier = 'campus_confirmed' | 'community_verified' | 'pending';

export interface TrustedEmployer {
  id: string;
  name: string;
  industry: string;
  headquarters: string;
  officialDomains: string[];
  atsPortals: string[];
  hiringPolicyNote: string;
  tier: EmployerTrustTier;
  vouchCount: number;
  vouchedBy: string[];
  nominatedBy: string;
  createdAt: string;
}

export type VerificationVerdict =
  | 'verified_trusted'
  | 'lookalike_spoof'
  | 'community_flagged'
  | 'high_risk_signals'
  | 'unverified';

export interface VerificationResult {
  verdict: VerificationVerdict;
  headline: string;
  summary: string;
  extractedDomain: string | null;
  matchedEmployer: TrustedEmployer | null;
  spoofedEmployer: TrustedEmployer | null;
  matchingReports: ScamReport[];
  detectedSignals: {
    label: string;
    detail: string;
    severity: SeverityLevel;
  }[];
  guidance: string[];
}

export type RadarWsEvent =
  | { type: 'presence:count'; count: number }
  | { type: 'report:created'; report: ScamReport }
  | { type: 'report:updated'; report: ScamReport }
  | { type: 'employer:created'; employer: TrustedEmployer }
  | { type: 'employer:updated'; employer: TrustedEmployer };
