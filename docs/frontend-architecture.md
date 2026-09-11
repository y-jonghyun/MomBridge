# HyperLocal Mission Platform — Frontend Architecture Document

## 1. 폴더 구조 (Next.js App Router)

```
hyperlocal-frontend/
├── public/
│   ├── images/
│   │   └── logo.svg
│   └── favicon.ico
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                          # 전역 루트 레이아웃
│   │   ├── page.tsx                            # 랜딩 (역할별 리다이렉트)
│   │   ├── not-found.tsx                       # 글로벌 404
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   │
│   │   ├── operator/
│   │   │   ├── layout.tsx                      # 운영자 사이드바 쉘
│   │   │   ├── page.tsx                        # 대시보드
│   │   │   ├── missions/
│   │   │   │   ├── page.tsx                    # 미션 목록
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx                # 미션 생성
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx                # 미션 상세
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx            # 미션 수정
│   │   │   ├── submissions/
│   │   │   │   ├── page.tsx                    # 인증 목록 (검수 큐)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx                # 인증 상세 검수
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx                    # 고객사 목록
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx                # 고객사 상세
│   │   │   ├── participants/
│   │   │   │   ├── page.tsx                    # 참여자 목록
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx                # 참여자 상세
│   │   │   └── settlements/
│   │   │       └── page.tsx                    # 정산 관리
│   │   │
│   │   ├── participant/
│   │   │   ├── layout.tsx                      # 참여자 바텀탭 쉘
│   │   │   ├── page.tsx                        # 미션 탐색 (홈)
│   │   │   ├── missions/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx                # 미션 상세 & 신청
│   │   │   ├── my-missions/
│   │   │   │   ├── page.tsx                    # 내 미션 현황
│   │   │   │   └── [id]/
│   │   │   │       └── submit/
│   │   │   │           └── page.tsx            # 인증 제출
│   │   │   ├── earnings/
│   │   │   │   └── page.tsx                    # 수익 & 정산 내역
│   │   │   └── profile/
│   │   │       └── page.tsx                    # 프로필 설정
│   │   │
│   │   └── client/
│   │       ├── layout.tsx                      # 고객사 헤더 쉘
│   │       ├── page.tsx                        # 고객사 대시보드
│   │       ├── missions/
│   │       │   ├── page.tsx                    # 의뢰 목록
│   │       │   ├── new/
│   │       │   │   └── page.tsx                # 미션 의뢰 등록
│   │       │   └── [id]/
│   │       │       └── page.tsx                # 의뢰 상세 & 진행 현황
│   │       ├── reports/
│   │       │   └── [missionId]/
│   │       │       └── page.tsx                # 결과 리포트
│   │       └── profile/
│   │           └── page.tsx                    # 가게 정보 관리
│   │
│   ├── components/
│   │   ├── ui/                                 # shadcn/ui 원본 (수정 금지)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── select.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── common/                             # 역할 무관 공통 컴포넌트
│   │   │   ├── PageHeader.tsx
│   │   │   ├── DataTable.tsx                  # TanStack Table 래퍼
│   │   │   ├── StatusBadge.tsx                # 미션/제출 상태 배지
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── FileUploader.tsx               # react-dropzone 래퍼
│   │   │   └── FormFieldWrapper.tsx           # RHF + Zod 에러 표시
│   │   │
│   │   ├── layout/
│   │   │   ├── OperatorSidebar.tsx
│   │   │   ├── ParticipantBottomNav.tsx
│   │   │   ├── ClientHeader.tsx
│   │   │   └── RoleGuard.tsx                  # RBAC 가드 컴포넌트
│   │   │
│   │   ├── operator/
│   │   │   ├── dashboard/
│   │   │   │   ├── StatCard.tsx
│   │   │   │   ├── PendingSubmissionsWidget.tsx
│   │   │   │   └── RecentActivityFeed.tsx
│   │   │   ├── missions/
│   │   │   │   ├── MissionForm.tsx            # 생성/수정 통합 폼
│   │   │   │   ├── MissionStatusControl.tsx
│   │   │   │   └── MissionTable.tsx
│   │   │   ├── submissions/
│   │   │   │   ├── SubmissionReviewPanel.tsx
│   │   │   │   ├── SubmissionMediaViewer.tsx
│   │   │   │   └── ReviewActionBar.tsx
│   │   │   └── settlements/
│   │   │       ├── SettlementTable.tsx
│   │   │       └── SettlementSummary.tsx
│   │   │
│   │   ├── participant/
│   │   │   ├── MissionCard.tsx                # 탐색 피드 카드
│   │   │   ├── MissionFilter.tsx              # 지역/카테고리 필터
│   │   │   ├── MissionDetailHeader.tsx
│   │   │   ├── SubmissionForm.tsx             # 인증 제출 폼
│   │   │   ├── MyMissionStatusCard.tsx
│   │   │   └── EarningsSummary.tsx
│   │   │
│   │   └── client/
│   │       ├── MissionRequestForm.tsx         # 의뢰 등록 멀티스텝 폼
│   │       ├── MissionProgressTracker.tsx
│   │       ├── SubmissionGallery.tsx          # 수집된 콘텐츠 갤러리
│   │       └── ReportSummaryCard.tsx
│   │
│   ├── features/                              # 도메인별 비즈니스 로직
│   │   ├── auth/
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── stores/
│   │   │   │   └── authStore.ts               # Zustand 인증 스토어
│   │   │   └── schemas/
│   │   │       └── authSchemas.ts             # Zod 스키마
│   │   ├── missions/
│   │   │   ├── hooks/
│   │   │   │   ├── useMissions.ts
│   │   │   │   ├── useMissionDetail.ts
│   │   │   │   └── useMissionMutations.ts
│   │   │   └── schemas/
│   │   │       └── missionSchemas.ts
│   │   ├── submissions/
│   │   │   ├── hooks/
│   │   │   │   ├── useSubmissions.ts
│   │   │   │   └── useSubmissionReview.ts
│   │   │   └── schemas/
│   │   │       └── submissionSchemas.ts
│   │   ├── settlements/
│   │   │   └── hooks/
│   │   │       └── useSettlements.ts
│   │   └── participants/
│   │       └── hooks/
│   │           └── useParticipantProfile.ts
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── axiosInstance.ts               # Axios 기본 설정
│   │   │   ├── endpoints.ts                   # API 경로 상수
│   │   │   └── queryClient.ts                 # TanStack Query 클라이언트
│   │   ├── utils/
│   │   │   ├── cn.ts                          # clsx + twMerge
│   │   │   ├── formatDate.ts
│   │   │   ├── formatCurrency.ts
│   │   │   └── roleRedirect.ts                # 역할별 초기 경로 반환
│   │   └── constants/
│   │       ├── roles.ts                       # 역할 상수 (OPERATOR | PARTICIPANT | CLIENT)
│   │       ├── missionStatus.ts               # 상태 Enum
│   │       └── queryKeys.ts                   # TanStack Query 키 팩토리
│   │
│   ├── mocks/                                 # MSW 목 핸들러
│   │   ├── browser.ts                         # 브라우저 서비스 워커 설정
│   │   ├── server.ts                          # 테스트용 Node 서버
│   │   ├── handlers/
│   │   │   ├── index.ts                       # 핸들러 통합 익스포트
│   │   │   ├── authHandlers.ts
│   │   │   ├── missionHandlers.ts
│   │   │   ├── submissionHandlers.ts
│   │   │   └── settlementHandlers.ts
│   │   └── fixtures/                          # 픽스처 데이터
│   │       ├── users.ts
│   │       ├── missions.ts
│   │       └── submissions.ts
│   │
│   └── types/
│       ├── api.ts                             # API 공통 응답 타입
│       ├── auth.ts
│       ├── mission.ts
│       ├── submission.ts
│       ├── settlement.ts
│       └── user.ts
```

