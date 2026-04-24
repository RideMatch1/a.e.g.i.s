#!/usr/bin/env bash
# Check TMG §5 / DDG field-completeness in rendered Impressum page.
# Pass: >=5 of the required field-class markers present.
# Fail: <5 markers. Lists which classes are missing.
#
# bash-3-compat: uses parallel indexed arrays, not associative arrays
# (declare -A needs bash 4+ which macOS stock does not ship).
# Keep CLASS_NAMES + CLASS_PATTERNS index-aligned.

set -euo pipefail

IMPRESSUM_PATH="${1:-src/app/[locale]/impressum/page.tsx}"

if [[ ! -f "$IMPRESSUM_PATH" ]]; then
  echo "::error::Impressum page not found at $IMPRESSUM_PATH" >&2
  exit 1
fi

CLASS_NAMES=(
  "1-Anschrift"
  "2-PLZ-Ort"
  "3-Kontakt-Email"
  "4-Vertretung"
  "5-Handelsregister"
  "6-USt-IdNr"
  "7-Telefon"
)
CLASS_PATTERNS=(
  'straße|strasse|str\.|anschrift|\b[a-zäöüß]+(weg|allee|platz|ring|chaussee|damm|pfad|ufer)\b'
  '[0-9]{5}'
  'mailto:|e-mail:|kontakt:|email:'
  'geschäftsführer|geschaeftsfuehrer|gf:|vertreten durch|inhaber'
  'handelsregister|hrb|hra|amtsgericht'
  'ust-idnr|umsatzsteuer-id|vat-id|de[0-9]{9}'
  'telefon:|tel\.:|\+49'
)

FOUND_LIST=""
MISSING_LIST=""
COUNT=0

for i in "${!CLASS_NAMES[@]}"; do
  if grep -qiE "${CLASS_PATTERNS[$i]}" "$IMPRESSUM_PATH"; then
    FOUND_LIST="$FOUND_LIST ${CLASS_NAMES[$i]}"
    COUNT=$((COUNT + 1))
  else
    MISSING_LIST="$MISSING_LIST ${CLASS_NAMES[$i]}"
  fi
done

echo "TMG §5 field-class markers found: $COUNT/7"
echo "  Found:  ${FOUND_LIST:-none}"
echo "  Missing:${MISSING_LIST:-none}"

# v0.17.2 M1 — empty-placeholder broken-HTML detection.
# An Impressum that substitutes optional fields (DPO, HRB, Vertretungsberechtigter,
# etc.) to empty strings while keeping their wrapper-tags intact produces
# semantically-broken HTML the placeholder-grep gate cannot see:
#   <a href="mailto:"></a>   (empty mailto link)
#   <a href=""></a>          (empty href)
#   <p></p>, <li></li>        (empty wrapper-tags)
# Fail the gate on any of those patterns so the broken render is caught
# before ship rather than in production.
EMPTY_HTML=$(grep -nE 'href="mailto:"|href=""|<[a-z]+>[[:space:]]*</[a-z]+>' "$IMPRESSUM_PATH" || true)
if [[ -n "$EMPTY_HTML" ]]; then
  echo "::error::Impressum contains empty-placeholder HTML (broken render):" >&2
  echo "$EMPTY_HTML" >&2
  echo "Cause: optional pattern-fields (DPO, HRB, Vertretungsberechtigter, etc.) substituted to empty strings while their wrapper-tags still rendered." >&2
  echo "Fix: populate the missing config-fields OR remove the wrapper-tags from the pattern body for the optional case." >&2
  exit 1
fi

if [[ $COUNT -lt 5 ]]; then
  echo "::error::Impressum incomplete — only $COUNT/7 TMG §5 field-classes present (need >=5). Missing:$MISSING_LIST. Abmahnung-risk €500-2000." >&2
  exit 1
fi

echo "Impressum gate PASS: $COUNT/7 field-classes present (threshold >=5)."
exit 0
