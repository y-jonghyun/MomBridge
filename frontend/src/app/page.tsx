import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Header />

      <main className="flex-1">
        <section className="max-w-2xl mx-auto px-5 py-24 sm:py-32 text-center">
          <p className="text-[11px] tracking-widest2 text-muted mb-6">HYPERLOCAL MISSION PLATFORM</p>
          <h1 className="font-serif italic text-3xl sm:text-5xl leading-snug mb-8">
            지역 소상공인과 주민을
            <br />
            연결하는 맘브릿지
          </h1>
          <p className="text-sm sm:text-base text-muted leading-loose mb-12">
            소상공인은 진성 콘텐츠를 저렴하게,
            <br className="sm:hidden" /> 지역 주민은 일상으로 수익을
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/missions" className="btn-solid">
              미션 탐색하기 →
            </Link>
            <Link href="/register?role=CLIENT" className="btn-outline">
              미션 등록하기 (소상공인)
            </Link>
          </div>
        </section>

        <section className="spacer h-10" />

        <section className="max-w-6xl mx-auto px-5 sm:px-10 grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border-y border-line mb-32">
          {[
            { title: '소상공인 (고객사)', desc: '홍보 미션 등록 → 진성 콘텐츠 확보' },
            { title: '지역 주민 (참여자)', desc: '미션 수행 → 인증 제출 → 보상 수령' },
            { title: '운영자', desc: '미션 관리 · 검수 · 정산 처리' },
          ].map((item) => (
            <div key={item.title} className="bg-cream py-12 px-6 text-center">
              <h3 className="font-serif italic text-lg mb-3">{item.title}</h3>
              <p className="text-[13px] text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="max-w-4xl mx-auto px-5 py-10 sm:py-16 mb-24">
          <h2 className="section-title">플랫폼 운영 흐름</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 sm:gap-3 mt-10">
            {[
              { step: '01', label: '수요발굴' },
              { step: '02', label: '미션설계' },
              { step: '03', label: '매칭' },
              { step: '04', label: '체험·제작' },
              { step: '05', label: '검수·정산' },
            ].map((s, i) => (
              <div key={s.step} className="text-center relative">
                <span className="block text-[11px] text-muted mb-2 tracking-widest2">{s.step}</span>
                <span className="block text-[13px] tracking-wide">{s.label}</span>
                {i < 4 && (
                  <span className="hidden sm:block absolute -right-2 top-1 text-muted text-sm">›</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
