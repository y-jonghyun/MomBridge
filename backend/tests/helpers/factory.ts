import jwt from 'jsonwebtoken';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import type { UserRole } from '../../src/middleware/auth';
import { randomCampaignCode } from '../../src/lib/random';

let seq = 0;
const next = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export function tokenFor(user: { id: string; email: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export async function createUser(role: UserRole, name = '테스트') {
  const user = await prisma.user.create({
    data: { email: `${role.toLowerCase()}-${next()}@test.local`, passwordHash: 'x', role, name },
  });
  return { user, token: tokenFor({ id: user.id, email: user.email, role }) };
}

export async function createClient(name = '광고주') {
  const { user, token } = await createUser('CLIENT', name);
  const profile = await prisma.clientProfile.create({
    data: { userId: user.id, businessName: `${name} 가게`, category: '카페', address: '서울', regionSi: '서울', regionGu: '마포구' },
  });
  return { user, token, profile };
}

export async function createParticipant(name = '체험단원') {
  const { user, token } = await createUser('PARTICIPANT', name);
  const profile = await prisma.participantProfile.create({
    data: { userId: user.id, regionSi: '서울', regionGu: '마포구' },
  });
  return { user, token, profile };
}

export async function createOperator(name = '운영자') {
  const { user, token } = await createUser('OPERATOR', name);
  const profile = await prisma.operatorProfile.create({ data: { userId: user.id } });
  return { user, token, profile };
}

export async function createMission(clientProfileId: string, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  return prisma.mission.create({
    data: {
      clientProfileId,
      title: '테스트 미션',
      description: '설명',
      category: 'SNS',
      status: 'OPEN',
      regionSi: '서울',
      regionGu: '마포구',
      rewardAmount: 30000,
      maxParticipants: 5,
      startDate: new Date(now),
      endDate: new Date(now + 14 * 86400000),
      submissionDeadline: new Date(now + 10 * 86400000),
      campaignCode: randomCampaignCode(),
      ...extra,
    } as any,
  });
}

export async function createApprovedApplication(missionId: string, participantId: string) {
  return prisma.application.create({ data: { missionId, participantId, status: 'APPROVED' } });
}

export async function createTrackingLink(missionId: string, participantId: string) {
  const application = await createApprovedApplication(missionId, participantId);
  const { ensureTrackingLink } = await import('../../src/modules/tracking/links');
  return { application, link: await ensureTrackingLink(application.id) };
}
