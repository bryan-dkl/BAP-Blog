#!/usr/bin/env node
// Creates a new blog post in src/content/blog/ by asking a few questions.
// Usage: npm run new-post
//
// Keep these lists in sync with src/data/taxonomy.ts
const PILLARS = ['development', 'ux', 'design'];
const TYPES = ['experiment', 'research', 'feedback', 'meeting', 'milestone', 'reflection'];

import { createInterface } from 'node:readline/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled';

const pickList = (answer, allowed) =>
  answer
    .split(/[\s,]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .map((v) => (/^\d+$/.test(v) ? allowed[Number(v) - 1] : v))
    .filter((v) => allowed.includes(v));

const numbered = (list) => list.map((v, i) => `${i + 1}) ${v}`).join('  ');

const title = (await rl.question('Title: ')).trim() || 'Untitled';
const today = new Date().toISOString().slice(0, 10);
const date = (await rl.question(`Date (${today}): `)).trim() || today;
const description = (await rl.question('Short description (optional): ')).trim();

let pillars = [];
while (pillars.length === 0) {
  pillars = pickList(await rl.question(`Pillars — ${numbered(PILLARS)}\n  (numbers or names, comma separated): `), PILLARS);
  if (pillars.length === 0) console.log('  Pick at least one pillar.');
}
const types = pickList(await rl.question(`Type — ${numbered(TYPES)}\n  (optional): `), TYPES);
const authors = (await rl.question('Authors (comma separated, optional): '))
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean);
rl.close();

const q = (s) => JSON.stringify(s);
const list = (items) => `[${items.map(q).join(', ')}]`;

const frontmatter = ['---', `title: ${q(title)}`, `date: ${date}`];
if (description) frontmatter.push(`description: ${q(description)}`);
frontmatter.push(`pillars: ${list(pillars)}`);
if (types.length) frontmatter.push(`types: ${list(types)}`);
if (authors.length) frontmatter.push(`authors: ${list(authors)}`);
frontmatter.push('draft: true', '---');

const body = ['', '## What we did', '', '## What we learned', '', '## Next steps', ''];

const dir = join(process.cwd(), 'src', 'content', 'blog');
mkdirSync(dir, { recursive: true });
let file = join(dir, `${date}-${slugify(title)}.md`);
for (let n = 2; existsSync(file); n++) file = join(dir, `${date}-${slugify(title)}-${n}.md`);

writeFileSync(file, [...frontmatter, ...body].join('\n'));
console.log(`\n✔ Created ${file.replace(process.cwd() + '/', '')}`);
console.log('  It starts as a draft (visible in `npm run dev` only). Remove `draft: true` to publish.');
