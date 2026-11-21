import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  EvidenceNote,
  RadarWsEvent,
  ReportStatus,
  ScamPattern,
  ScamReport,
  SeverityLevel,
  TrustedEmployer,
} from './src/types/radar.ts';
import {
  extractDomainFromInput,
  findTrustedEmployerMatch,
  verifyPostingAgainstCommunity,
} from './src/utils/scamScanner.ts';

interface RadarDatabase {
  reports: ScamReport[];
  employers: TrustedEmployer[];
}

const PORT = Number(process.env.PORT || 3000);

function resolveWritableDataDir(): string {
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'internradar-data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_PATH = path.join(DATA_DIR, 'radar-db.json');

const ALLOWED_PATTERNS = new Set<ScamPattern>([
  'equipment_check',
  'domain_spoof',
  'fake_interview',
  'upfront_fee',
  'data_harvest',
]);

const ALLOWED_PLATFORMS = new Set<string>([
  'LinkedIn',
  'Handshake',
  'Indeed',
  'Cold Email',
  'Discord / Slack',
  'University Board',
  'Other',
]);

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function createSeedDatabase(): RadarDatabase {
  const employers: TrustedEmployer[] = [
    {
      id: 'emp-stripe',
      name: 'Stripe',
      industry: 'Financial Infrastructure',
      headquarters: 'South San Francisco, CA & Dublin',
      officialDomains: ['stripe.com'],
      atsPortals: ['boards.greenhouse.io/stripe', 'stripe.com/jobs'],
      hiringPolicyNote:
        'All university interviews occur via scheduled video calls from @stripe.com. Laptops are shipped directly from Stripe IT.',
      tier: 'campus_confirmed',
      vouchCount: 142,
      vouchedBy: ['seed-1', 'seed-2', 'seed-3'],
      nominatedBy: 'UC Berkeley Career Center',
      createdAt: daysAgoIso(45),
    },
    {
      id: 'emp-figma',
      name: 'Figma',
      industry: 'Design & Collaboration Software',
      headquarters: 'San Francisco, CA',
      officialDomains: ['figma.com'],
      atsPortals: ['boards.greenhouse.io/figma', 'figma.com/careers'],
      hiringPolicyNote:
        'Never conducts interviews via Telegram, WhatsApp, or text-only chat apps. Official recruiter emails always end in @figma.com.',
      tier: 'campus_confirmed',
      vouchCount: 118,
      vouchedBy: ['seed-1', 'seed-2'],
      nominatedBy: 'CMU Career & Professional Development',
      createdAt: daysAgoIso(42),
    },
    {
      id: 'emp-nvidia',
      name: 'NVIDIA',
      industry: 'Semiconductors & AI Computing',
      headquarters: 'Santa Clara, CA',
      officialDomains: ['nvidia.com'],
      atsPortals: ['nvidia.wd5.myworkdayjobs.com', 'nvidia.com/en-us/about-nvidia/careers'],
      hiringPolicyNote:
        'Official applications go strictly through Workday (myworkdayjobs.com). Never requests upfront fees or check deposits.',
      tier: 'campus_confirmed',
      vouchCount: 164,
      vouchedBy: ['seed-1', 'seed-2', 'seed-3'],
      nominatedBy: 'Georgia Tech Co-op & Internships',
      createdAt: daysAgoIso(60),
    },
    {
      id: 'emp-datadog',
      name: 'Datadog',
      industry: 'Cloud Monitoring & Security',
      headquarters: 'New York, NY',
      officialDomains: ['datadoghq.com'],
      atsPortals: ['boards.greenhouse.io/datadog', 'careers.datadoghq.com'],
      hiringPolicyNote:
        'Note the official domain is datadoghq.com (not datadog-careers.com). Campus recruiting uses Greenhouse and Zoom.',
      tier: 'campus_confirmed',
      vouchCount: 89,
      vouchedBy: ['seed-1'],
      nominatedBy: 'NYU Wasserman Center',
      createdAt: daysAgoIso(38),
    },
    {
      id: 'emp-cloudflare',
      name: 'Cloudflare',
      industry: 'Edge Network & Security',
      headquarters: 'San Francisco, CA',
      officialDomains: ['cloudflare.com'],
      atsPortals: ['boards.greenhouse.io/cloudflare', 'cloudflare.com/careers'],
      hiringPolicyNote:
        'Never asks candidates to purchase home-office equipment or pay for background screening.',
      tier: 'campus_confirmed',
      vouchCount: 97,
      vouchedBy: ['seed-1'],
      nominatedBy: 'UT Austin Engineering Career Assistance',
      createdAt: daysAgoIso(35),
    },
    {
      id: 'emp-atlassian',
      name: 'Atlassian',
      industry: 'Team Collaboration Software',
      headquarters: 'Sydney & San Francisco',
      officialDomains: ['atlassian.com'],
      atsPortals: ['atlassian.com/company/careers', 'lever.co'],
      hiringPolicyNote:
        'Recruiters email exclusively from @atlassian.com and schedule HackerRank + live video technical interviews.',
      tier: 'community_verified',
      vouchCount: 74,
      vouchedBy: ['seed-1'],
      nominatedBy: 'WaterlooWorks Student Collective',
      createdAt: daysAgoIso(30),
    },
    {
      id: 'emp-hubspot',
      name: 'HubSpot',
      industry: 'CRM & Marketing Platform',
      headquarters: 'Cambridge, MA',
      officialDomains: ['hubspot.com'],
      atsPortals: ['hubspot.com/careers', 'boards.greenhouse.io/hubspot'],
      hiringPolicyNote:
        'Co-op and summer intern outreach uses @hubspot.com. Never uses personal Gmail accounts.',
      tier: 'community_verified',
      vouchCount: 63,
      vouchedBy: ['seed-1'],
      nominatedBy: 'Northeastern Co-op Network',
      createdAt: daysAgoIso(28),
    },
    {
      id: 'emp-linear',
      name: 'Linear',
      industry: 'Product Planning & Issue Tracking',
      headquarters: 'San Francisco, CA',
      officialDomains: ['linear.app'],
      atsPortals: ['linear.app/careers', 'jobs.ashbyhq.com/linear'],
      hiringPolicyNote:
        'Uses @linear.app and Ashby ATS. Does not post random Discord DM internship offers.',
      tier: 'community_verified',
      vouchCount: 51,
      vouchedBy: ['seed-1'],
      nominatedBy: 'Stanford CS Student Forum',
      createdAt: daysAgoIso(22),
    },
    {
      id: 'emp-shopify',
      name: 'Shopify',
      industry: 'Commerce Infrastructure',
      headquarters: 'Ottawa, Canada',
      officialDomains: ['shopify.com'],
      atsPortals: ['shopify.com/careers', 'jobs.smartrecruiters.com/Shopify'],
      hiringPolicyNote:
        'Dev Degree and summer internship correspondence uses @shopify.com or SmartRecruiters.',
      tier: 'campus_confirmed',
      vouchCount: 93,
      vouchedBy: ['seed-1'],
      nominatedBy: 'UWaterloo & Carleton Career Boards',
      createdAt: daysAgoIso(40),
    },
    {
      id: 'emp-microsoft',
      name: 'Microsoft',
      industry: 'Cloud & Productivity Platforms',
      headquarters: 'Redmond, WA',
      officialDomains: ['microsoft.com'],
      atsPortals: ['careers.microsoft.com', 'jobs.careers.microsoft.com'],
      hiringPolicyNote:
        'Official emails originate from @microsoft.com. Action Center handles all onboarding documents securely.',
      tier: 'campus_confirmed',
      vouchCount: 215,
      vouchedBy: ['seed-1', 'seed-2'],
      nominatedBy: 'UW Career & Internship Center',
      createdAt: daysAgoIso(55),
    },
    {
      id: 'emp-duolingo',
      name: 'Duolingo',
      industry: 'Language Learning Technology',
      headquarters: 'Pittsburgh, PA',
      officialDomains: ['duolingo.com'],
      atsPortals: ['careers.duolingo.com', 'boards.greenhouse.io/duolingo'],
      hiringPolicyNote:
        'University recruiters use @duolingo.com and Greenhouse; Thrive internships include live Zoom interviews.',
      tier: 'community_verified',
      vouchCount: 58,
      vouchedBy: ['seed-1'],
      nominatedBy: 'Pitt & CMU Student Chapter',
      createdAt: daysAgoIso(19),
    },
    {
      id: 'emp-databricks',
      name: 'Databricks',
      industry: 'Data & AI Platform',
      headquarters: 'San Francisco, CA',
      officialDomains: ['databricks.com'],
      atsPortals: ['databricks.com/company/careers', 'boards.greenhouse.io/databricks'],
      hiringPolicyNote:
        'All intern offers require live technical interviews and official DocuSign sent after @databricks.com recruiter confirmation.',
      tier: 'campus_confirmed',
      vouchCount: 109,
      vouchedBy: ['seed-1'],
      nominatedBy: 'UC Berkeley EECS Peer Advisors',
      createdAt: daysAgoIso(32),
    },
  ];

  const reports: ScamReport[] = [
    {
      id: 'rep-101',
      companyName: 'Stripe Talent Portal (Spoof)',
      roleTitle: 'Remote Software Engineering Intern',
      platform: 'Cold Email',
      suspiciousDomainOrContact: 'hr@stripe-onboarding.co',
      postingSnippet:
        'Received a PDF offer letter asking me to deposit an e-check of $2,450 and wire funds to their "certified MacBook vendor" before day one.',
      pattern: 'equipment_check',
      severity: 'critical',
      status: 'confirmed',
      redFlags: [
        'Lookalike domain stripe-onboarding.co (official: stripe.com)',
        'Fake e-check reimbursement for home-office equipment',
        'No live technical interview conducted',
      ],
      matchedTrustedEmployerId: 'emp-stripe',
      matchedTrustedEmployerName: 'Stripe',
      reporterLabel: 'Maya T.',
      university: 'UC Berkeley',
      flagCount: 19,
      flaggedBy: ['seed-u1', 'seed-u2', 'seed-u3'],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [
        {
          id: 'note-1',
          author: 'Devon R.',
          university: 'UCLA',
          text: 'Got the exact same PDF from stripe-onboarding.co after applying to a fake LinkedIn repost. Reported domain to registrar.',
          stance: 'corroborate',
          createdAt: minutesAgoIso(42),
        },
        {
          id: 'note-2',
          author: 'Hannah K.',
          university: 'UT Austin',
          text: 'Confirmed with an actual Stripe campus recruiter on Handshake that stripe-onboarding.co is fraudulent.',
          stance: 'corroborate',
          createdAt: minutesAgoIso(18),
        },
      ],
      createdAt: hoursAgoIso(2),
      updatedAt: minutesAgoIso(18),
    },
    {
      id: 'rep-102',
      companyName: 'Figma Campus Recruiting (Spoof)',
      roleTitle: 'Product Design Intern — Summer',
      platform: 'LinkedIn',
      suspiciousDomainOrContact: 'recruiting@figma-careers.org',
      postingSnippet:
        'Recruiter asked me to download Telegram and message "@figma_talent_desk" for a 20-minute text-only screening interview.',
      pattern: 'fake_interview',
      severity: 'high',
      status: 'confirmed',
      redFlags: [
        'Lookalike domain figma-careers.org (official: figma.com)',
        'Off-platform text-only Telegram interview',
        'Requested immediate SSN verification after 5 chat questions',
      ],
      matchedTrustedEmployerId: 'emp-figma',
      matchedTrustedEmployerName: 'Figma',
      reporterLabel: 'Jordan L.',
      university: 'RISD',
      flagCount: 14,
      flaggedBy: ['seed-u1', 'seed-u2'],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [
        {
          id: 'note-3',
          author: 'Priya S.',
          university: 'University of Washington',
          text: 'Same Telegram handle reached out to three design majors in our Slack channel this morning.',
          stance: 'corroborate',
          createdAt: minutesAgoIso(55),
        },
      ],
      createdAt: hoursAgoIso(4),
      updatedAt: minutesAgoIso(55),
    },
    {
      id: 'rep-103',
      companyName: 'NVIDIA AI Lab (Spoof)',
      roleTitle: 'ML Systems Intern (Remote)',
      platform: 'Indeed',
      suspiciousDomainOrContact: 'talent@nvidia-talent.us',
      postingSnippet:
        'Listed $68/hr remote ML intern role on Indeed redirecting to nvidia-talent.us asking for driver license scan and bank routing number upfront.',
      pattern: 'domain_spoof',
      severity: 'critical',
      status: 'confirmed',
      redFlags: [
        'Lookalike domain nvidia-talent.us (official: nvidia.com)',
        'Premature driver license & bank routing harvest',
        'Bypasses official Workday portal',
      ],
      matchedTrustedEmployerId: 'emp-nvidia',
      matchedTrustedEmployerName: 'NVIDIA',
      reporterLabel: 'Arjun V.',
      university: 'Georgia Tech',
      flagCount: 11,
      flaggedBy: ['seed-u1'],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [],
      createdAt: hoursAgoIso(7),
      updatedAt: hoursAgoIso(5),
    },
    {
      id: 'rep-104',
      companyName: 'Apex Horizon Logistics',
      roleTitle: 'Remote Data Entry & Payroll Intern',
      platform: 'University Board',
      suspiciousDomainOrContact: 'apex.horizon.hiring@gmail.com',
      postingSnippet:
        'Claims $45/hr flexible remote internship with no experience required. Asked to purchase $380 software license via Zelle to be reimbursed on first check.',
      pattern: 'upfront_fee',
      severity: 'critical',
      status: 'confirmed',
      redFlags: [
        'Uses free @gmail.com recruiter address',
        'Upfront Zelle payment for onboarding software',
        'Unrealistic $45/hr pay for entry-level data entry',
      ],
      matchedTrustedEmployerId: null,
      matchedTrustedEmployerName: null,
      reporterLabel: 'Elena M.',
      university: 'Ohio State University',
      flagCount: 9,
      flaggedBy: ['seed-u1'],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [
        {
          id: 'note-4',
          author: 'Career Services Desk',
          university: 'Ohio State',
          text: 'Listing removed from campus job portal; sender account suspended.',
          stance: 'corroborate',
          createdAt: hoursAgoIso(6),
        },
      ],
      createdAt: hoursAgoIso(11),
      updatedAt: hoursAgoIso(6),
    },
    {
      id: 'rep-105',
      companyName: 'Datadog Cloud Ops (Spoof)',
      roleTitle: 'Site Reliability Intern',
      platform: 'Cold Email',
      suspiciousDomainOrContact: 'onboarding@datadog-hr.info',
      postingSnippet:
        'Sent unsolicited email to .edu address asking for a $65 "refundable identity screening fee" through a third-party crypto payment gateway.',
      pattern: 'upfront_fee',
      severity: 'critical',
      status: 'flagged',
      redFlags: [
        'Lookalike domain datadog-hr.info (official: datadoghq.com)',
        'Requests $65 screening fee via crypto',
      ],
      matchedTrustedEmployerId: 'emp-datadog',
      matchedTrustedEmployerName: 'Datadog',
      reporterLabel: 'Samir P.',
      university: 'NYU',
      flagCount: 4,
      flaggedBy: [],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [],
      createdAt: hoursAgoIso(14),
      updatedAt: hoursAgoIso(14),
    },
    {
      id: 'rep-106',
      companyName: 'Linear App Labs (Spoof)',
      roleTitle: 'Frontend Engineering Intern',
      platform: 'Discord / Slack',
      suspiciousDomainOrContact: 'careers@linear-jobs.net',
      postingSnippet:
        'DM in a student hackathon Discord server linking to linear-jobs.net which asks candidates to run a suspicious local "take-home CLI package" with obfuscated install script.',
      pattern: 'data_harvest',
      severity: 'high',
      status: 'confirmed',
      redFlags: [
        'Lookalike domain linear-jobs.net (official: linear.app)',
        'Unsolicited Discord DM with suspicious executable take-home repo',
      ],
      matchedTrustedEmployerId: 'emp-linear',
      matchedTrustedEmployerName: 'Linear',
      reporterLabel: 'Chloe W.',
      university: 'University of Waterloo',
      flagCount: 8,
      flaggedBy: ['seed-u1'],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [],
      createdAt: hoursAgoIso(19),
      updatedAt: hoursAgoIso(16),
    },
    {
      id: 'rep-107',
      companyName: 'Vanguard Quantum Media',
      roleTitle: 'Social Media & Brand Marketing Intern',
      platform: 'Handshake',
      suspiciousDomainOrContact: 'talent@vanguardquantum-media.com',
      postingSnippet:
        '2-hour deadline to sign NDA and send passport scan + W-4 tax form before speaking with any hiring manager.',
      pattern: 'data_harvest',
      severity: 'high',
      status: 'flagged',
      redFlags: [
        '2-hour artificial urgency deadline',
        'Requests W-4 and passport photo pre-interview',
      ],
      matchedTrustedEmployerId: null,
      matchedTrustedEmployerName: null,
      reporterLabel: 'Liam G.',
      university: 'Boston University',
      flagCount: 3,
      flaggedBy: [],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [],
      createdAt: daysAgoIso(1),
      updatedAt: daysAgoIso(1),
    },
    {
      id: 'rep-108',
      companyName: 'Duolingo Thrive Recruiting',
      roleTitle: 'Thrive Software Engineering Intern',
      platform: 'University Board',
      suspiciousDomainOrContact: 'thrive-recruiting@duolingo.com',
      postingSnippet:
        'Flagged initially for a fast turnaround invite, later verified directly against @duolingo.com SPF records and Greenhouse portal.',
      pattern: 'domain_spoof',
      severity: 'medium',
      status: 'verified_safe',
      redFlags: ['Verified official @duolingo.com sender'],
      matchedTrustedEmployerId: 'emp-duolingo',
      matchedTrustedEmployerName: 'Duolingo',
      reporterLabel: 'Noah C.',
      university: 'Carnegie Mellon University',
      flagCount: 1,
      flaggedBy: [],
      safeVotes: 7,
      safeVotedBy: ['seed-u1', 'seed-u2'],
      notes: [
        {
          id: 'note-5',
          author: 'CMU Career Office',
          university: 'Carnegie Mellon University',
          text: 'Confirmed legitimate outreach from Duolingo’s official @duolingo.com university recruiting alias.',
          stance: 'dispute_safe',
          createdAt: daysAgoIso(1),
        },
      ],
      createdAt: daysAgoIso(2),
      updatedAt: daysAgoIso(1),
    },
  ];

  return { reports, employers };
}

function loadDatabase(): RadarDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = createSeedDatabase();
    writeDatabaseAtomic(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as RadarDatabase;
    if (!Array.isArray(parsed.reports) || !Array.isArray(parsed.employers)) {
      throw new Error('Invalid database structure');
    }
    return parsed;
  } catch {
    const seed = createSeedDatabase();
    writeDatabaseAtomic(seed);
    return seed;
  }
}

