#!/usr/bin/env bash
# Redesign E2E smoke through real nginx :3000 — verifies the Verdana redesign
# did not break any business flow. Throwaway user; self-cleans at the end.
# curl exit-23-safe (uses `-i | head -1 | awk` instead of -o /dev/null -w).
set -euo pipefail

BASE="http://localhost:3000/api"
RESP="$(mktemp)"
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ok: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

status_of() { tr -d '\r' < "$RESP" | head -1 | awk '{print $2}'; }
body_of()   { tr -d '\r' < "$RESP" | sed '1,/^$/d'; }

# JSON field helper via python (readable, no jq dependency).
jval() { body_of | python -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }

email="redesign-$(date +%s)@example.com"
pass="ThrowawayPass9!"

echo "== register =="
curl -s -i -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"$pass\"}" > "$RESP" || true
[ "$(status_of)" = "201" ] && ok "register 201" || bad "register $(status_of)"
TOK="$(jval "['token']")"

echo "== session restore =="
curl -s -i "$BASE/auth/me" -H "Authorization: Bearer $TOK" > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "auth/me 200" || bad "auth/me $(status_of)"

echo "== create BUILD habit =="
curl -s -i -X POST "$BASE/habits" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d "{\"name\":\"Meditate\",\"type\":\"BUILD\",\"startDate\":\"2026-08-01\"}" > "$RESP" || true
[ "$(status_of)" = "201" ] && ok "create BUILD 201" || bad "create BUILD $(status_of)"
BUILD_ID="$(jval "['habit']['id']")"

echo "== create BREAK habit =="
curl -s -i -X POST "$BASE/habits" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d "{\"name\":\"No doomscrolling\",\"type\":\"BREAK\",\"startDate\":\"2026-08-01\"}" > "$RESP" || true
[ "$(status_of)" = "201" ] && ok "create BREAK 201" || bad "create BREAK $(status_of)"
BREAK_ID="$(jval "['habit']['id']")"

echo "== list habits =="
curl -s -i "$BASE/habits?refDate=2026-08-13" -H "Authorization: Bearer $TOK" > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "list habits 200" || bad "list habits $(status_of)"
[ "$(body_of | python -c "import sys,json; print(len(json.load(sys.stdin)['habits']))")" -ge 2 ] && ok "2 habits listed" || bad "habit count"

echo "== complete today (BUILD) =="
curl -s -i -X PUT "$BASE/habits/$BUILD_ID/completions" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" -d '{"date":"2026-08-13","refDate":"2026-08-13"}' > "$RESP" || true
[ "$(status_of)" = "201" ] && ok "complete 201" || bad "complete $(status_of)"

echo "== idempotent repeat =="
curl -s -i -X PUT "$BASE/habits/$BUILD_ID/completions" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" -d '{"date":"2026-08-13","refDate":"2026-08-13"}' > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "repeat 200 (idempotent)" || bad "repeat $(status_of)"

echo "== stats reflect completion =="
curl -s -i "$BASE/habits/$BUILD_ID?refDate=2026-08-13" -H "Authorization: Bearer $TOK" > "$RESP" || true
STREAK="$(jval "['stats']['currentStreak']")"
[ "$STREAK" -ge 1 ] && ok "streak=$STREAK" || bad "streak=$STREAK"

echo "== undo completion =="
curl -s -i -X DELETE "$BASE/habits/$BUILD_ID/completions/2026-08-13" -H "Authorization: Bearer $TOK" > "$RESP" || true
[ "$(status_of)" = "204" ] && ok "undo 204" || bad "undo $(status_of)"

echo "== record relapse (BREAK) =="
curl -s -i -X POST "$BASE/habits/$BREAK_ID/relapses" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" -d '{"relapseDate":"2026-08-12","refDate":"2026-08-13"}' > "$RESP" || true
[ "$(status_of)" = "201" ] && ok "relapse 201" || bad "relapse $(status_of)"

