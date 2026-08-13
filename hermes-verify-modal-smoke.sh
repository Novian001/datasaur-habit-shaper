#!/usr/bin/env bash
# Phase 13b nginx smoke: modal habit creation + regression flows.
# Uses throwaway user; cleans up at the end.
set -uo pipefail

BASE="http://localhost:3000"
TS=$(date +%s)
EMAIL="modal-smoke-${TS}@example.com"
PASS="ThrowawayPass9!"
TODAY=$(docker exec datasaur-habit-shaper-backend-1 date +%F)
RESP=$(mktemp)
PASS_COUNT=0
FAIL_COUNT=0

ok() { PASS_COUNT=$((PASS_COUNT + 1)); echo "PASS: $1"; }
bad() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo "FAIL: $1"; }

status_of() { curl -s -i "$@" 2>/dev/null | head -1 | tr -d '\r' | awk '{print $2}'; }
body_of() { tr -d '\r' < "$RESP" | sed '1,/^$/d'; }

echo "== 1. register =="
curl -s -i -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
[ "$S" = "201" ] && ok "register 201" || bad "register got $S"
TOK=$(body_of | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "== 2. session restore =="
S=$(status_of "$BASE/api/auth/me" -H "Authorization: Bearer $TOK")
[ "$S" = "200" ] && ok "me 200" || bad "me got $S"

echo "== 3. dashboard opens (served bundle has modal marker) =="
HTML=$(curl -s "$BASE/")
BUNDLE=$(echo "$HTML" | grep -o 'assets/index-[^"]*\.js' | head -1)
MARKER=$(curl -s "$BASE/$BUNDLE" | grep -c 'Add a new habit')
[ "$MARKER" -ge 1 ] && ok "bundle contains 'Add a new habit' modal" || bad "bundle missing modal marker"

echo "== 4. create BUILD via POST /api/habits (modal payload) =="
curl -s -i -X POST "$BASE/api/habits" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Modal Build ${TS}\",\"type\":\"BUILD\",\"startDate\":\"$TODAY\"}" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
BID=$(body_of | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)
[ "$S" = "201" ] && ok "BUILD create 201 (id=$BID)" || bad "BUILD create got $S"

echo "== 5. create BREAK via POST /api/habits (modal payload) =="
curl -s -i -X POST "$BASE/api/habits" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Modal Break ${TS}\",\"type\":\"BREAK\",\"startDate\":\"$TODAY\"}" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
KID=$(body_of | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)
[ "$S" = "201" ] && ok "BREAK create 201 (id=$KID)" || bad "BREAK create got $S"

echo "== 6. list habits shows both =="
curl -s -i "$BASE/api/habits?refDate=$TODAY" -H "Authorization: Bearer $TOK" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
COUNT=$(body_of | python -c "import sys,json; print(len(json.load(sys.stdin)['habits']))")
[ "$S" = "200" ] && [ "$COUNT" -ge 2 ] && ok "list 200 with $COUNT habits" || bad "list got $S count=$COUNT"

echo "== 7. completion flow (BUILD) =="
S=$(status_of -X PUT "$BASE/api/habits/$BID/completions" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"date\":\"$TODAY\",\"refDate\":\"$TODAY\"}")
[ "$S" = "201" ] && ok "complete 201" || bad "complete got $S"
S=$(status_of -X PUT "$BASE/api/habits/$BID/completions" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"date\":\"$TODAY\",\"refDate\":\"$TODAY\"}")
[ "$S" = "200" ] && ok "complete idempotent 200" || bad "idempotent got $S"

echo "== 8. relapse flow (BREAK) =="
S=$(status_of -X POST "$BASE/api/habits/$KID/relapses" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"relapseDate\":\"$TODAY\",\"refDate\":\"$TODAY\"}")
[ "$S" = "201" ] && ok "relapse 201" || bad "relapse got $S"

echo "== 9. detail flow =="
S=$(status_of "$BASE/api/habits/$BID?refDate=$TODAY" -H "Authorization: Bearer $TOK")
[ "$S" = "200" ] && ok "detail 200" || bad "detail got $S"

echo "== 10. goals regression (create + list) =="
G=$(curl -s -i -X POST "$BASE/api/goals" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d "{\"habitId\":$BID,\"title\":\"Modal goal ${TS}\"}" | head -1 | tr -d '\r' | awk '{print $2}')
[ "$G" = "201" ] && ok "goal create 201" || bad "goal create got $G"
S=$(status_of "$BASE/api/goals" -H "Authorization: Bearer $TOK")
[ "$S" = "200" ] && ok "goals list 200" || bad "goals list got $S"

echo "== 11. login after session discard (client-side logout) =="
S=$(status_of -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
[ "$S" = "200" ] && ok "login 200" || bad "login got $S"

echo "== 12. wrong password 401 =="
S=$(status_of -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpass\"}")
[ "$S" = "401" ] && ok "wrong password 401" || bad "wrong password got $S"

echo "== cleanup =="
docker exec datasaur-habit-shaper-db-1 mysql -uhabit_user -phabit_password habit_shaper \
  -e "DELETE FROM users WHERE email='$EMAIL';" 2>/dev/null | grep -v 'Using a password'
ok "throwaway user removed"

echo
echo "SMOKE RESULT: $PASS_COUNT passed, $FAIL_COUNT failed"
[ "$FAIL_COUNT" -eq 0 ] || exit 1
rm -f "$RESP"
