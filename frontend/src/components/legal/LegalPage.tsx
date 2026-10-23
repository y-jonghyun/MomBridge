import Link from 'next/link';

/** 이용약관·개인정보처리방침 공통 틀 */
export function LegalPage({ title, effectiveDate, children }: { title: string; effectiveDate: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b px-4 sm:px-6 py-3">
        <Link href="/" className="text-base font-bold text-slate-800">맘브릿지</Link>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
        <p className="text-sm text-gray-500 mb-8">시행일: {effectiveDate}</p>
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-8 text-sm leading-relaxed text-gray-700">{children}</div>
        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/terms" className="hover:underline">이용약관</Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:underline font-semibold">개인정보처리방침</Link>
        </p>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
