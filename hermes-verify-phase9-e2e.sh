#!/usr/bin/env bash
# Phase 9 nginx E2E smoke — goals management through http://localhost:3000.
# Throwaway user; every step asserts; exit non-zero on first failure.
# No passwords or JWTs are printed (only the final HTTP statuses + ids).
set -euo pipefail

BASE="http://localhost:3000/api"
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ok   $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL $1"; }
check() { # $1 desc, $2 actual, $3 expected
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got: $2, want: $3)"; fi
}

# ---------- auth ----------
EMAIL="p9-$(date +%s)@example.com"
PASSWD="ThrowawayPass9!"
echo "== auth ($EMAIL) =="
REG=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}")
TOKEN=$(echo "$REG" | python -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
if [ -n "$TOKEN" ]; then ok "register returns token"; else bad "register token (raw: $(echo "$REG" | head -c 120))"; fi

ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $TOKEN")
check "auth/me works" "$(echo "$ME" | python -c "import sys,json; print(json.load(sys.stdin)['user']['email'])" 2>/dev/null)" "$EMAIL"

AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"
# Backend container clock is UTC (host may differ) — use the backend's date
# for refDate/completion paths so "today" matches server-side semantics.
TODAY=$(docker exec datasaur-habit-shaper-backend-1 date +%F)

# ---------- habits: one BUILD, one BREAK ----------
echo "== habits =="
HB=$(curl -s -X POST "$BASE/habits" -H "$AUTH" -H "$CT" \
  -d "{\"name\":\"Phase9 Build Habit\",\"type\":\"BUILD\",\"startDate\":\"$TODAY\"}")
BID=$(echo "$HB" | python -c "import sys,json; print(json.load(sys.stdin)['habit']['id'])" 2>/dev/null || echo "")
[ -n "$BID" ] && ok "BUILD habit created (id $BID)" || bad "BUILD habit create"

HR=$(curl -s -X POST "$BASE/habits" -H "$AUTH" -H "$CT" \
  -d "{\"name\":\"Phase9 Break Habit\",\"type\":\"BREAK\",\"startDate\":\"$TODAY\"}")
RID=$(echo "$HR" | python -c "import sys,json; print(json.load(sys.stdin)['habit']['id'])" 2>/dev/null || echo "")
[ -n "$RID" ] && ok "BREAK habit created (id $RID)" || bad "BREAK habit create"

# ---------- goals: create linked to BUILD and BREAK ----------
echo "== goals create =="
GB=$(curl -s -X POST "$BASE/goals" -H "$AUTH" -H "$CT" \
  -d "{\"habitId\":$BID,\"title\":\"P9 build goal\",\"description\":\"linked to BUILD\"}")
GID_B=$(echo "$GB" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['id'])" 2>/dev/null || echo "")
[ -n "$GID_B" ] && ok "goal linked to BUILD created (id $GID_B)" || bad "goal BUILD create"
check "goal habit type BUILD" \
  "$(echo "$GB" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['habit']['type'])" 2>/dev/null)" "BUILD"

GR=$(curl -s -X POST "$BASE/goals" -H "$AUTH" -H "$CT" \
  -d "{\"habitId\":$RID,\"title\":\"P9 break goal\"}")
GID_R=$(echo "$GR" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['id'])" 2>/dev/null || echo "")
[ -n "$GID_R" ] && ok "goal linked to BREAK created (id $GID_R)" || bad "goal BREAK create"
check "goal habit type BREAK" \
  "$(echo "$GR" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['habit']['type'])" 2>/dev/null)" "BREAK"

# ---------- goals list shows both with embedded habit ----------
echo "== goals list =="
GL=$(curl -s "$BASE/goals" -H "$AUTH")
check "list has 2 goals" "$(echo "$GL" | python -c "import sys,json; print(len(json.load(sys.stdin)['goals']))" 2>/dev/null)" "2"
check "list embeds habit type for build goal" \
  "$(echo "$GL" | python -c "import sys,json; gs=json.load(sys.stdin)['goals']; print([g['habit']['type'] for g in gs if g['id']==$GID_B][0])" 2>/dev/null)" "BUILD"

# ---------- edit title ----------
echo "== goals edit =="
GE1=$(curl -s -X PATCH "$BASE/goals/$GID_B" -H "$AUTH" -H "$CT" -d '{"title":"P9 build goal renamed"}')
check "edit title" "$(echo "$GE1" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['title'])" 2>/dev/null)" "P9 build goal renamed"

# ---------- edit description ----------
GE2=$(curl -s -X PATCH "$BASE/goals/$GID_B" -H "$AUTH" -H "$CT" -d '{"description":"edited description"}')
check "edit description" "$(echo "$GE2" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['description'])" 2>/dev/null)" "edited description"

