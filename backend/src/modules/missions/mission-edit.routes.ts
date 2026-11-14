import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';
import { missionKeywordsSchema, updateMissionSchema } from './missions.schema';
import { getMissionKeywords, normalizeMissionKeywords, saveMissionKeywords } from './mission-extras';
import { isStoreComplete, missingStoreParts } from '../client/store';
import {
  EDITABLE_FIELDS, EditableField, NOTIFY_FIELDS, UNFAVORABLE_KEY,
  editRules, fieldLabel, isBetter, isUnfavorable, ruleFor, sameValue,
} from './mission-edit';

/**
 * 미션 수정 — /api/v1/missions/:id/edit
 * 운영자는 모든 미션, 고객사는 본인 미션만. 무엇을 고칠 수 있는지는 mission-edit.ts가 정한다.
 */
const router = Router({ mergeParams: true });

router.use(authenticate);

/** 이 미션을 고칠 수 있는 사람인지 보고, 규칙을 셈할 재료를 돌려준다 */
async function loadForEdit(req: Request) {
  const missionId = String(req.params.id);
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: {
      clientProfile: { select: { id: true, userId: true, businessName: true, businessCategory: true, address: true, regionSi: true, regionGu: true } },
      _count: { select: { applications: true } },
    },
  });
  if (!mission) throw new AppError('NOT_FOUND', 404, '미션을 찾을 수 없습니다');

  const role = req.user!.role;
  if (role !== 'OPERATOR' && !(role === 'CLIENT' && mission.clientProfile.userId === req.user!.sub)) {
    throw new AppError('FORBIDDEN', 403, '이 미션을 수정할 수 없습니다');
  }

  return {
    mission,
    role: role as 'OPERATOR' | 'CLIENT',
    state: { paymentStatus: mission.paymentStatus, applicationCount: mission._count.applications },
  };
}

/** 수정 화면이 쓸 값과 규칙 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mission, role, state } = await loadForEdit(req);
    const images = await prisma.missionImage.findMany({
      where: { missionId: mission.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, url: true, sortOrder: true },
    });
    const kw = await getMissionKeywords(mission.id);

    res.json({
      success: true,
      data: {
        mission: {
          ...Object.fromEntries(EDITABLE_FIELDS.map(f => [f, mission[f as keyof typeof mission] ?? null])),
          id: mission.id,
          status: mission.status,
          paymentStatus: mission.paymentStatus,
          clientProfileId: mission.clientProfileId,
          businessName: mission.clientProfile.businessName,
        },
        images,
        /** 확정 키워드 (메인 1 + 서브). 없으면 null */
        keywords: kw.main ? { main: { keyword: kw.main.keyword }, subs: kw.subs.map(k => ({ keyword: k.keyword })) } : null,
        rules: editRules(role, state),
        applicationCount: state.applicationCount,
        /** 종료된 미션은 아예 저장할 수 없다 */
        closed: mission.status === 'CLOSED',
        // 고객사에게만 뜻이 있는 값 (운영자는 결제 확인 안내로 대신한다)
        paid: mission.paymentStatus === 'PAID',
      },
    });
  } catch (e) { next(e); }
});

