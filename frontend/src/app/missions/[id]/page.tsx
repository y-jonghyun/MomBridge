'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const CATEGORY_LABEL: Record<string, string> = { VISIT: '방문형', SNS: 'SNS', REVIEW: '리뷰작성', VIDEO: '영상제작' };
const CATEGORY_COLOR: Record<string, string> = {
  VISIT: 'bg-green-100 text-green-700',
  SNS: 'bg-pink-100 text-pink-700',
  REVIEW: 'bg-blue-100 text-blue-700',
  VIDEO: 'bg-red-100 text-red-700',
};

const MISSION_ICONS: Record<string, { icon: string; label: string }[]> = {
  SNS:    [{ icon: '#', label: '해시태그' }, { icon: '📸', label: '사진 첨부' }, { icon: '3장↑', label: '3장 이상' }, { icon: '🔗', label: 'URL 제출' }],
  VISIT:  [{ icon: '📍', label: '지도 첨부' }, { icon: '🧾', label: '영수증 인증' }, { icon: '📸', label: '방문 사진' }, { icon: '✍️', label: '후기 작성' }],
  REVIEW: [{ icon: '✍️', label: '리뷰 작성' }, { icon: '#', label: '해시태그' }, { icon: '🔗', label: '링크 제출' }, { icon: '📝', label: '300자 이상' }],
  VIDEO:  [{ icon: '🎬', label: '영상 제작' }, { icon: '60초↑', label: '1분 이상' }, { icon: '🔗', label: 'URL 제출' }, { icon: '📌', label: '설명 첨부' }],
};

