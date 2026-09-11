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
└── docker-compose.yml
```

## 실행 방법

### 1. 환경변수 설정
```bash
cp .env.example .env
# .env 파일에서 DB, API 키 등 설정
```

### 2. Docker로 전체 실행 (권장)
```bash
docker-compose up -d
```

### 3. 개별 실행
```bash
# 백엔드
cd backend && npm install && npm run dev

# 프론트엔드
cd frontend && npm install && npm run dev
```

## 기술 스택
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **Infrastructure**: Docker, AWS ECS, GitHub Actions
