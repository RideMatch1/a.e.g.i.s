#!/usr/bin/env bash
# brutaler-anwalt — Health-Check for skill consistency.
# Usage: bash scripts/health-check.sh
# Exit:  0 healthy · 1 issues found

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
issues=0

echo "▎ brutaler-anwalt Health-Check"
echo "▎ Skill-Dir: $SKILL_DIR"
echo

# 1. Brand-Leak-Check — known brand-codenames must NOT appear
# Note: grep -l returns exit 1 on no-match — we tolerate that via subshell+|| true
# so set -euo pipefail does not abort the script when 0 leaks is the desired state.
echo "1/5  Brand-Leak-Check…"
BRAND_PATTERN="hundementor|seitengold|ucos\.space|Neonarc|alexander hertle|hertlelukas|metrics\.hundementor|UCOS-space"
brand_hits=$( (grep -rEnli "$BRAND_PATTERN" \
  "$SKILL_DIR/SKILL.md" "$SKILL_DIR/README.md" "$SKILL_DIR/LICENSE" "$SKILL_DIR/CHANGELOG.md" "$SKILL_DIR/references/" 2>/dev/null || true) \
  | wc -l | tr -d ' ')
if [[ "$brand_hits" == "0" ]]; then
  echo "     ✓ keine Brand-Leaks"
else
  echo "     ✗ $brand_hits Brand-Leak-Treffer:"
  grep -rEni "$BRAND_PATTERN" \
    "$SKILL_DIR/SKILL.md" "$SKILL_DIR/README.md" "$SKILL_DIR/LICENSE" "$SKILL_DIR/CHANGELOG.md" "$SKILL_DIR/references/" 2>/dev/null | head -10 || true
  issues=$((issues + 1))
fi

# 2. Az.-Provenance — every entry should have a Source-URL
echo "2/5  Az.-Provenance-Check…"
# Az.-Eintraege = ### Headers, ABER nicht Pattern-Sections (### Wenn ...)
# und nicht die Audit-Trigger-Sections die thematisch sind, keine Az.
az_count=$( (grep -cE "^### " "$SKILL_DIR/references/bgh-urteile.md" 2>/dev/null || echo 0) | head -1)
pattern_count=$( (grep -cE "^### Wenn " "$SKILL_DIR/references/bgh-urteile.md" 2>/dev/null || echo 0) | head -1)
real_az=$((az_count - pattern_count))
# Source-Verlinkung in beliebigem Markdown-Format: **Source**, "Source:", oder eingebetteter http(s)-Link.
src_count=$( (grep -cE "\*\*Source\*\*|Source:|https?://(juris|curia|dejure|openjur|rewis|edpb|gesetze-im-internet|eur-lex|bverwg|bag-urteil|nrwe|wettbewerbszentrale|noerr|twobirds|bird-bird|alro-recht|bfdi|datenschutz-berlin|lfd\.niedersachsen|taylorwessing|lto|llp-law|lennmed|medien-internet-und-recht|dataprotection\.ie|edpb\.europa|heise|bafin)" "$SKILL_DIR/references/bgh-urteile.md" 2>/dev/null || echo 0) | head -1)
# Tolerated unsourced: VERDACHT-HALLUZINATION + DPF-Klage-anhaengig (intentionally unsourced)
tolerated_count=$( (grep -cE "VERDACHT-HALLUZINATION|unverifiziert, da Verfahren" "$SKILL_DIR/references/bgh-urteile.md" 2>/dev/null || echo 0) | head -1)
expected_src=$((real_az - tolerated_count))
echo "     Az.-Eintraege (echte): $real_az · Source-Verlinkungen: $src_count · Toleriert (Halluzin/anhaengig): $tolerated_count"
if [[ "$src_count" -lt "$expected_src" ]]; then
  diff=$((expected_src - src_count))
  echo "     ⚠ $diff Eintraege ohne Source-Verlinkung — Provenance-Disziplin §5 pruefen"
  issues=$((issues + 1))
else
  echo "     ✓ alle Az.-Eintraege haben Source-Verlinkung (modulo $tolerated_count tolerierte)"
fi

# 3. Verzeichnis-Vollstaendigkeit
echo "3/5  Verzeichnis-Vollstaendigkeit…"
required=("SKILL.md" "README.md" "LICENSE" "CHANGELOG.md" \
  "references/audit-patterns.md" "references/dsgvo.md" "references/it-recht.md" \
  "references/vertragsrecht.md" "references/checklisten.md" "references/branchenrecht.md" \
  "references/bgh-urteile.md" "references/abmahn-templates.md" "references/aegis-integration.md" \
  "references/international.md" "references/strafrecht-steuer.md" \
  "references/templates/README.md" \
  "references/gesetze/INDEX.md" \
  "references/stack-patterns/INDEX.md")

