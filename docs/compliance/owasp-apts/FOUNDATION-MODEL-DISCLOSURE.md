# Foundation Model Disclosure (APTS-TP-021)

> Section structure derived from OWASP/APTS Conformance_Claim_Template
> § Foundation Model Disclosure (CC BY-SA 4.0). See [`attribution.md`](./attribution.md).

## AEGIS Bring-Your-Own-Model (BYOM) posture

The AEGIS Autonomous Pentest Layer **does not pin a foundation model**.
Each integrated wrapper supports operator-chosen providers via its own
configuration surface. This disclosure documents the provider/model
matrix supported by each wrapper as of the claim date.

The operator is responsible for:

1. Declaring which model is in use at runtime for each engagement
2. Recording the exact model version (not "latest") used
3. Referencing the provider's capability baseline (model card link + retrieval date)
4. Documenting any fine-tunes or adapters applied
5. Maintaining re-attestation records when the model family or version changes (APTS-TP-022)

AEGIS provides the matrix; the operator provides the per-engagement
attestation against their actual deployment.

---

## Wrapper: Strix (`packages/scanners/src/dast/strix.ts`)

| Field | Value |
|-------|-------|
| Provider | Operator-chosen via LiteLLM proxy |
| Supported families | OpenAI GPT-* · Anthropic Claude * · Google Gemini * |
| Default model | None pinned by AEGIS |
| Configuration surface | `STRIX_LLM` env (model identifier) + `LLM_API_KEY` env (auth) |
| Fallback environment vars | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (for `isAvailable()` check) |
| Capability Baseline Reference | Provider's official model card at the configured version |
| Re-attestation cadence | Operator owns; AEGIS recommends per-major-AEGIS-release or per-model-version-change |

Source detail (verified at HEAD):

```
packages/scanners/src/dast/strix.ts:17  // doc: API key: STRIX_LLM + LLM_API_KEY env vars (OpenAI/Anthropic/Google).
packages/scanners/src/dast/strix.ts:67  // isAvailable check on env vars
```

---

## Wrapper: PTAI (`packages/scanners/src/dast/ptai.ts`)

| Field | Value |
|-------|-------|
| Provider | Operator-chosen — Anthropic / OpenAI / local Ollama |
| Supported families | Anthropic Claude * · OpenAI GPT-* · Ollama-hosted local models |
| Default model | None pinned by AEGIS |
| Configuration surface | `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `OLLAMA_HOST` |
| Capability Baseline Reference | Provider's official model card at the configured version (Anthropic / OpenAI) or Ollama model card |
| Re-attestation cadence | Operator owns; AEGIS recommends per-major-AEGIS-release |

Source detail (verified at HEAD):

```
packages/scanners/src/dast/ptai.ts:21       // doc: API key: ANTHROPIC_API_KEY / OPENAI_API_KEY / Ollama-local.
packages/scanners/src/dast/ptai.ts:79-81    // isAvailable check on env vars
```

---

## Wrapper: Pentest-Swarm-AI (`packages/scanners/src/dast/pentestswarm.ts`)

| Field | Value |
|-------|-------|
| Provider | Operator-chosen — Anthropic Claude (default) or local Ollama |
| Supported families | Anthropic Claude * · Ollama-hosted local models |
| Default orchestrator model | Anthropic Claude (per upstream Pentest-Swarm-AI default) |
| Configuration surface | `PENTESTSWARM_ORCHESTRATOR_API_KEY` (preferred) or `ANTHROPIC_API_KEY` · `OLLAMA_HOST` |
| Capability Baseline Reference | Provider's official model card at the configured version |
| Re-attestation cadence | Operator owns; AEGIS recommends per-major-AEGIS-release |

Source detail (verified at HEAD):

```
packages/scanners/src/dast/pentestswarm.ts:23     // doc: API key: PENTESTSWARM_ORCHESTRATOR_API_KEY (Anthropic Claude default, Ollama option).
packages/scanners/src/dast/pentestswarm.ts:85-87  // isAvailable check on env vars
```

---

## Companion mode: `aegis fix` (`packages/cli/src/commands/fix.ts`)

`aegis fix` is **not part of the autonomous-pentest-layer scope** under
this conformance claim, but it consumes LLMs and is therefore listed
here for transparency. Operators using `aegis fix` should follow the
same per-engagement attestation discipline.

| Field | Value |
|-------|-------|
| Provider | Operator-chosen — `claude` · `openai` · `ollama` · `templates` (no-LLM) |
| Supported families | Anthropic Claude * · OpenAI GPT-* · Ollama-hosted local models · static templates |
| Default model per provider | `claude-sonnet-4-20250514` · `gpt-4o` · `llama3` · n/a (templates) |
| Configuration surface | `--provider <claude|openai|ollama|templates>` flag · `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `OLLAMA_BASE_URL` |
| Fallback behaviour | Falls back to static templates if API key missing or request fails |
| Capability Baseline Reference | Provider model card at the configured version |
| Re-attestation cadence | Operator owns |

Source detail (verified at HEAD):

```
packages/cli/src/commands/fix.ts:120      // claude provider branch
packages/cli/src/commands/fix.ts:137      // default model: claude-sonnet-4-20250514
packages/cli/src/commands/fix.ts:168      // openai provider branch
packages/cli/src/commands/fix.ts:184      // default model: gpt-4o
packages/cli/src/commands/fix.ts:214      // ollama provider branch
packages/cli/src/commands/fix.ts:223      // default model: llama3
packages/cli/src/commands/fix.ts:257      // template fallback (no LLM)
```

---

## Operator obligations (per engagement)

For each engagement claiming APTS-TP-021 conformance, the operator must:

1. Record the exact model version (not "latest") used for that engagement
2. Reference the provider's capability baseline (model card link + retrieval date)
3. Document any fine-tunes or adapters applied
4. Maintain re-attestation records when the model family or version changes
5. Record any fallback events (e.g., API failure → template fallback in `aegis fix`) and the resulting assurance impact

AEGIS does not provide a per-engagement attestation template in this
release. Phase-2 deliverables include such a template under
`docs/compliance/owasp-apts/templates/`.

## Substitution disclosure

If the platform supports model substitution mid-engagement (e.g., via
LiteLLM provider switching in Strix), the operator MUST disclose each
approved model in their per-engagement record and identify which
phases of the engagement used which model. AEGIS does not enforce
substitution recording today; this is an operator-side discipline gap
that Phase-2 closes via structured engagement-log integration.

## Re-attestation triggers

- AEGIS major-version bump
- Wrapper-version bump (Strix / PTAI / Pentest-Swarm-AI upstream releases)
- Operator-side model-family or model-version change
- Provider's model card material update (e.g., a new safety advisory
  on the configured model)