---

## 2. 주요 페이지 및 컴포넌트 목록

### 2-1. 페이지 매핑표

| 경로 | 역할 | P 레벨 | 핵심 기능 |
|------|------|--------|-----------|
| `/` | 전체 | P0 | 인증 상태·역할 기반 리다이렉트 |
| `/login` | 전체 | P0 | 이메일/비밀번호 로그인 |
| `/register` | Participant, Client | P0 | 역할 선택 후 회원가입 |
| `/operator` | Operator | P0 | KPI 대시보드 (통계, 검수 대기) |
| `/operator/missions` | Operator | P0 | 미션 CRUD 목록 |
| `/operator/missions/new` | Operator | P0 | 미션 생성 폼 |
| `/operator/missions/[id]` | Operator | P0 | 미션 상세·상태 변경 |
| `/operator/submissions` | Operator | P0 | 인증 검수 큐 |
| `/operator/submissions/[id]` | Operator | P0 | 개별 검수 (승인/반려) |
| `/operator/clients` | Operator | P1 | 고객사 관리 |
| `/operator/participants` | Operator | P1 | 참여자 관리 |
| `/operator/settlements` | Operator | P0 | 정산 처리 |
| `/participant` | Participant | P0 | 미션 탐색 피드 |
| `/participant/missions/[id]` | Participant | P0 | 미션 상세·신청 |
| `/participant/my-missions` | Participant | P0 | 진행 중 미션 현황 |
| `/participant/my-missions/[id]/submit` | Participant | P0 | 인증 콘텐츠 제출 |
| `/participant/earnings` | Participant | P0 | 수익 내역·정산 |
| `/participant/profile` | Participant | P1 | SNS·지역 프로필 |
| `/client` | Client | P0 | 고객사 대시보드 |
| `/client/missions` | Client | P0 | 의뢰 목록 |
| `/client/missions/new` | Client | P0 | 의뢰 등록 멀티스텝 폼 |
| `/client/missions/[id]` | Client | P0 | 의뢰 상세·진행 현황 |
| `/client/reports/[missionId]` | Client | P1 | 결과 리포트 |
| `/client/profile` | Client | P1 | 가게 정보 |

