#!/usr/bin/env bash
# 운영 DB(public 스키마) 백업 → 복원 가능 확인 → 공개키 암호화 → S3 호환 저장소(R2 등) 업로드.
# 평문 덤프는 디스크에만 잠깐 있고 업로드·로그·아티팩트로 나가지 않는다 (저장소가 공개라 Actions 로그·아티팩트도 공개).
#
# 필요한 환경변수
#   BACKUP_DATABASE_URL     Session pooler(5432) 또는 직접 연결 주소. Transaction pooler(6543)는 pg_dump가 지원하지 않음
#   BACKUP_GPG_PUBLIC_KEY   복원용 키의 공개키(ASCII armor). 비밀키는 저장소·GitHub에 두지 않는다
#   BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
#   (선택) BACKUP_S3_PREFIX(기본 db/), BACKUP_SKIP_UPLOAD=1(로컬 점검용: 업로드 없이 암호화 파일만 남김)
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set}"
: "${BACKUP_GPG_PUBLIC_KEY:?BACKUP_GPG_PUBLIC_KEY is not set}"
if [ "${BACKUP_SKIP_UPLOAD:-}" != "1" ]; then
  : "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is not set}"
  : "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is not set}"
  : "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is not set}"
  : "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is not set}"
fi

WORK="${BACKUP_WORK_DIR:-$(mktemp -d)}"
STAMP="$(TZ=Asia/Seoul date +%Y%m%d_%H%M)"
DUMP="$WORK/mombridge_${STAMP}.dump"
OUT="$DUMP.gpg"
cleanup() { rm -f "$DUMP" "$WORK/pub.asc" "$WORK/toc.txt"; }
trap cleanup EXIT

# 1) 덤프 (custom 포맷, 앱 데이터는 모두 public 스키마 — _prisma_migrations 포함)
pg_dump --format=custom --no-owner --no-privileges --schema=public --file "$DUMP" "$BACKUP_DATABASE_URL"

# 2) 복원 가능한 파일인지 확인 — 목차를 읽고, 테이블 데이터 항목이 있어야 성공
pg_restore --list "$DUMP" > "$WORK/toc.txt"
TABLES=$(grep -c " TABLE DATA public " "$WORK/toc.txt" || true)
MIGRATIONS=$(grep -c " TABLE DATA public _prisma_migrations " "$WORK/toc.txt" || true)
echo "dump: $(wc -c < "$DUMP") bytes, $(wc -l < "$WORK/toc.txt") TOC entries, $TABLES tables with data"
if [ "$TABLES" -lt 10 ] || [ "$MIGRATIONS" -ne 1 ]; then
  echo "::error::backup looks incomplete ($TABLES tables, _prisma_migrations=$MIGRATIONS)"; exit 1
fi

# 3) 공개키로 암호화 (키링에 넣지 않고 파일로만 사용)
printf '%s\n' "$BACKUP_GPG_PUBLIC_KEY" > "$WORK/pub.asc"
gpg --batch --yes --quiet --trust-model always --recipient-file "$WORK/pub.asc" --output "$OUT" --encrypt "$DUMP"
rm -f "$DUMP"
echo "encrypted: $(basename "$OUT") ($(wc -c < "$OUT") bytes)"

# 4) 업로드. 보관 기간은 버킷 수명 주기 규칙으로 관리한다(이 작업의 키에는 삭제가 필요 없음)
if [ "${BACKUP_SKIP_UPLOAD:-}" = "1" ]; then
  echo "upload skipped: $OUT"
  exit 0
fi
KEY="${BACKUP_S3_PREFIX:-db/}$(basename "$OUT")"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" aws s3 cp "$OUT" "s3://$BACKUP_S3_BUCKET/$KEY" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
rm -f "$OUT"
echo "uploaded: $KEY"
