#!/usr/bin/env bash
# ============================================================================
# production-reset.sql 리허설 — 로컬 DB를 '복사한 임시 DB'에서만 돌린다.
#
#   SOURCE_URL='postgresql://…@localhost:5433/mombridge_db' bash docs/ops/production-reset-rehearsal.sh
#
# - SOURCE_URL은 localhost/127.0.0.1만 받는다 (운영 DB 주소면 멈춘다). 원래 DB에는 읽기(pg_dump)만 한다.
# - audit 두 경우(all, keep_operator)마다 임시 DB(mombridge_reset_rehearsal_<경우>)를 새로 만들어 돌리고, 끝나면 지운다.
#   KEEP=1이면 지우지 않는다.
# - 각 임시 DB에서 차례로:
#     1) 가짜 행 채우기 (production-reset-rehearsal-fill.sql — 모든 표에 한 줄 이상)
#     2) expected_db를 틀리게 → 실패해야 하고 행 수가 그대로여야 한다
#     3) simulate_failure=true (모두 지운 뒤 일부러 실패) → 실패해야 하고 행 수가 그대로여야 한다
#     4) apply=false (미리 보기) → 성공, 행 수가 그대로여야 한다
#     5) apply=true → 성공, 표별 전후 행 수 출력
#     6) apply=true 한 번 더 → 성공 (두 번 돌려도 안전)
# - 접속 주소(비밀번호 포함)는 화면에 찍지 않는다.
# ============================================================================
set -euo pipefail

: "${SOURCE_URL:?SOURCE_URL을 주세요 (로컬 DB 주소)}"
PGBIN="${PGBIN:-/c/Program Files/PostgreSQL/16/bin}"
PSQL="$PGBIN/psql"; PGDUMP="$PGBIN/pg_dump"; PGRESTORE="$PGBIN/pg_restore"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

case "$SOURCE_URL" in
  *@localhost:*|*@127.0.0.1:*) ;;
  *) echo "멈춤: SOURCE_URL이 로컬(localhost/127.0.0.1)이 아닙니다. 리허설은 로컬 복사본에서만 합니다."; exit 1 ;;
esac

SRC_DB="$(printf '%s' "$SOURCE_URL" | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#')"
url_for() { printf '%s' "$SOURCE_URL" | sed -E "s#/[^/?]+(\?.*)?\$#/$1\1#"; }
# q <접속 주소> [psql 옵션…] — 윈도 psql은 접속 주소 뒤의 옵션을 무시하므로 주소를 맨 뒤에 둔다
q()  { local url="$1"; shift; "$PSQL" -X -q -v ON_ERROR_STOP=1 "$@" "$url" </dev/null; }

counts() {  # 표=행수 한 줄씩 (정렬)
  q "$1" -At -c "SELECT format('%s=%s', tablename, (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I', tablename), false, true, '')))[1]::text) FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
}

echo "원본 DB: $SRC_DB (로컬) — 읽기만 합니다"
counts "$SOURCE_URL" > "$WORK/source.before"
"$PGDUMP" -Fc --no-owner --no-privileges -f "$WORK/source.dump" "$SOURCE_URL"

for MODE in all keep_operator; do
  DB="mombridge_reset_rehearsal_$MODE"
  T="$(url_for "$DB")"
  echo
  echo "================ audit=$MODE  (임시 DB: $DB) ================"
  q "$SOURCE_URL" -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
  "$PGRESTORE" --no-owner --no-privileges -d "$T" "$WORK/source.dump"

  q "$T" -f "$HERE/production-reset-rehearsal-fill.sql" >/dev/null
  counts "$T" > "$WORK/$MODE.0"
  echo "[1] 가짜 행을 채운 뒤 표 수: $(wc -l < "$WORK/$MODE.0"), 0행인 표: $(grep -c '=0$' "$WORK/$MODE.0" || true)"

  run() { q "$T" -v expected_db="$1" -v audit="$MODE" -v apply="$2" -v simulate_failure="$3" -f "$HERE/production-reset.sql"; }

  if run wrong_db false false > "$WORK/$MODE.2.log" 2>&1; then echo "[2] 실패해야 하는데 성공했습니다"; exit 1; fi
  counts "$T" > "$WORK/$MODE.2"
  cmp -s "$WORK/$MODE.0" "$WORK/$MODE.2" && echo "[2] expected_db 틀림 → 멈춤, 행 수 그대로: $(grep -o '다릅니다' "$WORK/$MODE.2.log" | head -1)" || { echo "[2] 행 수가 바뀌었습니다"; exit 1; }

  if run "$DB" true true > "$WORK/$MODE.3.log" 2>&1; then echo "[3] 실패해야 하는데 성공했습니다"; exit 1; fi
  counts "$T" > "$WORK/$MODE.3"
  cmp -s "$WORK/$MODE.0" "$WORK/$MODE.3" && echo "[3] 모두 지운 뒤 일부러 실패 → 전체 되돌림, 행 수 그대로" || { echo "[3] 행 수가 바뀌었습니다"; exit 1; }

  run "$DB" false false > "$WORK/$MODE.4.log" 2>&1
  counts "$T" > "$WORK/$MODE.4"
  cmp -s "$WORK/$MODE.0" "$WORK/$MODE.4" && echo "[4] 미리 보기(apply=false) → 성공, 행 수 그대로" || { echo "[4] 행 수가 바뀌었습니다"; exit 1; }

  run "$DB" true false > "$WORK/$MODE.5.log" 2>&1
  counts "$T" > "$WORK/$MODE.5"
  echo "[5] 적용(apply=true) → 성공. $(grep -o '확인 통과[^\"]*' "$WORK/$MODE.5.log" | head -1)"
  echo "    표 | 전 | 후"
  awk -F= 'NR == FNR { after[$1] = $2; next } { printf "    %s | %s | %s\n", $1, $2, after[$1] }' "$WORK/$MODE.5" "$WORK/$MODE.0"

  run "$DB" true false > "$WORK/$MODE.6.log" 2>&1
  counts "$T" > "$WORK/$MODE.6"
  cmp -s "$WORK/$MODE.5" "$WORK/$MODE.6" && echo "[6] 한 번 더 적용 → 성공, 바뀐 것 없음" || { echo "[6] 두 번째 실행에서 행 수가 바뀌었습니다"; exit 1; }

  if [ "${KEEP:-0}" != "1" ]; then q "$SOURCE_URL" -c "DROP DATABASE $DB"; echo "임시 DB를 지웠습니다: $DB"; fi
done

echo
counts "$SOURCE_URL" > "$WORK/source.after"
if cmp -s "$WORK/source.before" "$WORK/source.after"; then
  echo "원본 DB($SRC_DB)는 리허설 전후 표별 행 수가 같습니다: $(tr '\n' ' ' < "$WORK/source.after")"
else
  echo "경고: 원본 DB의 행 수가 바뀌었습니다"; diff "$WORK/source.before" "$WORK/source.after"; exit 1
fi