### 2-2. 컴포넌트 책임 정의

```
RoleGuard
  - 인증 토큰 유무 확인 → 없으면 /login 리다이렉트
  - 토큰 내 role 클레임 검증 → 불일치 시 역할 홈으로 리다이렉트
  - 로딩 중 스켈레톤 노출

DataTable
  - 컬럼 정의를 prop으로 주입받는 제네릭 테이블
  - 정렬, 페이지네이션, 행 선택 내장
  - 빈 상태(EmptyState) 자동 처리

MissionForm (운영자용)
  - 생성/수정 모드를 mode prop으로 분기
  - React Hook Form + Zod 검증
  - 보상 조건, 기간, 제출 가이드 섹션 포함

SubmissionReviewPanel
  - 좌우 분할 레이아웃 (미디어 | 메타데이터)
  - 승인/반려 원클릭 액션
  - 반려 시 사유 필수 입력 모달

MissionCard (참여자용)
  - 카드 형태 미션 요약 (보상, 마감, 카테고리)
  - 신청 가능 여부 배지
  - 즐겨찾기 토글 (P1)

MissionRequestForm (고객사용)
  - 3단계 멀티스텝: 기본 정보 → 미션 조건 → 예산 확인
  - 각 단계별 Zod 스키마 독립 검증
  - 이전/다음 네비게이션
```

---

## 3. 상태 관리 전략

### 3-1. 계층별 상태 소유권 원칙

```
전역 클라이언트 상태 (Zustand)
  └── 인증 정보만 관리 (token, user, role)
      인증과 무관한 도메인 상태를 Zustand에 넣지 않는다

서버 상태 (TanStack Query)
  └── 모든 API 데이터 (미션, 제출, 정산 등)
      캐시 → 동기화 → 낙관적 업데이트 전담

UI 로컬 상태 (useState / useReducer)
  └── 모달 열림 여부, 탭 인덱스, 폼 스텝 등
      컴포넌트 경계를 벗어나지 않는 상태
```