function writeDatabaseAtomic(data: RadarDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

function cleanText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function determineSeverity(
  pattern: ScamPattern,
  hasLookalikeSpoof: boolean,
  redFlagsCount: number
): SeverityLevel {
  if (pattern === 'equipment_check' || pattern === 'upfront_fee' || hasLookalikeSpoof) {
    return 'critical';
  }
  if (pattern === 'fake_interview' || pattern === 'data_harvest' || redFlagsCount >= 2) {
    return 'high';
  }
  return 'medium';
}

async function startServer() {
  const db = loadDatabase();
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/ws' });

  function getActiveWatchersCount(): number {
    let count = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) count++;
    });
    return count;
  }

  function broadcastEvent(event: RadarWsEvent): void {
    const payload = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  wss.on('connection', (ws) => {
    broadcastEvent({ type: 'presence:count', count: getActiveWatchersCount() });

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30_000);

    ws.on('close', () => {
      clearInterval(pingInterval);
      broadcastEvent({ type: 'presence:count', count: getActiveWatchersCount() });
    });

    ws.on('error', () => {
      clearInterval(pingInterval);
    });
  });

  // GET full initial state
  app.get('/api/state', (_req, res) => {
    res.json({
      reports: db.reports,
      employers: db.employers,
      activeWatchers: Math.max(1, getActiveWatchersCount()),
    });
  });

  // POST verify posting or recruiter contact
  app.post('/api/verify', (req, res) => {
    const companyName = cleanText(req.body?.companyName, 120);
    const contactOrUrl = cleanText(req.body?.contactOrUrl, 240);
    const postingText = cleanText(req.body?.postingText, 2000);

    if (!companyName && !contactOrUrl && !postingText) {
      res.status(400).json({ error: 'Provide at least a company name, contact/URL, or posting text.' });
      return;
    }

    const result = verifyPostingAgainstCommunity(
      { companyName, contactOrUrl, postingText },
      db.employers,
      db.reports
    );
    res.json(result);
  });

  // POST create new scam report
  app.post('/api/reports', (req, res) => {
    const companyName = cleanText(req.body?.companyName, 120);
    const roleTitle = cleanText(req.body?.roleTitle, 120);
    const platformRaw = cleanText(req.body?.platform, 40);
    const suspiciousDomainOrContact = cleanText(req.body?.suspiciousDomainOrContact, 200);
    const postingSnippet = cleanText(req.body?.postingSnippet, 1200);
    const patternRaw = cleanText(req.body?.pattern, 40) as ScamPattern;
    const reporterLabel = cleanText(req.body?.reporterLabel, 60) || 'Anonymous Student';
    const university = cleanText(req.body?.university, 80) || 'Campus Community';
    const voterId = cleanText(req.body?.voterId, 80) || `anon-${crypto.randomUUID()}`;

    if (!companyName || !roleTitle || !suspiciousDomainOrContact || !postingSnippet) {
      res.status(400).json({
        error: 'Company name, role title, suspicious domain/contact, and description are required.',
      });
      return;
    }

    const pattern: ScamPattern = ALLOWED_PATTERNS.has(patternRaw)
      ? patternRaw
      : 'domain_spoof';
    const platform = ALLOWED_PLATFORMS.has(platformRaw) ? platformRaw : 'Other';

    const scanResult = verifyPostingAgainstCommunity(
      {
        companyName,
        contactOrUrl: suspiciousDomainOrContact,
        postingText: postingSnippet,
      },
      db.employers,
      db.reports
    );

    const extractedDomain = extractDomainFromInput(suspiciousDomainOrContact);
    const { spoofedEmployer, exactEmployer } = findTrustedEmployerMatch(
      companyName,
      extractedDomain,
      db.employers
    );

    const redFlags: string[] = [];
    if (spoofedEmployer && extractedDomain) {
      redFlags.push(
        `Lookalike domain ${extractedDomain} (official: ${spoofedEmployer.officialDomains.join(', ')})`
      );
    }
    for (const sig of scanResult.detectedSignals) {
      if (!redFlags.includes(sig.label)) {
        redFlags.push(sig.label);
      }
    }
    if (redFlags.length === 0) {
      const patternLabels: Record<ScamPattern, string> = {
        equipment_check: 'Equipment purchase / check reimbursement demand',
        domain_spoof: 'Unverified or lookalike hiring domain',
        fake_interview: 'Off-platform or non-standard interview process',
        upfront_fee: 'Upfront fee or payment request',
        data_harvest: 'Premature sensitive identity or banking data request',
      };
      redFlags.push(patternLabels[pattern]);
    }

    const linkedEmployer = spoofedEmployer ?? (scanResult.verdict !== 'verified_trusted' ? exactEmployer : null);
    const severity = determineSeverity(pattern, Boolean(spoofedEmployer), redFlags.length);
    const nowIso = new Date().toISOString();

    const newReport: ScamReport = {
      id: `rep-${crypto.randomUUID().slice(0, 8)}`,
      companyName,
      roleTitle,
      platform,
      suspiciousDomainOrContact,
      postingSnippet,
      pattern,
      severity,
      status: 'flagged',
      redFlags: redFlags.slice(0, 5),
      matchedTrustedEmployerId: linkedEmployer?.id ?? null,
      matchedTrustedEmployerName: linkedEmployer?.name ?? null,
      reporterLabel,
      university,
      flagCount: 1,
      flaggedBy: [voterId],
      safeVotes: 0,
      safeVotedBy: [],
      notes: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.reports.unshift(newReport);
    writeDatabaseAtomic(db);
    broadcastEvent({ type: 'report:created', report: newReport });
    res.status(201).json(newReport);
  });

  // POST toggle "Flag Too (+1)" confirmation on a report
  app.post('/api/reports/:id/flag', (req, res) => {
    const id = cleanText(req.params.id, 64);
    const voterId = cleanText(req.body?.voterId, 80);
    if (!voterId) {
      res.status(400).json({ error: 'voterId is required.' });
      return;
    }

    const report = db.reports.find((r) => r.id === id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const alreadyFlagged = report.flaggedBy.includes(voterId);
    if (alreadyFlagged) {
      report.flaggedBy = report.flaggedBy.filter((v) => v !== voterId);
      report.flagCount = Math.max(0, report.flagCount - 1);
    } else {
      report.flaggedBy.push(voterId);
      report.flagCount += 1;
      if (report.safeVotedBy.includes(voterId)) {
        report.safeVotedBy = report.safeVotedBy.filter((v) => v !== voterId);
        report.safeVotes = Math.max(0, report.safeVotes - 1);
      }
    }

    if (report.flagCount >= 5 && report.safeVotes < report.flagCount) {
      report.status = 'confirmed';
    } else if (report.safeVotes >= 3 && report.safeVotes > report.flagCount) {
      report.status = 'verified_safe';
    } else {
      report.status = 'flagged';
    }

    report.updatedAt = new Date().toISOString();
    writeDatabaseAtomic(db);
    broadcastEvent({ type: 'report:updated', report });
    res.json(report);
  });

  // POST community verification vote (confirm scam or mark safe)
  app.post('/api/reports/:id/status', (req, res) => {
    const id = cleanText(req.params.id, 64);
    const voterId = cleanText(req.body?.voterId, 80);
    const action = cleanText(req.body?.action, 32);

    if (!voterId || (action !== 'confirm_scam' && action !== 'mark_safe')) {
      res.status(400).json({ error: 'Valid voterId and action (confirm_scam | mark_safe) required.' });
      return;
    }

    const report = db.reports.find((r) => r.id === id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    if (action === 'confirm_scam') {
      if (!report.flaggedBy.includes(voterId)) {
        report.flaggedBy.push(voterId);
        report.flagCount += 1;
      }
      if (report.safeVotedBy.includes(voterId)) {
        report.safeVotedBy = report.safeVotedBy.filter((v) => v !== voterId);
        report.safeVotes = Math.max(0, report.safeVotes - 1);
      }
      report.status = report.flagCount >= 5 ? 'confirmed' : 'flagged';
    } else {
      if (!report.safeVotedBy.includes(voterId)) {
        report.safeVotedBy.push(voterId);
        report.safeVotes += 1;
      }
      if (report.flaggedBy.includes(voterId)) {
        report.flaggedBy = report.flaggedBy.filter((v) => v !== voterId);
        report.flagCount = Math.max(0, report.flagCount - 1);
      }
      const nextStatus: ReportStatus =
        report.safeVotes >= 3 && report.safeVotes >= report.flagCount
          ? 'verified_safe'
          : report.status;
      report.status = nextStatus;
    }

    report.updatedAt = new Date().toISOString();
    writeDatabaseAtomic(db);
    broadcastEvent({ type: 'report:updated', report });
    res.json(report);
  });

  // POST add community evidence note
  app.post('/api/reports/:id/notes', (req, res) => {
    const id = cleanText(req.params.id, 64);
    const author = cleanText(req.body?.author, 60) || 'Student Reviewer';
    const university = cleanText(req.body?.university, 80) || 'Campus Community';
    const text = cleanText(req.body?.text, 500);
    const stance = req.body?.stance === 'dispute_safe' ? 'dispute_safe' : 'corroborate';

    if (!text) {
      res.status(400).json({ error: 'Evidence note text is required.' });
      return;
    }

    const report = db.reports.find((r) => r.id === id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const note: EvidenceNote = {
      id: `note-${crypto.randomUUID().slice(0, 8)}`,
      author,
      university,
      text,
      stance,
      createdAt: new Date().toISOString(),
    };

    report.notes.push(note);
    report.updatedAt = new Date().toISOString();
    writeDatabaseAtomic(db);
    broadcastEvent({ type: 'report:updated', report });
    res.status(201).json(report);
  });

  // POST nominate a new trusted employer
  app.post('/api/employers', (req, res) => {
    const name = cleanText(req.body?.name, 100);
    const industry = cleanText(req.body?.industry, 80) || 'Technology';
    const headquarters = cleanText(req.body?.headquarters, 100) || 'United States';
    const rawDomain = cleanText(req.body?.officialDomain, 120).toLowerCase();
    const atsPortal = cleanText(req.body?.atsPortal, 160);
    const hiringPolicyNote =
      cleanText(req.body?.hiringPolicyNote, 360) ||
      'Nominated by student community; verify recruiter identity via official corporate email.';
    const nominatedBy = cleanText(req.body?.nominatedBy, 80) || 'Student Contributor';
    const voterId = cleanText(req.body?.voterId, 80) || `anon-${crypto.randomUUID()}`;

    const domain = extractDomainFromInput(rawDomain) ?? rawDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    if (!name || !domain || !domain.includes('.')) {
      res.status(400).json({ error: 'Employer name and a valid official domain (e.g. company.com) are required.' });
      return;
    }

    const duplicate = db.employers.find((e) =>
      e.officialDomains.some((d) => d.toLowerCase() === domain)
    );
    if (duplicate) {
      res.status(409).json({ error: `Domain "${domain}" is already registered under ${duplicate.name}.` });
      return;
    }

    const employer: TrustedEmployer = {
      id: `emp-${crypto.randomUUID().slice(0, 8)}`,
      name,
      industry,
      headquarters,
      officialDomains: [domain],
      atsPortals: atsPortal ? [atsPortal] : [`${domain}/careers`],
      hiringPolicyNote,
      tier: 'pending',
      vouchCount: 1,
      vouchedBy: [voterId],
      nominatedBy,
      createdAt: new Date().toISOString(),
    };

    db.employers.unshift(employer);
    writeDatabaseAtomic(db);
    broadcastEvent({ type: 'employer:created', employer });
    res.status(201).json(employer);
  });

  // POST vouch for a trusted employer
  app.post('/api/employers/:id/vouch', (req, res) => {
    const id = cleanText(req.params.id, 64);
    const voterId = cleanText(req.body?.voterId, 80);
    if (!voterId) {
      res.status(400).json({ error: 'voterId is required.' });
      return;
    }

    const employer = db.employers.find((e) => e.id === id);
    if (!employer) {
      res.status(404).json({ error: 'Employer not found.' });
      return;
    }

    const alreadyVouched = employer.vouchedBy.includes(voterId);
    if (alreadyVouched) {
      employer.vouchedBy = employer.vouchedBy.filter((v) => v !== voterId);
      employer.vouchCount = Math.max(0, employer.vouchCount - 1);
    } else {
      employer.vouchedBy.push(voterId);
      employer.vouchCount += 1;
    }

    if (employer.tier !== 'campus_confirmed') {
      employer.tier = employer.vouchCount >= 3 ? 'community_verified' : 'pending';
    }

    writeDatabaseAtomic(db);
    broadcastEvent({ type: 'employer:updated', employer });
    res.json(employer);
  });

  // Serve built dist/ in production/deployed mode; use Vite dev middleware only when INTERNRADAR_DEV=1 or dist/ is absent
  const distPath = path.resolve(process.cwd(), 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const isDevServer = process.env.INTERNRADAR_DEV === '1';

  if (!isDevServer && fs.existsSync(distIndexPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`InternRadar server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start InternRadar server:', err);
  process.exit(1);
});
