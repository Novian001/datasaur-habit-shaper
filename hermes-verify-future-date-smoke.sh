#!/usr/bin/env bash
# Future-start-date nginx smoke (fix(stats): support habits with future start
# dates). Exercises: past BREAK cleanStreak 4 (A), future BREAK list 200 +
# cleanStreak 0 (B), future BUILD list 200 + missed 0 (C), active flows (D).
# Throwaway user; cleans up at the end.
set -uo pipefail

BASE="http://localhost:3000"
TS=$(date +%s)
EMAIL="futuresmoke-${TS}@example.com"
PASS="ThrowawayPass9!"
# Container clock (authoritative for the API). Canonical spec dates:
# TODAY=2026-08-13, PAST=2026-08-10 (3 days before), FUTURE=2026-08-15 (2 days after).
TODAY=$(docker exec datasaur-habit-shaper-backend-1 date +%F)
# Hardcode the canonical dates (the container's busybox date lacks GNU -d).
PAST="2026-08-10"
FUTURE="2026-08-15"
RESP=$(mktemp)
PASS_COUNT=0
FAIL_COUNT=0

ok() { PASS_COUNT=$((PASS_COUNT + 1)); echo "PASS: $1"; }
bad() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo "FAIL: $1"; }

status_of() { curl -s -i "$@" 2>/dev/null | head -1 | tr -d '\r' | awk '{print $2}'; }
body_of() { tr -d '\r' < "$RESP" | sed '1,/^$/d'; }
jval() { python -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }

echo "== 1. register =="
curl -s -i -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
[ "$S" = "201" ] && ok "register 201" || bad "register got $S"
TOK=$(body_of | python -c "import sys,json; print(json.load(sys.stdin)['token'])")

AUTH="Authorization: Bearer $TOK"

echo "== A. past BREAK (startDate=$PAST, refDate=$TODAY, no relapse → cleanStreak 4) =="
curl -s -i -X POST "$BASE/api/habits" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Past Break ${TS}\",\"type\":\"BREAK\",\"startDate\":\"$PAST\"}" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
[ "$S" = "201" ] && ok "past BREAK create 201" || bad "past BREAK create got $S"
PBID=$(body_of | jval "['habit']['id']")
curl -s -i "$BASE/api/habits/$PBID?refDate=$TODAY" -H "$AUTH" > "$RESP"
CS=$(body_of | jval "['stats']['cleanStreak']")
[ "$CS" = "4" ] && ok "past BREAK cleanStreak=4 (got $CS)" || bad "past BREAK cleanStreak=$CS (expected 4)"
LR=$(body_of | jval "['stats']['lastRelapseDate']")
[ "$LR" = "None" ] && ok "past BREAK lastRelapseDate null" || bad "past BREAK lastRelapseDate=$LR (expected null)"

echo "== B. future BREAK (startDate=$FUTURE, refDate=$TODAY → list 200, cleanStreak 0) =="
curl -s -i -X POST "$BASE/api/habits" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Future Break ${TS}\",\"type\":\"BREAK\",\"startDate\":\"$FUTURE\"}" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
[ "$S" = "201" ] && ok "future BREAK create 201" || bad "future BREAK create got $S"
curl -s -i "$BASE/api/habits?refDate=$TODAY" -H "$AUTH" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
[ "$S" = "200" ] && ok "list with future BREAK 200" || bad "list got $S"
FBCS=$(body_of | python -c "import sys,json; hs=json.load(sys.stdin)['habits']; print([h['stats']['cleanStreak'] for h in hs if 'Future Break' in h['name']][0])")
[ "$FBCS" = "0" ] && ok "future BREAK cleanStreak=0" || bad "future BREAK cleanStreak=$FBCS (expected 0)"

echo "== C. future BUILD (startDate=$FUTURE, refDate=$TODAY → list 200, missed 0) =="
curl -s -i -X POST "$BASE/api/habits" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Future Build ${TS}\",\"type\":\"BUILD\",\"startDate\":\"$FUTURE\"}" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
[ "$S" = "201" ] && ok "future BUILD create 201" || bad "future BUILD create got $S"
FBID=$(body_of | jval "['habit']['id']")
curl -s -i "$BASE/api/habits/$FBID?refDate=$TODAY" -H "$AUTH" > "$RESP"
S=$(head -1 "$RESP" | tr -d '\r' | awk '{print $2}')
[ "$S" = "200" ] && ok "future BUILD detail 200 (no 400)" || bad "future BUILD detail got $S"
MD=$(body_of | jval "['stats']['missedDays']")
[ "$MD" = "0" ] && ok "future BUILD missed=0" || bad "future BUILD missed=$MD (expected 0)"
ED=$(body_of | jval "['stats']['weekElapsedDays']")
[ "$ED" = "0" ] && ok "future BUILD weekElapsedDays=0" || bad "future BUILD weekElapsedDays=$ED (expected 0)"

echo "== D. active habit flows still work =="
# Active habit: startDate today, complete today → streak 1.
curl -s -i -X POST "$BASE/api/habits" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Active Build ${TS}\",\"type\":\"BUILD\",\"startDate\":\"$TODAY\"}" > "$RESP"
ABID=$(body_of | jval "['habit']['id']")
S=$(status_of -X PUT "$BASE/api/habits/$ABID/completions" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"date\":\"$TODAY\",\"refDate\":\"$TODAY\"}")
[ "$S" = "201" ] && ok "active BUILD complete 201" || bad "active BUILD complete got $S"
curl -s -i "$BASE/api/habits/$ABID?refDate=$TODAY" -H "$AUTH" > "$RESP"
AS=$(body_of | jval "['stats']['currentStreak']")
[ "$AS" = "1" ] && ok "active BUILD streak=1" || bad "active BUILD streak=$AS (expected 1)"

echo "== E. pre-start completion still rejected (event before startDate) =="
# Future habit: completing on TODAY (before startDate FUTURE) must be 400.
curl -s -i "$BASE/api/habits?refDate=$TODAY" -H "$AUTH" > "$RESP"
FBID=$(body_of | python -c "import sys,json; hs=json.load(sys.stdin)['habits']; print([h['id'] for h in hs if 'Future Build' in h['name']][0])")
S=$(status_of -X PUT "$BASE/api/habits/$FBID/completions" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"date\":\"$TODAY\",\"refDate\":\"$TODAY\"}")
[ "$S" = "400" ] && ok "pre-start completion rejected 400" || bad "pre-start completion got $S (expected 400)"

echo "== F. auth regression (login) =="
S=$(status_of -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
[ "$S" = "200" ] && ok "login 200" || bad "login got $S"

echo "== cleanup =="
docker exec datasaur-habit-shaper-db-1 mysql -uhabit_user -phabit_password habit_shaper \
  -e "DELETE FROM users WHERE email='$EMAIL';" 2>/dev/null | grep -v 'Using a password'
ok "throwaway user removed"

echo
echo "FUTURE-DATE SMOKE RESULT: $PASS_COUNT passed, $FAIL_COUNT failed"
[ "$FAIL_COUNT" -eq 0 ] || exit 1
rm -f "$RESP"