### 3-2. Zustand 인증 스토어

```typescript
// src/features/auth/stores/authStore.ts

interface AuthState {
  token: string | null
  user: AuthUser | null
  role: UserRole | null
  isHydrated: boolean
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  hydrate: () => void
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      role: null,
      isHydrated: false,
      setAuth: (token, user) =>
        set({ token, user, role: user.role }),
      clearAuth: () =>
        set({ token: null, user: null, role: null }),
      hydrate: () => set({ isHydrated: true }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.hydrate()
      },
    }
  )
)
```

### 3-3. TanStack Query 키 팩토리

```typescript
// src/lib/constants/queryKeys.ts

export const queryKeys = {
  missions: {
    all: ['missions'] as const,
    list: (filters: MissionFilters) =>
      ['missions', 'list', filters] as const,
    detail: (id: string) =>
      ['missions', 'detail', id] as const,
  },
  submissions: {
    all: ['submissions'] as const,
    list: (filters: SubmissionFilters) =>
      ['submissions', 'list', filters] as const,
    detail: (id: string) =>
      ['submissions', 'detail', id] as const,
    byMission: (missionId: string) =>
      ['submissions', 'mission', missionId] as const,
  },
  settlements: {
    all: ['settlements'] as const,
    list: (period: string) =>
      ['settlements', 'list', period] as const,
  },
  participants: {
    profile: (id: string) =>
      ['participants', 'profile', id] as const,
  },
} as const
```

### 3-4. 캐시 무효화 전략

```
미션 생성/수정/삭제
  → invalidateQueries(['missions', 'list', ...])
  → 상세 캐시는 optimistic update 후 revalidate

인증 제출 (참여자)
  → invalidateQueries(['submissions', 'mission', missionId])
  → invalidateQueries(['missions', 'detail', missionId])  # 제출 카운트 갱신

검수 승인/반려 (운영자)
  → invalidateQueries(['submissions', 'list', ...])
  → invalidateQueries(['settlements', ...])               # 정산 연동

로그아웃
  → queryClient.clear()                                  # 전체 캐시 초기화
  → useAuthStore.clearAuth()
```

---

## 4. API 통신 패턴

### 4-1. Axios 인스턴스 설정

```typescript
// src/lib/api/axiosInstance.ts

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// 요청 인터셉터: 토큰 자동 주입
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 응답 인터셉터: 401 처리
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      queryClient.clear()
      window.location.replace('/login')
    }
    return Promise.reject(error)
  }
)
```

### 4-2. API 엔드포인트 상수

```typescript
// src/lib/api/endpoints.ts

export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  missions: {
    root: '/missions',
    detail: (id: string) => `/missions/${id}`,
    status: (id: string) => `/missions/${id}/status`,
    apply: (id: string) => `/missions/${id}/apply`,
  },
  submissions: {
    root: '/submissions',
    detail: (id: string) => `/submissions/${id}`,
    review: (id: string) => `/submissions/${id}/review`,
    byMission: (missionId: string) =>
      `/missions/${missionId}/submissions`,
  },
  settlements: {
    root: '/settlements',
    process: (id: string) => `/settlements/${id}/process`,
  },
  users: {
    participants: '/users/participants',
    clients: '/users/clients',
    profile: (id: string) => `/users/${id}/profile`,
  },
} as const
```

### 4-3. 커스텀 훅 패턴

```typescript
// src/features/missions/hooks/useMissions.ts

// 조회 훅 — useQuery 래핑
export function useMissions(filters: MissionFilters) {
  return useQuery({
    queryKey: queryKeys.missions.list(filters),
    queryFn: () =>
      apiClient
        .get<ApiResponse<Mission[]>>(ENDPOINTS.missions.root, {
          params: filters,
        })
        .then((res) => res.data.data),
    staleTime: 1000 * 60 * 3,   // 3분 캐시
  })
}

// 뮤테이션 훅 — useMutation + 낙관적 업데이트
export function useUpdateMissionStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MissionStatus }) =>
      apiClient
        .patch<ApiResponse<Mission>>(ENDPOINTS.missions.status(id), {
          status,
        })
        .then((res) => res.data.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.missions.detail(updated.id),
        updated
      )
      queryClient.invalidateQueries({
        queryKey: queryKeys.missions.all,
      })
    },
  })
}
```

