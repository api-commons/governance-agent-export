// Turn a ruleset into agent-native artifacts. Governance rules are written to be
// executed by Spectral (reactive); these renderers turn them into guidance an agent
// follows while authoring (proactive): an AGENTS.md block, a system-prompt set, a
// per-rule remediation prompt pack, and a compact digest. Pure string generation.

export interface Rule {
  id: string; title: string; description: string; message: string;
  given: string; field: string; severity: string; tags: string[]; prompt: string;
}

export type Modal = 'MUST' | 'SHOULD' | 'MAY';
export function modalOf(severity: string): Modal {
  if (severity === 'error') return 'MUST';
  if (severity === 'hint') return 'MAY';
  return 'SHOULD'; // warn + info — an agent should follow them while authoring
}

// The best human-readable requirement for a rule: prefer the longer, non-templated
// of description/message; fall back to the title.
export function requirement(r: Rule): string {
  const cands = [r.description, r.message].map((s) => String(s || '').trim()).filter((s) => s && !s.includes('{{') && s.length > 3);
  let base = cands.sort((a, b) => b.length - a.length)[0] || r.title || r.id;
  // These are concise directives, not docs — drop embedded code/examples and cap length.
  base = base.replace(/```[\s\S]*$/, '').replace(/`[^`]*`/g, (m) => m).replace(/\s+/g, ' ').replace(/\.+$/, '').trim();
  if (base.length > 160) {
    const first = base.split(/\.\s+/)[0].trim();
    base = first.length >= 20 && first.length <= 200 ? first : base.slice(0, 180).trim() + '…';
  }
  return base;
}

const tagValue = (tags: string[], ns: string) => tags.find((t) => t.startsWith(ns + ':'))?.slice(ns.length + 1);
const titleCase = (s: string) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function sectionOf(r: Rule): string {
  const spec = tagValue(r.tags, 'spec');
  if (spec) return titleCase(spec);
  const exp = tagValue(r.tags, 'experience');
  if (exp) return titleCase(exp);
  return 'General';
}

function groupBySection(rules: Rule[]): [string, Rule[]][] {
  const m = new Map<string, Rule[]>();
  for (const r of rules) { const s = sectionOf(r); (m.get(s) ?? m.set(s, []).get(s)!).push(r); }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}

const MODAL_ORDER: Modal[] = ['MUST', 'SHOULD', 'MAY'];

// ---- 1. AGENTS.md governance block -----------------------------------------
export function toAgentsMd(rules: Rule[], format: string, rulesetName: string): string {
  const groups = groupBySection(rules);
  const lines: string[] = [
    `## API governance — ${format}`,
    '',
    `When authoring or editing ${format} in this repository, follow these rules. They are generated from the **${rulesetName}** ruleset (${rules.length} rules) and expressed by strength: **MUST** (required), **SHOULD** (expected), **MAY** (preferred).`,
    '',
  ];
  for (const [section, rs] of groups) {
    lines.push(`### ${section}`);
    for (const r of rs.slice().sort((a, b) => MODAL_ORDER.indexOf(modalOf(a.severity)) - MODAL_ORDER.indexOf(modalOf(b.severity)))) {
      lines.push(`- **${modalOf(r.severity)}** ${requirement(r)}. _(\`${r.id}\`)_`);
    }
    lines.push('');
  }
  lines.push('> If you must deviate from a MUST/SHOULD rule, say so explicitly and why — do not silently violate it.');
  return lines.join('\n');
}

// ---- 2. system-prompt instruction set --------------------------------------
export function toSystemPrompt(rules: Rule[], format: string, rulesetName: string): string {
  const byModal = new Map<Modal, Rule[]>([['MUST', []], ['SHOULD', []], ['MAY', []]]);
  for (const r of rules) byModal.get(modalOf(r.severity))!.push(r);
  const out: string[] = [`You author ${format} documents to the ${rulesetName} governance standard. Hold to the following, strongest first.`, ''];
  for (const m of MODAL_ORDER) {
    const rs = byModal.get(m)!;
    if (!rs.length) continue;
    out.push(`${m} (${rs.length}):`);
    for (const r of rs) out.push(`- ${requirement(r)}`);
    out.push('');
  }
  out.push('If a requirement cannot be met, state which one and why rather than ignoring it.');
  return out.join('\n');
}

// ---- 3. remediation prompt pack --------------------------------------------
export function toRemediationPack(rules: Rule[]): { json: string; count: number } {
  const pack: Record<string, string> = {};
  for (const r of rules) if (r.prompt) pack[r.id] = r.prompt;
  return { json: JSON.stringify(pack, null, 2), count: Object.keys(pack).length };
}

// ---- 4. compact rule digest ------------------------------------------------
export function toDigest(rules: Rule[]): string {
  const digest = rules.map((r) => ({
    id: r.id,
    must: requirement(r) + (r.field ? ` (field: ${r.field})` : ''),
    where: r.given,
    sev: r.severity,
    tags: r.tags.filter((t) => t.startsWith('experience:') || t.startsWith('owasp:')),
  }));
  return JSON.stringify(digest, null, 2);
}

// ---- filtering --------------------------------------------------------------
export function filterRules(rules: Rule[], opts: { experience?: string; query?: string }): Rule[] {
  let out = rules;
  if (opts.experience) out = out.filter((r) => r.tags.includes(`experience:${opts.experience}`));
  if (opts.query) { const q = opts.query.toLowerCase(); out = out.filter((r) => (r.id + ' ' + r.title + ' ' + r.description + ' ' + r.message).toLowerCase().includes(q)); }
  return out;
}

export function experiencesOf(rules: Rule[]): string[] {
  const set = new Set<string>();
  for (const r of rules) for (const t of r.tags) if (t.startsWith('experience:')) set.add(t.slice(11));
  return [...set].sort();
}

// Parse a pasted Spectral ruleset into Rule[] (best-effort; no prompts unless present).
export function rulesFromSpectral(doc: any): Rule[] {
  const map = doc?.rules || {};
  const out: Rule[] = [];
  for (const [id, r] of Object.entries<any>(map)) {
    if (!r || typeof r !== 'object' || r === true) continue;
    const then = r.then && !Array.isArray(r.then) ? r.then : {};
    out.push({
      id, title: id, description: String(r.description || ''), message: typeof r.message === 'string' ? r.message : '',
      given: (Array.isArray(r.given) ? r.given : [r.given]).filter(Boolean).map(String).join(' | '),
      field: then.field || '', severity: String(r.severity || 'warn'),
      tags: Array.isArray(r.tags) ? r.tags : [], prompt: String(r.prompt || ''),
    });
  }
  return out;
}
