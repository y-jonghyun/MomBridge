import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-700">맘브릿지</h1>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">로그인</Link>
          <Link href="/register" className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">시작하기</Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          지역 소상공인과 주민을 연결하는<br />
          <span className="text-purple-600">하이퍼로컬 미션 플랫폼</span>
        </h2>
        <p className="text-lg text-gray-500 mb-10">
          소상공인은 저렴하게 진성 콘텐츠를, 지역 주민은 일상으로 수익을
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/missions" className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700">
            미션 탐색하기
          </Link>
          <Link href="/register?role=CLIENT" className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50">
            미션 등록하기 (소상공인)
          </Link>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8">
          {[
            { icon: '🏪', title: '소상공인 (고객사)', desc: '홍보 미션 등록 → 진성 콘텐츠 확보' },
            { icon: '👤', title: '지역 주민 (참여자)', desc: '미션 수행 → 인증 제출 → 보상 수령' },
            { icon: '⚙️', title: '운영자', desc: '미션 관리 · 검수 · 정산 처리' },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
