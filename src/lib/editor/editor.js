// Blog editor (browser side). Works with either backend from ./backends.js.

import { EditorError, githubBackend, localBackend } from './backends.js';
import {
  ASSETS_DIR,
  MEDIA_DIR,
  POSTS_DIR,
  extension,
  isImage,
  isPostFile,
  parseFrontmatter,
  postIdFromFile,
  safeFileName,
  serializePost,
  slugify,
  uniqueName,
} from './post-format.js';

const TOKEN_KEY = 'bap-blog-github-token';
const MAX_FILE_MB = 90; // GitHub refuses files over 100 MB

const storage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token, remember) {
    try {
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: token only lives in memory */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function initEditor(root) {
  const base = root.dataset.base;
  const github = { owner: root.dataset.owner, repo: root.dataset.repo, branch: root.dataset.branch };
  const forceGithub = new URLSearchParams(location.search).get('mode') === 'github';
  const mode = root.dataset.mode === 'github' || forceGithub ? 'github' : 'local';

  const $ = (selector) => root.querySelector(selector);
  const form = $('#post-form');
  const body = $('#body');
  const status = $('#status');
  const picker = $('#post-picker');
  const coverInput = $('#cover-input');
  const coverPreview = $('#cover-preview');
  const coverImg = $('#cover-img');
  const attachmentsBox = $('#attachments');
  const attachmentList = $('#attachment-list');
  const input = (name) => form.elements.namedItem(name);

  const attachments = new Map(); // key (safe file name) → File
  let backend = null;
  let dirty = false;
  let editId = new URLSearchParams(location.search).get('edit');
  let posts = [];

  const setStatus = (message, kind = '', html = false) => {
    status[html ? 'innerHTML' : 'textContent'] = message;
    status.dataset.kind = kind;
  };

  // ---------- connecting ----------

  root.querySelectorAll('[data-mode-only]').forEach((el) => (el.hidden = el.dataset.modeOnly !== mode));

  if (mode === 'local') {
    backend = localBackend(base);
    start();
  } else {
    const token = storage.get();
    if (token) connect(token, true);
    else showConnect();
  }

  function showConnect(message) {
    $('#connect').hidden = false;
    $('#workspace').hidden = true;
    $('#connected').hidden = true;
    if (message) {
      $('#connect-status').textContent = message;
      $('#connect-status').dataset.kind = 'error';
    }
  }

  async function connect(token, remember) {
    const connectStatus = $('#connect-status');
    connectStatus.textContent = 'Checking token…';
    connectStatus.dataset.kind = '';
    const candidate = githubBackend({ ...github, token });
    try {
      const login = await candidate.verify();
      storage.set(token, remember);
      backend = candidate;
      $('#connect').hidden = true;
      $('#connected').hidden = false;
      $('#connected-user').textContent = `@${login}`;
      connectStatus.textContent = '';
      start();
    } catch (error) {
      storage.clear();
      showConnect(error instanceof EditorError ? error.message : `Couldn't reach GitHub: ${error.message}`);
    }
  }

  $('#connect-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const token = $('#token-input').value.trim();
    if (token) connect(token, $('#token-remember').checked);
  });

  $('#disconnect')?.addEventListener('click', () => {
    storage.clear();
    backend = null;
    $('#token-input').value = '';
    showConnect();
  });

  // ---------- loading posts ----------

  async function start() {
    $('#workspace').hidden = false;
    await loadPostList();
    if (editId) await loadPost(editId);
  }

  async function loadPostList() {
    try {
      const files = (await backend.list(POSTS_DIR)).filter(isPostFile);
      posts = await Promise.all(
        files.map(async (file) => {
          const id = postIdFromFile(file);
          try {
            const { data } = parseFrontmatter(await backend.readText(`${POSTS_DIR}/${file}`));
            return { id, file, title: data.title ?? id, date: String(data.date ?? ''), draft: data.draft === true };
          } catch {
            return { id, file, title: id, date: '', draft: false };
          }
        }),
      );
      posts.sort((a, b) => b.date.localeCompare(a.date));
      picker.length = 1;
      for (const post of posts) {
        picker.add(new Option(`${post.date} · ${post.title}${post.draft ? ' (draft)' : ''}`, post.id));
      }
      picker.value = editId ?? '';
    } catch (error) {
      setStatus(
        mode === 'local' ? 'Could not reach the editor API — is `npm run dev` running?' : error.message,
        'error',
      );
    }
  }

  picker.addEventListener('change', () => {
    if (dirty && !confirm('You have unsaved changes. Leave anyway?')) {
      picker.value = editId ?? '';
      return;
    }
    dirty = false;
    const params = new URLSearchParams(location.search);
    if (picker.value) params.set('edit', picker.value);
    else params.delete('edit');
    location.search = params.toString();
  });

  async function loadPost(id) {
    const post = posts.find((p) => p.id === id);
    if (!post) return setStatus(`Post "${id}" not found.`, 'error');
    setStatus('Loading post…');
    try {
      const { data, body: text } = parseFrontmatter(await backend.readText(`${POSTS_DIR}/${post.file}`));
      $('#editor-title').textContent = 'Edit post';
      input('id').value = id;
      input('title').value = data.title ?? '';
      input('date').value = String(data.date ?? '').slice(0, 10);
      input('description').value = data.description ?? '';
      input('authors').value = (data.authors ?? []).join(', ');
      input('coverAlt').value = data.coverAlt ?? '';
      for (const box of form.querySelectorAll('input[name="pillars"], input[name="types"]')) {
        box.checked = (data[box.name] ?? []).includes(box.value);
      }
      body.value = text;
      setStatus(data.draft ? 'This post is currently a draft.' : '');
      const coverPath = assetPathFromRef(data.cover);
      if (coverPath) showCover(URL.createObjectURL(await backend.readBlob(coverPath)));
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  /** "../../assets/blog/x/cover.jpg" → "src/assets/blog/x/cover.jpg" */
  function assetPathFromRef(ref) {
    const prefix = '../../assets/blog/';
    return typeof ref === 'string' && ref.startsWith(prefix) ? `${ASSETS_DIR}/${ref.slice(prefix.length)}` : null;
  }

  // ---------- cover ----------

  function showCover(src) {
    coverImg.src = src;
    coverPreview.hidden = false;
  }

  coverInput.addEventListener('change', () => {
    const file = coverInput.files?.[0];
    if (!file) return;
    if (!isImage(file.name)) {
      coverInput.value = '';
      return setStatus(unsupportedMessage(file), 'error');
    }
    input('removeCover').value = '';
    showCover(URL.createObjectURL(file));
  });

  $('#cover-remove').addEventListener('click', () => {
    coverInput.value = '';
    coverPreview.hidden = true;
    coverImg.removeAttribute('src');
    input('removeCover').value = 'true';
    dirty = true;
  });

  // ---------- markdown toolbar ----------

  function replaceSelection(text, selectFrom, selectTo) {
    const start = body.selectionStart;
    body.focus();
    body.setRangeText(text, start, body.selectionEnd, 'end');
    if (selectFrom !== undefined) body.setSelectionRange(start + selectFrom, start + (selectTo ?? selectFrom));
    body.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function wrap(before, after, placeholder) {
    const selected = body.value.slice(body.selectionStart, body.selectionEnd) || placeholder;
    replaceSelection(before + selected + after, before.length, before.length + selected.length);
  }

  function prefixLines(prefix) {
    const start = body.value.lastIndexOf('\n', body.selectionStart - 1) + 1;
    let end = body.value.indexOf('\n', body.selectionEnd);
    if (end === -1) end = body.value.length;
    body.setSelectionRange(start, end);
    const lines = body.value.slice(start, end).split('\n');
    replaceSelection(lines.map((line, i) => prefix(i) + line).join('\n'));
  }

  function insertBlock(text) {
    const before = body.value.slice(0, body.selectionStart);
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    replaceSelection(`${lead}${text}\n\n`);
  }

  const actions = {
    h2: () => prefixLines(() => '## '),
    h3: () => prefixLines(() => '### '),
    bold: () => wrap('**', '**', 'bold text'),
    italic: () => wrap('_', '_', 'italic text'),
    link: () => {
      const selected = body.value.slice(body.selectionStart, body.selectionEnd) || 'link text';
      const text = `[${selected}](https://)`;
      replaceSelection(text, text.length - 9, text.length - 1);
    },
    ul: () => prefixLines(() => '- '),
    ol: () => prefixLines((i) => `${i + 1}. `),
    quote: () => prefixLines(() => '> '),
    code: () => wrap('\n```\n', '\n```\n', 'code'),
  };

  root.querySelectorAll('[data-md]').forEach((button) => button.addEventListener('click', () => actions[button.dataset.md]()));

  body.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = { b: 'bold', i: 'italic', k: 'link' }[e.key.toLowerCase()];
    if (key) {
      e.preventDefault();
      actions[key]();
    }
  });

  // ---------- uploads ----------

  function unsupportedMessage(file) {
    return /\.(heic|heif)$/i.test(file.name)
      ? `"${file.name}" is an iPhone HEIC photo — export it as JPG first (Photos → File → Export).`
      : `"${file.name}" isn't a supported picture format (use jpg, png, webp, gif, avif or svg).`;
  }

  function addFiles(files, onlyImages = false) {
    for (const file of files) {
      const image = isImage(file.name);
      if (!image && (onlyImages || file.type.startsWith('image/'))) {
        setStatus(unsupportedMessage(file), 'error');
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setStatus(`"${file.name}" is too big (max ${MAX_FILE_MB} MB). Upload big videos to YouTube and use Embed instead.`, 'error');
        continue;
      }
      const key = uniqueName(safeFileName(file.name), new Set(attachments.keys()));
      attachments.set(key, file);
      insertBlock(markdownFor(key, file, image));
    }
    renderAttachments();
  }

  function markdownFor(key, file, image) {
    const src = `upload:${key}`;
    if (image) return `![Describe the picture](${src})`;
    if (file.type.startsWith('video/')) return `<video src="${src}" controls playsinline></video>`;
    if (file.type.startsWith('audio/')) return `<audio src="${src}" controls></audio>`;
    return `[📎 ${file.name}](${src})`;
  }

  function renderAttachments() {
    attachmentList.replaceChildren();
    for (const [key, file] of attachments) {
      const li = document.createElement('li');
      if (isImage(key)) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = '';
        li.append(img);
      } else {
        const icon = document.createElement('span');
        icon.className = 'attachment-icon';
        icon.textContent = file.type.startsWith('video/') ? '🎬' : '📄';
        li.append(icon);
      }
      const name = document.createElement('span');
      name.className = 'attachment-name';
      name.textContent = `${key} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link-button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        attachments.delete(key);
        body.value = body.value
          .split('\n')
          .filter((line) => !line.includes(`upload:${key}`))
          .join('\n');
        renderAttachments();
      });
      li.append(name, remove);
      attachmentList.append(li);
    }
    attachmentsBox.hidden = attachments.size === 0;
  }

  const imageInput = $('#image-input');
  const fileInput = $('#file-input');
  $('[data-action="image"]').addEventListener('click', () => imageInput.click());
  $('[data-action="file"]').addEventListener('click', () => fileInput.click());
  imageInput.addEventListener('change', () => {
    addFiles(imageInput.files ?? [], true);
    imageInput.value = '';
  });
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files ?? []);
    fileInput.value = '';
  });

  body.addEventListener('dragover', (e) => {
    e.preventDefault();
    body.classList.add('is-dragging');
  });
  body.addEventListener('dragleave', () => body.classList.remove('is-dragging'));
  body.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    body.classList.remove('is-dragging');
    addFiles(e.dataTransfer.files);
  });
  body.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    // Pasted screenshots are all called "image.png" — give them a clearer name.
    addFiles(files.map((f) => (f.name === 'image.png' ? new File([f], `screenshot-${Date.now()}.png`, { type: f.type }) : f)));
  });

  // ---------- embeds ----------

  $('[data-action="embed"]').addEventListener('click', () => {
    const url = prompt('Paste a YouTube, Vimeo or Figma link:')?.trim();
    if (url) insertBlock(embedFor(url));
  });

  function embedFor(url) {
    const youtube = url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/);
    const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    let src = '';
    if (youtube) src = `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
    else if (vimeo) src = `https://player.vimeo.com/video/${vimeo[1]}`;
    else if (/figma\.com\//.test(url)) src = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
    if (!src) return `[${url}](${url})`;
    return `<div class="embed"><iframe src="${src}" title="Embedded content" loading="lazy" allowfullscreen></iframe></div>`;
  }

  // ---------- save ----------

  form.addEventListener('input', () => (dirty = true));
  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!backend) return;
    const draft = e.submitter?.dataset.draft === 'true';
    const buttons = form.querySelectorAll('button[type="submit"]');
    buttons.forEach((b) => (b.disabled = true));
    setStatus(mode === 'github' ? 'Uploading to GitHub…' : 'Saving…');

    try {
      const { id, files, title, finalBody, isNew } = await buildPost(draft);
      const verb = isNew ? 'Add' : 'Update';
      const result = await backend.save(files, `${verb} post: ${title}`);

      dirty = false;
      attachments.clear();
      renderAttachments();
      body.value = finalBody;
      input('id').value = id;
      input('removeCover').value = '';
      coverInput.value = '';
      editId = id;
      $('#editor-title').textContent = 'Edit post';
      history.replaceState(null, '', `?${new URLSearchParams({ ...(mode === 'github' && root.dataset.mode !== 'github' ? { mode: 'github' } : {}), edit: id })}`);

      const postUrl = `${base}blog/${id}/`;
      if (mode === 'local') {
        setStatus(draft ? 'Saved as draft ✓ Opening the post…' : 'Published ✓ Opening the post…', 'ok');
        setTimeout(() => (location.href = postUrl), 400);
      } else {
        setStatus(
          `${draft ? 'Saved as draft' : 'Published'} ✓ Committed to GitHub. ` +
            (draft
              ? 'Drafts are not shown on the site — publish it later from this editor.'
              : `The site is rebuilding: your post will be live at <a href="${postUrl}">${postUrl}</a> in about 1–2 minutes.`) +
            ` <a href="${result.commitUrl}" target="_blank" rel="noopener">View commit</a> · <a href="${result.actionsUrl}" target="_blank" rel="noopener">Deploy status</a>`,
          'ok',
          true,
        );
        await loadPostList();
      }
    } catch (error) {
      setStatus(`Couldn't save: ${error.message}`, 'error');
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });

  /** Works out every file that has to be written for this save. */
  async function buildPost(draft) {
    const field = (name) => String(input(name).value ?? '').trim();
    const checked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((b) => b.value);

    const title = field('title');
    const date = field('date');
    const pillars = checked('pillars');
    if (!title) throw new EditorError('give your post a title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new EditorError('pick a date.');
    if (pillars.length === 0) throw new EditorError('pick at least one pillar.');

    // Existing post → keep its file (and URL). New post → date + title, made unique.
    let id = field('id');
    let file;
    let existing = {};
    const isNew = !id;
    if (isNew) {
      const taken = new Set((await backend.list(POSTS_DIR)).filter(isPostFile).map(postIdFromFile));
      id = uniqueName(`${date}-${slugify(title)}`, taken);
      file = `${id}.md`;
    } else {
      file = posts.find((p) => p.id === id)?.file ?? `${id}.md`;
      existing = parseFrontmatter(await backend.readText(`${POSTS_DIR}/${file}`)).data;
    }

    const files = [];
    let finalBody = body.value.replace(/\r\n/g, '\n').trim();

    // Uploads: pictures → src/assets/blog/<id>/, everything else → public/media/<id>/
    const takenAssets = new Set(await backend.list(`${ASSETS_DIR}/${id}`));
    const takenMedia = new Set(await backend.list(`${MEDIA_DIR}/${id}`));
    const store = (upload, wanted) => {
      const image = isImage(wanted);
      const taken = image ? takenAssets : takenMedia;
      const name = uniqueName(wanted, taken);
      taken.add(name);
      files.push({ path: `${image ? ASSETS_DIR : MEDIA_DIR}/${id}/${name}`, content: upload });
      // Relative links work both locally (/) and on GitHub Pages (/BAP-Blog/).
      return image ? `../../assets/blog/${id}/${name}` : `../../media/${id}/${name}`;
    };

    for (const [key, upload] of attachments) {
      if (!finalBody.includes(`upload:${key}`)) continue;
      finalBody = finalBody.split(`upload:${key}`).join(store(upload, key));
    }
    const missing = finalBody.match(/upload:[^\s)"']+/);
    if (missing) throw new EditorError(`"${missing[0]}" is used in the text but that file isn't attached anymore.`);

    let cover = existing.cover;
    const coverFile = coverInput.files?.[0];
    if (coverFile) cover = store(coverFile, `cover.${extension(coverFile.name)}`);
    else if (field('removeCover') === 'true') cover = undefined;

    const authors = field('authors')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    const markdown = serializePost(
      {
        title,
        date,
        description: field('description') || undefined,
        cover,
        coverAlt: field('coverAlt') || undefined,
        pillars,
        types: checked('types'),
        authors,
        draft,
      },
      finalBody,
      existing,
    );
    files.push({ path: `${POSTS_DIR}/${file}`, content: markdown });
    return { id, files, title, finalBody, isNew };
  }
}
