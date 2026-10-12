'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Footer from '@/components/Footer';

const CATEGORY_LABEL: Record<string, string> = { VISIT: '방문형', SNS: 'SNS', REVIEW: '리뷰작성', VIDEO: '영상제작' };

const MISSION_ICONS: Record<string, { icon: string; label: string }[]> = {
  SNS:    [{ icon: '#', label: '해시태그' }, { icon: '📸', label: '사진 첨부' }, { icon: '3장↑', label: '3장 이상' }, { icon: '🔗', label: 'URL 제출' }],
  VISIT:  [{ icon: '📍', label: '지도 첨부' }, { icon: '🧾', label: '영수증 인증' }, { icon: '📸', label: '방문 사진' }, { icon: '✍️', label: '후기 작성' }],
  REVIEW: [{ icon: '✍️', label: '리뷰 작성' }, { icon: '#', label: '해시태그' }, { icon: '🔗', label: '링크 제출' }, { icon: '📝', label: '300자 이상' }],
  VIDEO:  [{ icon: '🎬', label: '영상 제작' }, { icon: '60초↑', label: '1분 이상' }, { icon: '🔗', label: 'URL 제출' }, { icon: '📌', label: '설명 첨부' }],
};

function DateRange({ label, start, end }: { label: string; start: string; end: string }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] tracking-widest2 text-muted mb-1.5">{label}</div>
      <div className="flex items-center gap-2 text-[13px]">
        <span>{new Date(start).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
        <span className="text-muted">—</span>
        <span>{new Date(end).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-0 border-b border-line last:border-0">
      <div className="w-32 shrink-0 py-3.5 px-4 text-[12px] text-muted bg-sand">{label}</div>
      <div className="flex-1 py-3.5 px-4 text-[13px] text-ink">{children}</div>
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
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!mission) return (
    <div className="min-h-screen flex items-center justify-center bg-cream text-muted text-sm">미션을 찾을 수 없습니다</div>
  );

  const isOpen = mission.status === 'OPEN';
  const isFull = (mission.currentCount ?? 0) >= mission.maxParticipants;
  const dday = Math.ceil((new Date(mission.endDate).getTime() - Date.now()) / 86400000);
  const pct = Math.min(100, Math.round(((mission.currentCount ?? 0) / mission.maxParticipants) * 100));
  const backHref = user?.role === 'PARTICIPANT' ? '/participant' : user?.role === 'OPERATOR' ? '/operator' : '/missions';
  const missionIcons = MISSION_ICONS[mission.category] ?? MISSION_ICONS['SNS'];

  return (
    <div className="min-h-screen flex flex-col bg-cream pb-24 lg:pb-0">
      {/* 네비게이션 */}
      <header className="bg-cream border-b border-line px-5 sm:px-10 py-4 flex items-center gap-3 sticky top-0 z-20">
        <Link href={backHref} className="text-muted hover:text-ink text-[12px] tracking-wide flex items-center gap-1">← 목록</Link>
        <span className="text-line">|</span>
        <Link href="/" className="font-serif italic text-base">맘브릿지</Link>
      </header>

      {/* 타이틀 헤더 바 */}
      <div className="bg-cream border-b border-line px-5 sm:px-10 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-3 flex-wrap mb-3">
            <span className="text-[11px] tracking-widest2 text-muted border border-line px-2.5 py-1">
              {CATEGORY_LABEL[mission.category]}
            </span>
            {isOpen && dday >= 0 && dday <= 3 && (
              <span className="text-[11px] tracking-widest2 px-2.5 py-1 bg-ink text-cream">마감 임박 D-{dday || 'Day'}</span>
            )}
            <span className="ml-auto text-lg font-serif italic">{Number(mission.rewardAmount).toLocaleString()}원</span>
          </div>
          <h2 className="text-xl leading-tight">{mission.title}</h2>
        </div>
      </div>

      {/* 메인 2컬럼 레이아웃 */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex gap-8 items-start">

        {/* ── 왼쪽 메인 컬럼 ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* 대표 이미지 */}
          <div className="bg-sand overflow-hidden">
            {mission.thumbnailUrl ? (
              <img src={mission.thumbnailUrl} alt="" className="w-full h-60 object-cover" />
            ) : (
              <div className="w-full h-48 flex flex-col items-center justify-center">
                <p className="text-muted text-[13px] font-serif italic">{mission.clientProfile?.businessName}</p>
              </div>
            )}
          </div>

          {/* 참여 스텝 안내 */}
          <div className="border border-line p-6">
            <p className="text-[13px] mb-1">해당 체험단은 <span className="italic font-serif">{CATEGORY_LABEL[mission.category]}</span> 체험단입니다.</p>
            <p className="text-[12px] text-muted mb-5">리뷰어가 해당 장소를 방문하여 서비스나 제품을 체험한 뒤, 사진과 후기를 작성합니다.</p>
            <div className="space-y-2.5">
              {[
                { step: 'STEP1', text: `공고에서 원하는 ${CATEGORY_LABEL[mission.category]} 미션을 찾아 신청해 주세요 (하루 한 번 신청)` },
                { step: 'STEP2', text: '체험 일정에 맞춰 방문 후 콘텐츠를 제출해 주세요' },
                { step: 'STEP3', text: '리뷰 마감일까지 미션을 완료하고 보상을 받아가세요' },
              ].map(({ step, text }) => (
                <div key={step} className="flex gap-3 text-[13px] text-muted">
                  <span className="shrink-0 tracking-widest2 text-[11px] text-ink">{step}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 주요 정보 테이블 */}
          <div className="border border-line overflow-hidden">
            <InfoRow label="주최자">{mission.clientProfile?.businessName ?? '-'}</InfoRow>
            <InfoRow label="제공서비스/물품">
              <span>{Number(mission.rewardAmount).toLocaleString()}원</span>
              <span className="text-muted text-[11px] ml-2">(수수료 10% 제외 후 지급)</span>
            </InfoRow>
            <InfoRow label="활동 지역">{mission.regionSi} {mission.regionGu}</InfoRow>
            {mission.clientProfile?.address && (
              <InfoRow label="방문 주소">{mission.clientProfile.address}</InfoRow>
            )}
            <InfoRow label="모집 인원">
              <div>
                <span>{mission.maxParticipants}명</span>
                <span className="text-muted text-[11px] ml-2">현재 {mission.currentCount ?? 0}명 신청</span>
                <div className="mt-2 h-px bg-line w-40 overflow-hidden">
                  <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </InfoRow>
          </div>

          {/* 미션 소개 */}
          <div className="border border-line p-6">
            <h3 className="text-[13px] tracking-widest2 text-muted mb-3">미션 소개</h3>
            <p className="text-[13px] leading-relaxed whitespace-pre-line">{mission.description}</p>
          </div>

          {/* 키워드 / 태그 */}
          <div className="border border-line p-6">
            <h3 className="text-[13px] tracking-widest2 text-muted mb-3">키워드 정보</h3>
            <div className="flex flex-wrap gap-2">
              {[mission.regionSi, mission.regionGu, CATEGORY_LABEL[mission.category], mission.clientProfile?.businessName]
                .filter(Boolean).map((kw: string) => (
                  <span key={kw} className="text-[11px] border border-line px-3 py-1.5 text-muted">{kw}</span>
                ))}
              {mission.category === 'SNS' && ['#맘브릿지', '#체험단'].map(t => (
                <span key={t} className="text-[11px] border border-line px-3 py-1.5">{t}</span>
              ))}
            </div>
          </div>

          {/* 체험단 미션 아이콘 */}
          <div className="border border-line p-6">
            <h3 className="text-[13px] tracking-widest2 text-muted mb-4">체험단 미션</h3>
            <div className="grid grid-cols-4 gap-3">
              {missionIcons.map(({ icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2 bg-sand py-4 px-2">
                  <div className="w-9 h-9 bg-cream rounded-full flex items-center justify-center text-base border border-line">
                    {icon}
                  </div>
                  <span className="text-[11px] text-muted text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 필수 체크 사항 */}
          {mission.requirements && (
            <div className="border border-line p-6">
              <h3 className="text-[13px] tracking-widest2 text-center mb-4">필수 체크 사항</h3>
              <div className="space-y-2.5">
                {mission.requirements.split('\n').filter(Boolean).map((line: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[13px]">
                    <span className="text-muted shrink-0 mt-0.5">✓</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 주의사항 공통 */}
          <div className="border border-line p-6">
            <h3 className="text-[13px] tracking-widest2 text-muted mb-3">방문 및 예약 안내</h3>
            <div className="space-y-2">
              {[
                '체험 가능 요일: 월/화/수/목/금',
                '체험 가능 시간: 오전 11시 30분 ~ 오후 8시 30분',
                '당일 예약 및 방문 불가',
                '당첨자는 반드시 예약 후 방문해 주세요',
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] text-muted">
                  <span className="shrink-0 mt-1">·</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 댓글 영역 */}
          <div className="border border-line p-6">
            <h3 className="text-[13px] tracking-widest2 text-muted mb-4">댓글</h3>
            <div className="text-center py-6 text-muted text-[13px]">아직 댓글이 없습니다</div>
            {user && (
              <div className="border-t border-line pt-4 flex gap-2">
                <input className="field-input flex-1" placeholder="댓글을 남겨주세요" />
                <button className="btn-outline py-2 px-4">등록</button>
              </div>
            )}
          </div>
        </div>

        {/* ── 오른쪽 사이드바 (sticky, 데스크탑만) ── */}
        <div className="hidden lg:block w-72 shrink-0 sticky top-20 space-y-6">

          {/* 체험단 일정 */}
          <div className="border border-line overflow-hidden">
            <div className="bg-ink text-cream text-[12px] tracking-widest2 px-4 py-3">
              체험단 일정
            </div>
            <div className="p-4">
              <DateRange label="신청 기간" start={mission.startDate} end={mission.endDate} />
              <DateRange label="체험 & 미션 수행" start={mission.startDate} end={mission.endDate} />
              <DateRange label="콘텐츠 제출 마감" start={mission.submissionDeadline} end={mission.submissionDeadline} />
            </div>

            {/* D-Day 카운터 */}
            <div className="mx-4 mb-4 bg-sand py-3 text-center">
              {dday > 0 ? (
                <>
                  <p className="text-[11px] text-muted mb-0.5">모집 마감까지</p>
                  <p className="text-xl font-serif italic">D-{dday}</p>
                </>
              ) : dday === 0 ? (
                <p className="text-base font-serif italic">오늘 마감!</p>
              ) : (
                <p className="text-[13px] text-muted">모집 종료</p>
              )}
            </div>

            {/* 신청하기 버튼 */}
            <div className="px-4 pb-4">
              {user?.role === 'PARTICIPANT' && isOpen && !isFull && !applied && (
                <div className="space-y-2">
                  <textarea
                    className="field-input resize-none text-[12px]"
                    rows={3} placeholder="지원 동기를 간단히 적어주세요 (선택)"
                    value={applyMsg} onChange={e => setApplyMsg(e.target.value)}
                  />
                  <button onClick={handleApply} disabled={applying} className="btn-solid w-full disabled:opacity-50">
                    {applying ? '신청 중...' : '신청하기'}
                  </button>
                </div>
              )}
              {applied && (
                <div className="w-full border border-line py-3 text-center">
                  <p className="text-[13px]">✓ 신청 완료!</p>
                  <p className="text-muted text-[11px] mt-0.5">운영자 승인을 기다려 주세요</p>
                </div>
              )}
              {user?.role === 'PARTICIPANT' && isFull && (
                <button disabled className="w-full border border-line text-muted py-3 text-[12px] tracking-widest2">모집 마감</button>
              )}
              {user?.role === 'PARTICIPANT' && !isOpen && (
                <button disabled className="w-full border border-line text-muted py-3 text-[12px] tracking-widest2">모집 종료</button>
              )}
              {!user && (
                <Link href="/login" className="btn-solid w-full block text-center">
                  로그인 후 신청하기
                </Link>
              )}
              {(user?.role === 'CLIENT' || user?.role === 'OPERATOR') && (
                <button disabled className="w-full border border-line text-muted py-3 text-[12px] tracking-widest2">
                  {user.role === 'OPERATOR' ? '운영자 계정' : '고객사 계정'}
                </button>
              )}
            </div>
          </div>

          {/* 주최사 카드 */}
          <div className="border border-line p-4">
            <p className="text-[11px] text-muted mb-2 tracking-widest2">주최사</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sand rounded-full flex items-center justify-center font-serif italic text-sm">
                {(mission.clientProfile?.businessName ?? '?')[0]}
              </div>
              <div>
                <p className="text-[13px]">{mission.clientProfile?.businessName}</p>
                {mission.clientProfile?.address && (
                  <p className="text-[11px] text-muted mt-0.5 line-clamp-1">{mission.clientProfile.address}</p>
                )}
              </div>
            </div>
          </div>

          {/* 공정위 문구 */}
          <div className="border border-line p-4 text-center">
            <p className="text-[11px] text-muted mb-2">공정위 문구</p>
            <div className="bg-sand py-4 px-3">
              <p className="text-muted text-[11px]">당첨된 이후 확인 가능</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* ── 모바일 하단 신청 바 ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-cream border-t border-line px-5 py-3 z-30">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted">보상금액</p>
            <p className="text-[15px] font-serif italic">{Number(mission.rewardAmount).toLocaleString()}원</p>
          </div>
          <div className="shrink-0 w-44">
            {user?.role === 'PARTICIPANT' && isOpen && !isFull && !applied && (
              <button onClick={handleApply} disabled={applying} className="btn-solid w-full py-2.5 disabled:opacity-50">
                {applying ? '신청 중...' : '신청하기'}
              </button>
            )}
            {applied && (
              <div className="w-full border border-line py-2.5 text-center">
                <p className="text-[12px]">✓ 신청 완료!</p>
              </div>
            )}
            {user?.role === 'PARTICIPANT' && (isFull || !isOpen) && (
              <button disabled className="w-full border border-line text-muted py-2.5 text-[12px]">
                {isFull ? '모집 마감' : '모집 종료'}
              </button>
            )}
            {!user && (
              <Link href="/login" className="btn-solid w-full py-2.5 block text-center">
                로그인 후 신청하기
              </Link>
            )}
            {(user?.role === 'CLIENT' || user?.role === 'OPERATOR') && (
              <button disabled className="w-full border border-line text-muted py-2.5 text-[12px]">
                {user.role === 'OPERATOR' ? '운영자 계정' : '고객사 계정'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
