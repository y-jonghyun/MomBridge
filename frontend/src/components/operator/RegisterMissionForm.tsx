'use client';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import DistrictSelect from '@/components/common/DistrictSelect';
import MissionImageUploader, { type PendingImage } from '@/components/missions/MissionImageUploader';
import { BUSINESS_CATEGORIES, MOM_TAGS } from '@/lib/mission-options';
import { CLIENT_PAYMENT_ENABLED } from '@/lib/features';

/**
 * 운영자가 고객사 대신 미션을 등록하는 폼.
 * 칸이 많아서 여섯 구역으로 묶는다 — 기본 정보 · 장소 · 일정 · 보상 · 안내 · 사진.
 */

export interface RegisterForm {
  clientProfileId: string;
  title: string;
  description: string;
  category: string;
  rewardAmount: string;
  maxParticipants: string;
  regionSi: string;
  regionGu: string;
  regionDong: string;
  visitAddress: string;
  startDate: string;
  endDate: string;
  announceDate: string;
  submissionDeadline: string;
  requirements: string;
  visitGuide: string;
  businessCategory: string;
  momTags: string[];
  visitHours: string;
  sendPaymentLink: boolean;
}

export interface ClientOption {
  id: string;
  businessName: string;
  contactPhone?: string | null;
  user?: { email?: string | null } | null;
}

const input = 'w-full rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink';
const label = 'mb-1 block text-sm font-medium text-ink-2';

