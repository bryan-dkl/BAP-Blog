// Blog editor — local file API, only active during `npm run dev`.
//
// On the live site the editor saves to GitHub (see src/lib/editor/backends.js).
// Locally it uses these endpoints instead, so saving writes straight into your project folder:
//   GET  /__blog-editor/list?dir=...   → file names in a folder
//   GET  /__blog-editor/file?path=...  → a file's contents
//   POST /__blog-editor/write          → write files (multipart: path + file pairs)
// Only these folders can be read or written: src/content/blog, src/assets/blog and public/media.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS_DIR, MEDIA_DIR, POSTS_DIR } from '../src/lib/editor/post-format.js';

const API = '__blog-editor';
const ALLOWED = [POSTS_DIR, ASSETS_DIR, MEDIA_DIR];
const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  avif: 'image/avif', svg: 'image/svg+xml', md: 'text/markdown; charset=utf-8', mdx: 'text/markdown; charset=utf-8',
};

export default function blogEditor() {
  // Lets us tell Astro to re-read the posts right after saving,
  // instead of relying on the file watcher (which can miss new files).
  let refreshContent;

  return {
    name: 'blog-editor',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig }) => {
        if (command !== 'dev') return;
        const handler = createHandler(fileURLToPath(config.root), () => refreshContent?.());
        updateConfig({
          vite: {
            plugins: [{ name: 'blog-editor-api', configureServer: (server) => void server.middlewares.use(handler) }],
          },
        });
      },
      'astro:server:setup': (options) => {
        refreshContent = options.refreshContent;
      },
    },
  };
}

export function createHandler(root, refresh = async () => {}) {
  /** Turns a project-relative path into an absolute one, refusing anything outside the allowed folders. */
  function resolve(path) {
    const normal = posix.normalize(String(path ?? '').replace(/\\/g, '/')).replace(/\/$/, '');
    const allowed = ALLOWED.some((dir) => normal === dir || normal.startsWith(`${dir}/`));
    if (!allowed || normal.split('/').includes('..')) throw httpError(400, `Not allowed: ${path}`);
    return join(root, normal);
  }

  return async function blogEditorApi(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const i = url.pathname.indexOf(`/${API}/`);
    if (i === -1) return next();
    const route = url.pathname.slice(i + API.length + 2);

    try {
      if (req.method === 'GET' && route === 'list') {
        const entries = await readdir(resolve(url.searchParams.get('dir')), { withFileTypes: true }).catch(() => []);
        return json(res, 200, entries.filter((e) => e.isFile()).map((e) => e.name));
      }

      if (req.method === 'GET' && route === 'file') {
        const path = resolve(url.searchParams.get('path'));
        const data = await readFile(path).catch(() => null);
        if (!data) return json(res, 404, { error: 'File not found' });
        const ext = path.split('.').pop().toLowerCase();
        res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' });
        return res.end(data);
      }

      if (req.method === 'POST' && route === 'write') {
        const form = await readFormData(req);
        const paths = form.getAll('path').map(String);
        const files = form.getAll('file');
        if (paths.length === 0 || paths.length !== files.length) throw httpError(400, 'Nothing to write');
        const targets = paths.map(resolve); // validate everything before writing anything
        for (const [n, target] of targets.entries()) {
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, Buffer.from(await files[n].arrayBuffer()));
        }
        await refresh(); // make Astro pick up the new / changed post right away
        return json(res, 200, { written: paths });
      }

      return json(res, 404, { error: 'Unknown editor route' });
    } catch (error) {
      if (!error.status) console.error('[blog-editor]', error);
      return json(res, error.status ?? 500, { error: error.message ?? 'Something went wrong' });
    }
  };
}

async function readFormData(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] ?? '' },
    body: Buffer.concat(chunks),
  }).formData();
}

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
