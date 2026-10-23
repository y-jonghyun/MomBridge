/**
 * 데모·임시 미션 정리. 기본은 미리 보기(dry run)이고 --apply를 붙여야 실제로 바뀐다.
 *
 *   npm run build
 *   DATABASE_URL=... npm run missions:cleanup -- list
 *   DATABASE_URL=... npm run missions:cleanup -- hide --ids <id,id>            [--apply]
 *   DATABASE_URL=... npm run missions:cleanup -- delete --ids <id,id>          [--apply]
 *   DATABASE_URL=... npm run missions:cleanup -- delete --unpaid-drafts 14     [--apply]   (14일 넘게 결제 안 된 임시저장)
 *
 * hide = 목록에서 내리고 종료(되돌릴 수 있음). delete = 완전 삭제(결제·제출 기록이 있으면 거부).
 * 운영 DB에 --apply 하기 전에 백업을 받는다 (docs/ops/db-backup-restore.md).
 */
import { prisma } from '../config/database';
import { parseArgs, ask } from './cli';
import { checkDeletable, deleteMissions, hideMissions, listMissions, staleUnpaidDrafts } from '../modules/missions/mission-cleanup';

const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function confirmApply(action: string, n: number, dbHost: string): Promise<boolean> {
  const answer = await ask(`${dbHost}에서 미션 ${n}개를 ${action}합니다. 계속하려면 "${action}"를 입력하세요: `);
  return answer === action;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const apply = args.apply === true;
  const dbHost = (() => { try { return new URL(process.env.DATABASE_URL ?? '').host; } catch { return '(알 수 없음)'; } })();

  if (command === 'list') {
    const rows = await listMissions();
    console.log(`대상 DB: ${dbHost} · 미션 ${rows.length}개`);
    console.table(rows.map(r => ({
      id: r.id, title: r.title.slice(0, 24), business: r.business.slice(0, 14), status: r.status, pay: r.paymentStatus,
      visible: r.isVisible, created: fmt(r.createdAt), end: fmt(r.endDate), apps: r.applications, subs: r.submissions,
    })));
    return;
  }

  let ids = typeof args.ids === 'string' ? args.ids.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (command === 'delete' && typeof args['unpaid-drafts'] === 'string') {
    const days = Number(args['unpaid-drafts']);
    if (!Number.isInteger(days) || days < 1) throw new Error('--unpaid-drafts 뒤에 일수를 적어 주세요 (예: 14)');
    ids = await staleUnpaidDrafts(days);
    console.log(`${days}일 넘게 결제되지 않은 임시저장 미션 ${ids.length}개`);
  }
  if ((command !== 'hide' && command !== 'delete') || !ids.length) {
    console.error('사용법: list | hide --ids <id,...> | delete --ids <id,...> | delete --unpaid-drafts <일수>  [--apply]');
    process.exitCode = 1;
    return;
  }

  const rows = (await listMissions()).filter(r => ids.includes(r.id));
  console.log(`대상 DB: ${dbHost}`);
  console.table(rows.map(r => ({ id: r.id, title: r.title.slice(0, 24), status: r.status, pay: r.paymentStatus, apps: r.applications, subs: r.submissions })));

  if (command === 'hide') {
    if (!apply) { console.log(`미리 보기: ${rows.length}개를 목록에서 내리고 종료 처리합니다. 실행하려면 --apply`); return; }
    if (!(await confirmApply('hide', rows.length, dbHost))) { console.log('취소했습니다'); return; }
    console.log(`처리함: ${await hideMissions(rows.map(r => r.id))}개`);
    return;
  }

  const checks = await checkDeletable(ids);
  for (const c of checks.filter(c => !c.ok)) console.log(`삭제 안 함 ${c.id}: ${c.reason}`);
  const ok = checks.filter(c => c.ok).length;
  if (!apply) { console.log(`미리 보기: ${ok}개를 지원 기록과 함께 완전히 삭제합니다. 실행하려면 --apply`); return; }
  if (!ok) return;
  if (!(await confirmApply('delete', ok, dbHost))) { console.log('취소했습니다'); return; }
  const result = await deleteMissions(ids);
  console.log(`삭제함: ${result.deleted.length}개`);
  const { removed, failed } = result.imageFiles;
  if (removed || failed) {
    console.log(`저장소 사진 파일: ${removed}개 삭제${failed ? `, ${failed}개 실패 (로그 확인 후 수동 정리 필요)` : ''}`);
  }
}

main()
  .catch(err => { console.error(`실패: ${(err as Error).message}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
