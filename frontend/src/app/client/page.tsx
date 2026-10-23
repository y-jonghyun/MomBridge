'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { LogOutIcon } from '@/components/ui/icons';
import KeywordRecommender, { KeywordSelection } from '@/components/campaign/KeywordRecommender';
import CampaignPanel from '@/components/campaign/CampaignPanel';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import { CategoryTabs, SiteHeader } from '@/components/ui';
import MissionImageUploader, { uploadPendingImages, type PendingImage } from '@/components/missions/MissionImageUploader';
import { BUSINESS_CATEGORIES, MOM_TAGS } from '@/lib/mission-options';
import { ClientPerformanceCard, MissionProgress, clientMissionStage } from '@/components/client/ClientOverview';

type Tab = 'my-missions' | 'create' | 'results' | 'profile';

const STATUS_LABEL: Record<string, string> = { DRAFT: '임시저장', OPEN: '모집중', IN_PROGRESS: '진행중', REVIEWING: '검수중', CLOSED: '종료' };
const STATUS_COLOR: Record<string, string> = { DRAFT: 'border border-line text-muted', OPEN: 'bg-clay-tint text-clay-dark', IN_PROGRESS: 'bg-clay-tint text-clay-dark', REVIEWING: 'bg-clay-tint text-clay-dark', CLOSED: 'bg-ink text-paper' };

const defaultForm = {
  title: '', description: '', category: 'SNS',
  rewardAmount: '', maxParticipants: '5',
  regionSi: '', regionGu: '',
  startDate: '', endDate: '', submissionDeadline: '',
  requirements: '',
  visitGuide: '',
  destinationUrl: '',
  businessCategory: '',
  momTags: [] as string[],
  visitHours: '',
  announceDate: '',
};

type CreateForm = typeof defaultForm & { keywords?: KeywordSelection | null };

type TossIntent =
  | { type: 'create'; form: CreateForm }
  | { type: 'pay'; missionId: string; amount: number };

