# MITRE-Mapped Skills — `mitre-mapped/`

Skills that cross-walk AEGIS scanner findings to MITRE ATT&CK Enterprise,
ATLAS (AI/ML threats), D3FEND (defensive countermeasures), NIST CSF 2.0,
and NIST AI RMF. Use these to translate AEGIS reports into the MITRE
language your SIEM / EDR / IR tooling already speaks.

## Sources

| Source dir | License | Skills |
|---|---|---|
| `aegis-native/` | MIT (AEGIS-original) | 3 |

## AEGIS-native skills

| Skill | Coverage |
|---|---|
| `mapping-overview` | Top-level cross-walk: per-CWE → ATT&CK technique, plus tactic-level coverage summary. ATLAS overlay for AI/LLM threats. D3FEND defensive-countermeasure mapping. NIST CSF 2.0 + NIST AI RMF function-level alignment. |
| `t1190-exploit-public-app` | Deep-dive on T1190 (Exploit Public-Facing Application) coverage — SQLi, XSS, SSRF, RCE, command-injection, file-upload, auth-bypass. |
| `t1078-valid-accounts` | Deep-dive on T1078 (Valid Accounts) coverage — credential leakage detection, JWT-format detection, cloud-credential protection, T1078.001-004 sub-technique map. |

License: MIT. See top-level [`ATTRIBUTION.md`](../../ATTRIBUTION.md) for
attribution chain.

## Roadmap

Future expansions:

- Per-tactic deep-dive skills for high-coverage tactics (Credential Access TA0006, Exfiltration TA0010, Privilege Escalation TA0004).
- ATLAS-specific deep-dive on AML.T0051 (Direct + Indirect Prompt Injection).
- D3FEND countermeasure-recommendation skill that turns AEGIS findings into specific D3FEND-technique recommendations.

## See also

- AEGIS scanner inventory in the top-level `README.md` — authoritative per-scanner CWE list.
- MITRE ATT&CK — https://attack.mitre.org/
- MITRE ATLAS — https://atlas.mitre.org/
- MITRE D3FEND — https://d3fend.mitre.org/
