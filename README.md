# 지역 마케팅 미션 매칭 플랫폼 시스템 개발

[플랫폼 개요]
지역 소상공인(고객사)이 홍보

> AI Engineer System으로 자동 생성된 프로젝트입니다.

## 폴더 구조

```
├── frontend/        Next.js 프론트엔드
├── backend/         Node.js + Express 백엔드
├── database/        SQL 스키마
├── mobile/          React Native 앱 (선택)
├── tests/           자동화 테스트
├── docs/            문서 (PRD, API 명세 등)
└── docker-compose.yml   로컬용 PostgreSQL만
```

## 로컬 실행

### 1. 데이터베이스
```bash
docker-compose up -d   # PostgreSQL 16 (localhost:5432, mombridge_user / mombridge_pass / mombridge_db)
```
Docker 없이 설치한 PostgreSQL을 써도 됩니다.

### 2. 백엔드
```bash
cd backend
cp .env.example .env   # DATABASE_URL·DIRECT_URL에 로컬 DB 주소(같은 값), JWT 비밀값 등 설정
npm install
npx prisma migrate deploy
npm run dev
```

### 3. 프론트엔드
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Windows PowerShell에서는 `npm` 대신 `npm.cmd`, `npx` 대신 `npx.cmd`를 쓰세요.

## 배포

| | 백엔드 (Render, Node 런타임) | 프론트엔드 (Vercel) |
|---|---|---|
| Root Directory | `backend` | `frontend` |
| Build | `npm install --production=false && npx prisma generate && npm run build && npx prisma migrate deploy` | Next.js 기본값 (`frontend/vercel.json`) |
| Start | `npm start` | - |

- 마이그레이션은 Render 빌드 마지막 단계에서 실행됩니다. 실패하면 빌드가 실패하고 이전 배포가 계속 서비스됩니다.
- `DATABASE_URL`은 Supabase Transaction pooler(6543), `DIRECT_URL`은 Session pooler(5432)를 씁니다. `prisma migrate`는 `DIRECT_URL`을 씁니다.
- 배포 절차와 환경변수는 `docs/design/keyword-tracking.md`를 참고하세요.

## 기술 스택
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **Infrastructure**: Render, Vercel, GitHub Actions
