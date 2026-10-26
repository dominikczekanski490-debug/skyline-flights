#!/usr/bin/env bash
# Smoke test: hit /api/board for ~25+ airports, both directions. Reports non-200 / empty / slow.
# Usage: scripts/smoke.sh [base-url]   (default http://localhost:8787)
BASE="${1:-http://localhost:8787}"
APTS="${APTS:-MAN STN EMA LHR LGW EDI DUB LBA BFS ABZ OSL FRA MUC BER DUS VIE MAD BCN AMS ARN HEL KEF LUX WAW KRK PRG BUD ZRH GVA HAM}"
fail=0
for a in $APTS; do for d in dep arr; do
  out=$(curl -s -m 40 -o /tmp/smoke.$$ -w "%{http_code} %{time_total}" "$BASE/api/board/$a?dir=$d")
  n=$(node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((j.flights||[]).length+" "+(j.sourceKind||j.error||"?"))}catch{console.log("0 badjson")}' /tmp/smoke.$$)
  code=${out%% *}; cnt=${n%% *}; flag=OK
  if [ "$code" != 200 ]; then flag=FAIL; fail=$((fail+1)); elif [ "$cnt" = 0 ]; then flag=EMPTY; fi
  printf "%-4s %-3s %-5s %3s %7ss %5s rows  %s\n" "$a" "$d" "$flag" "$code" "${out##* }" "$cnt" "${n#* }"
done; done
rm -f /tmp/smoke.$$; echo "failures: $fail"; [ $fail = 0 ]
