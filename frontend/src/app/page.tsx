import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50">
      <nav className="border-b bg-white/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-bold text-slate-800">맘브릿지</h1>
        <div className="flex gap-2">
          <Link href="/login" className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">로그인</Link>
          <Link href="/register" className="px-4 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium">시작하기</Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-5 py-16 sm:py-24 text-center">
        <span className="inline-block text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-5 tracking-wide">하이퍼로컬 미션 매칭 플랫폼</span>
        <h2 className="text-2xl sm:text-5xl font-bold text-slate-900 mb-5 leading-snug tracking-tight">
          지역 소상공인과 주민을<br />연결하는 <span className="text-slate-800">맘브릿지</span>
        </h2>
        <p className="text-base sm:text-lg text-slate-500 mb-10 leading-relaxed">
          소상공인은 진성 콘텐츠를 저렴하게,<br className="sm:hidden" /> 지역 주민은 일상으로 수익을
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/missions" className="px-7 py-3.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 text-sm sm:text-base shadow-sm transition-all">
            미션 탐색하기 →
          </Link>
          <Link href="/register?role=CLIENT" className="px-7 py-3.5 border border-stone-300 text-slate-700 bg-white rounded-xl font-semibold hover:bg-stone-100 text-sm sm:text-base transition-all">
            미션 등록하기 (소상공인)
          </Link>
        </div>
      </section>

      <section className="bg-white border-y border-stone-200 py-14">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: '🏪', title: '소상공인 (고객사)', desc: '홍보 미션 등록 → 진성 콘텐츠 확보', color: 'bg-amber-50 border-amber-100' },
            { icon: '👤', title: '지역 주민 (참여자)', desc: '미션 수행 → 인증 제출 → 보상 수령', color: 'bg-indigo-50 border-indigo-100' },
            { icon: '⚙️', title: '운영자', desc: '미션 관리 · 검수 · 정산 처리', color: 'bg-stone-50 border-stone-200' },
          ].map((item) => (
            <div key={item.title} className={`rounded-2xl p-6 border flex sm:flex-col items-center sm:text-center gap-4 sm:gap-0 ${item.color}`}>
              <div className="text-3xl sm:text-4xl sm:mb-3 shrink-0">{item.icon}</div>
              <div>
                <h3 className="font-bold text-slate-800 sm:mb-1.5">{item.title}</h3>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-14 sm:py-20">
        <h3 className="text-center text-xl font-bold text-slate-800 mb-10">플랫폼 운영 흐름</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { step: '01', label: '수요발굴', icon: '🔍' },
            { step: '02', label: '미션설계', icon: '✏️' },
            { step: '03', label: '매칭', icon: '🤝' },
            { step: '04', label: '체험·제작', icon: '📸' },
            { step: '05', label: '검수·정산', icon: '✅' },
          ].map((s, i) => (
            <div key={s.step} className="bg-white rounded-xl p-4 text-center border border-stone-200 shadow-sm relative">
              <span className="text-xs font-bold text-indigo-400 block mb-1">{s.step}</span>
              <span className="text-2xl block mb-1">{s.icon}</span>
              <span className="text-xs font-semibold text-slate-700">{s.label}</span>
              {i < 4 && <span className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 text-stone-300 text-lg font-bold z-10">›</span>}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-slate-400 bg-white">
        © 2026 맘브릿지 · 지역 마케팅 미션 플랫폼
      </footer>
    </main>
  );
}
