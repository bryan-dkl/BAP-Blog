// Blog editor API — only active during `npm run dev`.
//
// Adds a few endpoints to the local dev server that the editor page (src/pages/editor.astro) talks to.
// They write straight into the project:
//   - posts    → src/content/blog/<id>.md
//   - pictures → src/assets/blog/<id>/<file>   (optimised by Astro at build time)
//   - other files (video, pdf, ...) → public/media/<id>/<file>
//
// Nothing here ends up in the built / deployed site.

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = '__blog-editor';
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg', '.tiff'];
const KNOWN_KEYS = ['title', 'date', 'description', 'cover', 'coverAlt', 'pillars', 'types', 'authors', 'draft'];
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.tiff': 'image/tiff',
};

export default function blogEditor() {
  // Set in astro:server:setup — lets us tell Astro to re-read the posts right after saving,
  // instead of relying on the file watcher (which can miss new files, e.g. after a dev-server restart).
  let refreshContent;
  return {
    name: 'blog-editor',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig, logger }) => {
        if (command !== 'dev') return;
        const root = fileURLToPath(config.root);
        const base = config.base.endsWith('/') ? config.base : `${config.base}/`;
        const handler = createHandler({ root, base, refresh: () => refreshContent?.() });
        updateConfig({
          vite: {
            plugins: [{ name: 'blog-editor-api', configureServer: (server) => void server.middlewares.use(handler) }],
          },
        });
        logger.info(`Blog editor ready → ${base}editor/`);
      },
      'astro:server:setup': (options) => {
        refreshContent = options.refreshContent;
      },
    },
  };
}

function createHandler({ root, base, refresh }) {
  const POSTS_DIR = join(root, 'src', 'content', 'blog');
  const ASSETS_DIR = join(root, 'src', 'assets', 'blog');
  const MEDIA_DIR = join(root, 'public', 'media');

  return async function blogEditorApi(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const i = url.pathname.indexOf(`/${API}/`);
    if (i === -1) return next();
    const route = decodeURIComponent(url.pathname.slice(i + API.length + 2)).split('/').filter(Boolean);

    try {
      // GET posts → list of all posts
      if (req.method === 'GET' && route[0] === 'posts' && route.length === 1) {
        return json(res, 200, await listPosts());
      }
      // GET posts/<id> → one post (frontmatter + body) for editing
      if (req.method === 'GET' && route[0] === 'posts' && route.length === 2) {
        return json(res, 200, await readPost(route[1]));
      }
      // GET files/<id>/<name> → preview of an image that's already saved
      if (req.method === 'GET' && route[0] === 'files' && route.length === 3) {
        const file = join(ASSETS_DIR, safeId(route[1]), safeFileName(route[2]));
        const data = await readFile(file).catch(() => null);
        if (!data) return json(res, 404, { error: 'File not found' });
        res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
        return res.end(data);
      }
      // POST posts → create or update a post (multipart form with files)
      if (req.method === 'POST' && route[0] === 'posts' && route.length === 1) {
        return json(res, 200, await savePost(await readFormData(req)));
      }
      return json(res, 404, { error: 'Unknown editor route' });
    } catch (error) {
      console.error('[blog-editor]', error);
      return json(res, error.status ?? 500, { error: error.message ?? 'Something went wrong' });
    }
  };

  // ---------- posts ----------

  async function postFiles() {
    await mkdir(POSTS_DIR, { recursive: true });
    return (await readdir(POSTS_DIR)).filter((f) => /\.mdx?$/.test(f) && !f.startsWith('_'));
  }

  async function findPostFile(id) {
    const files = await postFiles();
    const file = files.find((f) => f.replace(/\.mdx?$/, '') === id);
    if (!file) throw httpError(404, `Post "${id}" not found`);
    return join(POSTS_DIR, file);
  }

  async function listPosts() {
    const posts = [];
    for (const file of await postFiles()) {
      const { data } = parseFrontmatter(await readFile(join(POSTS_DIR, file), 'utf8'));
      posts.push({ id: file.replace(/\.mdx?$/, ''), title: data.title ?? file, date: String(data.date ?? ''), draft: data.draft === true });
    }
    return posts.sort((a, b) => b.date.localeCompare(a.date));
  }

  async function readPost(id) {
    id = safeId(id);
    const { data, body } = parseFrontmatter(await readFile(await findPostFile(id), 'utf8'));
    const prefix = `../../assets/blog/${id}/`;
    const coverPreview =
      typeof data.cover === 'string' && data.cover.startsWith(prefix)
        ? `${base}${API}/files/${id}/${encodeURIComponent(data.cover.slice(prefix.length))}`
        : null;
    return { id, data, body, coverPreview };
  }

  async function savePost(form) {
    const field = (name) => String(form.get(name) ?? '').trim();
    const list = (name) => form.getAll(name).map(String).map((v) => v.trim()).filter(Boolean);

    const title = field('title');
    const date = field('date');
    const pillars = list('pillars');
    if (!title) throw httpError(400, 'A title is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, 'Date must look like 2026-11-01');
    if (pillars.length === 0) throw httpError(400, 'Pick at least one pillar');

    // New post → id from date + title. Existing post → keep its id (and URL).
    let id = field('id');
    let file;
    let existing = {};
    if (id) {
      id = safeId(id);
      file = await findPostFile(id);
      existing = parseFrontmatter(await readFile(file, 'utf8')).data;
    } else {
      const taken = new Set((await postFiles()).map((f) => f.replace(/\.mdx?$/, '')));
      const start = `${date}-${slugify(title)}`;
      id = start;
      for (let n = 2; taken.has(id); n++) id = `${start}-${n}`;
      file = join(POSTS_DIR, `${id}.md`);
    }

    // Uploaded files: the editor references them in the text as "upload:<name>".
    let body = String(form.get('body') ?? '').replace(/\r\n/g, '\n').trim();
    for (const upload of form.getAll('files')) {
      if (typeof upload === 'string' || upload.size === 0) continue;
      const ref = await storeFile(id, upload);
      body = body.split(`upload:${upload.name}`).join(ref);
    }
    const missing = body.match(/upload:[^\s)"']+/);
    if (missing) throw httpError(400, `"${missing[0]}" is used in the text but the file wasn't uploaded`);

    // Cover image: new upload > remove > keep existing.
    let cover = existing.cover;
    const coverFile = form.get('cover');
    if (coverFile && typeof coverFile !== 'string' && coverFile.size > 0) {
      if (!isImage(coverFile.name)) throw httpError(400, 'The cover must be an image (jpg, png, webp, gif, avif or svg)');
      cover = await storeFile(id, coverFile, 'cover-');
    } else if (field('removeCover') === 'true') {
      cover = undefined;
    }

    const authors = field('authors').split(',').map((a) => a.trim()).filter(Boolean);
    const data = {
      title,
      date,
      description: field('description') || undefined,
      cover,
      coverAlt: cover ? field('coverAlt') || undefined : undefined,
      pillars,
      types: list('types'),
      authors,
      draft: field('draft') === 'true',
    };

    // Keep any extra frontmatter keys someone added by hand.
    const extra = Object.fromEntries(Object.entries(existing).filter(([k]) => !KNOWN_KEYS.includes(k)));

    await writeFile(file, serialize(data, extra, body));
    // Make Astro pick up the new / changed post (and its pictures) right away.
    await refresh();
    return { id, url: `${base}blog/${id}/` };
  }

  async function storeFile(id, upload, prefix = '') {
    const image = isImage(upload.name);
    const dir = join(image ? ASSETS_DIR : MEDIA_DIR, id);
    await mkdir(dir, { recursive: true });
    const name = await uniqueName(dir, prefix + safeFileName(upload.name));
    await writeFile(join(dir, name), Buffer.from(await upload.arrayBuffer()));
    // Images: relative path so Astro can optimise them. Other files: served as-is from /public.
    return image ? `../../assets/blog/${id}/${name}` : `${base}media/${id}/${name}`;
  }
}

// ---------- helpers ----------

async function readFormData(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] ?? '' },
    body: Buffer.concat(chunks),
  });
  return request.formData();
}

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function isImage(name) {
  return IMAGE_EXT.includes(extname(name).toLowerCase());
}

