import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { editableSettingKeys, getSetting, isSettingKey, resetSetting, setSetting, settingDefaults, SettingKey } from './settings';

/** 운영 설정 — /operator/settings */
const router = Router();
router.use(authenticate, requireRole('OPERATOR'));

function editableKey(key: string): SettingKey {
  if (!isSettingKey(key) || !editableSettingKeys.includes(key)) throw new AppError('NOT_FOUND', 404, '편집할 수 없는 설정입니다');
  return key;
}

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await Promise.all(editableSettingKeys.map(async key => ({
      key, value: await getSetting(key), defaultValue: settingDefaults[key],
    })));
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.put('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = editableKey(req.params.key);
    const before = await getSetting(key);
    let value;
    try {
      value = await setSetting(key, req.body?.value, req.user!.sub);
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        throw new AppError('VALIDATION_ERROR', 400, `${issue.path.join('.') || 'value'}: ${issue.message}`);
      }
      throw err;
    }
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: 'SETTING_UPDATE',
        targetTable: 'platform_settings',
        targetId: req.user!.sub,
        before: { key, value: before as object },
        after: { key, value: value as object },
      },
    });
    res.json({ success: true, data: { key, value } });
  } catch (e) { next(e); }
});

router.delete('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = editableKey(req.params.key);
    await resetSetting(key);
    res.json({ success: true, data: { key, value: settingDefaults[key] } });
  } catch (e) { next(e); }
});

export default router;
