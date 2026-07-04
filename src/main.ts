import './style.css';
import { parse as parseYaml } from 'yaml';
import { toAgentsMd, toSystemPrompt, toRemediationPack, toDigest, filterRules, experiencesOf, rulesFromSpectral, type Rule } from './export';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const val = (s: string) => ($(s) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

const FMT_LABEL: Record<string, string> = { openapi: 'OpenAPI', asyncapi: 'AsyncAPI', arazzo: 'Arazzo', jsonschema: 'JSON Schema', 'apis-json': 'APIs.json', mcp: 'MCP', plans: 'Plans', 'rate-limits': 'Rate Limits', finops: 'FinOps', 'json-structure': 'JSON Structure', 'json-ld': 'JSON-LD', 'agent-skill': 'Agent Skill' };
const TARGETS = {
  agents: { title: 'AGENTS.md governance block', file: 'AGENTS.md', desc: 'Imperative rules for an AGENTS.md / agents.md file — followed while authoring.' },
  system: { title: 'System-prompt instruction set', file: 'governance-system-prompt.txt', desc: 'A compact priming block to steer an LLM/agent.' },
  remediation: { title: 'Remediation prompt pack', file: 'remediation-prompts.json', desc: 'Per-rule fix prompts, keyed by rule id — an agent looks up the fix for a violation.' },
  digest: { title: 'Compact rule digest', file: 'rule-digest.json', desc: 'Token-efficient machine-readable digest for an agent to self-check against.' },
};

let bundle: any;
let source: 'catalog' | 'custom' = 'catalog';
let target: keyof typeof TARGETS = 'agents';
let current = '';

init();
async function init() {
  wire();
  try {
    bundle = await fetch(`${import.meta.env.BASE_URL}rules.json`).then((r) => r.json());
    $('#f-format').innerHTML = Object.keys(bundle.formats).map((f) => `<option value="${f}">${FMT_LABEL[f] || f} (${bundle.counts[f]})</option>`).join('');
    refreshExperiences();
    render();
  } catch (e) { $('#output').textContent = `Couldn't load the rule catalog. ${(e as Error).message}`; }
}

function wire() {
  document.querySelectorAll<HTMLButtonElement>('#src-seg button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#src-seg button').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active'); source = b.dataset.src as typeof source;
    ($('#drawer') as HTMLDetailsElement).hidden = source !== 'custom';
    if (source === 'custom') ($('#drawer') as HTMLDetailsElement).open = true;
    $('#f-format').parentElement!.style.opacity = source === 'custom' ? '.4' : '1';
    refreshExperiences(); render();
  }));
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('is-active'));
    t.classList.add('is-active'); target = t.dataset.target as typeof target; render();
  }));
  ['#f-format', '#f-exp', '#f-query'].forEach((s) => $(s).addEventListener('input', () => { if (s === '#f-format') refreshExperiences(); render(); }));
  $('#ruleset-text').addEventListener('input', () => { refreshExperiences(); render(); });
  $('#copy-out').addEventListener('click', () => navigator.clipboard?.writeText(current));
  $('#dl-out').addEventListener('click', () => download(TARGETS[target].file, current));
  $('#engage-ae').addEventListener('click', () => { location.href = 'mailto:info@apievangelist.com?subject=' + encodeURIComponent('API governance — agent-native rules'); });
  $('#nav-about').addEventListener('click', (e) => { e.preventDefault(); about(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('about-modal')?.remove(); });
}

function baseRules(): Rule[] {
  if (source === 'custom') {
    const t = val('#ruleset-text').trim(); if (!t) return [];
    try { return rulesFromSpectral(JSON.parse(t)); } catch { try { return rulesFromSpectral(parseYaml(t)); } catch { return []; } }
  }
  return bundle?.formats?.[val('#f-format')] ?? [];
}

function refreshExperiences() {
  const exps = experiencesOf(baseRules());
  const cur = val('#f-exp');
  $('#f-exp').innerHTML = '<option value="">all</option>' + exps.map((e) => `<option value="${e}"${e === cur ? ' selected' : ''}>${e}</option>`).join('');
}

function render() {
  if (!bundle) return;
  const rules = filterRules(baseRules(), { experience: val('#f-exp') || undefined, query: val('#f-query').trim() || undefined });
  const fmtLabel = source === 'custom' ? 'your API' : (FMT_LABEL[val('#f-format')] || val('#f-format'));
  const rsName = source === 'custom' ? 'your' : 'API Commons';
  const meta = TARGETS[target];
  $('#out-title').textContent = meta.title;
  $('#out-desc').textContent = meta.desc;
  $('#out-file').textContent = meta.file;

  if (!rules.length) { current = ''; $('#output').textContent = source === 'custom' ? 'Paste a Spectral ruleset with a `rules:` map to export it.' : 'No rules match this filter.'; $('#status').innerHTML = '<b>0</b> rules'; return; }

  if (target === 'agents') current = toAgentsMd(rules, fmtLabel, rsName);
  else if (target === 'system') current = toSystemPrompt(rules, fmtLabel, rsName);
  else if (target === 'remediation') { const p = toRemediationPack(rules); current = p.json; }
  else current = toDigest(rules);

  const prompts = rules.filter((r) => r.prompt).length;
  $('#status').innerHTML = `<b>${rules.length}</b> rules${target === 'remediation' ? ` · <b>${prompts}</b> with prompts` : ''}`;
  $('#output').textContent = current;
  if (target === 'remediation' && !prompts) $('#output').textContent = 'None of these rules carry a remediation prompt (custom rulesets rarely do). The catalog rules do.';
}

function download(name: string, content: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function about() {
  const el = document.createElement('div'); el.id = 'about-modal';
  el.innerHTML = `<div class="about-backdrop"></div><div class="about-card">
    <button class="detail-close" id="about-close">&times;</button>
    <h2>Governance the agent reads before it writes</h2>
    <p>A Spectral ruleset is built to be <em>executed</em> — it catches problems after an API is written. But the agents now writing and editing APIs need the same rules <em>before</em> they act, as guidance they can follow. This tool turns a ruleset into the artifacts that do that.</p>
    <p><strong>AGENTS.md block</strong> — imperative rules (MUST / SHOULD / MAY) for the emerging <code>AGENTS.md</code> repo convention, grouped by section. <strong>System prompt</strong> — a compact priming block to steer an LLM. <strong>Remediation pack</strong> — the catalog's per-rule fix prompts, so an agent can look up how to resolve a specific violation. <strong>Rule digest</strong> — a token-efficient machine-readable checklist.</p>
    <p>Filter by format and consumer experience, or paste your own ruleset. It pairs with the <a href="https://validator.apicommons.org" target="_blank" rel="noopener">Validator</a> (which enforces) and the <a href="https://github.com/api-commons/api-governance-mcp" target="_blank" rel="noopener">Governance MCP</a> (which lets an agent lint on demand).</p>
    <p class="muted small">Runs entirely in your browser. Nothing you paste leaves the page.</p>
  </div>`;
  document.body.appendChild(el);
  el.querySelector('#about-close')!.addEventListener('click', () => el.remove());
  el.querySelector('.about-backdrop')!.addEventListener('click', () => el.remove());
}