function DateRange({ label, start, end, color }: { label: string; start: string; end: string; color: string }) {
  return (
    <div className="mb-3">
      <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1.5 ${color}`}>{label}</div>
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="font-semibold">{new Date(start).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
        <span className="text-gray-300">—</span>
        <span className="font-semibold">{new Date(end).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-0 border-b border-gray-50 last:border-0">
      <div className="w-32 shrink-0 py-3.5 px-4 text-sm text-gray-500 font-medium bg-gray-50">{label}</div>
      <div className="flex-1 py-3.5 px-4 text-sm text-gray-800">{children}</div>
    </div>
  );
}

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applyMsg, setApplyMsg] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.get(`/missions/${id}`).then(r => setMission(r.data.data)).finally(() => setLoading(false));
  }, [id]);

  async function handleApply() {
    if (!user) { router.push('/login'); return; }
    setApplying(true);
    try {
      await api.post('/submissions/apply', { missionId: id, message: applyMsg });
      setApplied(true);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '지원에 실패했습니다');
    } finally { setApplying(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!mission) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">미션을 찾을 수 없습니다</div>
  );

  const isOpen = mission.status === 'OPEN';
  const isFull = (mission.currentCount ?? 0) >= mission.maxParticipants;
  const dday = Math.ceil((new Date(mission.endDate).getTime() - Date.now()) / 86400000);
  const pct = Math.min(100, Math.round(((mission.currentCount ?? 0) / mission.maxParticipants) * 100));
  const backHref = user?.role === 'PARTICIPANT' ? '/participant' : user?.role === 'OPERATOR' ? '/operator' : '/missions';
  const missionIcons = MISSION_ICONS[mission.category] ?? MISSION_ICONS['SNS'];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 네비게이션 */}
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <Link href={backHref} className="text-gray-400 hover:text-gray-700 text-sm flex items-center gap-1">← 목록</Link>
        <span className="text-gray-200">|</span>
        <h1 className="text-base font-bold text-purple-700">맘브릿지</h1>
      </nav>

      {/* 타이틀 헤더 바 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-3 flex-wrap mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLOR[mission.category] ?? 'bg-gray-100 text-gray-600'}`}>
              {CATEGORY_LABEL[mission.category]}
            </span>
            {mission.category === 'VISIT' && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">방문형</span>}
            {isOpen && dday >= 0 && dday <= 3 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500 text-white">마감 임박 D-{dday || 'Day'}</span>
            )}
            <span className="ml-auto text-xl font-extrabold text-purple-600">{Number(mission.rewardAmount).toLocaleString()}원</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{mission.title}</h2>
        </div>
      </div>

      {/* 메인 2컬럼 레이아웃 */}
      <div className="max-w-5xl mx-auto px-4 py-5 flex gap-5 items-start">

        {/* ── 왼쪽 메인 컬럼 ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* 대표 이미지 */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            {mission.thumbnailUrl ? (
              <img src={mission.thumbnailUrl} alt="" className="w-full h-60 object-cover" />
            ) : (
              <div className="w-full h-44 bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col items-center justify-center">
                <div className="text-5xl mb-2">{{ VISIT: '📍', SNS: '📸', REVIEW: '✍️', VIDEO: '🎬' }[mission.category as string] ?? '🎯'}</div>
                <p className="text-purple-400 text-sm font-medium">{mission.clientProfile?.businessName}</p>
              </div>
            )}
          </div>

          {/* 참여 스텝 안내 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-1">해당 체험단은 <span className="text-purple-600">{CATEGORY_LABEL[mission.category]}</span> 체험단입니다.</p>
            <p className="text-xs text-gray-400 mb-4">리뷰어가 해당 장소를 방문하여 서비스나 제품을 체험한 뒤, 사진과 후기를 작성합니다.</p>
            <div className="space-y-2">
              {[
                { step: 'STEP1', text: `공고에서 원하는 ${CATEGORY_LABEL[mission.category]} 미션을 찾아 신청해 주세요 (하루 한 번 신청)` },
                { step: 'STEP2', text: '체험 일정에 맞춰 방문 후 콘텐츠를 제출해 주세요' },
                { step: 'STEP3', text: '리뷰 마감일까지 미션을 완료하고 보상을 받아가세요' },
              ].map(({ step, text }) => (
                <div key={step} className="flex gap-2 text-sm text-gray-600">
                  <span className="shrink-0 font-bold text-purple-500">{step}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 주요 정보 테이블 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <InfoRow label="주최자">{mission.clientProfile?.businessName ?? '-'}</InfoRow>
            <InfoRow label="제공서비스/물품">
              <span className="font-semibold text-purple-700">{Number(mission.rewardAmount).toLocaleString()}원</span>
              <span className="text-gray-400 text-xs ml-2">(수수료 10% 제외 후 지급)</span>
            </InfoRow>
            <InfoRow label="활동 지역">{mission.regionSi} {mission.regionGu}</InfoRow>
            {mission.clientProfile?.address && (
              <InfoRow label="방문 주소">{mission.clientProfile.address}</InfoRow>
            )}
            <InfoRow label="모집 인원">
              <div>
                <span className="font-semibold">{mission.maxParticipants}명</span>
                <span className="text-gray-400 text-xs ml-2">현재 {mission.currentCount ?? 0}명 신청</span>
                <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full w-40 overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-400' : 'bg-purple-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </InfoRow>
          </div>

          {/* 미션 소개 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-500 rounded-full" />미션 소개
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{mission.description}</p>
          </div>

          {/* 키워드 / 태그 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-pink-400 rounded-full" />키워드 정보
            </h3>
            <div className="flex flex-wrap gap-2">
              {[mission.regionSi, mission.regionGu, CATEGORY_LABEL[mission.category], mission.clientProfile?.businessName]
                .filter(Boolean).map((kw: string) => (
                  <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">{kw}</span>
                ))}
              {mission.category === 'SNS' && ['#맘브릿지', '#체험단'].map(t => (
                <span key={t} className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-full font-medium">{t}</span>
              ))}
            </div>
          </div>

          {/* 체험단 미션 아이콘 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-400 rounded-full" />체험단 미션
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {missionIcons.map(({ icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2 bg-gray-50 rounded-xl py-3 px-2">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-lg shadow-sm border border-gray-100">
                    {icon}
                  </div>
                  <span className="text-xs text-gray-600 text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 필수 체크 사항 */}
          {mission.requirements && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                <h3 className="text-sm font-bold text-red-700 mb-3 text-center">필수 체크 사항</h3>
                <div className="space-y-2.5">
                  {mission.requirements.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-red-400 font-bold shrink-0 mt-0.5">✓</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 주의사항 공통 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-yellow-400 rounded-full" />방문 및 예약 안내
            </h3>
            <div className="space-y-2">
              {[
                '체험 가능 요일: 월/화/수/목/금',
                '체험 가능 시간: 오전 11시 30분 ~ 오후 8시 30분',
                '당일 예약 및 방문 불가',
                '당첨자는 반드시 예약 후 방문해 주세요',
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-gray-300 shrink-0 mt-1">·</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 댓글 영역 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">댓글</h3>
            <div className="text-center py-6 text-gray-300 text-sm">아직 댓글이 없습니다</div>
            {user && (
              <div className="border-t pt-4 flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="댓글을 남겨주세요"
                />
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">등록</button>
              </div>
            )}
          </div>
        </div>

        {/* ── 오른쪽 사이드바 (sticky) ── */}
        <div className="w-72 shrink-0 sticky top-16 space-y-4">

          {/* 체험단 일정 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-700 text-white text-sm font-bold px-4 py-3 flex items-center justify-between">
              <span>체험단 일정</span>
              <span className="text-gray-400 text-xs">▼</span>
            </div>
            <div className="p-4 space-y-1">
              <DateRange label="신청 기간" start={mission.startDate} end={mission.endDate} color="bg-purple-100 text-purple-700" />
              <DateRange label="체험 & 미션 수행" start={mission.startDate} end={mission.endDate} color="bg-pink-100 text-pink-700" />
              <DateRange label="콘텐츠 제출 마감" start={mission.submissionDeadline} end={mission.submissionDeadline} color="bg-orange-100 text-orange-700" />
            </div>

            {/* D-Day 카운터 */}
            <div className="mx-4 mb-4 bg-gray-50 rounded-lg py-3 text-center">
              {dday > 0 ? (
                <>
                  <p className="text-xs text-gray-400 mb-0.5">모집 마감까지</p>
                  <p className="text-2xl font-extrabold text-red-500">D-{dday}</p>
                </>
              ) : dday === 0 ? (
                <p className="text-lg font-extrabold text-red-500">오늘 마감!</p>
              ) : (
                <p className="text-lg font-bold text-gray-400">모집 종료</p>
              )}
            </div>

            {/* 신청하기 버튼 */}
            <div className="px-4 pb-4">
              {user?.role === 'PARTICIPANT' && isOpen && !isFull && !applied && (
                <div className="space-y-2">
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3} placeholder="지원 동기를 간단히 적어주세요 (선택)"
                    value={applyMsg} onChange={e => setApplyMsg(e.target.value)}
                  />
                  <button onClick={handleApply} disabled={applying}
                    className="w-full bg-purple-600 text-white rounded-lg py-3 font-bold text-sm hover:bg-purple-700 disabled:opacity-50 shadow-md">
                    {applying ? '신청 중...' : '신청하기'}
                  </button>
                </div>
              )}
              {applied && (
                <div className="w-full bg-green-50 border border-green-200 rounded-lg py-3 text-center">
                  <p className="text-green-700 font-bold text-sm">✓ 신청 완료!</p>
                  <p className="text-green-500 text-xs mt-0.5">운영자 승인을 기다려 주세요</p>
                </div>
              )}
              {user?.role === 'PARTICIPANT' && isFull && (
                <button disabled className="w-full bg-gray-200 text-gray-400 rounded-lg py-3 font-bold text-sm">모집 마감</button>
              )}
              {user?.role === 'PARTICIPANT' && !isOpen && (
                <button disabled className="w-full bg-gray-200 text-gray-400 rounded-lg py-3 font-bold text-sm">모집 종료</button>
              )}
              {!user && (
                <Link href="/login" className="block w-full bg-purple-600 text-white rounded-lg py-3 font-bold text-sm text-center hover:bg-purple-700 shadow-md">
                  로그인 후 신청하기
                </Link>
              )}
              {(user?.role === 'CLIENT' || user?.role === 'OPERATOR') && (
                <button disabled className="w-full bg-gray-100 text-gray-400 rounded-lg py-3 font-bold text-sm">
                  {user.role === 'OPERATOR' ? '운영자 계정' : '고객사 계정'}
                </button>
              )}
            </div>
          </div>

          {/* 주최사 카드 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium">주최사</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">
                {(mission.clientProfile?.businessName ?? '?')[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{mission.clientProfile?.businessName}</p>
                {mission.clientProfile?.address && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{mission.clientProfile.address}</p>
                )}
              </div>
            </div>
          </div>

          {/* 공정위 문구 */}
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-400 mb-2">공정위 문구</p>
            <div className="bg-gray-100 rounded-lg py-4 px-3">
              <p className="text-gray-400 text-xs">당첨된 이후 확인 가능</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