function slugify(s) {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

function safeId(id) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw httpError(400, 'Invalid post id');
  return id;
}

function safeFileName(name) {
  const ext = extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${slugify(basename(name, extname(name)))}${ext}`;
}

async function uniqueName(dir, name) {
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let candidate = name;
  for (let n = 2; await exists(join(dir, candidate)); n++) candidate = `${stem}-${n}${ext}`;
  return candidate;
}

async function exists(path) {
  return access(path).then(() => true, () => false);
}

function serialize(data, extra, body) {
  const q = (v) => JSON.stringify(v); // JSON strings / arrays are valid YAML
  const lines = ['---', `title: ${q(data.title)}`, `date: ${data.date}`];
  if (data.description) lines.push(`description: ${q(data.description)}`);
  if (data.cover) lines.push(`cover: ${q(data.cover)}`);
  if (data.coverAlt) lines.push(`coverAlt: ${q(data.coverAlt)}`);
  lines.push(`pillars: ${q(data.pillars)}`);
  if (data.types.length) lines.push(`types: ${q(data.types)}`);
  if (data.authors.length) lines.push(`authors: ${q(data.authors)}`);
  if (data.draft) lines.push('draft: true');
  for (const [key, value] of Object.entries(extra)) lines.push(`${key}: ${q(value)}`);
  lines.push('---', '', body, '');
  return lines.join('\n');
}

// Small frontmatter reader — handles what the editor writes plus normal hand-written YAML
// (quoted/unquoted strings, true/false, [inline, lists], "- block" lists and # comments).
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: text };
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
    try { return JSON.parse(v); } catch { return v.slice(1, -1); }
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
    return value.slice(1, -1).split(',').map(scalar).filter((v) => v !== '');
  }
}
