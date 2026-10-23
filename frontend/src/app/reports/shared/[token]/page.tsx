'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import CampaignReport, { CampaignReportData } from '@/components/campaign/CampaignReport';

/** 공유 링크로 보는 읽기 전용 성과 리포트 (로그인 불필요) */
export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<(CampaignReportData & { expiresAt: string }) | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/reports/shared/${token}`)
      .then(r => setReport(r.data.data))
      .catch(err => setError(err?.response?.status === 410 ? '만료되었거나 폐기된 공유 링크입니다.' : '리포트를 찾을 수 없습니다.'));
  }, [token]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-paper border-b px-6 py-4">
        <h1 className="text-xl font-bold text-ink-2">맘브릿지 <span className="text-sm font-normal text-muted">캠페인 성과 리포트</span></h1>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && <div className="bg-paper rounded-box p-10 text-center text-muted">{error}</div>}
        {report && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink">{report.mission.title}</h2>
              <p className="text-xs text-muted mt-1">이 공유 링크는 {new Date(report.expiresAt).toLocaleString('ko-KR')}에 만료됩니다.</p>
            </div>
            <CampaignReport report={report} />
          </>
        )}
      </div>
    </div>
  );
}
