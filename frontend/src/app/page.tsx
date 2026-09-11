import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-purple-700">맘브릿지</h1>
        <div className="flex gap-2">
          <Link href="/login" className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">로그인</Link>
          <Link href="/register" className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">시작하기</Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-5 py-16 text-center">
        <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4 leading-snug">
          지역 소상공인과 주민을 연결하는<br />
          <span className="text-purple-600">하이퍼로컬 미션 플랫폼</span>
        </h2>
        <p className="text-base sm:text-lg text-gray-500 mb-8">
          소상공인은 저렴하게 진성 콘텐츠를,<br className="sm:hidden" /> 지역 주민은 일상으로 수익을
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/missions" className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 text-sm sm:text-base">
            미션 탐색하기
          </Link>
          <Link href="/register?role=CLIENT" className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 text-sm sm:text-base">
            미션 등록하기 (소상공인)
          </Link>
        </div>
      </section>

      <section className="bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '🏪', title: '소상공인 (고객사)', desc: '홍보 미션 등록 → 진성 콘텐츠 확보' },
            { icon: '👤', title: '지역 주민 (참여자)', desc: '미션 수행 → 인증 제출 → 보상 수령' },
            { icon: '⚙️', title: '운영자', desc: '미션 관리 · 검수 · 정산 처리' },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl p-5 shadow-sm flex sm:flex-col items-center sm:text-center gap-4 sm:gap-0">
              <div className="text-3xl sm:text-4xl sm:mb-3 shrink-0">{item.icon}</div>
              <div>
                <h3 className="font-bold text-gray-900 sm:mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
