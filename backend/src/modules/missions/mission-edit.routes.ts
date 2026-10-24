import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';
import { updateMissionSchema } from './missions.schema';
import { isStoreComplete, missingStoreParts } from '../client/store';
import {
  EDITABLE_FIELDS, EditableField, NOTIFY_FIELDS,
  editRules, fieldLabel, isBetter, ruleFor, sameValue,
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
        rules: editRules(role, state),
        applicationCount: state.applicationCount,
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

    // 고객사는 가게 정보가 다 차 있어야 한다 (등록과 같은 조건)
    if (role === 'CLIENT' && !isStoreComplete(mission.clientProfile)) {
      throw new AppError('STORE_INCOMPLETE', 422, `${missingStoreParts(mission.clientProfile).join(' · ')}을 먼저 입력해 주세요`);
    }

    // 등록과 같은 칸 검증 + 날짜 순서
    const input = parseInput(updateMissionSchema, req.body);

    // 무엇이 바뀌었는지 모으고, 바꿀 수 없는 칸이면 막는다
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const changed: EditableField[] = [];

    for (const field of EDITABLE_FIELDS) {
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

    if (changed.length === 0) {
      res.json({ success: true, data: { changed: [], notified: 0 } });
      return;
    }

    const updated = await prisma.mission.update({
      where: { id: mission.id },
      data: Object.fromEntries(changed.map(f => [f, (input as Record<string, unknown>)[f] ?? null])),
    });

    // 누가 언제 무엇을 바꿨는지 남긴다
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: 'MISSION_UPDATE',
        targetTable: 'missions',
        targetId: mission.id,
        // Prisma의 Json 칸이라 평범한 객체로 넣는다
        before: before as object,
        after: after as object,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
      },
    });

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
      data: { changed, notified, mission: { id: updated.id, title: updated.title } },
    });
  } catch (e) { next(e); }
});

export default router;
