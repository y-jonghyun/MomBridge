'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Guide {
  missionTitle: string;
  requirements: string | null;
  requiresBlogReview: boolean;
  mainKeyword: string | null;
  subKeywords: string[];
  trackingUrl: string | null;
  trackingInstruction: string;
  disclosureInstruction: string;
  disclosureExamples: string[];
}

function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      className="shrink-0 px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-stone-50">
      {done ? '복사됨 ✓' : label}
    </button>
  );
}

/** 체험단원 작성 가이드: 키워드 · 추적 링크(복사) · 대가 표시 예시(복사) */
export function ReviewGuideModal({ missionId, onClose }: { missionId: string; onClose: () => void }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/participant/missions/${missionId}/guide`)
      .then(r => setGuide(r.data.data))
      .catch(err => setError(err?.response?.data?.error?.message ?? '가이드를 불러오지 못했습니다'));
  }, [missionId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-bold text-gray-900">작성 가이드</h2>
            {guide && <p className="text-xs text-gray-400 mt-0.5">{guide.missionTitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-5 text-sm">
          {error && <p className="text-red-600">{error}</p>}
          {guide && (
            <>
              {(guide.mainKeyword || guide.subKeywords.length > 0) && (
                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">키워드</h3>
                  {guide.mainKeyword && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-slate-700 text-white px-2 py-0.5 rounded">메인</span>
                      <span className="font-medium">{guide.mainKeyword}</span>
                      <CopyButton text={guide.mainKeyword} />
                    </div>
                  )}
                  {guide.subKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">서브</span>
                      {guide.subKeywords.map(k => <span key={k} className="text-xs border px-2 py-0.5 rounded">{k}</span>)}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">메인 키워드는 제목과 본문에 자연스럽게 넣어 주세요.</p>
                </section>
              )}

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{guide.trackingInstruction}</h3>
                {guide.trackingUrl ? (
                  <div className="flex items-center gap-2 bg-stone-50 rounded-lg p-2">
                    <code className="flex-1 break-all text-xs">{guide.trackingUrl}</code>
                    <CopyButton text={guide.trackingUrl} label="링크 복사" />
                  </div>
                ) : (
                  <p className="text-gray-500">광고주가 이동할 주소를 아직 등록하지 않았습니다. 등록되면 여기에 링크가 표시됩니다.</p>
                )}
                <p className="text-xs text-gray-500 mt-2">이 링크는 회원님 전용입니다. 다른 링크로 바꾸거나 단축 URL로 바꾸지 마세요.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">대가 표시 (필수)</h3>
                <p className="text-gray-700">{guide.disclosureInstruction}</p>
                <div className="space-y-2 mt-2">
                  {guide.disclosureExamples.map(ex => (
                    <div key={ex} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-2">
                      <span className="flex-1 text-xs text-amber-900">{ex}</span>
                      <CopyButton text={ex} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">&apos;체험단&apos;, &apos;선물 받았어요&apos;처럼 대가 여부가 불분명한 표현은 인정되지 않습니다.</p>
              </section>

              {guide.requirements && (
                <section>
                  <h3 className="font-semibold text-gray-900 mb-1">수행 조건</h3>
                  <p className="text-gray-700 whitespace-pre-line">{guide.requirements}</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const REASON_LABEL: Record<string, string> = {
  FETCH_FAILED: '게시글을 불러오지 못했어요. 운영자가 직접 확인합니다.',
  POST_NOT_FOUND: '공개된 게시글을 찾지 못했어요. 글이 전체 공개인지 확인해 주세요.',
  DISCLOSURE_NOT_FOUND: '대가 표시 문구를 찾지 못했어요. 이미지로 표시했다면 운영자가 직접 확인합니다.',
  DISCLOSURE_NOT_AT_TOP: '대가 표시 문구가 글 끝에 있어요. 제목이나 본문 첫 부분으로 옮겨 주세요.',
};

const WARNING_LABEL: Record<string, string> = {
  NO_TRACKING_LINK: '글에서 추적 링크를 찾지 못했어요. 유입이 집계되지 않을 수 있습니다.',
  NO_MAIN_KEYWORD: '메인 키워드가 글에 없어요.',
};

/** 제출 직후 보여주는 자동 확인 결과 */
export function PostCheckSummary({ submission }: { submission: any }) {
  const r = submission?.postCheckResult;
  if (!r) return null;
  const passed = submission.disclosureCheck === 'AUTO_PASSED' || submission.disclosureCheck === 'MANUAL_CONFIRMED';
  const items: [string, boolean | null][] = [
    ['공개된 글', r.postFound],
    ['추적 링크 포함', r.hasTrackingLink],
    ['메인 키워드 포함', r.hasMainKeyword],
    ['대가 표시 (제목·첫 부분)', r.postFound ? passed : null],
  ];
  return (
    <div className="space-y-2 text-sm">
      <ul className="space-y-1">
        {items.map(([label, ok]) => (
          <li key={label} className="flex items-center gap-2">
            <span className={ok === true ? 'text-green-600' : ok === false ? 'text-amber-600' : 'text-gray-400'}>{ok === true ? '✓' : ok === false ? '!' : '–'}</span>
            <span className="text-gray-700">{label}</span>
          </li>
        ))}
      </ul>
      {[...(r.manualReasons ?? []).map((x: string) => REASON_LABEL[x]), ...(r.warnings ?? []).map((x: string) => WARNING_LABEL[x])]
        .filter(Boolean).map((t: string) => <p key={t} className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1">{t}</p>)}
      {submission.disclosureCheck === 'NEEDS_MANUAL_REVIEW' && <p className="text-xs text-gray-500">운영자 확인 후 검수가 진행됩니다.</p>}
    </div>
  );
}
