# wendaomumu.com

Hugo static site, deployed to Cloudflare Pages via GitHub push.

## Stack

- Hugo + Stack theme (`themes/hugo-theme-stack/`)
- Custom styles: `assets/scss/custom.scss` (loaded last, overrides theme without !important)
- Content sync: Notion → local markdown via `notion-sync.mjs`
- Deploy: git push → Cloudflare Pages auto-builds

## Directory Structure

```
content/
  post/          ← blog articles (markdown)
  page/          ← static pages
assets/
  scss/
    custom.scss  ← ALL custom CSS lives here
static/          ← static files served as-is
layouts/         ← Hugo template overrides
hugo.toml        ← site config
```

## Editing Styles

Only edit `assets/scss/custom.scss`. The Stack theme files in `themes/` should not be modified (they'd be overwritten on theme update).

Rules:
- No `!important` — custom.scss loads after theme, so normal specificity wins
- Use Stack theme CSS variables where possible (e.g. `var(--card-background)`)
- Test with `hugo server` before pushing

## Content

Articles live in `content/post/`. Each article is a markdown file with YAML frontmatter:
```yaml
---
title: "Article Title"
date: 2026-01-01
categories: ["分类"]
tags: ["tag1", "tag2"]
---
```

## Deploy

```bash
hugo server          # local preview at localhost:1313
git push             # triggers Cloudflare Pages build
```

## Notion Sync

```bash
node notion-sync.mjs   # syncs Notion database → content/post/
```