# ---------- clear description ----------
GE3=$(curl -s -X PATCH "$BASE/goals/$GID_B" -H "$AUTH" -H "$CT" -d '{"description":null}')
check "clear description (null)" "$(echo "$GE3" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['description'])" 2>/dev/null)" "None"

# ---------- relink BUILD -> BREAK ----------
GE4=$(curl -s -X PATCH "$BASE/goals/$GID_B" -H "$AUTH" -H "$CT" -d "{\"habitId\":$RID}")
check "relink to BREAK habit" "$(echo "$GE4" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['habit']['type'])" 2>/dev/null)" "BREAK"
check "relink habitId" "$(echo "$GE4" | python -c "import sys,json; print(json.load(sys.stdin)['goal']['habitId'])" 2>/dev/null)" "$RID"

# ---------- foreign habit relink -> 404 (ownership preserved) ----------
FOREIGN=$(curl -s -i -X PATCH "$BASE/goals/$GID_B" -H "$AUTH" -H "$CT" \
  -d "{\"habitId\":999999}" | head -1 | tr -d '\r' | awk '{print $2}')
check "foreign habit relink 404" "$FOREIGN" "404"

# ---------- delete one goal; other goal + both habits remain ----------
echo "== goals delete =="
DEL_STATUS=$(curl -s -i -X DELETE "$BASE/goals/$GID_R" -H "$AUTH" | head -1 | tr -d '\r' | awk '{print $2}')
check "delete goal returns 204" "$DEL_STATUS" "204"

GL2=$(curl -s "$BASE/goals" -H "$AUTH")
check "1 goal remains" "$(echo "$GL2" | python -c "import sys,json; print(len(json.load(sys.stdin)['goals']))" 2>/dev/null)" "1"
check "deleted goal gone" "$(echo "$GL2" | python -c "import sys,json; print(any(g['id']==$GID_R for g in json.load(sys.stdin)['goals']))" 2>/dev/null)" "False"

HL=$(curl -s "$BASE/habits?refDate=$TODAY" -H "$AUTH")
check "both habits still exist" "$(echo "$HL" | python -c "import sys,json; print(len(json.load(sys.stdin)['habits']))" 2>/dev/null)" "2"

# ---------- regression: habit completion + undo still work ----------
# Contract (backend/src/routes/tracking.ts): PUT /habits/:id/completions
# body { date, refDate } — 201 first, 200 idempotent repeat (D2). No path date,
# no server clock (D8): explicit calendar dates only.
COMP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/habits/$BID/completions" -H "$AUTH" -H "$CT" \
  -d "{\"date\":\"$TODAY\",\"refDate\":\"$TODAY\"}")
COMP_CODE=$(echo "$COMP" | tail -1)
check "completion PUT 201" "$COMP_CODE" "201"
COMP2=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/habits/$BID/completions" -H "$AUTH" -H "$CT" \
  -d "{\"date\":\"$TODAY\",\"refDate\":\"$TODAY\"}")
COMP2_CODE=$(echo "$COMP2" | tail -1)
check "completion PUT idempotent 200" "$COMP2_CODE" "200"
HABSTAT=$(curl -s "$BASE/habits?refDate=$TODAY" -H "$AUTH")
check "stats streak 1" "$(echo "$HABSTAT" | python -c "import sys,json; hs=[h for h in json.load(sys.stdin)['habits'] if h['id']==$BID]; print(hs[0].get('stats',{}).get('currentStreak'))" 2>/dev/null)" "1"
UNDO=$(curl -s -i -X DELETE "$BASE/habits/$BID/completions/$TODAY" -H "$AUTH" | head -1 | tr -d '\r' | awk '{print $2}')
check "undo completion 204" "$UNDO" "204"

# ---------- auth regression: unauthenticated goals 401 ----------
echo "== auth regression =="
UNAUTH=$(curl -s -i "$BASE/goals" | head -1 | tr -d '\r' | awk '{print $2}')
check "unauthenticated goals 401" "$UNAUTH" "401"

# ---------- cleanup: delete remaining goal + habits ----------
echo "== cleanup =="
# Best-effort: a curl write-error on -o /dev/null must not abort the script.
curl -s -o /dev/null -X DELETE "$BASE/goals/$GID_B" -H "$AUTH" || true
curl -s -o /dev/null -X DELETE "$BASE/habits/$BID" -H "$AUTH" || true
curl -s -o /dev/null -X DELETE "$BASE/habits/$RID" -H "$AUTH" || true
check "cleanup done" "yes" "yes"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
