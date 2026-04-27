# Attribution and License

## Upstream attribution: OWASP/APTS

Portions of this subtree (the conformance-claim template structure,
the machine-readable claim schema, the evidence-package manifest
layout, and the foundation-model disclosure section) are derived from
the **OWASP Autonomous Penetration Testing Standard v0.1.0**, which
is licensed under **Creative Commons Attribution-ShareAlike 4.0
International (CC BY-SA 4.0)**.

- Upstream repository: https://github.com/OWASP/APTS
- License: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/
- Standard version: v0.1.0
- Date pulled: 2026-04-27

## What is derived

| Derived file | Upstream source |
|---|---|
| `CONFORMANCE-CLAIM.md` | `standard/appendix/Conformance_Claim_Template.md` |
| `conformance.json` (structure) | `standard/appendix/Conformance_Claim_Schema.md` + `standard/apts_requirements_schema.json` |
| `EVIDENCE-MANIFEST.md` (structure) | `standard/appendix/Evidence_Package_Manifest.md` |
| `FOUNDATION-MODEL-DISCLOSURE.md` (section 2 layout) | `standard/appendix/Conformance_Claim_Template.md` § Foundation Model Disclosure |

## Share-Alike obligation

CC BY-SA 4.0 requires that derivative works are licensed under the
same terms. The above-listed files are therefore licensed under
**CC BY-SA 4.0** — anyone may re-use, modify, and distribute them
under the same license, with attribution preserved.

## AEGIS-original content

All other files in this subtree (notably `README.md`, `gap-summary.md`,
the AEGIS-specific evidence claims, and any AEGIS-side opinion or
narrative) are **AEGIS-original** and are licensed under the
[AEGIS top-level MIT license](../../../LICENSE).

The repository as a whole remains MIT-licensed; this subtree's
APTS-derived files carry CC BY-SA 4.0 as required by the upstream
share-alike clause. The two licenses do not conflict because the
CC BY-SA-licensed files are clearly identified above.