/** 구역 하나 */
function Section({ step, title, hint, children }: {
  step: number; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-cream p-4 sm:p-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
          {step}
        </span>
        <h3 className="font-serif text-section-sm font-bold text-ink">{title}</h3>
      </div>
      {hint && <p className="mb-3 text-xs leading-[1.6] text-muted">{hint}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function RegisterMissionForm({
  form, set, clients, pendingImages, onPendingChange, submitting, onSubmit,
}: {
  form: RegisterForm;
  set: (key: keyof RegisterForm, value: string | string[] | boolean) => void;
  clients: ClientOption[];
  pendingImages: PendingImage[];
  onPendingChange: (next: PendingImage[]) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const chosen = clients.find(c => c.id === form.clientProfileId);
  const total = Number(form.rewardAmount || 0) * Number(form.maxParticipants || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Section step={1} title="기본 정보">
        <div>
          <label htmlFor="op-client" className={label}>고객사 *</label>
          <select id="op-client" required className={input}
            value={form.clientProfileId} onChange={e => set('clientProfileId', e.target.value)}>
            <option value="">고객사를 선택하세요</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.businessName} ({c.user?.email}){c.contactPhone ? ` · ${c.contactPhone}` : ' · 연락처 없음'}
              </option>
            ))}
          </select>
          {clients.length === 0 && (
            <p className="mt-1 text-xs text-clay-dark">등록된 고객사가 없습니다. 먼저 고객사 계정을 만들어야 합니다.</p>
          )}
        </div>

        <div>
          <label htmlFor="op-title" className={label}>미션 제목 *</label>
          <input id="op-title" required className={input}
            value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="예: 우리 카페 방문 후 인스타 업로드" />
        </div>

        <div>
          <label htmlFor="op-desc" className={label}>미션 설명 *</label>
          <textarea id="op-desc" required rows={3} className={`${input} resize-none`}
            value={form.description} onChange={e => set('description', e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="op-category" className={label}>미션 유형 *</label>
            <select id="op-category" required className={input}
              value={form.category} onChange={e => set('category', e.target.value)}>
              {[['SNS', 'SNS 게시'], ['VISIT', '방문 인증'], ['REVIEW', '리뷰 작성'], ['VIDEO', '영상 제작']].map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="op-biz" className={label}>업종</label>
            <select id="op-biz" className={input}
              value={form.businessCategory} onChange={e => set('businessCategory', e.target.value)}>
              <option value="">선택 안 함</option>
              {BUSINESS_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section step={2} title="장소" hint="체험단원이 찾아갈 곳입니다. 지역은 미션 목록의 지역 필터에 쓰입니다.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="op-si" className={label}>시·도 *</label>
            <ProvinceSelect required value={form.regionSi}
              onChange={v => { set('regionSi', v); set('regionGu', ''); }} />
          </div>
          <div>
            <label htmlFor="op-gu" className={label}>시·군·구 *</label>
            <DistrictSelect id="op-gu" required province={form.regionSi}
              value={form.regionGu} onChange={v => set('regionGu', v)} />
          </div>
        </div>
        <div>
          <label htmlFor="op-dong" className={label}>동 (선택)</label>
          <input id="op-dong" className={input}
            value={form.regionDong} onChange={e => set('regionDong', e.target.value)} placeholder="예: 합정동" />
        </div>
        <div>
          <label htmlFor="op-address" className={label}>방문 주소 (선택)</label>
          <input id="op-address" className={input}
            value={form.visitAddress} onChange={e => set('visitAddress', e.target.value)}
            placeholder="예: 서울시 마포구 합정동 123 1층" />
          <p className="mt-1 text-xs text-muted">비워 두면 고객사 프로필에 적힌 주소를 보여 줍니다.</p>
        </div>
      </Section>

      <Section step={3} title="일정" hint="신청 시작 → 신청 마감 → 선정 발표 → 후기 마감 순서여야 합니다.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['startDate', '신청 시작일 *', '', true],
            ['endDate', '신청 마감일 *', 'startDate', true],
            ['announceDate', '선정 발표일', 'endDate', false],
            ['submissionDeadline', '후기 마감일 *', form.announceDate ? 'announceDate' : 'endDate', true],
          ] as const).map(([key, text, after, required]) => (
            <div key={key}>
              <label htmlFor={`op-${key}`} className={label}>{text}</label>
              <input id={`op-${key}`} type="date" required={required} className={input}
                min={after ? form[after as 'startDate'] || undefined : undefined}
                value={form[key]} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">선정 발표일을 비우면 상세 화면의 일정에서 그 단계를 보여주지 않습니다.</p>
      </Section>

      <Section step={4} title="보상 · 인원">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="op-reward" className={label}>1인 보상 금액 (원) *</label>
            <input id="op-reward" required type="number" min="1000" className={input}
              value={form.rewardAmount} onChange={e => set('rewardAmount', e.target.value)} placeholder="예: 30000" />
          </div>
          <div>
            <label htmlFor="op-max" className={label}>모집 인원 *</label>
            <input id="op-max" required type="number" min="1" className={input}
              value={form.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} />
          </div>
        </div>
        {total > 0 && (
          <p className="text-sm text-ink-2">
            미션 총액 <strong className="whitespace-nowrap">{total.toLocaleString()}원</strong>
            <span className="ml-1 text-xs text-muted">(보상 × 인원)</span>
          </p>
        )}
      </Section>

      <Section step={5} title="안내">
        <div>
          <label htmlFor="op-req" className={label}>수행 조건 (선택)</label>
          <textarea id="op-req" rows={2} className={`${input} resize-none`}
            value={form.requirements} onChange={e => set('requirements', e.target.value)}
            placeholder="한 줄에 하나씩. 예: 인스타그램 팔로워 300명 이상" />
        </div>
        <div>
          <label htmlFor="op-guide" className={label}>방문·예약 안내 (선택)</label>
          <textarea id="op-guide" rows={3} className={`${input} resize-none`}
            value={form.visitGuide} onChange={e => set('visitGuide', e.target.value)}
            placeholder="한 줄에 하나씩. 예: 체험 가능: 평일 11:30~20:30 / 당일 예약 불가" />
        </div>
        <div>
          <label htmlFor="op-hours" className={label}>방문 가능 시간 (선택)</label>
          <input id="op-hours" className={input}
            value={form.visitHours} onChange={e => set('visitHours', e.target.value)} placeholder="예: 평일 10:00~15:00" />
        </div>
        <div>
          <span className={label}>엄마 시간 태그 (선택)</span>
          <div className="flex flex-wrap gap-2">
            {MOM_TAGS.map(([v, l]) => {
              const on = form.momTags.includes(v);
              return (
                <button key={v} type="button" aria-pressed={on}
                  onClick={() => set('momTags', on ? form.momTags.filter(t => t !== v) : [...form.momTags, v])}
                  className={`flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] ${
                    on ? 'bg-ink font-medium text-paper' : 'border border-line bg-paper text-ink-2'
                  }`}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section step={6} title="사진" hint="첫 장이 대표 사진이 됩니다. 미션을 저장하면 함께 올라갑니다.">
        <MissionImageUploader pending={pendingImages} onPendingChange={onPendingChange} />
      </Section>

      {/* 결제 처리 — 결제를 받지 않는 동안에는 선택지를 숨기고 면제만 쓴다 */}
      {CLIENT_PAYMENT_ENABLED ? (
        <section className="rounded-card border border-line bg-cream p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium text-ink-2">결제 처리</p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="radio" name="paymentOption" className="mt-0.5"
                checked={!form.sendPaymentLink} onChange={() => set('sendPaymentLink', false)} />
              <span>
                <span className="block text-sm font-medium text-ink">결제 면제</span>
                <span className="block text-xs text-muted">운영자 테스트·프로모션 등 결제 없이 바로 등록합니다.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="radio" name="paymentOption" className="mt-0.5"
                checked={form.sendPaymentLink} onChange={() => set('sendPaymentLink', true)} />
              <span>
                <span className="block text-sm font-medium text-ink">결제 링크 발송 (문자·알림톡)</span>
                <span className="block text-xs text-muted">
                  고객사 연락처로 결제 링크를 발송합니다.
                  {chosen?.contactPhone ? ` 수신: ${chosen.contactPhone}` : ' (연락처가 없으면 발송되지 않습니다)'}
                </span>
              </span>
            </label>
          </div>
          {form.sendPaymentLink && total > 0 && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
              결제 요청 금액 <strong className="whitespace-nowrap">{total.toLocaleString()}원</strong>
            </p>
          )}
        </section>
      ) : (
        <p className="rounded-card border border-line bg-cream p-4 text-xs leading-[1.7] text-muted">
          지금은 고객사 결제를 받지 않아 <strong className="text-ink-2">결제 면제</strong>로만 등록됩니다.
          사업자등록이 끝나면 결제 링크 발송을 다시 켭니다.
        </p>
      )}

      <button type="submit" disabled={submitting}
        className="h-12 w-full rounded-card bg-ink text-sm font-bold text-paper disabled:opacity-50">
        {submitting ? '등록 중…' : CLIENT_PAYMENT_ENABLED && form.sendPaymentLink ? '미션 등록 + 결제 링크 발송' : '미션 등록 (결제 면제)'}
      </button>
    </form>
  );
}
