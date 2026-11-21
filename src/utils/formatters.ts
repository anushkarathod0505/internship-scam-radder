import type {
  EmployerTrustTier,
  ReportStatus,
  ScamPattern,
  SeverityLevel,
} from '../types/radar.ts';

export const PATTERN_LABELS: Record<ScamPattern, string> = {
  equipment_check: 'Equipment Check',
  domain_spoof: 'Domain Spoof',
  fake_interview: 'Fake Interview',
  upfront_fee: 'Fee / Deposit',
  data_harvest: 'Data Harvest',
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  confirmed: 'Confirmed Scam',
  flagged: 'Flagged · Under Review',
  verified_safe: 'Verified Safe',
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  critical: 'Critical Risk',
  high: 'High Risk',
  medium: 'Moderate Risk',
};

export const TIER_LABELS: Record<EmployerTrustTier, string> = {
  campus_confirmed: 'Campus Confirmed',
  community_verified: 'Community Verified',
  pending: 'Pending Review',
};

export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return 'Just now';
  }
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getOrCreateVoterId(): string {
  const storageKey = 'internradar_voter_id';
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing && existing.length >= 6) {
      return existing;
    }
    const created = `stu-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return `stu-session-${Math.random().toString(36).slice(2, 10)}`;
  }
}