async function initiateToss(clientKey: string, intent: TossIntent, orderName: string, customerName: string, totalAmount: number) {
  const orderId = `MB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  sessionStorage.setItem('tossIntent', JSON.stringify(intent));

  if (!(window as any).TossPayments) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.tosspayments.com/v1/payment';
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const tossPayments = (window as any).TossPayments(clientKey);
  await tossPayments.requestPayment('카드', {
    amount: totalAmount,
    orderId,
    orderName,
    customerName,
    successUrl: `${window.location.origin}/client`,
    failUrl: `${window.location.origin}/client`,
  });
}

function ClientPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>('my-missions');
  const [missions, setMissions] = useState<any[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [keywords, setKeywords] = useState<KeywordSelection | null>(null);
  const [clientInfo, setClientInfo] = useState<{ businessName?: string; category: string; regionGu: string; regionDong: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [missionDetail, setMissionDetail] = useState<{ applications: any[]; submissions: any[] } | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', currentPassword: '', newPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'CLIENT' && user.role !== 'OPERATOR') { router.push('/'); return; }

    // Toss failure return
    const paymentCode = searchParams.get('code');
    if (paymentCode) {
      const message = searchParams.get('message') ?? '결제가 취소됐습니다.';
      alert(message);
      sessionStorage.removeItem('tossIntent');
      router.replace('/client');
      setTab('my-missions');
      return;
    }

    // Toss success return
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    if (paymentKey && orderId && amount) {
      const saved = sessionStorage.getItem('tossIntent');
      if (saved) {
        sessionStorage.removeItem('tossIntent');
        const intent: TossIntent = JSON.parse(saved);
        if (intent.type === 'create') {
          setTab('create');
          handleCreateComplete(paymentKey, orderId, Number(amount), intent.form);
        } else if (intent.type === 'pay') {
          setTab('my-missions');
          handlePayComplete(paymentKey, orderId, Number(amount), intent.missionId);
        }
        return;
      }
    }

    loadMissions();
    loadProfile();
  }, [user, hydrated]);

  async function loadProfile() {
    try {
      const [userR, profileR] = await Promise.all([
        api.get('/auth/me'),
        api.get('/client/profile'),
      ]);
      setProfileForm(prev => ({
        ...prev,
        name: userR.data.data.user.name ?? '',
        phone: profileR.data.data.contactPhone ?? '',
      }));
      setClientInfo(profileR.data.data);
    } catch { /* 무시 */ }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const tasks: Promise<any>[] = [];
      if (profileForm.name.trim()) tasks.push(api.patch('/auth/me/name', { name: profileForm.name }));
      if (profileForm.phone) tasks.push(api.patch('/client/profile/phone', { phone: profileForm.phone }));
      if (profileForm.newPassword) {
        // 비밀번호를 바꾸면 다른 기기의 로그인은 끊기고, 이 화면은 새 토큰으로 계속 쓴다
        tasks.push(api.patch('/auth/me/password', {
          currentPassword: profileForm.currentPassword,
          newPassword: profileForm.newPassword,
        }).then(r => {
          if (r.data.data?.accessToken) useAuthStore.getState().setTokens(r.data.data.accessToken, r.data.data.refreshToken);
        }));
      }
      await Promise.all(tasks);
      alert('저장됐습니다.');
      setProfileForm(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '저장에 실패했습니다');
    } finally { setProfileSaving(false); }
  }

  async function loadMissions() {
    setLoading(true);
    try {
      const r = await api.get('/client/missions');
      setMissions(r.data.data);
    } catch { /* 에러 무시 */ } finally { setLoading(false); }
  }

  async function handleCreateComplete(paymentKey: string, orderId: string, amount: number, formData: CreateForm) {
    setSubmitting(true);
    try {
      const { keywords: pickedKeywords, ...fields } = formData;
      const { data: createdRes } = await api.post('/missions/pay-and-create', {
        ...fields,
        keywords: pickedKeywords ?? undefined,
        rewardAmount: Number(formData.rewardAmount),
        maxParticipants: Number(formData.maxParticipants),
        paymentKey, orderId, amount,
      });
      const created = createdRes?.data;
      alert('미션이 등록됐습니다. 운영자 승인 후 오픈됩니다.');
      // 등록 화면에서 고른 사진을 만들어진 미션에 올린다 (실패해도 미션은 남는다)
      if (pendingImages.length > 0 && created?.id) {
        await uploadPendingImages(created.id, pendingImages).catch(() => alert('미션은 등록됐지만 사진을 올리지 못했습니다. 미션 목록에서 다시 올려 주세요.'));
        setPendingImages([]);
      }
      setForm(defaultForm);
      setKeywords(null);
      router.replace('/client');
      setTab('my-missions');
      loadMissions();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '미션 등록에 실패했습니다. 결제는 취소 처리됩니다.');
    } finally { setSubmitting(false); }
  }

  async function handlePayComplete(paymentKey: string, orderId: string, amount: number, missionId: string) {
    setSubmitting(true);
    try {
      await api.patch(`/missions/${missionId}/pay`, { paymentKey, orderId, amount });
      alert('결제가 완료됐습니다. 미션이 활성화 대기 중입니다.');
      router.replace('/client');
      loadMissions();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '결제 처리에 실패했습니다.');
    } finally { setSubmitting(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      alert('결제 설정이 없습니다. 관리자에게 문의하세요.');
      setSubmitting(false);
      return;
    }

    const totalAmount = Number(form.rewardAmount) * Number(form.maxParticipants);
    try {
      await initiateToss(clientKey, { type: 'create', form: { ...form, keywords } }, form.title || '맘브릿지 미션 등록', user?.name ?? '고객사', totalAmount);
    } catch (err: any) {
      sessionStorage.removeItem('tossIntent');
      if (err?.code !== 'USER_CANCEL') alert(err?.message ?? '결제 진행 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  }

  async function handlePayExistingMission(mission: any) {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      alert('결제 설정이 없습니다. 관리자에게 문의하세요.');
      return;
    }
    const totalAmount = Number(mission.rewardAmount) * Number(mission.maxParticipants);
    try {
      await initiateToss(
        clientKey,
        { type: 'pay', missionId: mission.id, amount: totalAmount },
        mission.title,
        user?.name ?? '고객사',
        totalAmount,
      );
    } catch (err: any) {
      sessionStorage.removeItem('tossIntent');
      if (err?.code !== 'USER_CANCEL') alert(err?.message ?? '결제 진행 중 오류가 발생했습니다.');
    }
  }

  async function loadMissionDetail(mission: any) {
    setSelectedMission(mission);
    const [appR, subR] = await Promise.all([
      api.get(`/client/missions/${mission.id}/applications`),
      api.get(`/client/missions/${mission.id}/submissions`),
    ]);
    setMissionDetail({ applications: appR.data.data, submissions: subR.data.data });
    setTab('results');
  }

  const f = (k: keyof typeof form, v: string | string[]) => setForm(prev => ({ ...prev, [k]: v }));
  const totalAmount = Number(form.rewardAmount || 0) * Number(form.maxParticipants || 0);
  const pendingPaymentMissions = missions.filter(m => m.paymentStatus === 'PENDING');

  if (!hydrated || !user) return null;

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader showSearch={false} showMyLink={false} />

      <header className="mx-auto flex w-full max-w-client items-center justify-between gap-2 px-5 pb-2 pt-3.5">
        <div className="min-w-0">
          <span className="font-accent text-[13px] italic tracking-[0.06em] text-muted">For shop owners</span>
          <h1 className="truncate font-serif text-title font-bold">{clientInfo?.businessName || user.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {user.role === 'OPERATOR' && (
            <Link href="/operator" className="rounded-full border border-line px-2 py-1 text-xs text-muted">운영자</Link>
          )}
          <button
            type="button" aria-label="로그아웃"
            onClick={() => { clearAuth(); router.push('/login'); }}
            className="flex h-11 w-11 items-center justify-center text-muted"
          >
            <LogOutIcon size={20} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-client px-5 pb-28 pt-2">

        {/* 결제 대기 중인 미션 알림 배너 */}
        {pendingPaymentMissions.length > 0 && tab === 'my-missions' && (
          <div className="mb-4 bg-clay-tint border border-clay-tint rounded-box p-4">
            <p className="text-sm font-semibold text-clay-dark mb-2">결제 대기 중인 미션이 {pendingPaymentMissions.length}건 있습니다</p>
            <div className="space-y-2">
              {pendingPaymentMissions.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-paper rounded-card px-4 py-3 border border-clay-tint">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.title}</p>
                    <p className="text-xs text-muted">
                      총 결제금액: {(Number(m.rewardAmount) * m.maxParticipants).toLocaleString()}원
                    </p>
                  </div>
                  <button
                    onClick={() => handlePayExistingMission(m)}
                    className="px-4 py-2 bg-clay text-paper text-sm font-semibold rounded-card transition-colors">
                    결제하기
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="-mx-5 mb-2">
          <CategoryTabs
            tabs={[
              { value: 'my-missions', label: '내 미션' },
              { value: 'create', label: '미션 등록' },
              { value: 'results', label: '결과 리포트' },
              { value: 'profile', label: '내 정보' },
            ]}
            value={tab}
            onChange={v => setTab(v as Tab)}
            ariaLabel="고객사 메뉴"
          />
        </div>

        {/* 성과 카드 — 내 미션들의 리포트를 합쳐 보여 준다 */}
        {tab === 'my-missions' && (
          <ClientPerformanceCard missions={missions} onOpenReport={m => loadMissionDetail(m)} />
        )}

        {tab === 'my-missions' && (
          <div className="flex items-baseline justify-between pb-3 pt-[30px]">
            <div>
              <span className="font-accent text-sm italic text-clay">My missions</span>
              <h2 className="mt-0.5 font-serif text-section font-bold">내 미션</h2>
            </div>
            <span className="text-[13px] text-muted">
              진행 {missions.filter(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS' || m.status === 'REVIEWING').length}
              {' · '}완료 {missions.filter(m => m.status === 'CLOSED').length}
            </span>
          </div>
        )}

        {/* 내 미션 목록 */}
        {tab === 'my-missions' && (
          <div className="space-y-3">
            {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" /></div>}
            {!loading && missions.filter(m => m.paymentStatus !== 'PENDING').map(m => (
              <section key={m.id} className="rounded-card border border-line bg-paper p-[18px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{m.title}</p>
                    <p className="mt-[3px] text-xs text-muted">
                      모집 {new Date(m.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      {' – '}{new Date(m.endDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      {' · '}{m.maxParticipants}명
                    </p>
                  </div>
                  <span className={`flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-xs ${STATUS_COLOR[m.status] ?? 'border border-line text-muted'}`}>
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                </div>

                <MissionProgress current={clientMissionStage(m)} />

                <div className="mt-4 grid grid-cols-3 border-t border-line-soft pt-3.5 text-center">
                  {[
                    { label: '신청', value: m._count?.applications ?? 0 },
                    { label: '후기', value: m._count?.submissions ?? 0 },
                    { label: '보상', value: `${Number(m.rewardAmount).toLocaleString()}원` },
                  ].map(c => (
                    <div key={c.label}>
                      <p className="text-lg font-bold">{c.value}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{c.label}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => loadMissionDetail(m)}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-control border border-line text-sm text-ink-2"
                >
                  성과 리포트 보기
                </button>
              </section>
            ))}
            {!loading && missions.filter(m => m.paymentStatus !== 'PENDING').length === 0 && pendingPaymentMissions.length === 0 && (
              <div className="text-center py-20 bg-paper rounded-box text-muted">
                <p className="mb-4">등록한 미션이 없습니다</p>
                <button onClick={() => setTab('create')} className="px-6 py-2 bg-ink text-paper rounded-card text-sm font-semibold">첫 미션 등록하기</button>
              </div>
            )}
          </div>
        )}

        {/* 미션 등록 */}
        {tab === 'create' && (
          <div className="bg-paper rounded-box p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-ink">미션 등록</h2>
              <span className="text-xs text-muted bg-cream px-3 py-1 rounded-full">결제 후 등록</span>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">미션 제목 *</label>
                <input required className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                  value={form.title} onChange={e => f('title', e.target.value)} placeholder="예: 우리 카페 방문 후 인스타 업로드" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">미션 설명 *</label>
                <textarea required rows={4} className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none resize-none"
                  value={form.description} onChange={e => f('description', e.target.value)} placeholder="미션 내용을 자세히 설명해주세요" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">미션 유형 *</label>
                  <select required className="w-full border rounded-control px-3 py-2 text-sm" value={form.category} onChange={e => f('category', e.target.value)}>
                    {[['SNS', 'SNS 게시'], ['VISIT', '방문 인증'], ['REVIEW', '리뷰 작성'], ['VIDEO', '영상 제작']].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">1인 보상금액 (원) *</label>
                  <input required type="number" min="1000" className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                    value={form.rewardAmount} onChange={e => f('rewardAmount', e.target.value)} placeholder="예: 30000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">모집 인원 *</label>
                  <input required type="number" min="1" className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                    value={form.maxParticipants} onChange={e => f('maxParticipants', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">지역 (시·도) *</label>
                  <ProvinceSelect required value={form.regionSi} onChange={v => f('regionSi', v)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">지역 (시·군·구) *</label>
                <input required className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                  value={form.regionGu} onChange={e => f('regionGu', e.target.value)} placeholder="예: 청주시 상당구, 마포구" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {([['startDate', '시작일 *'], ['endDate', '종료일 *'], ['submissionDeadline', '제출 마감일 *']] as const).map(([k, l]) => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-ink-2 mb-1">{l}</label>
                    <input required type="date" className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                      value={form[k]} onChange={e => f(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="rounded-card border border-line bg-cream p-4">
                <MissionImageUploader pending={pendingImages} onPendingChange={setPendingImages} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="client-biz" className="mb-1 block text-sm font-medium text-ink-2">업종</label>
                  <select id="client-biz" className="w-full rounded-control border border-line bg-paper px-3 py-2 text-sm"
                    value={form.businessCategory} onChange={e => f('businessCategory', e.target.value)}>
                    <option value="">선택 안 함</option>
                    {BUSINESS_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="client-hours" className="mb-1 block text-sm font-medium text-ink-2">방문 가능 시간</label>
                  <input id="client-hours" className="w-full rounded-control border border-line bg-paper px-3 py-2 text-sm"
                    value={form.visitHours} onChange={e => f('visitHours', e.target.value)} placeholder="예: 평일 10:00~15:00" />
                </div>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-ink-2">엄마 시간 태그</span>
                <div className="flex flex-wrap gap-2">
                  {MOM_TAGS.map(([v, l]) => {
                    const on = form.momTags.includes(v);
                    return (
                      <button key={v} type="button" aria-pressed={on}
                        onClick={() => f('momTags', on ? form.momTags.filter(t => t !== v) : [...form.momTags, v])}
                        className={`flex h-9 items-center rounded-full px-3.5 text-[13px] ${on ? 'bg-ink font-medium text-paper' : 'border border-line bg-paper text-ink-2'}`}>
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="client-announce" className="mb-1 block text-sm font-medium text-ink-2">선정 발표일</label>
                <input id="client-announce" type="date" className="w-full rounded-control border border-line bg-paper px-3 py-2 text-sm"
                  value={form.announceDate} onChange={e => f('announceDate', e.target.value)} />
                <p className="mt-1 text-xs text-muted">비워 두면 상세 일정에서 이 단계를 보여주지 않습니다.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">도착 URL {form.category === 'REVIEW' ? '(권장)' : '(선택)'}</label>
                <input type="url" className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                  value={form.destinationUrl} onChange={e => f('destinationUrl', e.target.value)} placeholder="예약 페이지·스마트스토어·홈페이지 주소 (https://...)" />
                <p className="text-xs text-muted mt-1">체험단원마다 이 주소로 연결되는 추적 링크가 발급되어 리뷰 유입을 집계합니다. 등록 후에도 변경할 수 있습니다.</p>
              </div>
              <KeywordRecommender
                defaultCategory={clientInfo?.category ?? ''}
                defaultRegion={[form.regionGu || clientInfo?.regionGu, clientInfo?.regionDong].filter(Boolean).join(' ')}
                value={keywords}
                onChange={setKeywords}
              />
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">수행 조건 (선택)</label>
                <textarea rows={2} className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none resize-none"
                  value={form.requirements} onChange={e => f('requirements', e.target.value)} placeholder="예: 인스타그램 팔로워 500명 이상, 게시물 24시간 이상 유지" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">방문·예약 안내 (선택)</label>
                <textarea rows={3} className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none resize-none"
                  value={form.visitGuide} onChange={e => f('visitGuide', e.target.value)}
                  placeholder={'한 줄에 하나씩 적어 주세요. 예:\n체험 가능: 평일 11:30~20:30\n당일 예약 불가, 전화로 예약 후 방문'} />
                <p className="text-xs text-muted mt-1">비워 두면 미션 상세에 이 안내가 표시되지 않습니다.</p>
              </div>
              {form.rewardAmount && form.maxParticipants && (
                <div className="bg-cream rounded-card p-4 border border-line">
                  <div className="flex justify-between text-sm text-ink-2 mb-1">
                    <span>1인 보상금액</span>
                    <span>{Number(form.rewardAmount).toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between text-sm text-ink-2 mb-2">
                    <span>모집 인원</span>
                    <span>{form.maxParticipants}명</span>
                  </div>
                  <div className="flex justify-between font-bold text-ink text-base border-t pt-2">
                    <span>총 결제 금액</span>
                    <span>{totalAmount.toLocaleString()}원</span>
                  </div>
                  <p className="text-xs text-muted mt-2">토스페이먼츠를 통해 안전하게 결제됩니다</p>
                </div>
              )}
              <button type="submit" disabled={submitting}
                className="w-full bg-ink text-paper rounded-card py-3 font-semibold disabled:opacity-50 transition-colors">
                {submitting
                  ? '처리 중...'
                  : `${totalAmount > 0 ? `${totalAmount.toLocaleString()}원 ` : ''}결제하고 등록하기`}
              </button>
            </form>
          </div>
        )}

        {/* 내 정보 */}
        {tab === 'profile' && (
          <div className="bg-paper rounded-box p-6">
            <h2 className="text-lg font-bold text-ink mb-6">내 정보 수정</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">이름</label>
                <input className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                  value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">연락처 (SMS 수신용)</label>
                <input type="tel" placeholder="예: 01012345678"
                  className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                  value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
                <p className="text-xs text-muted mt-1">운영자가 결제 링크를 발송할 때 사용됩니다</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-ink-2 mb-3">비밀번호 변경 (선택)</p>
                <div className="space-y-3">
                  <input type="password" placeholder="현재 비밀번호"
                    className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                    value={profileForm.currentPassword} onChange={e => setProfileForm(p => ({ ...p, currentPassword: e.target.value }))} />
                  <input type="password" placeholder="새 비밀번호 (6자 이상)"
                    className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                    value={profileForm.newPassword} onChange={e => setProfileForm(p => ({ ...p, newPassword: e.target.value }))} />
                </div>
              </div>
              <button type="submit" disabled={profileSaving}
                className="w-full bg-ink text-paper rounded-card py-3 font-semibold disabled:opacity-50 transition-colors">
                {profileSaving ? '저장 중...' : '저장하기'}
              </button>
            </form>
          </div>
        )}

        {/* 결과 리포트 */}
        {tab === 'results' && (
          <div>
            {!selectedMission ? (
              <div className="text-center py-20 text-muted bg-paper rounded-box">미션 목록에서 결과보기를 클릭하세요</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-paper rounded-box p-5">
                  <h3 className="font-bold text-ink text-lg mb-1">{selectedMission.title}</h3>
                  <div className="flex gap-4 text-sm text-muted">
                    <span>보상 {Number(selectedMission.rewardAmount).toLocaleString()}원</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[selectedMission.status] ?? 'bg-cream'}`}>{STATUS_LABEL[selectedMission.status]}</span>
                  </div>
                </div>
                {missionDetail && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: '총 지원자', value: missionDetail.applications.length, color: 'text-ink' },
                        { label: '승인된 지원', value: missionDetail.applications.filter(a => a.status === 'APPROVED').length, color: 'text-sage' },
                        { label: '콘텐츠 제출', value: missionDetail.submissions.length, color: 'text-ink-2' },
                      ].map(s => (
                        <div key={s.label} className="bg-paper rounded-box p-4 text-center">
                          <p className="text-sm text-muted mb-1">{s.label}</p>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <CampaignPanel mission={selectedMission} defaultCategory={clientInfo?.category ?? ''} />
                    {missionDetail.submissions.length > 0 && (
                      <div className="bg-paper rounded-box p-5">
                        <h4 className="font-semibold text-ink mb-4">제출된 콘텐츠</h4>
                        <div className="space-y-3">
                          {missionDetail.submissions.map((s: any) => (
                            <div key={s.id} className="border rounded-card p-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-ink-2">{s.participant?.user?.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status] ?? 'bg-cream text-ink-2'}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
                              </div>
                              {s.description && <p className="text-sm text-ink-2">{s.description}</p>}
                              {s.snsPostUrl && <a href={s.snsPostUrl} target="_blank" rel="noreferrer" className="text-xs text-clay underline">SNS 링크 →</a>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 고정 — 어느 탭에서든 새 미션을 등록할 수 있게 */}
      {tab !== 'create' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-5 py-3">
          <button
            onClick={() => setTab('create')}
            className="mx-auto flex h-[52px] w-full max-w-client items-center justify-center rounded-control-lg bg-clay text-base font-bold text-paper"
          >
            새 미션 등록
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={null}>
      <ClientPageContent />
    </Suspense>
  );
}