### 4-4. 공통 API 응답 타입

```typescript
// src/types/api.ts

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ApiError {
  success: false
  message: string
  errors?: Record<string, string[]>
}
```

### 4-5. MSW 목 핸들러 구조

```typescript
// src/mocks/handlers/missionHandlers.ts

export const missionHandlers = [
  http.get('/api/missions', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 10)

    const start = (page - 1) * limit
    const sliced = missionFixtures.slice(start, start + limit)

    return HttpResponse.json({
      success: true,
      data: sliced,
      meta: {
        total: missionFixtures.length,
        page,
        limit,
        totalPages: Math.ceil(missionFixtures.length / limit),
      },
    })
  }),

  http.post('/api/missions', async ({ request }) => {
    const body = await request.json()
    const newMission = { id: crypto.randomUUID(), ...body }
    missionFixtures.push(newMission)
    return HttpResponse.json(
      { success: true, data: newMission },
      { status: 201 }
    )
  }),

  http.patch('/api/submissions/:id/review', async ({ params, request }) => {
    const { id } = params
    const body = await request.json()
    // 검수 처리 시뮬레이션
    await delay(400)
    return HttpResponse.json({
      success: true,
      data: { id, ...body, reviewedAt: new Date().toISOString() },
    })
  }),
]
```

---

## 5. UI/UX 설계 원칙

### 5-1. 역할별 레이아웃 철학

```
Operator (어드민)
  패턴: 사이드바 고정 + 메인 콘텐츠 스크롤
  이유: 메뉴 항목이 많고 데이터 밀도가 높아 빠른 내비게이션 필요
  사이드바 너비: 240px (접힘 모드: 64px 아이콘만)
  배경 톤: 중성 그레이 (#F8FAFC) — 장시간 작업 피로 최소화

Participant (모바일 우선)
  패턴: 바텀 네비게이션 4탭 (탐색 | 내 미션 | 수익 | 프로필)
  이유: 모바일 기기 사용 비중 높음, 엄지 접근성 우선
  콘텐츠: 카드 피드 형태, 무한 스크롤 (P1)
  배경 톤: 화이트 + 포인트 컬러 강조

Client (정보 확인 중심)
  패턴: 고정 상단 헤더 + 탭 기반 섹션 전환
  이유: 현황 파악과 리포트 확인이 주 목적, 깊은 탐색 불필요
  배경 톤: 화이트, 정보 카드 그리드
```

### 5-2. 디자인 토큰 & 색상 시스템

```typescript
// tailwind.config.ts 확장 설정

colors: {
  brand: {
    primary:   '#3B82F6',  // Blue-500 — 주 액션
    secondary: '#10B981',  // Emerald-500 — 성공/승인
    warning:   '#F59E0B',  // Amber-500 — 대기/검토
    danger:    '#EF4444',  // Red-500 — 반려/삭제
    neutral:   '#6B7280',  // Gray-500 — 비활성
  },
  mission: {
    draft:     '#9CA3AF',  // 임시저장
    active:    '#3B82F6',  // 활성
    closed:    '#6B7280',  // 마감
    completed: '#10B981',  // 완료
  },
  submission: {
    pending:   '#F59E0B',  // 검수 대기
    approved:  '#10B981',  // 승인
    rejected:  '#EF4444',  // 반려
  },
}
```

### 5-3. 반응형 브레이크포인트 전략

```
운영자 페이지: min-width 1024px 이상 타겟 (데스크톱 우선)
참여자 페이지: max-width 768px 이하 타겟 (모바일 우선)
고객사 페이지: 768px ~ 1280px 타겟 (태블릿/데스크톱 병행)

공통