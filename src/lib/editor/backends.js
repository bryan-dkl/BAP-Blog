// Where the editor reads and saves files.
//
// - githubBackend: used on the live site (GitHub Pages). Reads from and commits to the GitHub repo
//   with the visitor's own GitHub token. Every save is one commit on the main branch, which
//   triggers the "Deploy to GitHub Pages" workflow.
// - localBackend: used during `npm run dev`. Writes straight into the project folder
//   through the dev-server API in integrations/blog-editor.mjs.
//
// Both have the same methods:
//   list(dir)            → file names in a folder ([] if it doesn't exist)
//   readText(path)       → file contents as text
//   readBlob(path)       → file contents as Blob (for image previews)
//   save(files, message) → write [{ path, content: string | Blob }] in one go

export class EditorError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ---------- local (npm run dev) ----------

export function localBackend(base) {
  const api = `${base}__blog-editor/`;

  async function request(url, init) {
    const res = await fetch(url, { cache: 'no-store', ...init });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new EditorError(body.error ?? `Request failed (${res.status})`, res.status);
    }
    return res;
  }

  return {
    kind: 'local',
    async list(dir) {
      return (await request(`${api}list?dir=${encodeURIComponent(dir)}`)).json();
    },
    async readText(path) {
      return (await request(`${api}file?path=${encodeURIComponent(path)}`)).text();
    },
    async readBlob(path) {
      return (await request(`${api}file?path=${encodeURIComponent(path)}`)).blob();
    },
    async save(files) {
      const form = new FormData();
      for (const { path, content } of files) {
        form.append('path', path);
        form.append('file', content instanceof Blob ? content : new Blob([content], { type: 'text/markdown' }), path);
      }
      await request(`${api}write`, { method: 'POST', body: form });
      return {};
    },
  };
}

// ---------- GitHub (live site) ----------

export function githubBackend({ owner, repo, branch, token }) {
  const repoPath = `/repos/${owner}/${repo}`;

  async function gh(path, { raw = false, ...init } = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      cache: 'no-store',
      ...init,
      headers: {
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new EditorError(explain(res.status, body.message), res.status);
    }
    return res;
  }

  function explain(status, message = '') {
    if (status === 401) return 'Your GitHub token is invalid or expired. Disconnect and connect again with a new token.';
    if (status === 403 && /rate limit/i.test(message)) return 'GitHub rate limit reached — wait a few minutes and try again.';
    if (status === 403 || status === 404)
      return `This token can't write to ${owner}/${repo}. Check that it has "Contents: Read and write" access to that repository (or the public_repo scope).`;
    if (status === 409 || status === 422) return 'Someone else pushed at the same moment — just click save again.';
    return `GitHub error ${status}${message ? `: ${message}` : ''}`;
  }

  const contentsUrl = (path) => `${repoPath}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;

  async function createBlob(content) {
    const bytes = content instanceof Blob ? new Uint8Array(await content.arrayBuffer()) : new TextEncoder().encode(content);
    const res = await gh(`${repoPath}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: toBase64(bytes), encoding: 'base64' }),
    });
    return (await res.json()).sha;
  }

  return {
    kind: 'github',

    /** Checks the token and returns the GitHub user name. */
    async verify() {
      const user = await (await gh('/user')).json();
      const info = await (await gh(repoPath)).json();
      if (!info.permissions?.push) throw new EditorError(explain(403), 403);
      return user.login;
    },

    async list(dir) {
      try {
        const items = await (await gh(contentsUrl(dir))).json();
        return Array.isArray(items) ? items.filter((i) => i.type === 'file').map((i) => i.name) : [];
      } catch (error) {
        if (error.status === 404) return [];
        throw error;
      }
    },

    async readText(path) {
      return (await gh(contentsUrl(path), { raw: true })).text();
    },

    async readBlob(path) {
      return (await gh(contentsUrl(path), { raw: true })).blob();
    },

    /** Puts all files in one commit on the branch (Git Data API). */
    async save(files, message) {
      const ref = await (await gh(`${repoPath}/git/ref/heads/${branch}`)).json();
      const parent = await (await gh(`${repoPath}/git/commits/${ref.object.sha}`)).json();

      const tree = [];
      for (const { path, content } of files) {
        tree.push({ path, mode: '100644', type: 'blob', sha: await createBlob(content) });
      }
      const newTree = await (
        await gh(`${repoPath}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree }) })
      ).json();
      const commit = await (
        await gh(`${repoPath}/git/commits`, {
          method: 'POST',
          body: JSON.stringify({ message, tree: newTree.sha, parents: [parent.sha] }),
        })
      ).json();
      await gh(`${repoPath}/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });

      return { commitUrl: commit.html_url, actionsUrl: `https://github.com/${owner}/${repo}/actions` };
    },
  };
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
