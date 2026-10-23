import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createParticipant, createTrackingLink } from '../helpers/factory';
import { TrackedRecorder } from '../helpers/recorder';
import { setClickRecorder, DbClickRecorder, visitorCounter } from '../../src/modules/tracking/click-recorder';
import { clearResolveCache } from '../../src/modules/tracking/redirect.routes';
import { clearSettingsCache, setSetting } from '../../src/modules/settings/settings';
import { selfClickToken, verifySelfClickToken, SELF_CLICK_MAX_AGE_SEC } from '../../src/modules/tracking/self-click';
import { clock } from '../../src/lib/clock';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';

describe('self-click token', () => {
  afterEach(() => clock.set(null));

  it('verifies only an untampered, unexpired token', () => {
    const t = selfClickToken('p-1')!;
    expect(verifySelfClickToken(t)).toBe('p-1');
    const [id, exp, sig] = t.split('.');
    expect(verifySelfClickToken(`p-2.${exp}.${sig}`)).toBeNull();
    expect(verifySelfClickToken(`${id}.${Number(exp) + 1}.${sig}`)).toBeNull();
    expect(verifySelfClickToken('garbage')).toBeNull();
    clock.set(() => new Date(Date.now() + (SELF_CLICK_MAX_AGE_SEC + 60) * 1000));
    expect(verifySelfClickToken(t)).toBeNull();
  });
});

describeDb('체험단원 본인 클릭 제외', () => {
  let recorder: TrackedRecorder;

  beforeEach(async () => {
    await resetDb();
    clearResolveCache();
    clearSettingsCache();
    visitorCounter.clear();
    recorder = new TrackedRecorder();
    setClickRecorder(recorder);
  });
  afterEach(() => recorder.idle());
  afterAll(async () => { setClickRecorder(new DbClickRecorder()); await prisma.$disconnect(); });

  async function setup() {
    const client = await createClient();
    const mission = await createMission(client.profile.id, { destinationUrl: 'https://smartstore.naver.com/shop/products/1' });
    const owner = await createParticipant('링크 주인');
    const other = await createParticipant('다른 체험단원');
    const { link } = await createTrackingLink(mission.id, owner.profile.id);
    return { link, owner, other };
  }

  // 프론트 프록시가 mb_self 쿠키 값을 x-mb-self로 넘긴다
  const click = (code: string, self?: string, ip = '203.0.113.20') => {
    const req = request(app).get(`/r/${code}`)
      .set('x-mb-proxy-secret', 'test-proxy-secret').set('x-mb-client-ip', ip).set('x-mb-user-agent', IPHONE);
    return self ? req.set('x-mb-self', self) : req;
  };
  const settle = async () => { for (let i = 0; i < 5; i++) await recorder.idle(); };
  /**
   * 기록은 응답 뒤 setImmediate로 일어난다. idle()은 '그 순간 등록된' 작업만 기다리므로
   * 느린 러너에서는 아직 시작도 안 한 기록을 놓칠 수 있다 — 행이 보일 때까지 기다린다.
   * 끝내 안 보이면 숫자가 아니라 이유를 알 수 있게 메시지를 남기고 실패한다.
   */
  const waitForClicks = async (n: number) => {
    const deadline = Date.now() + 5_000;
    let count = await prisma.clickEvent.count();
    while (count < n && Date.now() < deadline) {
      await settle();
      count = await prisma.clickEvent.count();
    }
    if (count < n) throw new Error(`클릭 ${n}건을 5초 동안 기다렸지만 ${count}건만 기록됐다 (LOG_LEVEL=debug로 원인 로그 확인)`);
    return count;
  };

  it('gives participants a token for their own profile', async () => {
    const { owner } = await setup();
    const res = await request(app).get('/api/v1/participant/self-click-token').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(verifySelfClickToken(res.body.data.token)).toBe(owner.profile.id);
  });

  it('redirects the owner but does not count the click; others are counted', async () => {
    const { link, owner, other } = await setup();
    const own = await click(link.code, selfClickToken(owner.profile.id)!, '203.0.113.21');
    expect(own.status).toBe(302);
    await settle();
    expect(await prisma.clickEvent.count()).toBe(0);

    // 다른 체험단원의 표시나 위조 값은 무시하고 집계
    await click(link.code, selfClickToken(other.profile.id)!, '203.0.113.22'); await settle();
    await click(link.code, `${owner.profile.id}.9999999999.forged`, '203.0.113.23'); await settle();
    await click(link.code, undefined, '203.0.113.24'); await settle();
    expect(await waitForClicks(3)).toBe(3);
  });

  it('counts the owner again when the operator turns the option off', async () => {
    const { link, owner } = await setup();
    await setSetting('click.excludeSelf', false, SYSTEM_ID);
    await click(link.code, selfClickToken(owner.profile.id)!);
    await settle();
    expect(await waitForClicks(1)).toBe(1);
  });
});
