'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { DangerButton, PrimaryButton, QuietButton } from './ui';

/**
 * 운영 설정 편집.
 *
 * 기본 화면은 쉬운 입력(선택 상자·숫자 칸·문구 목록)으로 보여 주고,
 * JSON·정규식 원문은 '고급' 접기 안에 둔다.
 * 저장 전에 값을 검사해서 잘못된 값은 서버로 보내지 않는다.
 */

type Item = { key: string; value: unknown; defaultValue: unknown };

const LABEL: Record<string, { title: string; help: string }> = {
  'keyword.sort': {
    title: '키워드 정렬 기준',
    help: '고객사에게 추천 키워드를 어떤 순서로 보여 줄지 정합니다.',
  },
  'submission.disclosurePhrases': {
    title: '대가 표시 인정 문구',
    help: "후기에 이 문구가 있으면 대가 표시로 인정합니다. '체험단', '선물'처럼 공정위 지침상 불명확한 표현은 넣지 마세요.",
  },
  'click.excludeSelf': {
    title: '체험단원 본인 클릭 제외',
    help: '켜면 체험단원이 자기 추적 링크를 누른 것은 집계하지 않습니다(이동은 됩니다).',
  },
  'click.botRules': {
    title: '봇 제외 규칙',
    help: 'User-Agent가 규칙에 걸리는 클릭은 집계에서 뺍니다.',
  },
};

const SORT_MODES = [
  ['recommended', '추천 점수순'],
  ['volume', '검색량 많은 순'],
  ['competition', '경쟁 낮은 순'],
] as const;

const input = 'w-full rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink';
const numberInput = 'w-28 rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink';

/** 정규식에서 뜻을 가지는 글자를 글자 그대로 찾도록 바꾼다 */
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 사람이 적은 문구 → 정규식. 띄어쓰기는 있어도 없어도 걸리게 한다 */
export function phraseToPattern(phrase: string): string {
  return escapeRegex(phrase.trim()).replace(/\s+/g, '\\s*');
}

/** 정규식 → 사람이 읽을 문구 */
export function patternToPhrase(pattern: string): string {
  return pattern.replace(/\\s\*/g, ' ').replace(/\\(.)/g, '$1');
}

/**
 * 쉬운 입력칸에서 고쳐도 되는 문구인지.
 *
 * 기본값에는 `(제품|상품) (을|를)? … 받`처럼 여러 표현을 한 번에 잡는 정규식이 들어 있다.
 * 그런 값을 글자 칸에 그대로 보여 주고 고치게 하면 괄호·파이프가 escape되어 조용히 망가진다.
 * 그래서 '되돌렸다 다시 바꿨을 때 똑같아지는' 문구만 글자 칸으로 열어 준다.
 */
export function isPlainPhrase(pattern: string): boolean {
  return phraseToPattern(patternToPhrase(pattern)) === pattern;
}

