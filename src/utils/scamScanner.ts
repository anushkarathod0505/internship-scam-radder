import type {
  ScamReport,
  SeverityLevel,
  TrustedEmployer,
  VerificationResult,
} from '../types/radar.ts';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'proton.me',
  'protonmail.com',
  'icloud.com',
  'aol.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
]);

const SIGNAL_RULES: {
  id: string;
  label: string;
  detail: string;
  severity: SeverityLevel;
  regex: RegExp;
}[] = [
  {
    id: 'equipment_check',
    label: 'Home-office equipment check scam',
    detail:
      'Legitimate employers ship company-managed hardware directly—they never mail a check or ask interns to pay a "verified vendor."',
    severity: 'critical',
    regex:
      /\b(send (you )?a check|mobile deposit|e-?check|home office (equipment|stipend|setup)|approved vendor|purchase (your )?(laptop|equipment)|reimburse.*vendor|cashier'?s check)\b/i,
  },
  {
    id: 'off_platform_chat',
    label: 'Off-platform encrypted/text interview',
    detail:
      'Asking candidates to interview solely via Telegram, WhatsApp, or Signal text messages is a hallmark impersonation tactic.',
    severity: 'high',
    regex:
      /\b(telegram|whatsapp|signal app|wire app|text[- ]only interview|chat[- ]based interview|icq|jabber|teams chat only|download telegram)\b/i,
  },
  {
    id: 'upfront_fee',
    label: 'Upfront training, onboarding, or deposit fee',
    detail:
      'No legitimate paid internship charges interns for training, badges, background checks, or refundable equipment deposits.',
    severity: 'critical',
    regex:
      /\b(training fee|registration fee|refundable deposit|application fee|pay for (your )?(background check|badge|certification)|wire transfer|zelle|venmo|cash ?app|crypto|bitcoin|usdt|gift card)\b/i,
  },
  {
    id: 'pii_harvest',
    label: 'Premature SSN, banking, or ID harvesting',
    detail:
      'Requesting Social Security numbers, bank routing numbers, or passport photos before a verified offer in an official ATS portal.',
    severity: 'critical',
    regex:
      /\b(social security|ssn|routing number|bank account details|credit score|credit report|photo of (your )?(id|driver'?s license|passport)|w-?4 before interview)\b/i,
  },
  {
    id: 'urgency_bait',
    label: 'Artificial urgency or skipped interview',
    detail:
      'High-hourly-rate offers ($45–$90/hr for generic data entry) with "no interview needed" or 2-hour acceptance deadlines.',
    severity: 'medium',
    regex:
      /\b(no interview (required|needed)|immediate hire|reply within \d+ hours?|urgent hiring|guaranteed \$[4-9]\d\/hr|data entry intern.*\$[3-9]\d)\b/i,
  },
];

export function extractDomainFromInput(rawInput: string): string | null {
  const input = rawInput.trim().toLowerCase();
  if (!input) return null;

  const emailMatch = input.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (emailMatch?.[1]) {
    return emailMatch[1].replace(/^www\./, '');
  }

  const urlCandidate = input.match(/(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})(?:[/:?#]|$)/i);
  if (urlCandidate?.[1]) {
    return urlCandidate[1].replace(/^www\./, '');
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function domainMatchesOfficial(domain: string, official: string): boolean {
  return domain === official || domain.endsWith(`.${official}`);
}

function normalizeCompanyToken(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|corp|ltd|co|technologies|labs|portal|careers|talent)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function findTrustedEmployerMatch(
  companyName: string,
  domain: string | null,
  employers: TrustedEmployer[]
): {
  exactEmployer: TrustedEmployer | null;
  spoofedEmployer: TrustedEmployer | null;
} {
  const cleanCompany = normalizeCompanyToken(companyName);

  if (domain) {
    for (const emp of employers) {
      const matchesOfficial = emp.officialDomains.some((d) =>
        domainMatchesOfficial(domain, d.toLowerCase())
      );
      const matchesAts = emp.atsPortals.some((portal) =>
        domain.includes(portal.toLowerCase())
      );
      if (matchesOfficial || matchesAts) {
        return { exactEmployer: emp, spoofedEmployer: null };
      }
    }
  }

  // Check if domain or company name spoofs a trusted employer
  for (const emp of employers) {
    const empToken = normalizeCompanyToken(emp.name);
    const domainBase = domain ? domain.split('.')[0].replace(/[^a-z0-9]/g, '') : '';

    const companyMentionsEmployer =
      cleanCompany.length >= 3 &&
      (cleanCompany === empToken ||
        cleanCompany.includes(empToken) ||
        empToken.includes(cleanCompany));

    if (domain) {
      const looksLikeDomain = emp.officialDomains.some((official) => {
        const officialBase = official.split('.')[0].replace(/[^a-z0-9]/g, '');
        if (!domainBase || !officialBase) return false;
        if (domainBase.includes(officialBase) && !domainMatchesOfficial(domain, official)) {
          return true;
        }
        const dist = levenshtein(domainBase, officialBase);
        return dist > 0 && dist <= 2 && officialBase.length >= 4;
      });

      if (looksLikeDomain) {
        return { exactEmployer: null, spoofedEmployer: emp };
      }

      if (companyMentionsEmployer && !emp.officialDomains.some((d) => domainMatchesOfficial(domain, d))) {
        return { exactEmployer: null, spoofedEmployer: emp };
      }
    } else if (companyMentionsEmployer) {
      return { exactEmployer: emp, spoofedEmployer: null };
    }
  }

  return { exactEmployer: null, spoofedEmployer: null };
}

export function verifyPostingAgainstCommunity(
  input: {
    companyName: string;
    contactOrUrl: string;
    postingText: string;
  },
  employers: TrustedEmployer[],
  reports: ScamReport[]
): VerificationResult {
  const company = input.companyName.trim();
  const contact = input.contactOrUrl.trim();
  const text = input.postingText.trim();
  const combined = `${company} ${contact} ${text}`;

  const extractedDomain = extractDomainFromInput(contact) ?? extractDomainFromInput(text);

  const detectedSignals: VerificationResult['detectedSignals'] = [];

  for (const rule of SIGNAL_RULES) {
    if (rule.regex.test(combined)) {
      detectedSignals.push({
        label: rule.label,
        detail: rule.detail,
        severity: rule.severity,
      });
    }
  }

  if (extractedDomain && FREE_EMAIL_DOMAINS.has(extractedDomain) && company.length > 0) {
    detectedSignals.push({
      label: 'Free webmail recruiter address',
      detail: `Domain "${extractedDomain}" is a consumer webmail provider rather than a corporate hiring domain.`,
      severity: 'high',
    });
  }

  const { exactEmployer, spoofedEmployer } = findTrustedEmployerMatch(
    company,
    extractedDomain,
    employers
  );

  // Find matching reports in the community radar
  const cleanCompany = company.toLowerCase();
  const matchingReports = reports.filter((r) => {
    if (r.status === 'verified_safe') return false;
    const rDomain = extractDomainFromInput(r.suspiciousDomainOrContact);
    if (extractedDomain && rDomain && extractedDomain === rDomain) return true;
    if (
      contact &&
      r.suspiciousDomainOrContact.toLowerCase().includes(contact.toLowerCase()) &&
      contact.length >= 5
    ) {
      return true;
    }
    if (
      cleanCompany.length >= 3 &&
      r.companyName.toLowerCase().includes(cleanCompany) &&
      (!exactEmployer || !extractedDomain)
    ) {
      return true;
    }
    return false;
  });

  // Priority 1: Lookalike domain spoof
  if (spoofedEmployer) {
    return {
      verdict: 'lookalike_spoof',
      headline: `Lookalike domain impersonating ${spoofedEmployer.name}`,
      summary: extractedDomain
        ? `"${extractedDomain}" is not an official ${spoofedEmployer.name} domain. Verified ${spoofedEmployer.name} roles originate from ${spoofedEmployer.officialDomains.join(', ')}.`
        : `The contact details provided do not match ${spoofedEmployer.name}'s verified hiring domains.`,
      extractedDomain,
      matchedEmployer: null,
      spoofedEmployer,
      matchingReports,
      detectedSignals,
      guidance: [
        `Do not reply or share personal information with ${extractedDomain ?? 'this contact'}.`,
        `Verify open internships directly on ${spoofedEmployer.officialDomains[0]} or ${spoofedEmployer.atsPortals[0] ?? 'their official careers page'}.`,
        'Flag this posting to the live radar so other students receive an immediate warning.',
      ],
    };
  }

  // Priority 2: Community flagged reports already exist for this contact/domain
  if (matchingReports.length > 0 && (extractedDomain || matchingReports.some((r) => r.status === 'confirmed'))) {
    const totalFlags = matchingReports.reduce((acc, r) => acc + r.flagCount, 0);
    return {
      verdict: 'community_flagged',
      headline: `Matched ${matchingReports.length} active community scam report${matchingReports.length > 1 ? 's' : ''}`,
      summary: `Students have already flagged this contact or posting pattern ${totalFlags} times across campus communities.`,
      extractedDomain,
      matchedEmployer: exactEmployer,
      spoofedEmployer: null,
      matchingReports,
      detectedSignals,
      guidance: [
        'Inspect the matched community reports below to compare recruiter aliases and outreach scripts.',
        'Add a "+1 Flag" confirmation if you received the same message.',
        'Block the sender and report the listing on the originating job board.',
      ],
    };
  }

  // Priority 3: High-risk heuristic signals even without a prior report
  if (detectedSignals.some((s) => s.severity === 'critical' || s.severity === 'high')) {
    return {
      verdict: 'high_risk_signals',
      headline: `${detectedSignals.length} high-risk scam indicator${detectedSignals.length > 1 ? 's' : ''} detected`,
      summary:
        'The posting text or recruiter contact contains tactics strongly associated with student internship fraud.',
      extractedDomain,
      matchedEmployer: exactEmployer,
      spoofedEmployer: null,
      matchingReports,
      detectedSignals,
      guidance: [
        'Never deposit checks, pay training/equipment fees, or interview exclusively via Telegram/WhatsApp.',
        'Confirm the role requisition ID directly on the employer’s official careers website.',
        'Submit this posting to the Live Radar to warn other students.',
      ],
    };
  }

  // Priority 4: Verified trusted employer with clean domain & no red flags
  if (exactEmployer && extractedDomain) {
    return {
      verdict: 'verified_trusted',
      headline: `Verified official domain for ${exactEmployer.name}`,
      summary: `"${extractedDomain}" matches ${exactEmployer.name}'s community-verified hiring infrastructure (${exactEmployer.vouchCount} community vouches).`,
      extractedDomain,
      matchedEmployer: exactEmployer,
      spoofedEmployer: null,
      matchingReports,
      detectedSignals,
      guidance: [
        exactEmployer.hiringPolicyNote,
        `Official portals: ${exactEmployer.atsPortals.join(', ')}.`,
        'Still verify the email authentication headers (SPF/DKIM) before sharing tax or onboarding forms.',
      ],
    };
  }

  // Priority 5: Unverified / neutral
  return {
    verdict: 'unverified',
    headline: exactEmployer
      ? `${exactEmployer.name} is verified, but no domain/URL was provided to authenticate this sender`
      : 'No prior community reports or verified employer match found',
    summary: exactEmployer
      ? `Paste the recruiter's exact email address or job application URL so InternRadar can verify it against ${exactEmployer.officialDomains.join(', ')}.`
      : 'This employer is not yet in the Trusted Employer Registry and has no prior scam flags. Check corporate domain WHOIS age and official LinkedIn presence before applying.',
    extractedDomain,
    matchedEmployer: exactEmployer,
    spoofedEmployer: null,
    matchingReports,
    detectedSignals,
    guidance: [
      'Always paste the full recruiter email address (including the @domain) or exact application URL.',
      'Check whether the company domain was registered recently or uses a free webmail address.',
      'If the role looks suspicious, report it so your campus community can track it.',
    ],
  };
}
