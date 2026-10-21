import { prisma } from '../../config/database';
import { addDays, clock, formatDay, kstDayKey } from '../../lib/clock';
import { AppError } from '../../middleware/errorHandler';
import { DailyRow, loadDailyRows } from './aggregate';

export const REPORT_NOTICE = '블로그 글의 추적 링크를 눌러 넘어온 방문만 집계됩니다. 블로그 조회수와는 다릅니다.';
const MAX_RANGE_DAYS = 366;

export interface Range { from: Date; to: Date }

/** 기간 기본값: 미션 생성일 ~ 오늘(KST). 최대 366일 */
export function resolveRange(from: Date | null, to: Date | null, defaultFrom: Date): Range {
  const today = kstDayKey(clock.now());
  const end = to ?? today;
  let start = from ?? kstDayKey(defaultFrom);
  if (start > end) throw new AppError('VALIDATION_ERROR', 400, '시작일이 종료일보다 늦습니다');
  if ((end.getTime() - start.getTime()) / 86400000 >= MAX_RANGE_DAYS) start = addDays(end, -(MAX_RANGE_DAYS - 1));
  return { from: start, to: end };
}

interface Totals { clicks: number; uniqueVisitors: number; mobile: number; pc: number; unknown: number }

function sumRows(rows: DailyRow[]): Totals {
  return rows.reduce<Totals>((t, r) => ({
    clicks: t.clicks + r.totalClicks,
    uniqueVisitors: t.uniqueVisitors + r.uniqueVisitors,
    mobile: t.mobile + r.mobileClicks,
    pc: t.pc + r.pcClicks,
    unknown: t.unknown + r.unknownClicks,
  }), { clicks: 0, uniqueVisitors: 0, mobile: 0, pc: 0, unknown: 0 });
}

/** 홍길동 → 홍*동, 김철 → 김*, 한 글자는 * */
export function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

export type DisclosureState = 'AUTO_PASSED' | 'MANUAL_CONFIRMED' | 'NEEDS_MANUAL_REVIEW' | 'NOT_CHECKED' | 'NOT_SUBMITTED';

export async function buildCampaignReport(missionId: string, range: Range, opts: { maskNames: boolean }) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: {
      id: true, title: true, campaignCode: true, destinationUrl: true, category: true, createdAt: true,
      clientProfile: { select: { businessName: true } },
      keywords: { select: { keyword: true, role: true } },
      trackingLinks: {
        select: {
          id: true, code: true,
          application: {
            select: {
              participant: { select: { id: true, user: { select: { name: true } } } },
              submission: { select: { id: true, status: true, snsPostUrl: true, disclosureCheck: true } },
            },
          },
        },
      },
    },
  });
  if (!mission) throw new AppError('NOT_FOUND', 404, '미션을 찾을 수 없습니다');

  const rows = await loadDailyRows(mission.trackingLinks.map(l => l.id), range.from, range.to);
  const totals = sumRows(rows);

  const daily: { day: string; clicks: number; uniqueVisitors: number }[] = [];
  const byDay = new Map<string, { clicks: number; uniqueVisitors: number }>();
  for (const r of rows) {
    const d = formatDay(r.dayKey);
    const cur = byDay.get(d) ?? { clicks: 0, uniqueVisitors: 0 };
    byDay.set(d, { clicks: cur.clicks + r.totalClicks, uniqueVisitors: cur.uniqueVisitors + r.uniqueVisitors });
  }
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const key = formatDay(d);
    daily.push({ day: key, ...(byDay.get(key) ?? { clicks: 0, uniqueVisitors: 0 }) });
  }

  const referers = new Map<string, number>();
  for (const r of rows) for (const [domain, n] of Object.entries(r.referers)) referers.set(domain, (referers.get(domain) ?? 0) + n);

  const disclosureCounts: Record<DisclosureState, number> = {
    AUTO_PASSED: 0, MANUAL_CONFIRMED: 0, NEEDS_MANUAL_REVIEW: 0, NOT_CHECKED: 0, NOT_SUBMITTED: 0,
  };

  // 캠페인 안에서는 체험단원 1명 = 리뷰 1건 = 추적 링크 1개
  const ranking = mission.trackingLinks.map(link => {
    const t = sumRows(rows.filter(r => r.linkId === link.id));
    const submission = link.application.submission;
    const disclosure: DisclosureState = !submission ? 'NOT_SUBMITTED' : (submission.disclosureCheck ?? 'NOT_CHECKED');
    disclosureCounts[disclosure]++;
    const name = link.application.participant.user.name;
    return {
      linkCode: link.code,
      participantName: opts.maskNames ? maskName(name) : name,
      postUrl: submission?.snsPostUrl ?? null,
      submissionStatus: submission?.status ?? null,
      disclosure,
      clicks: t.clicks,
      uniqueVisitors: t.uniqueVisitors,
    };
  }).sort((a, b) => b.clicks - a.clicks || b.uniqueVisitors - a.uniqueVisitors);

  return {
    notice: REPORT_NOTICE,
    range: { from: formatDay(range.from), to: formatDay(range.to) },
    mission: {
      id: mission.id, title: mission.title, campaignCode: mission.campaignCode, businessName: mission.clientProfile.businessName,
      destinationUrl: mission.destinationUrl,
      mainKeyword: mission.keywords.find(k => k.role === 'MAIN')?.keyword ?? null,
      subKeywords: mission.keywords.filter(k => k.role === 'SUB').map(k => k.keyword),
    },
    totals: {
      clicks: totals.clicks,
      uniqueVisitors: totals.uniqueVisitors,
      reviews: ranking.filter(r => r.postUrl).length,
      avgClicksPerReview: ranking.filter(r => r.postUrl).length ? Math.round((totals.clicks / ranking.filter(r => r.postUrl).length) * 10) / 10 : null,
    },
    devices: { mobile: totals.mobile, pc: totals.pc, unknown: totals.unknown },
    daily,
    ranking,
    topReferers: [...referers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, clicks]) => ({ domain, clicks })),
    disclosure: disclosureCounts,
  };
}

