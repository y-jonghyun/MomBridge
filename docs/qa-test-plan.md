# MVP 종합 테스트 계획서 (MVP_test_plan.md)

> **프로젝트:** 지역 마케팅 미션 매칭 플랫폼 (HyperLocal Mission Platform)
> **문서 버전:** v1.0
> **작성자:** QA 엔지니어
> **작성일:** 2025년 기준
> **검토 상태:** 초안 (Draft)
> **대상 릴리즈:** MVP 베타 런칭

---

## 📋 목차

1. [테스트 목적 및 범위](#1-테스트-목적-및-범위)
2. [테스트 전략 및 접근 방식](#2-테스트-전략-및-접근-방식)
3. [테스트 유형별 계획](#3-테스트-유형별-계획)
4. [테스트 환경 설정](#4-테스트-환경-설정)
5. [결함 분류 기준](#5-결함-분류-기준)
6. [테스트 일정](#6-테스트-일정)
7. [진입/종료 기준](#7-진입종료-기준)
8. [리스크 분석 및 완화 전략](#8-리스크-분석-및-완화-전략)
9. [산출물 및 보고 체계](#9-산출물-및-보고-체계)

---

## 1. 테스트 목적 및 범위

### 1-1. 테스트 목적

본 테스트 계획서는 HyperLocal Mission Platform MVP 베타 런칭 전 품질을 보증하기 위한 종합 검증 전략을 정의한다. 플랫폼의 핵심 가치인 **"소상공인-참여자-운영자 3자 신뢰 구조"** 를 기술적으로 검증하는 것이 최우선 목표이며, 특히 금전 관련 오류와 권한 오류는 런칭 블로커로 간주한다.

```
QA 핵심 책임 (재확인)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1] P0 기능의 E2E 시나리오 완전 검증    → 런칭 블로커 Zero
[2] 역할별 권한 누락/초과 검증          → 보안 결함 Zero
[3] 정산/포인트 정합성 검증             → 금전 오류 Zero
[4] 비기능 요구사항(성능/보안) 검증     → SLA 기준 충족
[5] API 계약 검증                       → 회귀 방지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1-2. 테스트 범위

#### ✅ 포함 범위

| 카테고리 | 대상 기능 | 우선순위 |
|---------|-----------|---------|
| 인증/계정 관리 | 회원가입, JWT 로그인/로그아웃, 시드 계정, 프로필 등록 | P0/P1 |
| 미션 관리 | 미션 생성/수정/삭제, 상태 전환, 미션 목록 조회 | P0/P1 |
| 지원/매칭 | 참여자 지원, 운영자 승인/거절, 매칭 상태 관리 | P0 |
| 콘텐츠 제출/검수 | 인증 콘텐츠 제출, 운영자 검수, 승인/반려, 재제출 | P0 |
| 정산/포인트 | 포인트 적립, 정산 요청, 정산 처리, 내역 조회 | P0 |
| 고객사 의뢰/리포트 | 미션 의뢰, 진행 현황, 결과 리포트 | P0/P1 |
| 보안/권한 | 역할별 접근 제어, JWT 취약점, OWASP Top 10 | P0 |
| 성능 | 동시 접속 부하, API 응답 시간, DB 쿼리 성능 | P1 |

#### ❌ 제외 범위 (Post-MVP)

| 제외 항목 | 사유 |
|----------|------|
| 카카오/네이버 소셜 로그인 | P2 기능, Post-MVP 대상 |
| 모바일 앱 | 모바일 팀 산출물 없음 |
| 고급 추천 알고리즘 | Post-MVP 고도화 항목 |
| 다국어 지원 | 범위 외 |

### 1-3. 사용자 역할별 검증 행렬

```
역할          | 인증 | 미션관리 | 지원/매칭 | 콘텐츠검수 | 정산 | 리포트
─────────────────────────────────────────────────────────────────────
운영자        |  ✓  |    ✓    |    ✓    |     ✓     |  ✓  |   ✓
참여자        |  ✓  |    -    |    ✓    |     ✓     |  ✓  |   -
고객사        |  ✓  |    -    |    -    |     -     |  -  |   ✓
─────────────────────────────────────────────────────────────────────
크로스 역할   |  ✓  |    ✓    |    ✓    |     ✓     |  ✓  |   ✓
권한 침범     |  ✓  |    ✓    |    ✓    |     ✓     |  ✓  |   ✓
```

---

## 2. 테스트 전략 및 접근 방식

### 2-1. 전체 테스트 피라미드 전략

```
                    ╔══════════════╗
                    ║   E2E Test   ║  ← 20% | Playwright
                    ║  (시나리오)  ║     주요 사용자 여정 커버
                    ╠══════════════╣
               ╔════╣  API / 통합  ╠════╗
               ║    ║    Test     ║    ║  ← 30% | Supertest + Postman
               ║    ║  (계약검증) ║    ║     API 계약 + 비즈니스 로직
               ║    ╠══════════════╣    ║
          ╔════╣    ║  Unit Test   ║    ╠════╗
          ║    ║    ║ (단위검증)  ║    ║    ║  ← 50% | Jest
          ║    ║    ╚══════════════╝    ║    ║     순수 함수/서비스 레이어
          ╚════╩════════════════════════╩════╝

  특수 테스트: 보안(OWASP ZAP) + 성능(k6) → 별도 파이프라인
```

### 2-2. 위험 기반 테스트 (Risk-Based Testing) 원칙

플랫폼 특성상 **금전 신뢰성**과 **권한 보안**이 최고 위험 요소이므로, 아래 원칙으로 테스트 우선순위를 결정한다.

```
위험도 산정 공식: 위험도 = 발생 가능성(1~5) × 영향도(1~5)

우선순위 결정 기준
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
위험도 점수   | 테스트 강도
─────────────────────────────────────────────
20~25        | 최우선 (자동화 + 수동 이중 검증)
12~19        | 높음 (자동화 필수)
6~11         | 보통 (자동화 권장)
1~5          | 낮음 (체크리스트 수준)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

적용 예시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
기능               | 발생가능성 | 영향도 | 위험도
─────────────────────────────────────────────
정산 금액 오류     |     3     |   5   |  15  → 높음
권한 무단 접근     |     3     |   5   |  15  → 높음
JWT 토큰 위조      |     2     |   5   |  10  → 보통
콘텐츠 검수 누락   |     4     |   4   |  16  → 높음
회원가입 중복      |     4     |   3   |  12  → 높음
성능 저하          |     3     |   4   |  12  → 높음
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2-3. 테스트 자동화 전략

```
자동화 대상 선정 기준
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 자동화 필수
  - 반복 실행 빈도가 높은 회귀 테스트
  - 정산/포인트 계산 로직 (숫자 정합성)
  - 역할별 API 권한 제어
  - 핵심 E2E 사용자 여정 (Happy Path)

⚠️ 자동화 권장
  - API 응답 스키마 검증
  - 경계값 테스트
  - 에러 응답 코드 검증

🔲 수동 테스트 유지
  - UI/UX 직관성 평가
  - 탐색적 테스트 (Exploratory Testing)
  - 콘텐츠 인증 UI 흐름 체험
  - 신규 기능 최초 탐색
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2-4. CI/CD 통합 전략

```yaml
# 파이프라인 단계별 테스트 실행 계획
Pipeline Stages:
  
  PR 생성 시 (빠른 피드백):
    - Jest Unit Test (< 2분)
    - Jest Integration Test (< 3분)
    - ESLint 품질 게이트
    
  PR Merge → develop 브랜치:
    - Supertest API 통합 테스트
    - Postman Newman Collection
    - Playwright E2E (핵심 시나리오 subset)
    
  Release 브랜치 생성:
    - Playwright E2E 전체 실행
    - k6 성능 테스트
    - OWASP ZAP 보안 스캔
    
  배포 후 Smoke Test:
    - Playwright Smoke Suite (5분 이내)
    - API 헬스체크
```

---

## 3. 테스트 유형별 계획

### 3-1. 유닛 테스트 (Unit Test)

#### 목적 및 커버리지 목표

```
목표 커버리지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
전체 라인 커버리지         : 80% 이상
비즈니스 로직 레이어       : 90% 이상 (필수)
정산/포인트 계산 함수      : 100% (Zero tolerance)
유틸리티 함수              : 85% 이상
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 주요 테스트 대상 및 케이스

```typescript
// ── 영역 1: 인증 서비스 유닛 테스트 ──────────────────────────

/**
 * 파일: qa/unit/auth.service.test.ts
 * 대상: backend-business-logic.ts > AuthService
 */

describe('AuthService', () => {
  
  describe('register()', () => {
    test('UT-AUTH-001: 유효한 이메일/비밀번호로 회원가입 성공');
    // 검증: DB에 유저 생성, 비밀번호 bcrypt 해시 저장 확인
    
    test('UT-AUTH-002: 중복 이메일 회원가입 시 ConflictException 발생');
    // 검증: HTTP 409 응답, 에러 메시지 포함
    
    test('UT-AUTH-003: 이메일 형식 오류 시 ValidationError 발생');
    // 검증: HTTP 400 응답
    
    test('UT-AUTH-004: 비밀번호 최소 길이(8자) 미충족 시 ValidationError');
    test('UT-AUTH-005: 비밀번호가 평문으로 DB에 저장되지 않음 확인');
  });
  
  describe('login()', () => {
    test('UT-AUTH-006: 올바른 자격증명으로 JWT accessToken 발급 성공');
    // 검증: accessToken + refreshToken 반환, 만료시간 검증
    
    test('UT-AUTH-007: 잘못된 비밀번호로 로그인 시 UnauthorizedException');
    test('UT-AUTH-008: 존재하지 않는 이메일 로그인 시 UnauthorizedException');
    test('UT-AUTH-009: JWT 페이로드에 userId, role 포함 여부 확인');
    test('UT-AUTH-010: 비활성화 계정 로그인 시도 차단');
  });
  
  describe('validateToken()', () => {
    test('UT-AUTH-011: 유효한 JWT 토큰 검증 성공');
    test('UT-AUTH-012: 만료된 JWT 토큰 검증 실패 처리');
    test('UT-AUTH-013: 서명이 변조된 JWT 거부');
    test('UT-AUTH-014: 알고리즘 혼용 공격(none 알고리즘) 방어 확인');
  });
});

// ── 영역 2: 정산 서비스 유닛 테스트 (최고 우선순위) ────────────

/**
 * 파일: qa/unit/settlement.service.test.ts
 * 대상: backend-business-logic.ts > SettlementService
 */

describe('SettlementService', () => {
  
  describe('calculateReward()', () => {
    test('UT-SET-001: 기본 미션 보상 금액 정확 계산');
    // 입력: mission.rewardAmount = 10000
    // 기대: participant 포인트 +10000

    test('UT-SET-002: 플랫폼 수수료 공제 후 정산액 정확성');
    // 예: 총액 10000, 수수료율 20% → 지급액 8000 검증

    test('UT-SET-003: 복수 미션 동시 완료 시 누적 포인트 정확성');
    test('UT-SET-004: 포인트 계산 시 소수점 처리 정책(버림/반올림) 일관성');
    test('UT-SET-005: 0원 미션 및 음수 금액 입력 방어 처리');
    test('UT-SET-006: Integer overflow 경계값 테스트 (MAX_SAFE_INTEGER)');
  });
  
  describe('processSettlementRequest()', () => {
    test('UT-SET-007: 출금 가능 포인트 이하 정산 요청 성공');
    test('UT-SET-008: 보유 포인트 초과 정산 요청 거절');
    test('UT-SET-009: 최소 출금 금액 미달 요청 거절');
    test('UT-SET-010: 정산 중복 요청 방지 (pending 상태에서 재요청 차단)');
    test('UT-SET-011: 정산 승인 후 포인트 차감 원자성 보장');
  });
});

// ── 영역 3: 미션 서비스 유닛 테스트 ──────────────────────────

describe('MissionService', () => {
  
  describe('createMission()', () => {
    test('UT-MIS-001: 유효한 미션 데이터로 미션 생성 성공');
    test('UT-MIS-002: 필수 필드(제목/보상금액/마감일) 누락 시 오류');
    test('UT-MIS-003: 마감일이 현재보다 과거인 경우 오류 처리');
    test('UT-MIS-004: 보상금액 음수 입력 방어');
  });
  
  describe('updateMissionStatus()', () => {
    test('UT-MIS-005: 허용된 상태 전환만 가능 (상태 머신 검증)');
    // DRAFT → ACTIVE → CLOSED 순서 검증
    // CLOSED → ACTIVE 역전 불가 검증
    
    test('UT-MIS-006: 활성 지원자가 있는 미션 강제 취소 처리');
    test('UT-MIS-007: 만료된 미션 자동 상태 전환 로직');
  });
});
```

#### Jest 설정 및 커버리지 리포트

```javascript
// qa/jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './',
  testMatch: ['**/unit/**/*.test.ts', '**/integration/**/*.test.ts'],
  
  // 커버리지 설정
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/utils/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThresholds: {
    global: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    // 정산 로직 별도 임계값
    './src/services/settlement.service.ts': {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  reporters: ['default', 'jest-html-reporters'],
};
```

---

### 3-2. 통합 테스트 (Integration Test)

#### 목적

개별 모듈(API 라우터, 서비스, DB)이 결합되었을 때 올바르게 동작하는지 검증한다. Supertest로 실제 HTTP 요청을 시뮬레이션하고, 테스트 DB에 실제 데이터를 적재하여 검증한다.

#### API 엔드포인트 통합 테스트 계획

```typescript
// qa/integration/auth.integration.test.ts

describe('[통합] 인증 API', () => {
  
  // 테스트 전 처리
  beforeAll(async () => {
    // 테스트 DB 마이그레이션 + 시드 데이터 삽입
  });
  afterEach(async () => {
    // 각 테스트 후 생성된 유저 데이터 정리
  });
  
  // ── POST /api/auth/register ──────────────────────────────
  describe('POST /api/auth/register', () => {
    test('INT-AUTH-001: 참여자 회원가입 성공 → 201 + 사용자 정보 반환');
    /*
      Request:
        { email: "test@test.com", password: "Pass1234!", role: "PARTICIPANT" }
      Expected Response (201):
        { id: string, email: "test@test.com", role: "PARTICIPANT", createdAt: ISO8601 }
      DB 검증:
        - users 테이블에 레코드 생성 확인
        - password 필드 bcrypt 해시 형식 확인 ($2b$...)
        - 응답에 password 필드 미포함 확인
    */
    
    test('INT-AUTH-002: 고객사 회원가입 성공 → 201 + role: CLIENT');
    test('INT-AUTH-003: 중복 이메일 → 409 Conflict');
    test('INT-AUTH-004: 잘못된 이메일 형식 → 400 Bad Request');
    test('INT-AUTH-005: 비밀번호 8자 미만 → 400 Bad Request');
    test('INT-AUTH-006: role 필드 미포함 → 400 Bad Request');
    test('INT-AUTH-007: SQL Injection 패턴 입력 → 400 또는 안전 처리');
  });
  
  // ── POST /api/auth/login ─────────────────────────────────
  describe('POST /api/auth/login', () => {
    test('INT-AUTH-008: 올바른 자격증명 → 200 + accessToken + refreshToken');
    /*
      Expected Response Headers:
        Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict
      Expected Body:
        { accessToken: string, expiresIn: number, user: { id, email, role } }
    */
    
    test('INT-AUTH-009: 틀린 비밀번호 → 401 Unauthorized');
    test('INT-AUTH-010: 미존재 이메일 → 401 (이메일 존재 여부 노출 금지)');
    // 보안: "이메일이 없습니다" vs "인증 실패" → 후자여야 함
    
    test('INT-AUTH-011: 5회 연속 실패 시 계정 잠금 또는 rate limit');
  });
  
  // ── POST /api/auth/logout ────────────────────────────────
  describe('POST /api/auth/logout', () => {
    test('INT-AUTH-012: 유효한 토큰으로 로그아웃 → 200 + 토큰 무효화');
    test('INT-AUTH-013: 로그아웃 후 동일 토큰 재사용 시도 → 401');
    test('INT-AUTH-014: 토큰 없이 로그아웃 요청 → 401');
  });
  
  // ── POST /api/auth/refresh ───────────────────────────────
  describe('POST /api/auth/token/refresh', () => {
    test('INT-AUTH-015: 유효한 refreshToken으로 accessToken 재발급 → 200');
    test('INT-AUTH-016: 만료된 refreshToken → 401');
    test('INT-AUTH-017: 이미 사용된 refreshToken 재사용 → 401 (Token Rotation)');
  });
});

// ── 미션 관리 API 통합 테스트 ────────────────────────────────
describe('[통합] 미션 관리 API', () => {
  
  describe('POST /api/missions (운영자 전용)', () => {
    test('INT-MIS-001: 운영자 토큰으로 미션 생성 → 201');
    /*
      Request:
        {
          title: "카페 방문 인증",
          description: "음료 + 인테리어 사진 3장",
          rewardAmount: 15000,
          maxParticipants: 10,
          deadline: "2025-12-31T23:59:59Z",
          clientId: "uuid",
          location: { lat: 37.5, lng: 127.0, radius: 500 }
        }
      Expected: 201 + mission 객체 (status: "DRAFT")
    */
    
    test('INT-MIS-002: 참여자 토큰으로 미션 생성 시도 → 403 Forbidden');
    test('INT-MIS-003: 고객사 토큰으로 미션 생성 시도 → 403 Forbidden');
    test('INT-MIS-004: 토큰 없이 미션 생성 시도 → 401 Unauthorized');
    test('INT-MIS-005: 마감일 과거 설정 → 400 Bad Request');
    test('INT-MIS-006: 보상금액 0 이하 → 400 Bad Request');
  });
  
  describe('GET /api/missions (참여자 - 미션 탐색)', () => {
    test('INT-MIS-007: 활성 미션 목록 조회 → 200 + 배열');
    test('INT-MIS-008: 위치 기반 필터링 (lat/lng/radius) 정확성');
    test('INT-MIS-009: 페이지네이션 (page, limit 파라미터) 동작');
    test('INT-MIS-010: DRAFT/CLOSED 상태 미션 목록 미노출 확인');
    test('INT-MIS-011: 참여자 미인증 상태에서 목록 조회 → 401');
  });
  
  describe('PATCH /api/missions/:id/status (운영자 전용)', () => {
    test('INT-MIS-012: DRAFT → ACTIVE 상태 전환 성공');
    test('INT-MIS-013: ACTIVE → CLOSED 상태 전환 성공');
    test('INT-MIS-014: CLOSED → ACTIVE 역전 시도 → 400');
    test('INT-MIS-015: 존재하지 않는 미션 ID → 404');
  });
});

// ── 정산 API 통합 테스트 (최우선) ────────────────────────────
describe('[통합] 정산/포인트 API', () => {
  
  describe('POST /api/settlements/request (참여자)', () => {
    test('INT-SET-001: 보유 포인트 내 정산 요청 → 201 + PENDING 상태');
    test('INT-SET-002: 보유 포인트 초과 요청 → 400 + 명확한 에러');
    test('INT-SET-003: 최소 출금 금액 미달 → 400');
    test('INT-SET-004: 정산 중복 요청 방지 (PENDING 중 재요청 → 409)');
    test('INT-SET-005: 정산 요청 시 포인트 즉시 예약 차감 및 DB 반영 확인');
  });
  
  describe('PATCH /api/settlements/:id/approve (운영자)', () => {
    test('INT-SET-006: 운영자 정산 승인 → 200 + APPROVED 상태 + 포인트 확정 차감');
    test('INT-SET-007: 운영자 정산 거절 → 200 + REJECTED 상태 + 포인트 복구 확인');
    test('INT-SET-008: 동일 정산 건