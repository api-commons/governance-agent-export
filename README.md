# Agent Rule Export

A browser-first tool that exports an API governance ruleset into **agent-native
artifacts** — so the agents now writing and editing APIs can follow the rules *while
authoring*, not just fail them after linting. No backend, no accounts; runs entirely in
your browser. Live at **[agents.apicommons.org](https://agents.apicommons.org)**.

A Spectral ruleset is built to be *executed*. But an AI agent generating an API needs the
same rules *before* it acts, as guidance it can read. This tool turns a ruleset into the
artifacts that do that.

## What it exports

| Artifact | What it is |
| --- | --- |
| **AGENTS.md governance block** | Imperative rules (MUST / SHOULD / MAY) for the emerging `AGENTS.md` / `agents.md` repo convention, grouped by section — a coding agent follows them while authoring. |
| **System-prompt instruction set** | A compact, token-efficient priming block to steer an LLM/agent, rules ordered by strength. |
| **Remediation prompt pack** | The catalog's per-rule AI-remediation `prompt` fields as a JSON map keyed by rule id — an agent looks up the exact fix for a violation. |
| **Compact rule digest** | A machine-readable checklist (`id`, requirement, `where`, severity, tags) stripped of Spectral execution detail, for an agent to self-check against. |

Severity maps to strength for the prose artifacts: `error` → **MUST**, `warn`/`info` →
**SHOULD** (an agent should follow them while authoring), `hint` → **MAY**.

## Use it

Pick a **format** (OpenAPI, AsyncAPI, Arazzo, …) and optionally filter by consumer
**experience** or a search term, then copy or download any of the four artifacts. Or switch
the source to **Paste your own** and drop in a Spectral ruleset (`rules:` map) to export
*your* governance.

It pairs with the [Validator](https://validator.apicommons.org) (which enforces the rules)
and the [Governance MCP](https://github.com/api-commons/api-governance-mcp) (which lets an
agent lint on demand): export the guidance here so the agent writes it right the first time,
enforce with the others.

## Develop

```bash
npm install
npm run data      # rebuild public/rules.json from ../api-validator/rules/all-rules.yaml
npm run dev
npm run build     # → dist/
```

`npm run data` snapshots the catalog (id, title, description, message, given, severity,
tags, and the remediation `prompt`) into the committed
[`public/rules.json`](./public/rules.json), so CI only runs `vite build`.

## Privacy

Everything runs client-side. Any ruleset you paste never leaves the page — there is no
server.

## Part of API Commons

An open, browser-first tool from **[API Commons](https://apicommons.org)** — free, no backend, your data stays in your browser. Browse the full set at **[apicommons.org/tools](https://apicommons.org/tools/)**.

**Related tools**
- [API Governance MCP](https://github.com/api-commons/api-governance-mcp) — a Spectral MCP server for AI clients
- [Toolsmith](https://toolsmith.apicommons.org) — forge MCP tools + Agent Skills from OpenAPI
- [Context Gate](https://contextgate.apicommons.org) — consumer-centric governance for agent context
- [Spectral Ruleset Studio](https://studio.apicommons.org) — turn a style guide into an owned ruleset
- [API Validator](https://validator.apicommons.org) — lint OpenAPI/AsyncAPI/Arazzo/JSON Schema in your browser
- [Governance Coverage](https://coverage.apicommons.org) — how much of your API your rules actually check

---

**Governance guidance** — the human *why*:
[Guidance](https://guidance.apievangelist.com/store/guidance/) and
[Rules](https://guidance.apievangelist.com/store/rules/) at guidance.apievangelist.com.

A project of [API Evangelist](https://apievangelist.com), maintained openly under
[API Commons](https://apicommons.org). Free to fork; API Evangelist offers expert API
governance services when you want help. Apache-2.0.