missing=0
for f in "${required[@]}"; do
  if [[ ! -f "$SKILL_DIR/$f" ]]; then
    echo "     ✗ fehlt: $f"
    missing=$((missing + 1))
  fi
done
if [[ "$missing" == "0" ]]; then
  echo "     ✓ alle ${#required[@]} Pflicht-Files vorhanden"
else
  echo "     ✗ $missing Pflicht-Files fehlen"
  issues=$((issues + 1))
fi

# 4. SKILL.md Reference-Loading-Map → File-Vorhandensein
echo "4/5  Reference-Loading-Map konsistent…"
map_files=$(grep -oE 'references/[a-z_-]+\.md' "$SKILL_DIR/SKILL.md" 2>/dev/null | sort -u)
for f in $map_files; do
  if [[ ! -f "$SKILL_DIR/$f" ]]; then
    echo "     ✗ SKILL.md verlinkt $f, aber Datei fehlt"
    issues=$((issues + 1))
  fi
done
echo "     ✓ alle in SKILL.md referenzierten Files vorhanden"

# 5. Templates ohne Brand-Leak
echo "5/6  Templates anonymisiert…"
template_brand_hits=$( (grep -rEnli "hundementor|seitengold|ucos|Neonarc" \
  "$SKILL_DIR/references/templates/" 2>/dev/null || true) | wc -l | tr -d ' ')
if [[ "$template_brand_hits" == "0" ]]; then
  echo "     ✓ alle Templates anonymisiert"
else
  echo "     ✗ Templates enthalten Brand-Refs (sollten anonym sein):"
  grep -rEni "hundementor|seitengold|ucos|Neonarc" \
    "$SKILL_DIR/references/templates/" 2>/dev/null | head -10 || true
  issues=$((issues + 1))
fi

# 6. Az-Cross-File-Konsistenz (V4.0-Lesson, post-E.1-Cleanup-Lesson 2026-05-02)
# Detekt: bekannte verworfene Az. die als AKTIVE Citation auftauchen (nicht als Doku-Note)
# Toleriert: Provenance-Notes / VERDACHT-HALLUZINATION-Tags / „verworfen" / Lesson-Kontext.
echo "6/6  Az-Cross-File-Konsistenz (aktive Drifts)…"
DRIFT_FOUND=0
# 6a. OLG Hamm 4 U 75/23 — aktive Citation = ohne Doku-Marker im selben File
hamm_active=$( (grep -rEn "OLG Hamm.*4 U 75/23|Hamm 4 U 75/23" \
  "$SKILL_DIR/references/" "$SKILL_DIR/SKILL.md" 2>/dev/null || true) \
  | (grep -vE "verworfen|Vorgaenger-Eintrag|Provenance-Note|Lesson|halluzin|Halluzin|war \*\*OLG Hamm|tatsaechlich 11 U 88|→ 11 U 88|→ tatsaechlich" || true) \
  | wc -l | tr -d ' ')
if [[ "$hamm_active" -gt "0" ]]; then
  echo "     ✗ OLG Hamm 4 U 75/23 in $hamm_active aktiven Citation(s) — sollte 11 U 88/22 sein:"
  grep -rEn "OLG Hamm.*4 U 75/23|Hamm 4 U 75/23" "$SKILL_DIR/references/" "$SKILL_DIR/SKILL.md" 2>/dev/null \
    | grep -vE "verworfen|Vorgaenger-Eintrag|Provenance-Note|Lesson|halluzin|Halluzin|war \*\*OLG Hamm" | head -3 || true
  DRIFT_FOUND=$((DRIFT_FOUND + 1))
fi
# 6b. LG Berlin 16 O 9/22 — analog
# grep -v exits with 1 when ALL lines are filtered out (legitimate match → no active drift).
# Use `|| true` defensively after the grep -v + wrap in subshell.
lgb_active=$( (grep -rEn "16 O 9/22" "$SKILL_DIR/references/" "$SKILL_DIR/SKILL.md" 2>/dev/null || true) \
  | (grep -vE "VERDACHT-HALLUZINATION|halluzin|Halluzin|verworfen|nicht zitieren|Lesson|existiert nicht|ersetzt durch|→ BGH I ZR 218/07" || true) \
  | wc -l | tr -d ' ')
if [[ "$lgb_active" -gt "0" ]]; then
  echo "     ✗ LG Berlin 16 O 9/22 in $lgb_active aktiven Citation(s) — Halluzination, BGH I ZR 218/07 verwenden"
  DRIFT_FOUND=$((DRIFT_FOUND + 1))
fi
if [[ "$DRIFT_FOUND" == "0" ]]; then
  echo "     ✓ keine aktiven Cross-File-Az-Drifts"
else
  issues=$((issues + 1))
fi

echo
if [[ "$issues" == "0" ]]; then
  echo "✓ Health-Check passed — Skill ist konsistent."
  exit 0
else
  echo "✗ Health-Check failed — $issues Issues gefunden."
  exit 1
fi
