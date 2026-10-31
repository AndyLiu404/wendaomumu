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

## 林定过的规矩（2026-10-31 从 Claude 私有记忆迁来）

- push 到 GitHub `main` 就会由 Cloudflare Pages 自动部署到线上；新功能先在 `staging` 分支做，林确认后再 merge 到 main。`dev.wendaomumu.com` 还没绑。
- Notion 同步：`node notion-sync.mjs`，只发 Status = `Published` 的页面；`@notionhq/client` 固定在 2.2.15（v5 删了 `databases.query`）。图片渲染靠 `layouts/_default/_markup/render-image.html`。
- 和 wendaocitywalk.com 完全独立，只靠链接互跳；citywalk 静态文件已于 2026-04-27 移出本仓库。
