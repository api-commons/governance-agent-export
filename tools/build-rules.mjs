#!/usr/bin/env node
// Snapshot the API Commons rule catalog into an agent-export-ready bundle: per
// format, each rule with the fields the exporters need — id, title, description,
// message, given, severity, tags, and the AI-remediation `prompt`. Run locally
// (`npm run data`); the committed public/rules.json means CI only runs `vite build`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CATALOG = join(REPO, '..', 'api-validator', 'rules', 'all-rules.yaml');
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

const catalog = parseYaml(readFileSync(CATALOG, 'utf8'));
const formats = {};
let total = 0, withPrompt = 0;
for (const [format, group] of Object.entries(catalog)) {
  if (!group || typeof group !== 'object') continue;
  const rules = [];
  for (const [id, r] of Object.entries(group)) {
    if (!r || typeof r !== 'object') continue;
    if (r.prompt) withPrompt++;
    rules.push({
      id,
      title: r.title || id,
      description: r.description || '',
      message: typeof r.message === 'string' ? r.message : '',
      given: arr(r.given).map(String).join(' | '),
      field: r.then && !Array.isArray(r.then) ? (r.then.field ?? '') : '',
      severity: r.severity || 'info',
      tags: arr(r.tags),
      prompt: r.prompt || '',
    });
    total++;
  }
  formats[format] = rules;
}
const bundle = {
  generatedAt: new Date().toISOString(),
  source: 'API Commons rule catalog (api-validator/rules/all-rules.yaml)',
  counts: Object.fromEntries(Object.entries(formats).map(([k, v]) => [k, v.length])),
  formats,
};
const OUT = join(REPO, 'public', 'rules.json');
writeFileSync(OUT, JSON.stringify(bundle));
console.log(`Wrote ${OUT}`);
console.log(`  ${total} rules across ${Object.keys(formats).length} formats; ${withPrompt} carry a remediation prompt`);
console.log(`  counts:`, bundle.counts);
