'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Mission {
  id: string; title: string; description: string;
  category: string; rewardAmount: number; status: string;
  regionSi: string; regionGu: string; endDate: string;
  clientProfile: { businessName: string; category: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  VISIT: '방문', SNS: 'SNS', REVIEW: '리뷰', VIDEO: '영상',
};

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/missions').then(({ data }) => setMissions(data.data.missions)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-10 py-16">
        <h1 className="section-title mb-16">미션 탐색</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin" />
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-20 text-muted text-sm">아직 오픈된 미션이 없습니다</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
            {missions.map((m) => (
              <Link key={m.id} href={`/missions/${m.id}`} className="group block bg-white p-4">
                <div className="aspect-[4/5] bg-sand mb-4 flex items-center justify-center overflow-hidden">
                  <span className="text-[11px] tracking-widest2 text-muted">
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h3 className="text-[13px] leading-snug line-clamp-2">{m.title}</h3>
                  <span className="text-[13px] text-muted shrink-0">{Number(m.rewardAmount).toLocaleString()}원</span>
                </div>
                <p className="text-[12px] text-muted line-clamp-2 mb-2">{m.description}</p>
                <div className="flex items-center justify-between text-[11px] text-muted tracking-wide">
                  <span>{m.clientProfile?.businessName}</span>
                  <span>{m.regionSi} {m.regionGu}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
