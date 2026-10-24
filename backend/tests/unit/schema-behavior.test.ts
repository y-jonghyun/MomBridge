import { agreementsSchema } from '../../src/modules/auth/consent';
import { missionKeywordsSchema, operatorCreateMissionSchema } from '../../src/modules/missions/missions.schema';

/**
 * zod 4로 올리면서 동작이 달라질 수 있던 두 가지를 고정한다.
 * - z.preprocess: 빈 문자열·null을 "입력 안 함"으로 바꾸는 자리 (미션 스키마 6곳)
 * - .default(): 안 보낸 칸을 채우는 자리 (동의 marketing, 키워드 subs)
 */
describe('스키마 동작', () => {
  const MISSION = {
    title: '미션', description: '설명', category: 'SNS',
    regionSi: '서울특별시', regionGu: '마포구', maxParticipants: 5, rewardAmount: 30000,
    startDate: '2026-11-01', endDate: '2026-11-10', submissionDeadline: '2026-11-20',
  };

  describe('preprocess — 빈 문자열은 입력 안 함으로 본다', () => {
    it('빈 문자열로 보낸 선택 칸은 결과에서 빠진다', () => {
      const parsed = operatorCreateMissionSchema.parse({
        ...MISSION,
        regionDong: '', announceDate: '', businessCategory: '', visitHours: '',
        thumbnailUrl: '', destinationUrl: '', clientProfileId: '', requirements: '', visitGuide: '',
      });

      for (const key of [
        'regionDong', 'announceDate', 'businessCategory', 'visitHours',
        'thumbnailUrl', 'destinationUrl', 'clientProfileId', 'requirements', 'visitGuide',
      ] as const) {
        expect(parsed[key]).toBeUndefined();
      }
    });

    it('null도 입력 안 함으로 본다', () => {
      const parsed = operatorCreateMissionSchema.parse({ ...MISSION, regionDong: null, announceDate: null });
      expect(parsed.regionDong).toBeUndefined();
      expect(parsed.announceDate).toBeUndefined();
    });

    it('값이 들어오면 그대로 살린다', () => {
      const parsed = operatorCreateMissionSchema.parse({
        ...MISSION, regionDong: '합정동', businessCategory: 'CAFE', visitHours: '평일 10~15시',
        announceDate: '2026-11-12',
      });
      expect(parsed.regionDong).toBe('합정동');
      expect(parsed.businessCategory).toBe('CAFE');
      expect(parsed.visitHours).toBe('평일 10~15시');
      expect(parsed.announceDate).toEqual(new Date('2026-11-12'));
    });
  });

  describe('default — 안 보낸 칸을 채운다', () => {
    it('동의의 marketing은 false', () => {
      expect(agreementsSchema.parse({ age14: true, terms: true, privacy: true }))
        .toEqual({ age14: true, terms: true, privacy: true, marketing: false });
    });

    it('키워드의 subs는 빈 배열', () => {
      expect(missionKeywordsSchema.parse({ main: { keyword: '카페' } }))
        .toEqual({ main: { keyword: '카페' }, subs: [] });
    });

    it('보낸 값이 있으면 기본값을 덮지 않는다', () => {
      expect(agreementsSchema.parse({ age14: true, terms: true, privacy: true, marketing: true }).marketing).toBe(true);
      expect(missionKeywordsSchema.parse({ main: { keyword: '카페' }, subs: [{ keyword: '마포' }] }).subs)
        .toEqual([{ keyword: '마포' }]);
    });
  });
});
