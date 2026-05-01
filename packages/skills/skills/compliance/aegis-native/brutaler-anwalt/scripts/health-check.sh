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

# 1. Brand-Leak-Check — operator-customizable deny-list of brand-codenames
# that must NOT appear in shipped skill content (SKILL.md / references / etc).
#
# CUSTOMIZATION: edit BRAND_PATTERN below to add your own brand-codenames
# (single-bar-separated, regex-syntax). Example: if your projects are named
# `acme-saas` and `bluefin`, set:
#     BRAND_PATTERN="acme-saas|bluefin|your-internal-codename"
# Defaults are placeholder examples; replace before relying on the check.
#
# The check reads the deny-list from a gitignored sibling file when present,
# so operators can keep their real codenames out of the public skill repo.
echo "1/5  Brand-Leak-Check…"
LOCAL_DENY_FILE="$SKILL_DIR/scripts/brand-deny-list.local.txt"
if [[ -f "$LOCAL_DENY_FILE" ]]; then
  # one pattern per line, joined with | for grep -E
  BRAND_PATTERN=$(grep -vE '^[[:space:]]*(#|$)' "$LOCAL_DENY_FILE" | tr '\n' '|' | sed 's/|$//')
  if [[ -z "$BRAND_PATTERN" ]]; then
    BRAND_PATTERN="placeholder-codename-example"
  fi
else
  BRAND_PATTERN="placeholder-codename-example|placeholder-internal-project"
fi
brand_hits=$( (grep -rEnli "$BRAND_PATTERN" \
  "$SKILL_DIR/SKILL.md" "$SKILL_DIR/README.md" "$SKILL_DIR/LICENSE" "$SKILL_DIR/CHANGELOG.md" "$SKILL_DIR/references/" 2>/dev/null || true) \
  | wc -l | tr -d ' ')
if [[ "$brand_hits" == "0" ]]; then
  echo "     ✓ keine Brand-Leaks (Pattern: $BRAND_PATTERN)"
else
  echo "     ✗ $brand_hits Brand-Leak-Treffer:"
  grep -rEni "$BRAND_PATTERN" \
    "$SKILL_DIR/SKILL.md" "$SKILL_DIR/README.md" "$SKILL_DIR/LICENSE" "$SKILL_DIR/CHANGELOG.md" "$SKILL_DIR/references/" 2>/dev/null | head -10 || true
  issues=$((issues + 1))
fi

# 2. Az.-Provenance — every entry should have a Source-URL
echo "2/5  Az.-Provenance-Check…"
az_count=$( (grep -cE "^### " "$SKILL_DIR/references/bgh-urteile.md" 2>/dev/null || echo 0) | head -1)
# Source-Verlinkung in beliebigem Markdown-Format: **Source**, "Source:", oder eingebetteter http(s)-Link.
src_count=$( (grep -cE "\*\*Source\*\*|Source:|https?://(juris|curia|dejure|openjur|rewis|edpb|gesetze-im-internet|eur-lex|bverwg|bag-urteil|nrwe|wettbewerbszentrale|noerr|twobirds|bird-bird|alro-recht)" "$SKILL_DIR/references/bgh-urteile.md" 2>/dev/null || echo 0) | head -1)
echo "     Az.-Eintraege: $az_count · Source-Verlinkungen: $src_count"
if [[ "$src_count" -lt "$az_count" ]]; then
  diff=$((az_count - src_count))
  echo "     ⚠ $diff Eintraege ohne Source-Verlinkung — Provenance-Disziplin §5 pruefen"
  issues=$((issues + 1))
else
  echo "     ✓ alle Eintraege haben Source-Verlinkung"
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

# 5. Templates ohne Brand-Leak — re-uses the BRAND_PATTERN configured above
# in section 1. Templates must not contain any operator-specific codename.
echo "5/5  Templates anonymisiert…"
template_brand_hits=$( (grep -rEnli "$BRAND_PATTERN" \
  "$SKILL_DIR/references/templates/" 2>/dev/null || true) | wc -l | tr -d ' ')
if [[ "$template_brand_hits" == "0" ]]; then
  echo "     ✓ alle Templates anonymisiert"
else
  echo "     ✗ Templates enthalten Brand-Refs (sollten anonym sein):"
  grep -rEni "$BRAND_PATTERN" \
    "$SKILL_DIR/references/templates/" 2>/dev/null | head -10 || true
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
