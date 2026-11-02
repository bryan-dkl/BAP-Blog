// Shared helpers for the blog editor: file names, paths and reading/writing post frontmatter.
// Used in the browser (editor page) and in Node (dev-server API).

export const POSTS_DIR = 'src/content/blog';
export const ASSETS_DIR = 'src/assets/blog'; // pictures → optimised by Astro
export const MEDIA_DIR = 'public/media'; // videos, pdfs, ... → served as-is

export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'];
const KNOWN_KEYS = ['title', 'date', 'description', 'cover', 'coverAlt', 'pillars', 'types', 'authors', 'draft'];

export function extension(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

export function isImage(name) {
  return IMAGE_EXT.includes(extension(name));
}

export function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

/** "My Photo (1).JPG" → "my-photo-1.jpg" */
export function safeFileName(name) {
  const ext = extension(name).replace(/[^a-z0-9]/g, '');
  const stem = ext ? name.slice(0, name.length - ext.length - 1) : name;
  return ext ? `${slugify(stem)}.${ext}` : slugify(stem);
}

/** Adds -2, -3, ... until the name isn't in `taken`. */
export function uniqueName(name, taken) {
  const ext = extension(name);
  const stem = ext ? name.slice(0, name.length - ext.length - 1) : name;
  let candidate = name;
  for (let n = 2; taken.has(candidate); n++) candidate = ext ? `${stem}-${n}.${ext}` : `${stem}-${n}`;
  return candidate;
}

export const postIdFromFile = (file) => file.replace(/\.mdx?$/, '');
export const isPostFile = (file) => /\.mdx?$/.test(file) && !file.startsWith('_');

// ---------- frontmatter ----------

/**
 * Small frontmatter reader — handles what the editor writes plus normal hand-written YAML
 * (quoted/unquoted strings, true/false, [inline, lists], "- block" lists and # comments).
 */
export function parseFrontmatter(text) {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: String(text) };
  const data = {};
  let listKey = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && listKey) {
      data[listKey].push(scalar(item[1]));
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, value] = pair;
    if (value.trim() === '') {
      data[key] = [];
      listKey = key;
    } else {
      listKey = null;
      data[key] = value.trim().startsWith('[') ? inlineList(value.trim()) : scalar(value);
    }
  }
  return { data, body: match[2].replace(/^\n/, '') };
}

/** Turns post data + body back into a Markdown file. Unknown keys in `existing` are kept. */
export function serializePost(data, body, existing = {}) {
  const q = (v) => JSON.stringify(v); // JSON strings / arrays are valid YAML
  const lines = ['---', `title: ${q(data.title)}`, `date: ${data.date}`];
  if (data.description) lines.push(`description: ${q(data.description)}`);
  if (data.cover) lines.push(`cover: ${q(data.cover)}`);
  if (data.cover && data.coverAlt) lines.push(`coverAlt: ${q(data.coverAlt)}`);
  lines.push(`pillars: ${q(data.pillars)}`);
  if (data.types?.length) lines.push(`types: ${q(data.types)}`);
  if (data.authors?.length) lines.push(`authors: ${q(data.authors)}`);
  if (data.draft) lines.push('draft: true');
  for (const [key, value] of Object.entries(existing)) {
    if (!KNOWN_KEYS.includes(key)) lines.push(`${key}: ${q(value)}`);
  }
  lines.push('---', '', String(body).trim(), '');
  return lines.join('\n');
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function scalar(value) {
  const v = value.trim();
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function inlineList(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value
      .slice(1, -1)
      .split(',')
      .map(scalar)
      .filter((v) => v !== '');
  }
}
