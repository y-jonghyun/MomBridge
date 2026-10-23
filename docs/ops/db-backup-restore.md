# 운영 DB 자동 백업 · 복원

Supabase Free 플랜은 자동 백업이 없다. GitHub Actions `DB backup` 워크플로(`.github/workflows/db-backup.yml`)가 매일 04:00 KST에 다음을 한다.

1. `pg_dump --format=custom --schema=public` (PostgreSQL 17 클라이언트)
2. `pg_restore --list`로 복원 가능한 파일인지 확인 (테이블 10개 미만이거나 `_prisma_migrations`가 없으면 실패 처리)
3. **공개키로 gpg 암호화** — 복호화에 필요한 비밀키는 GitHub에도 저장소에도 없다
4. S3 호환 저장소(Cloudflare R2 권장)에 업로드. 보관 기간은 버킷 수명 주기 규칙으로 관리

저장소가 공개이므로 **Actions 로그와 아티팩트도 공개**다. 워크플로는 덤프를 아티팩트로 올리지 않고, 평문 덤프는 러너 디스크에만 잠깐 있다가 지워진다. 로그에는 파일 크기·목차 개수만 찍힌다.

> 실패하면 GitHub가 저장소 소유자에게 메일을 보낸다(기본 알림 설정). 공개 저장소에서 **60일 동안 커밋이 없으면 GitHub가 예약 워크플로를 자동으로 끈다** — 메일이 오면 Actions 탭에서 다시 켠다.

---

## 1. 처음 한 번 설정

### 1-1. 암호화 키 만들기 (내 PC, Git Bash)
gpg는 Git for Windows에 들어 있다(`C:\Program Files\Git\usr\bin\gpg.exe`). Git Bash에서:

```bash
gpg --quick-gen-key "MomBridge DB backup <본인 이메일>" default default never
# 비밀키 보호 암호(passphrase)를 묻는다 — 길게 정하고 비밀번호 관리자에 저장

gpg --armor --export "MomBridge DB backup" > mombridge-backup-public.asc        # 공개키 → GitHub에 넣는다
gpg --armor --export-secret-keys "MomBridge DB backup" > mombridge-backup-SECRET.asc  # 비밀키 → 오프라인 보관
```

- `mombridge-backup-SECRET.asc`는 **두 곳 이상 오프라인**(USB, 비밀번호 관리자 첨부 등)에 보관하고 PC에서 지운다. 이 파일과 암호가 없으면 백업을 복원할 수 없다.
- 저장소 폴더 안에서 만들지 말 것(실수로 커밋 방지).

### 1-2. 저장소 (Cloudflare R2 예시, 무료 10GB)
1. Cloudflare 대시보드 → R2 → **Create bucket** `mombridge-db-backup` (공개 접근 끔 = 기본값)
2. 버킷 → Settings → **Object lifecycle rules** → 접두사 `db/`, **30일 후 삭제**(원하는 보관 기간)
3. R2 → Manage API tokens → **Create API token** → 권한 *Object Read & Write*, **이 버킷만** 지정
4. 받은 값: Access Key ID, Secret Access Key, 엔드포인트 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### 1-3. GitHub 설정 (Settings → Secrets and variables → Actions)
| 종류 | 이름 | 값 |
|---|---|---|
| Secret | `BACKUP_DATABASE_URL` | Supabase **Session pooler(5432)** 주소. `postgres` 사용자(테이블 소유자) |
| Secret | `BACKUP_S3_ENDPOINT` | R2 엔드포인트 |
| Secret | `BACKUP_S3_BUCKET` | `mombridge-db-backup` |
| Secret | `BACKUP_S3_ACCESS_KEY_ID` | R2 Access Key ID |
| Secret | `BACKUP_S3_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| Variable | `BACKUP_GPG_PUBLIC_KEY` | `mombridge-backup-public.asc` 파일 내용 전체 (공개키라 비밀이 아님) |

- `BACKUP_DATABASE_URL`은 **테이블 소유자(`postgres`)** 여야 한다. 모든 테이블에 RLS가 켜져 있어서, 소유자가 아닌 읽기 전용 역할로는 pg_dump가 `row-level security` 오류로 실패한다.
- 접속 문자열·키는 PR·이슈·문서·채팅에 붙이지 않는다.

### 1-4. 첫 실행 확인
Actions → **DB backup** → Run workflow → 성공 후 로그에 `dump: ... bytes, ... tables with data`, `uploaded: db/mombridge_YYYYMMDD_HHMM.dump.gpg`가 나오고 R2 버킷에 파일이 생기면 정상. 이어서 아래 2번 복원 연습을 한 번 한다.

---

## 2. 복원 연습 (월 1회 권장, 로컬 DB로)
PowerShell 기준. pg 도구는 `C:\Tools\pgsql\pgsql\bin`, gpg는 Git에 포함된 것을 쓴다.

```powershell
$env:Path = "C:\Tools\pgsql\pgsql\bin;C:\Program Files\Git\usr\bin;" + $env:Path