/** 체험단원: 내 리뷰별 유입 수 (전체 기간) */
export async function buildParticipantStats(participantId: string) {
  const links = await prisma.trackingLink.findMany({
    where: { participantId },
    select: {
      id: true, code: true, createdAt: true,
      mission: { select: { id: true, title: true } },
      application: { select: { submission: { select: { snsPostUrl: true, status: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (links.length === 0) return [];
  const earliest = links.reduce((min, l) => (l.createdAt < min ? l.createdAt : min), links[0].createdAt);
  const rows = await loadDailyRows(links.map(l => l.id), kstDayKey(earliest), kstDayKey(clock.now()));
  return links.map(l => {
    const t = sumRows(rows.filter(r => r.linkId === l.id));
    return {
      missionId: l.mission.id,
      missionTitle: l.mission.title,
      postUrl: l.application.submission?.snsPostUrl ?? null,
      submissionStatus: l.application.submission?.status ?? null,
      clicks: t.clicks,
      uniqueVisitors: t.uniqueVisitors,
    };
  });
}

/** 운영자: 캠페인별 합계 (사업 성과보고용) */
export async function buildOperatorSummary(range: Range) {
  const missions = await prisma.mission.findMany({
    where: { trackingLinks: { some: {} } },
    select: {
      id: true, title: true, campaignCode: true, regionSi: true, regionGu: true,
      clientProfile: { select: { businessName: true } },
      trackingLinks: { select: { id: true } },
      submissions: { select: { status: true, disclosureCheck: true, snsPostUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const rows = await loadDailyRows(missions.flatMap(m => m.trackingLinks.map(l => l.id)), range.from, range.to);
  const byLink = new Map<string, DailyRow[]>();
  for (const r of rows) byLink.set(r.linkId, [...(byLink.get(r.linkId) ?? []), r]);

  const campaigns = missions.map(m => {
    const t = sumRows(m.trackingLinks.flatMap(l => byLink.get(l.id) ?? []));
    const reviews = m.submissions.filter(s => s.snsPostUrl).length;
    const approved = m.submissions.filter(s => s.status === 'APPROVED').length;
    const disclosed = m.submissions.filter(s => s.disclosureCheck === 'AUTO_PASSED' || s.disclosureCheck === 'MANUAL_CONFIRMED').length;
    return {
      missionId: m.id,
      campaignCode: m.campaignCode,
      missionTitle: m.title,
      businessName: m.clientProfile.businessName,
      region: [m.regionSi, m.regionGu].filter(Boolean).join(' '),
      trackingLinks: m.trackingLinks.length,
      reviews,
      approvedReviews: approved,
      clicks: t.clicks,
      uniqueVisitors: t.uniqueVisitors,
      avgClicksPerReview: reviews ? Math.round((t.clicks / reviews) * 10) / 10 : null,
      mobileRatio: t.clicks ? Math.round((t.mobile / t.clicks) * 1000) / 1000 : null,
      disclosureComplianceRate: m.submissions.length ? Math.round((disclosed / m.submissions.length) * 1000) / 1000 : null,
    };
  });
  const total = campaigns.reduce((acc, c) => ({
    campaigns: acc.campaigns + 1,
    reviews: acc.reviews + c.reviews,
    clicks: acc.clicks + c.clicks,
    uniqueVisitors: acc.uniqueVisitors + c.uniqueVisitors,
  }), { campaigns: 0, reviews: 0, clicks: 0, uniqueVisitors: 0 });
  return {
    notice: REPORT_NOTICE,
    range: { from: formatDay(range.from), to: formatDay(range.to) },
    total: { ...total, avgClicksPerReview: total.reviews ? Math.round((total.clicks / total.reviews) * 10) / 10 : null },
    campaigns,
  };
}

const CSV_COLUMNS = [
  'campaign_code', 'mission_title', 'business_name', 'region', 'period_from', 'period_to', 'tracking_links', 'reviews',
  'approved_reviews', 'total_clicks', 'unique_visitors', 'avg_clicks_per_review', 'mobile_ratio', 'disclosure_compliance_rate',
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // 엑셀 수식 주입 방지
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function summaryToCsv(summary: Awaited<ReturnType<typeof buildOperatorSummary>>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const c of summary.campaigns) {
    lines.push([
      c.campaignCode, c.missionTitle, c.businessName, c.region, summary.range.from, summary.range.to, c.trackingLinks, c.reviews,
      c.approvedReviews, c.clicks, c.uniqueVisitors, c.avgClicksPerReview, c.mobileRatio, c.disclosureComplianceRate,
    ].map(csvCell).join(','));
  }
  // UTF-8 BOM: 엑셀에서 한글이 깨지지 않도록
  return '﻿' + lines.join('\r\n') + '\r\n';
}
