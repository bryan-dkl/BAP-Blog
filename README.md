# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Writing a blog post

Posts live in `src/content/blog/` as Markdown files (`YYYY-MM-DD-short-title.md`). Three ways to add one:

1. **Terminal:** `npm run new-post` asks for title, pillars, etc. and creates the file (as a draft).
2. **Browser:** run `npm run dev`, open `/new-post/`, fill in the form and download the `.md` file into `src/content/blog/`.
3. **By hand:** copy `src/content/blog/_template.md`.

Frontmatter fields:

| field         | required | values |
|---------------|----------|--------|
| `title`       | yes      | text |
| `date`        | yes      | `2026-10-30` |
| `pillars`     | yes      | one or more of `development`, `ux`, `design` |
| `types`       | no       | `experiment`, `research`, `feedback`, `meeting`, `milestone`, `reflection` |
| `description` | no       | shown on the overview |
| `authors`     | no       | list of names |
| `draft`       | no       | `true` = only visible in `npm run dev` |

Pillars and types are defined in `src/data/taxonomy.ts` — edit them there.

### Structure

```
src/
├─ content.config.ts        # schema for posts (title, date, pillars, types, ...)
├─ content/blog/            # the posts (.md)
├─ data/taxonomy.ts         # pillars + extra filters, labels and colours
├─ lib/posts.ts             # getPosts(), date formatting, group by month
├─ layouts/BaseLayout.astro # header, footer, <head>
├─ components/              # FilterBar, PostCard, Tags
├─ pages/index.astro        # chronological overview + filters
├─ pages/blog/[id].astro    # individual post (with previous/next)
├─ pages/new-post.astro     # "write a post" form
└─ styles/global.css
scripts/new-post.mjs        # `npm run new-post`
```