# 1) R2 대시보드에서 최신 db/mombridge_*.dump.gpg 다운로드 (예: Downloads 폴더)
# 2) 비밀키 가져오기 (처음 한 번)
gpg --import E:\mombridge-backup-SECRET.asc
# 3) 복호화 (passphrase 입력)
gpg --output mombridge.dump --decrypt "$HOME\Downloads\mombridge_20261023_0400.dump.gpg"
# 4) 로컬 빈 DB에 복원 (예: docker-compose의 로컬 postgres)
psql "postgresql://mombridge_user:mombridge_pass@localhost:5432/postgres" -c "CREATE DATABASE restore_test"
pg_restore --no-owner --no-privileges --dbname "postgresql://mombridge_user:mombridge_pass@localhost:5432/restore_test" mombridge.dump
# 5) 확인
psql "postgresql://mombridge_user:mombridge_pass@localhost:5432/restore_test" -c "SELECT count(*) FROM users; SELECT migration_name FROM _prisma_migrations ORDER BY started_at;"
# 6) 정리 — 평문 덤프를 남기지 않는다
Remove-Item mombridge.dump
```

- 복원 중 `schema "public" already exists` 오류 1건은 정상이다(`--schema=public` 덤프에 `CREATE SCHEMA public`이 들어 있음). 그 외 오류가 있으면 확인.
- 로컬 테스트에서 덤프 → 확인 → 암호화 → 복호화 → 복원까지 검증함(2026-10-22, 사용자·마이그레이션·테이블 수 일치).

---

## 3. 운영 장애 시 복원 (최후 수단)
운영 DB를 덮어쓰는 작업이다. **먼저 현재 상태를 한 번 더 백업**하고 진행한다.

1. Render 서비스 **Suspend**(쓰기 중단). Vercel은 그대로 두면 API 오류 화면이 보인다.
2. 현재 상태 백업: Actions에서 DB backup 수동 실행 또는 PC에서 `pg_dump`.
3. 가능하면 **새 Supabase 프로젝트에 복원**하고 Render `DATABASE_URL`·`DIRECT_URL`만 바꾸는 쪽을 택한다(기존 DB를 보존하므로 되돌릴 수 있음).
4. 같은 DB에 덮어써야 한다면 Session pooler 주소로:
   ```powershell
   pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --schema=public --dbname "$env:PROD_DB_URL" mombridge.dump
   ```
   `--single-transaction`이라 중간에 실패하면 아무것도 바뀌지 않는다.
5. 확인: `npx.cmd prisma migrate status`(up to date), Supabase Security Advisor(RLS 오류 없음 — 덤프에 RLS 설정이 포함됨), 앱 로그인·미션 목록.
6. Render Resume.

백업 이후에 생긴 데이터(최대 하루치)는 복원되지 않는다. 결제 기록은 토스페이먼츠 대시보드와 대조한다.