/** 수정 저장 */
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mission, role, state } = await loadForEdit(req);

    // 종료된 미션은 고치지 않는다. 고쳐야 하면 운영자가 상태를 되돌린 뒤에 한다
    // (운영자도 같은 규칙이다 — 되돌릴 수단이 있어 막아도 막히지 않는다)
    if (mission.status === 'CLOSED') {
      throw new AppError('MISSION_CLOSED', 422, '종료된 미션은 수정할 수 없습니다. 상태를 되돌린 뒤 수정해 주세요');
    }

    // 고객사는 가게 정보가 다 차 있어야 한다 (등록과 같은 조건)
    if (role === 'CLIENT' && !isStoreComplete(mission.clientProfile)) {
      throw new AppError('STORE_INCOMPLETE', 422, `${missingStoreParts(mission.clientProfile).join(' · ')}을 먼저 입력해 주세요`);
    }

    // 등록과 같은 칸 검증 + 날짜 순서
    const input = parseInput(updateMissionSchema, req.body);
    // 키워드는 운영자만 이 경로로 고친다. 가게는 '캠페인 설정'(PUT /client/missions/:id/keywords)에서 고친다.
    // 조용히 버리지 않고 거절한다 — 무엇도 저장하기 전에
    const keywordsSent = req.body?.keywords !== undefined && req.body?.keywords !== null;
    if (keywordsSent && role !== 'OPERATOR') {
      throw new AppError('FORBIDDEN', 403, "키워드는 '캠페인 설정'에서 바꿔 주세요");
    }
    // 가게 경로와 같은 검증·정리 함수 (서브 개수 상한, 메인과 겹치는 서브 빼기). 비우기는 하지 않는다
    const nextKeywords = keywordsSent
      ? await normalizeMissionKeywords(parseInput(missionKeywordsSchema, req.body.keywords))
      : null;
    // 도착 주소는 요청에 키가 아예 없으면 '그대로 둠'이다 (예전 수정 창은 이 칸을 보내지 않았다).
    // null 또는 ''를 명시해 보냈을 때만 비운다
    const destinationSent = req.body?.destinationUrl !== undefined;

    // 무엇이 바뀌었는지 모으고, 바꿀 수 없는 칸이면 막는다
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const changed: EditableField[] = [];

    for (const field of EDITABLE_FIELDS) {
      if (field === 'destinationUrl' && !destinationSent) continue;
      const next = (input as Record<string, unknown>)[field] ?? null;
      const prev = (mission as unknown as Record<string, unknown>)[field] ?? null;
      if (sameValue(prev, next)) continue;

      const rule = ruleFor(field, role, state);
      if (rule.locked) {
        throw new AppError('FIELD_LOCKED', 422, `${fieldLabel(field)}: ${rule.reason ?? '바꿀 수 없는 항목입니다'}`);
      }
      if (rule.onlyBetter && !isBetter(field, prev, next)) {
        throw new AppError('FIELD_LOCKED', 422, `${fieldLabel(field)}: ${rule.reason ?? '줄이거나 앞당길 수 없습니다'}`);
      }

      changed.push(field);
      before[field] = prev instanceof Date ? prev.toISOString() : prev;
      after[field] = next instanceof Date ? (next as Date).toISOString() : next;
    }

    // 키워드가 바뀌었는지 (메인·서브 이름으로 비교)
    let keywordsChanged = false;
    if (nextKeywords) {
      const cur = await getMissionKeywords(mission.id);
      const curKey = JSON.stringify([cur.main?.keyword ?? null, cur.subs.map(k => k.keyword).sort()]);
      const nextKey = JSON.stringify([nextKeywords.main.keyword.trim(), nextKeywords.subs.map(k => k.keyword.trim()).sort()]);
      if (curKey !== nextKey) {
        keywordsChanged = true;
        before.keywords = cur.main ? { main: cur.main.keyword, subs: cur.subs.map(k => k.keyword) } : null;
        after.keywords = { main: nextKeywords.main.keyword.trim(), subs: nextKeywords.subs.map(k => k.keyword.trim()) };
      }
    }

    if (changed.length === 0 && !keywordsChanged) {
      res.json({ success: true, data: { changed: [], notified: 0 } });
      return;
    }

    // 체험단원에게 불리한 변경(줄이기·앞당기기)은 운영자만 할 수 있다.
    // 막지는 않고, 화면에서 확인을 받았는지까지 기록에 남긴다.
    const unfavorable = state.applicationCount > 0
      ? changed.filter(f => isUnfavorable(f, before[f], after[f]))
      : [];
    const afterWithMark: Record<string, unknown> = { ...after };
    if (unfavorable.length > 0) {
      afterWithMark[UNFAVORABLE_KEY] = {
        fields: unfavorable,
        labels: unfavorable.map(fieldLabel),
        affected: state.applicationCount,
        // 화면에서 '계속할까요?'에 예를 누르고 보냈는지
        acknowledged: req.body?.acknowledgeUnfavorable === true,
      };
    }

    // 키워드 저장 · 미션 수정 · 감사 기록을 한 트랜잭션으로 — 중간에 실패하면 셋 다 남지 않는다
    const updated = await prisma.$transaction(async tx => {
      if (keywordsChanged) await saveMissionKeywords(mission.id, nextKeywords!, tx);
      const row = changed.length > 0
        ? await tx.mission.update({
            where: { id: mission.id },
            data: Object.fromEntries(changed.map(f => [f, (input as Record<string, unknown>)[f] ?? null])),
          })
        : await tx.mission.findUniqueOrThrow({ where: { id: mission.id } });
      // 누가 언제 무엇을 바꿨는지 남긴다
      await tx.auditLog.create({
        data: {
          actorId: req.user!.sub,
          action: 'MISSION_UPDATE',
          targetTable: 'missions',
          targetId: mission.id,
          // Prisma의 Json 칸이라 평범한 객체로 넣는다
          before: before as object,
          after: afterWithMark as object,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
        },
      });
      return row;
    });

    // 알림은 저장이 끝난 뒤에 따로 보낸다 (실패해도 수정은 되돌리지 않는다 — 예전과 같다).
    // 일정·방문 안내·주소가 바뀌면 선정된 체험단원에게 알린다
    let notified = 0;
    const notifyChanges = changed.filter(f => NOTIFY_FIELDS.includes(f));
    if (notifyChanges.length > 0) {
      const approved = await prisma.application.findMany({
        where: { missionId: mission.id, status: 'APPROVED' },
        select: { participant: { select: { userId: true } } },
      });
      if (approved.length > 0) {
        const what = notifyChanges.map(fieldLabel).join(' · ');
        await prisma.notification.createMany({
          data: approved.map(a => ({
            userId: a.participant.userId,
            type: 'SYSTEM' as const,
            title: '미션 안내가 바뀌었어요',
            body: `[${mission.title}] ${what}이 바뀌었습니다. 미션 상세에서 확인해 주세요.`,
            resourceId: mission.id,
            resourceType: 'mission',
          })),
        });
        notified = approved.length;
      }
    }

    res.json({
      success: true,
      data: { changed, keywordsChanged, notified, unfavorable, mission: { id: updated.id, title: updated.title } },
    });
  } catch (e) { next(e); }
});

export default router;