echo "== relapse stats =="
curl -s -i "$BASE/habits/$BREAK_ID?refDate=2026-08-13" -H "Authorization: Bearer $TOK" > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "BREAK detail 200" || bad "BREAK detail $(status_of)"
LAST="$(jval "['stats']['lastRelapseDate']")"
[ "$LAST" = "2026-08-12" ] && ok "lastRelapse=$LAST" || bad "lastRelapse=$LAST"

echo "== goals: create BUILD-linked =="
curl -s -i -X POST "$BASE/goals" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d "{\"habitId\":$BUILD_ID,\"title\":\"Meditate daily\",\"description\":\"10 min every morning\"}" > "$RESP" || true
[ "$(status_of)" = "201" ] && ok "goal BUILD-linked 201" || bad "goal BUILD-linked $(status_of)"
G1="$(jval "['goal']['id']")"
[ "$(jval "['goal']['habit']['type']")" = "BUILD" ] && ok "embedded habit BUILD" || bad "embedded habit type"

echo "== goals: create BREAK-linked =="
curl -s -i -X POST "$BASE/goals" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d "{\"habitId\":$BREAK_ID,\"title\":\"Quit doomscrolling\"}" > "$RESP" || true
[ "$(status_of)" = "201" ] && ok "goal BREAK-linked 201" || bad "goal BREAK-linked $(status_of)"
G2="$(jval "['goal']['id']")"

echo "== goals: list =="
curl -s -i "$BASE/goals" -H "Authorization: Bearer $TOK" > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "list goals 200" || bad "list goals $(status_of)"
[ "$(body_of | python -c "import sys,json; print(len(json.load(sys.stdin)['goals']))")" -ge 2 ] && ok "2 goals" || bad "goal count"

echo "== goals: edit title + clear description =="
curl -s -i -X PATCH "$BASE/goals/$G1" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" -d '{"title":"Meditate every day","description":null}' > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "edit goal 200" || bad "edit goal $(status_of)"
[ "$(jval "['goal']['description']")" = "None" ] && ok "description cleared (null)" || bad "desc cleared"

echo "== goals: relink to BREAK =="
curl -s -i -X PATCH "$BASE/goals/$G1" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" -d "{\"habitId\":$BREAK_ID}" > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "relink 200" || bad "relink $(status_of)"
[ "$(jval "['goal']['habit']['type']")" = "BREAK" ] && ok "relinked to BREAK" || bad "relinked type"

echo "== goals: foreign relink → 404 =="
curl -s -i -X PATCH "$BASE/goals/$G1" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" -d '{"habitId":999999}' > "$RESP" || true
[ "$(status_of)" = "404" ] && ok "foreign relink 404" || bad "foreign relink $(status_of)"

echo "== goals: delete =="
curl -s -i -X DELETE "$BASE/goals/$G1" -H "Authorization: Bearer $TOK" > "$RESP" || true
[ "$(status_of)" = "204" ] && ok "delete goal 204" || bad "delete goal $(status_of)"

echo "== habit intact after goal delete =="
curl -s -i "$BASE/habits/$BUILD_ID?refDate=2026-08-13" -H "Authorization: Bearer $TOK" > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "habit still exists" || bad "habit gone"

echo "== auth regression: logout/login =="
curl -s -i -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"$pass\"}" > "$RESP" || true
[ "$(status_of)" = "200" ] && ok "login 200" || bad "login $(status_of)"

echo "== wrong password rejected =="
curl -s -i -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"wrongpass\"}" > "$RESP" || true
[ "$(status_of)" = "401" ] && ok "wrong password 401" || bad "wrong password $(status_of)"

echo "== cleanup: delete throwaway user =="
docker exec datasaur-habit-shaper-db-1 mysql -uhabit_user -phabit_password habit_shaper \
  -e "DELETE FROM users WHERE email='$email';" > /dev/null 2>&1 || true
echo "  cleanup done"

rm -f "$RESP"
echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
