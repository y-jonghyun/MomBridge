'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-purple-700">맘브릿지</Link>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">로그인</Link>
          <Link href="/register" className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg">가입</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">미션 탐색</h1>

        {missions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">아직 오픈된 미션이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missions.map((m) => (
              <Link key={m.id} href={`/missions/${m.id}`} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </span>
                  <span className="text-sm font-bold text-purple-600">
                    {Number(m.rewardAmount).toLocaleString()}원
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{m.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{m.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{m.clientProfile?.businessName}</span>
                  <span>{m.regionSi} {m.regionGu}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