function Row({ title, help, children, onSave, onReset, saving, error }: {
  title: string; help: string; children: React.ReactNode;
  onSave: () => void; onReset: () => void; saving: boolean; error?: string;
}) {
  return (
    <section className="space-y-3 rounded-box bg-paper p-5">
      <div>
        <h3 className="font-serif text-section-sm font-bold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs leading-[1.6] text-muted">{help}</p>
      </div>
      {children}
      {error && <p className="text-[13px] text-clay-dark">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={onSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</PrimaryButton>
        <DangerButton confirmLabel="기본값으로 되돌릴까요?" onConfirm={onReset}>기본값으로</DangerButton>
      </div>
    </section>
  );
}

/** JSON 원문 편집 — 평소에는 접어 둔다 */
function Advanced({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <details className="rounded-card border border-line bg-cream p-3">
      <summary className="cursor-pointer text-xs text-muted">고급 — 원문 직접 편집</summary>
      <textarea rows={8} value={value} onChange={e => onChange(e.target.value)}
        className="mt-2 w-full rounded-control border border-line bg-paper px-3 py-2 font-mono text-xs" />
    </details>
  );
}

export default function SettingsEditor() {
  const [items, setItems] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/operator/settings');
    const list: Item[] = data.data;
    setItems(list);
    setDrafts(Object.fromEntries(list.map(i => [i.key, i.value])));
    setRaw(Object.fromEntries(list.map(i => [i.key, JSON.stringify(i.value, null, 2)])));
    setErrors({});
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** 쉬운 입력을 고치면 원문도 같이 맞춘다 */
  const put = (key: string, value: unknown) => {
    setDrafts(d => ({ ...d, [key]: value }));
    setRaw(r => ({ ...r, [key]: JSON.stringify(value, null, 2) }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  /** 원문을 고치면 쉬운 입력에 반영한다 (JSON이 깨졌으면 저장할 때 막는다) */
  const putRaw = (key: string, text: string) => {
    setRaw(r => ({ ...r, [key]: text }));
    try {
      put(key, JSON.parse(text));
      setRaw(r => ({ ...r, [key]: text })); // put이 다시 쓴 원문을 사용자가 친 그대로 되돌린다
    } catch {
      setErrors(e => ({ ...e, [key]: 'JSON 형식이 올바르지 않습니다' }));
    }
  };

  /** 저장 전 검사 — 잘못된 값이면 서버로 보내지 않는다 */
  function validate(key: string, value: unknown): string | null {
    if (errors[key]) return errors[key];

    if (key === 'keyword.sort') {
      const v = value as { mode?: string; volumeBand?: number[]; weights?: Record<string, number> };
      if (!SORT_MODES.some(([m]) => m === v.mode)) return '정렬 기준을 골라 주세요';
      const [low, high] = v.volumeBand ?? [];
      if (!Number.isInteger(low) || !Number.isInteger(high)) return '검색량 구간은 정수로 적어 주세요';
      if (low < 0 || high < 1) return '검색량 구간은 0 이상이어야 합니다';
      if (low >= high) return '검색량 구간의 시작이 끝보다 작아야 합니다';
      for (const [name, w] of Object.entries(v.weights ?? {})) {
        if (typeof w !== 'number' || w < 0 || w > 1) return `가중치 ${name}은 0과 1 사이여야 합니다`;
      }
      return null;
    }

    if (key === 'submission.disclosurePhrases') {
      const list = value as string[];
      if (!Array.isArray(list) || list.length === 0) return '문구를 하나 이상 넣어 주세요';
      for (const pattern of list) {
        if (!pattern.trim()) return '빈 문구는 넣을 수 없습니다';
        try { new RegExp(pattern, 'i'); } catch { return `정규식이 올바르지 않습니다: ${pattern}`; }
      }
      return null;
    }

    if (key === 'click.botRules') {
      const list = value as { name?: string; pattern?: string }[];
      if (!Array.isArray(list)) return '규칙 목록이 올바르지 않습니다';
      for (const rule of list) {
        if (!rule.name?.trim()) return '규칙 이름을 적어 주세요';
        if (!rule.pattern?.trim()) return '규칙의 정규식을 적어 주세요';
        try { new RegExp(rule.pattern, 'i'); } catch { return `정규식이 올바르지 않습니다: ${rule.pattern}`; }
      }
      return null;
    }

    return null;
  }

  async function save(key: string) {
    const value = drafts[key];
    const problem = validate(key, value);
    if (problem) { setErrors(e => ({ ...e, [key]: problem })); return; }

    setSaving(key);
    try {
      await api.put(`/operator/settings/${key}`, { value });
      setMsg(`${LABEL[key]?.title ?? key} 저장됨`);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setErrors(prev => ({ ...prev, [key]: e?.response?.data?.error?.message ?? '저장하지 못했습니다' }));
    } finally { setSaving(null); }
  }

  async function reset(key: string) {
    await api.delete(`/operator/settings/${key}`);
    setMsg('기본값으로 되돌렸습니다');
    await load();
  }

  const find = (key: string) => items.find(i => i.key === key);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">운영 설정</h2>
      {msg && <p className="rounded-card border border-line bg-cream px-4 py-2 text-sm text-ink-2">{msg}</p>}

      {/* 키워드 정렬 */}
      {find('keyword.sort') && (() => {
        const key = 'keyword.sort';
        const v = (drafts[key] ?? {}) as { mode: string; volumeBand: [number, number]; weights: Record<string, number> };
        const band = v.volumeBand ?? [0, 1];
        const weights = v.weights ?? {};
        const WEIGHT_LABEL: Record<string, string> = { band: '검색량 구간', competition: '경쟁 낮음', regionCategory: '지역·업종 맞춤' };
        return (
          <Row key={key} title={LABEL[key].title} help={LABEL[key].help}
            onSave={() => save(key)} onReset={() => reset(key)} saving={saving === key} error={errors[key]}>
            <div>
              <label htmlFor="set-mode" className="mb-1 block text-sm font-medium text-ink-2">정렬 기준</label>
              <select id="set-mode" className={input} value={v.mode ?? ''}
                onChange={e => put(key, { ...v, mode: e.target.value })}>
                {SORT_MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-ink-2">적당한 검색량 구간</span>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                <input type="number" min={0} className={numberInput} value={band[0]} aria-label="검색량 구간 시작"
                  onChange={e => put(key, { ...v, volumeBand: [Number(e.target.value), band[1]] })} />
                <span>~</span>
                <input type="number" min={1} className={numberInput} value={band[1]} aria-label="검색량 구간 끝"
                  onChange={e => put(key, { ...v, volumeBand: [band[0], Number(e.target.value)] })} />
                <span className="text-xs text-muted">월 검색 수</span>
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-ink-2">점수 가중치 (0 ~ 1)</span>
              <div className="flex flex-wrap gap-3">
                {Object.entries(weights).map(([name, w]) => (
                  <label key={name} className="flex items-center gap-2 text-sm text-ink-2">
                    <span className="whitespace-nowrap text-xs text-muted">{WEIGHT_LABEL[name] ?? name}</span>
                    <input type="number" min={0} max={1} step={0.05} className={numberInput} value={w}
                      onChange={e => put(key, { ...v, weights: { ...weights, [name]: Number(e.target.value) } })} />
                  </label>
                ))}
              </div>
            </div>
            <Advanced value={raw[key] ?? ''} onChange={t => putRaw(key, t)} />
          </Row>
        );
      })()}

      {/* 대가 표시 인정 문구 */}
      {find('submission.disclosurePhrases') && (() => {
        const key = 'submission.disclosurePhrases';
        const list = (drafts[key] ?? []) as string[];
        return (
          <Row key={key} title={LABEL[key].title} help={LABEL[key].help}
            onSave={() => save(key)} onReset={() => reset(key)} saving={saving === key} error={errors[key]}>
            <ul className="space-y-2">
              {list.map((pattern, i) => {
                const plain = isPlainPhrase(pattern);
                return (
                  <li key={i} className="flex items-center gap-2">
                    {plain ? (
                      <input className={input} value={patternToPhrase(pattern)}
                        aria-label={`문구 ${i + 1}`} placeholder="예: 소정의 원고료를 지원받아 작성"
                        onChange={e => {
                          const next = [...list];
                          next[i] = phraseToPattern(e.target.value);
                          put(key, next);
                        }} />
                    ) : (
                      // 여러 표현을 한 번에 잡는 정규식 — 글자 칸에서 고치면 망가지므로 보여 주기만 한다
                      <span className="flex min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-cream px-3 py-2">
                        <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted">정규식</span>
                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2" title={pattern}>{pattern}</code>
                      </span>
                    )}
                    <QuietButton onClick={() => put(key, list.filter((_, j) => j !== i))}>삭제</QuietButton>
                  </li>
                );
              })}
            </ul>
            <QuietButton onClick={() => put(key, [...list, ''])}>문구 추가</QuietButton>
            <p className="text-xs leading-[1.6] text-muted">
              새로 적는 문구는 띄어쓰기를 무시하고 찾도록 정규식으로 바꿔 저장합니다.
              <br />
              <strong className="text-ink-2">정규식</strong> 표시가 붙은 것은 여러 표현을 한 번에 잡는 값이라 여기서 고칠 수 없습니다 —
              아래 고급에서 고치거나, 지우고 새로 적어 주세요.
            </p>
            <Advanced value={raw[key] ?? ''} onChange={t => putRaw(key, t)} />
          </Row>
        );
      })()}

      {/* 본인 클릭 제외 */}
      {find('click.excludeSelf') && (() => {
        const key = 'click.excludeSelf';
        const on = drafts[key] === true;
        return (
          <Row key={key} title={LABEL[key].title} help={LABEL[key].help}
            onSave={() => save(key)} onReset={() => reset(key)} saving={saving === key} error={errors[key]}>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={on}
                onChange={e => put(key, e.target.checked)} />
              본인 클릭을 집계에서 뺍니다
            </label>
          </Row>
        );
      })()}

      {/* 봇 제외 규칙 */}
      {find('click.botRules') && (() => {
        const key = 'click.botRules';
        const list = (drafts[key] ?? []) as { name: string; pattern: string }[];
        return (
          <Row key={key} title={LABEL[key].title} help={LABEL[key].help}
            onSave={() => save(key)} onReset={() => reset(key)} saving={saving === key} error={errors[key]}>
            <ul className="space-y-2">
              {list.map((rule, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <input className="w-40 rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink"
                    aria-label={`규칙 ${i + 1} 이름`} placeholder="규칙 이름" value={rule.name ?? ''}
                    onChange={e => {
                      const next = [...list];
                      next[i] = { ...rule, name: e.target.value };
                      put(key, next);
                    }} />
                  <input className="min-w-0 flex-1 rounded-control border border-line bg-paper px-3 py-2 font-mono text-xs outline-none focus:border-ink"
                    aria-label={`규칙 ${i + 1} 정규식`} placeholder="User-Agent 정규식" value={rule.pattern ?? ''}
                    onChange={e => {
                      const next = [...list];
                      next[i] = { ...rule, pattern: e.target.value };
                      put(key, next);
                    }} />
                  <QuietButton onClick={() => put(key, list.filter((_, j) => j !== i))}>삭제</QuietButton>
                </li>
              ))}
            </ul>
            <QuietButton onClick={() => put(key, [...list, { name: '', pattern: '' }])}>규칙 추가</QuietButton>
            <Advanced value={raw[key] ?? ''} onChange={t => putRaw(key, t)} />
          </Row>
        );
      })()}
    </div>
  );
}
