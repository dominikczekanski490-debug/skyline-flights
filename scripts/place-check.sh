#!/bin/bash
# Checks the destination-guide place resolver: airport -> resolved place -> population. Fails if the airport's own city name isn't matched.
B=${B:-http://localhost:8787}; fail=0
for c in ${@:-FUE ACE TFS LPA PMI AGP ALC FAO OLB MAN DUB ATH RHO HER SKG IST KEF TRD TOS BGO LHR JFK DXB BCN CFU ZTH IBZ MLA PFO NCE}; do
  j=$(curl -s -m 60 "$B/api/place/$c"); line=$(echo "$j" | python3 -c "import json,sys
try: d=json.load(sys.stdin)
except: print('ERR'); sys.exit()
if 'error' in d: print('ERR', d['error']); sys.exit()
p=d.get('place') or {}; pop=d.get('pop') or {}
print(('OK ' if d.get('matched') else 'FAIL'), d.get('apCity'), '->', p.get('label'), p.get('qid'), '| island:', d.get('island'), '| pop:', pop.get('n'), pop.get('year'), '|', d.get('how'))")
  echo "$c $line"; case "$line" in OK*) ;; *) fail=1;; esac; done; exit $fail
