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
echo "1/7  Brand-Leak-Check…"
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
echo "2/7  Az.-Provenance-Check…"
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
echo "3/7  Verzeichnis-Vollstaendigkeit…"
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
echo "4/7  Reference-Loading-Map konsistent…"
map_files=$(grep -oE 'references/[a-z_-]+\.md' "$SKILL_DIR/SKILL.md" 2>/dev/null | sort -u)
for f in $map_files; do
  if [[ ! -f "$SKILL_DIR/$f" ]]; then
    echo "     ✗ SKILL.md verlinkt $f, aber Datei fehlt"
    issues=$((issues + 1))
  fi
done
echo "     ✓ alle in SKILL.md referenzierten Files vorhanden"

# 5. Templates ohne Brand-Leak
echo "5/7  Templates anonymisiert…"
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
echo "6/7  Az-Cross-File-Konsistenz (aktive Drifts)…"
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

# 7. Frontmatter-Validation (verification-status / last-checked / source)
# Liest NUR den Top-Level-YAML-Block (zwischen erster --- und zweiter ---);
# code-fenced Templates innerhalb des Markdown-Bodies werden ignoriert.
echo "7/7  Frontmatter-Validation…"
fm_issues=0
allowed_vs="verified|partially-verified|secondary-source-derived|az-list-unverified|skeleton-only"
fm_files_checked=0

while IFS= read -r -d '' file; do
  fm=$(awk 'BEGIN{state=0}
            state==0 && NR==1 && /^---[[:space:]]*$/ {state=1; next}
            state==0 {exit}
            state==1 && /^---[[:space:]]*$/ {exit}
            state==1 {print}' "$file")
  [[ -z "$fm" ]] && continue
  fm_files_checked=$((fm_files_checked + 1))

  # 7a. verification-status (wenn vorhanden) — Wert muss Whitelist matchen
  vs_line=$(printf "%s\n" "$fm" | grep -E "^verification-status:" | head -1 || true)
  if [[ -n "$vs_line" ]]; then
    vs_value=$(printf "%s" "$vs_line" | sed -E 's/^verification-status:[[:space:]]*//' | awk '{print $1}')
    if ! [[ "$vs_value" =~ ^(verified|partially-verified|secondary-source-derived|az-list-unverified|skeleton-only)$ ]]; then
      rel="${file#$SKILL_DIR/}"
      echo "     ✗ $rel: verification-status='$vs_value' nicht in {$allowed_vs}"
      fm_issues=$((fm_issues + 1))
    fi
  fi

  # 7b. last-checked (wenn vorhanden) — muss mit YYYY-MM-DD beginnen
  lc_line=$(printf "%s\n" "$fm" | grep -E "^last-checked:" | head -1 || true)
  if [[ -n "$lc_line" ]]; then
    lc_value=$(printf "%s" "$lc_line" | sed -E 's/^last-checked:[[:space:]]*//')
    if ! [[ "$lc_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
      rel="${file#$SKILL_DIR/}"
      echo "     ✗ $rel: last-checked='$lc_value' nicht im Format YYYY-MM-DD"
      fm_issues=$((fm_issues + 1))
    fi
  fi

  # 7c. last-verified (wenn vorhanden) — analog
  lv_line=$(printf "%s\n" "$fm" | grep -E "^last-verified:" | head -1 || true)
  if [[ -n "$lv_line" ]]; then
    lv_value=$(printf "%s" "$lv_line" | sed -E 's/^last-verified:[[:space:]]*//')
    if ! [[ "$lv_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
      rel="${file#$SKILL_DIR/}"
      echo "     ✗ $rel: last-verified='$lv_value' nicht im Format YYYY-MM-DD"
      fm_issues=$((fm_issues + 1))
    fi
  fi

  # 7d. source (wenn vorhanden) — http(s)-URL oder YAML-Block-Scalar (Wert beginnt mit | bzw. >).
  src_line=$(printf "%s\n" "$fm" | grep -E "^source:" | head -1 || true)
  if [[ -n "$src_line" ]]; then
    src_value=$(printf "%s" "$src_line" | sed -E 's/^source:[[:space:]]*//')
    # Skip nur wenn Wert mit | oder > BEGINNT (YAML-Block-Scalar-Marker, nicht innerhalb Placeholder).
    if [[ "$src_value" != "|"* && "$src_value" != ">"* ]]; then
      if ! [[ "$src_value" =~ ^https?:// ]]; then
        rel="${file#$SKILL_DIR/}"
        echo "     ✗ $rel: source='$src_value' kein http(s)://-URL"
        fm_issues=$((fm_issues + 1))
      fi
    fi
  fi

  # 7e. Placeholder-Drift — <YYYY-MM-DD>, <primary-URL>, <Quelle> in echtem Frontmatter
  if printf "%s" "$fm" | grep -qE "<YYYY-MM-DD>|<primary-URL>|<Quelle>|<TBD>"; then
    rel="${file#$SKILL_DIR/}"
    echo "     ✗ $rel: enthaelt unausgefuelltes Placeholder im Frontmatter"
    fm_issues=$((fm_issues + 1))
  fi
done < <(find "$SKILL_DIR/references" -name "*.md" -type f -print0)

if [[ "$fm_issues" == "0" ]]; then
  echo "     ✓ alle $fm_files_checked Frontmatter-Bloecke valide"
else
  echo "     ✗ $fm_issues Frontmatter-Verstoesse in $fm_files_checked geprueften Files"
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
