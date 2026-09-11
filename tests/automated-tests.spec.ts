# 지역 마케팅 미션 매칭 플랫폼 - 자동화 테스트 코드

## 테스트 전략 개요

```
tests/
├── unit/                    # Jest 유닛 테스트
│   ├── mission.service.test.ts
│   ├── reward.service.test.ts
│   ├── content.service.test.ts
│   └── auth.service.test.ts
├── integration/             # Supertest API 통합 테스트
│   ├── mission.api.test.ts
│   ├── auth.api.test.ts
│   ├── reward.api.test.ts
│   └── content.api.test.ts
├── e2e/                     # Playwright E2E 테스트
│   ├── participant-flow.spec.ts
│   ├── operator-flow.spec.ts
│   └── business-flow.spec.ts
├── performance/             # k6 부하 테스트
│   ├── load-test.js
│   └── stress-test.js
├── fixtures/                # 공통 테스트 데이터
│   └── test-data.ts
└── jest.config.ts
```

---

## 설정 파일들

### jest.config.ts

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  // 프로젝트별 분리 실행 가능
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterFramework: ['<rootDir>/tests/setup/unit.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterFramework: ['<rootDir>/tests/setup/integration.setup.ts'],
      testTimeout: 30000, // DB 연결 고려
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  ],

  // 전체 커버리지 리포트
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/migrations/**',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: '<rootDir>/coverage',
};

export default config;
```

### tests/setup/unit.setup.ts

```typescript
// tests/setup/unit.setup.ts
import { jest } from '@jest/globals';

// 전역 모킹 설정
jest.mock('@/lib/prisma', () => ({
  prisma: {
    mission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    missionApplication: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contentSubmission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reward: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// 날짜 고정
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-01-15T00:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

// 각 테스트 후 모킹 초기화
afterEach(() => {
  jest.clearAllMocks();
});
```

### tests/setup/integration.setup.ts

```typescript
// tests/setup/integration.setup.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
});

// 테스트 DB 마이그레이션 및 시딩
beforeAll(async () => {
  // 테스트 전용 DB 마이그레이션
  execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  });
  
  // 기본 시드 데이터
  await seedTestDatabase(prisma);
});

// 각 테스트 후 데이터 정리 (트랜잭션 롤백 방식)
afterEach(async () => {
  await cleanTestDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedTestDatabase(prisma: PrismaClient) {
  // 기본 운영자 계정 생성
  await prisma.user.upsert({
    where: { email: 'operator@test.com' },
    update: {},
    create: {
      email: 'operator@test.com',
      password: '$2b$10$hashedpassword', // bcrypt hash of 'Test1234!'
      name: '테스트운영자',
      role: 'OPERATOR',
      isVerified: true,
    },
  });
}

async function cleanTestDatabase(prisma: PrismaClient) {
  // 외래키 순서에 맞게 삭제
  const tables = [
    'reward',
    'content_submission',
    'mission_application',
    'mission',
    'business',
    'user',
  ];
  
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "${table}" WHERE created_at > NOW() - INTERVAL '1 hour'`
    );
  }
}
```

### tests/fixtures/test-data.ts

```typescript
// tests/fixtures/test-data.ts
import { MissionStatus, ApplicationStatus, ContentStatus, UserRole } from '@prisma/client';

// ============================================================
// 사용자 픽스처
// ============================================================
export const testUsers = {
  operator: {
    id: 'operator-uuid-001',
    email: 'operator@test.com',
    name: '김운영',
    role: UserRole.OPERATOR,
    isVerified: true,
    createdAt: new Date('2025-01-01'),
  },
  participant: {
    id: 'participant-uuid-001',
    email: 'participant@test.com',
    name: '이참여',
    role: UserRole.PARTICIPANT,
    isVerified: true,
    phone: '010-1234-5678',
    region: '서울 마포구',
    snsUrl: 'https://instagram.com/test_user',
    followerCount: 1500,
    createdAt: new Date('2025-01-02'),
  },
  business: {
    id: 'business-uuid-001',
    email: 'business@test.com',
    name: '박사장',
    role: UserRole.BUSINESS,
    isVerified: true,
    businessName: '마포 맛집',
    businessRegNo: '123-45-67890',
    createdAt: new Date('2025-01-03'),
  },
  unverifiedParticipant: {
    id: 'participant-uuid-002',
    email: 'unverified@test.com',
    name: '미인증참여자',
    role: UserRole.PARTICIPANT,
    isVerified: false,
    createdAt: new Date('2025-01-10'),
  },
};

// ============================================================
// 미션 픽스처
// ============================================================
export const testMissions = {
  activeMission: {
    id: 'mission-uuid-001',
    title: '마포 맛집 방문 후기 작성',
    description: '저희 식당을 방문하시고 인스타그램에 후기를 남겨주세요!',
    businessId: 'business-uuid-001',
    reward: 15000,
    maxParticipants: 10,
    currentParticipants: 3,
    status: MissionStatus.ACTIVE,
    region: '서울 마포구',
    category: 'RESTAURANT',
    requirements: {
      minFollowers: 500,
      platform: ['INSTAGRAM'],
      contentType: 'PHOTO',
      hashtags: ['#마포맛집', '#마포구'],
    },
    deadline: new Date('2025-02-15'),
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-10'),
  },
  draftMission: {
    id: 'mission-uuid-002',
    title: '카페 신메뉴 체험단',
    description: '신메뉴 무료 체험 후 블로그 리뷰 작성',
    businessId: 'business-uuid-001',
    reward: 20000,
    maxParticipants: 5,
    currentParticipants: 0,
    status: MissionStatus.DRAFT,
    region: '서울 마포구',
    category: 'CAFE',
    requirements: {
      minFollowers: 1000,
      platform: ['BLOG'],
      contentType: 'BLOG_POST',
      hashtags: ['#마포카페'],
    },
    deadline: new Date('2025-03-01'),
    createdAt: new Date('2025-01-12'),
    updatedAt: new Date('2025-01-12'),
  },
  fullMission: {
    id: 'mission-uuid-003',
    title: '마감된 미션',
    description: '참여자가 꽉 찬 미션',
    businessId: 'business-uuid-001',
    reward: 10000,
    maxParticipants: 5,
    currentParticipants: 5, // 마감
    status: MissionStatus.ACTIVE,
    region: '서울 서대문구',
    category: 'RETAIL',
    requirements: {
      minFollowers: 300,
      platform: ['INSTAGRAM'],
      contentType: 'PHOTO',
      hashtags: [],
    },
    deadline: new Date('2025-02-01'),
    createdAt: new Date('2025-01-05'),
    updatedAt: new Date('2025-01-05'),
  },
};

// ============================================================
// 콘텐츠 제출 픽스처
// ============================================================
export const testContentSubmissions = {
  pendingSubmission: {
    id: 'content-uuid-001',
    applicationId: 'application-uuid-001',
    participantId: testUsers.participant.id,
    missionId: testMissions.activeMission.id,
    contentUrl: 'https://www.instagram.com/p/test123/',
    platform: 'INSTAGRAM',
    screenshotUrls: [
      'https://s3.test.com/screenshots/content-001-1.jpg',
      'https://s3.test.com/screenshots/content-001-2.jpg',
    ],
    status: ContentStatus.PENDING,
    likes: 45,
    comments: 12,
    reach: 1200,
    submittedAt: new Date('2025-01-14'),
    reviewedAt: null,
    reviewNote: null,
  },
  approvedSubmission: {
    id: 'content-uuid-002',
    applicationId: 'application-uuid-002',
    participantId: testUsers.participant.id,
    missionId: testMissions.activeMission.id,
    contentUrl: 'https://www.instagram.com/p/approved123/',
    platform: 'INSTAGRAM',
    screenshotUrls: ['https://s3.test.com/screenshots/content-002-1.jpg'],
    status: ContentStatus.APPROVED,
    likes: 120,
    comments: 25,
    reach: 3500,
    submittedAt: new Date('2025-01-13'),
    reviewedAt: new Date('2025-01-14'),
    reviewNote: '콘텐츠 품질 우수',
  },
  rejectedSubmission: {
    id: 'content-uuid-003',
    applicationId: 'application-uuid-003',
    participantId: 'participant-uuid-003',
    missionId: testMissions.activeMission.id,
    contentUrl: 'https://www.instagram.com/p/rejected123/',
    platform: 'INSTAGRAM',
    screenshotUrls: [],
    status: ContentStatus.REJECTED,
    likes: 5,
    comments: 0,
    reach: 100,
    submittedAt: new Date('2025-01-12'),
    reviewedAt: new Date('2025-01-13'),
    reviewNote: '필수 해시태그 누락',
  },
};

// ============================================================
// 보상 픽스처
// ============================================================
export const testRewards = {
  pendingReward: {
    id: 'reward-uuid-001',
    participantId: testUsers.participant.id,
    missionId: testMissions.activeMission.id,
    contentId: testContentSubmissions.approvedSubmission.id,
    amount: 15000,
    status: 'PENDING',
    scheduledPayDate: new Date('2025-02-01'),
    paidAt: null,
  },
  paidReward: {
    id: 'reward-uuid-002',
    participantId: testUsers.participant.id,
    missionId: 'mission-uuid-004',
    contentId: 'content-uuid-004',
    amount: 20000,
    status: 'PAID',
    scheduledPayDate: new Date('2025-01-10'),
    paidAt: new Date('2025-01-10'),
  },
};

// ============================================================
// API 요청 바디 픽스처
// ============================================================
export const testRequestBodies = {
  createMission: {
    title: '테스트 미션 생성',
    description: '자동화 테스트용 미션입니다.',
    reward: 12000,
    maxParticipants: 8,
    region: '서울 마포구',
    category: 'RESTAURANT',
    requirements: {
      minFollowers: 500,
      platform: ['INSTAGRAM'],
      contentType: 'PHOTO',
      hashtags: ['#테스트'],
    },
    deadline: '2025-03-01T00:00:00.000Z',
  },
  registerParticipant: {
    email: 'newparticipant@test.com',
    password: 'SecurePass123!',
    name: '신규참여자',
    phone: '010-9999-8888',
    region: '서울 강남구',
    snsUrl: 'https://instagram.com/newuser',
    followerCount: 2000,
  },
  submitContent: {
    contentUrl: 'https://www.instagram.com/p/newcontent123/',
    platform: 'INSTAGRAM',
    screenshotUrls: [
      'https://s3.test.com/screenshots/new-1.jpg',
    ],
  },
  reviewContent: {
    status: 'APPROVED',
    reviewNote: '요구사항 모두 충족',
  },
};

// ============================================================
// JWT 토큰 헬퍼
// ============================================================
export function createTestToken(userId: string, role: UserRole): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId, role, email: `${role.toLowerCase()}@test.com` },
    process.env.JWT_SECRET || 'test-secret-key',
    { expiresIn: '1h' }
  );
}
```

---

## 1. 유닛 테스트 (Jest)

### tests/unit/mission.service.test.ts

```typescript
// tests/unit/mission.service.test.ts
import { MissionService } from '@/services/mission.service';
import { prisma } from '@/lib/prisma';
import { 
  testMissions, 
  testUsers, 
  testRequestBodies 
} from '../fixtures/test-data';
import { 
  MissionStatus, 
  UserRole,
  ApplicationStatus 
} from '@prisma/client';
import { 
  BadRequestError, 
  NotFoundError, 
  ForbiddenError,
  ConflictError 
} from '@/errors';

// Prisma 모킹
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MissionService', () => {
  let missionService: MissionService;

  beforeEach(() => {
    missionService = new MissionService();
  });

  // ============================================================
  // 미션 생성 테스트
  // ============================================================
  describe('createMission()', () => {
    it('✅ 유효한 데이터로 미션을 성공적으로 생성한다', async () => {
      // Given
      const businessId = testUsers.business.id;
      const missionData = testRequestBodies.createMission;
      
      mockPrisma.mission.create.mockResolvedValue({
        ...testMissions.draftMission,
        ...missionData,
        id: 'new-mission-uuid',
        businessId,
        status: MissionStatus.DRAFT,
        currentParticipants: 0,
      } as any);

      // When
      const result = await missionService.createMission(businessId, missionData);

      // Then
      expect(result).toBeDefined();
      expect(result.status).toBe(MissionStatus.DRAFT);
      expect(result.businessId).toBe(businessId);
      expect(result.currentParticipants).toBe(0);
      expect(mockPrisma.mission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          title: missionData.title,
          reward: missionData.reward,
          status: MissionStatus.DRAFT,
        }),
      });
    });

    it('❌ 보상금이 최솟값(1000원) 미만이면 BadRequestError를 던진다', async () => {
      // Given
      const businessId = testUsers.business.id;
      const invalidData = { 
        ...testRequestBodies.createMission, 
        reward: 500 // 최솟값 미달
      };

      // When & Then
      await expect(
        missionService.createMission(businessId, invalidData)
      ).rejects.toThrow(BadRequestError);
      
      await expect(
        missionService.createMission(businessId, invalidData)
      ).rejects.toThrow('보상금은 최소 1,000원 이상이어야 합니다');
      
      expect(mockPrisma.mission.create).not.toHaveBeenCalled();
    });

    it('❌ 최대 참여자 수가 0이면 BadRequestError를 던진다', async () => {
      // Given
      const invalidData = { 
        ...testRequestBodies.createMission, 
        maxParticipants: 0 
      };

      // When & Then
      await expect(
        missionService.createMission(testUsers.business.id, invalidData)
      ).rejects.toThrow(BadRequestError);
    });

    it('❌ 마감일이 현재 시각 이전이면 BadRequestError를 던진다', async () => {
      // Given - jest.useFakeTimers()로 2025-01-15로 고정됨
      const invalidData = { 
        ...testRequestBodies.createMission, 
        deadline: '2025-01-01T00:00:00.000Z' // 과거 날짜
      };

      // When & Then
      await expect(
        missionService.createMission(testUsers.business.id, invalidData)
      ).rejects.toThrow(BadRequestError);
      
      await expect(
        missionService.createMission(testUsers.business.id, invalidData)
      ).rejects.toThrow('마감일은 현재 시각 이후여야 합니다');
    });

    it('❌ 필수 해시태그가 배열이 아니면 BadRequestError를 던진다', async () => {
      // Given
      const invalidData = { 
        ...testRequestBodies.createMission, 
        requirements: {
          ...testRequestBodies.createMission.requirements,
          hashtags: 'not-an-array' as any,
        }
      };

      // When & Then
      await expect(
        missionService.createMission(testUsers.business.id, invalidData)
      ).rejects.toThrow(BadRequestError);
    });
  });

  // ============================================================
  // 미션 목록 조회 테스트
  // ============================================================
  describe('getMissions()', () => {
    it('✅ 활성 미션 목록을 지역 필터로 조회한다', async () => {
      // Given
      const filters = { 
        region: '서울 마포구', 
        status: MissionStatus.ACTIVE,
        page: 1,
        limit: 10,
      };
      
      const mockMissions = [testMissions.activeMission];
      mockPrisma.mission.findMany.mockResolvedValue(mockMissions as any);
      (mockPrisma.mission as any).count = jest.fn().mockResolvedValue(1);

      // When
      const result = await missionService.getMissions(filters);

      // Then
      expect(result.data).toHaveLength(1);
      expect(result.data[0].region).toBe('서울 마포구');
      expect(result.total).toBe(1);
      expect(mockPrisma.mission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            region: '서울 마포구',
            status: MissionStatus.ACTIVE,
          }),
          skip: 0,
          take: 10,
        })
      );
    });

    it('✅ 페이지네이션이 올바르게 동작한다', async () => {
      // Given
      const filters = { page: 2, limit: 5 };
      mockPrisma.mission.findMany.mockResolvedValue([]);

      // When
      await missionService.getMissions(filters);

      // Then
      expect(mockPrisma.mission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page-1) * limit = (2-1) * 5
          take: 5,
        })
      );
    });

    it('✅ 카테고리 필터가 적용된다', async () => {
      // Given
      const filters = { category: 'RESTAURANT' };
      mockPrisma.mission.findMany.mockResolvedValue([testMissions.activeMission] as any);

      // When
      await missionService.getMissions(filters);

      // Then
      expect(mockPrisma.mission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'RESTAURANT',
          }),
        })
      );
    });
  });

  // ============================================================
  // 미션 신청 테스트
  // ============================================================
  describe('applyMission()', () => {
    it('✅ 자격을 충족한 참여자가 미션에 성공적으로 신청한다', async () => {
      // Given
      const participantId = testUsers.participant.id;
      const missionId = testMissions.activeMission.id;
      
      mockPrisma.mission.findUnique.mockResolvedValue({
        ...testMissions.activeMission,
        business: { name: '마포 맛집' },
      } as any);
      
      mockPrisma.missionApplication.findUnique.mockResolvedValue(null); // 중복 신청 없음
      
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUsers.participant,
        followerCount: 1500, // 최소 팔로워 500 충족
      } as any);
      
      mockPrisma.missionApplication.create.mockResolvedValue({
        id: 'new-application-uuid',
        participantId,
        missionId,
        status: ApplicationStatus.PENDING,
        appliedAt: new Date('2025-01-15'),
      } as any);

      // When
      const result = await missionService.applyMission(participantId, missionId);

      // Then
      expect(result.status).toBe(ApplicationStatus.PENDING);
      expect(result.participantId).toBe(participantId);
      expect(mockPrisma.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: missionId },
          data: { currentParticipants: { increment: 1 } },
        })
      );
    });

    it('❌ 이미 신청한 미션에 재신청하면 ConflictError를 던진다', async () => {
      // Given
      mockPrisma.mission.findUnique.mockResolvedValue(
        testMissions.activeMission as any
      );
      mockPrisma.missionApplication.findUnique.mockResolvedValue({
        id: 'existing-application',
        status: ApplicationStatus.PENDING,
      } as any);

      // When & Then
      await expect(
        missionService.applyMission(
          testUsers.participant.id,
          testMissions.activeMission.id
        )
      ).rejects.toThrow(ConflictError);
      
      await expect(
        missionService.applyMission(
          testUsers.participant.id,
          testMissions.activeMission.id
        )
      ).rejects.toThrow('이미 신청한 미션입니다');
    });

    it('❌ 참여 인원이 가득 찬 미션에 신청하면 ConflictError를 던진다', async () => {
      // Given
      mockPrisma.mission.findUnique.mockResolvedValue({
        ...testMissions.fullMission,
        currentParticipants: 5,
        maxParticipants: 5,
      } as any);
      mockPrisma.missionApplication.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        missionService.applyMission(
          testUsers.participant.id,
          testMissions.fullMission.id
        )
      ).rejects.toThrow(ConflictError);
      
      await expect(
        missionService.applyMission(
          testUsers.participant.id,
          testMissions.fullMission.id
        )
      ).rejects.toThrow('참여 인원이 마감되었습니다');
    });

    it('❌ 팔로워 수가 부족하면 ForbiddenError를 던진다', async () => {
      // Given
      mockPrisma.mission.findUnique.mockResolvedValue({
        ...testMissions.activeMission,
        requirements: { minFollowers: 1000, platform: ['INSTAGRAM'] },
      } as any);
      mockPrisma.missionApplication.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUsers.participant,
        followerCount: 300, // 최소 1000 미달
      } as any);

      // When & Then
      await expect(
        missionService.applyMission(
          testUsers.participant.id,
          testMissions.activeMission.id
        )
      ).rejects.toThrow(ForbiddenError);
      
      await expect(
        missionService.applyMission(
          testUsers.participant.id,
          testMissions.activeMission.id
        )
      ).rejects.toThrow('팔로워 수가 미션 참여 조건에 맞지 않습니다');
    });

    it('❌ 존재하지 않는 미션에 신청하면 NotFoundError를 던진다', async () => {
      // Given
      mockPrisma.mission.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        missionService.applyMission(testUsers.participant.id, 'non-existent-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('❌ DRAFT 상태의 미션에 신청하면 ForbiddenError를 던진다', async () => {
      // Given
      mockPrisma.mission.findUnique.mockResolvedValue({
        ...testMissions.draftMission,
        status: MissionStatus.DRAFT,
      } as any);
      mockPrisma.missionApplication.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        missionService.applyMission(
          testUsers.participant.id,
          testMissions.draftMission.id
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ============================================================
  // 미션 상