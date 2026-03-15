import pkg from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import fs from "fs";
import path from "path";

const { Client } = pkg;

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = "29580cca903380dd882ed142381a0abc";

if (!NOTION_TOKEN) {
  console.error("Error: NOTION_TOKEN environment variable is not set.");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

const CATEGORY_MAP = {
  citywalk: "content/zh/citywalk",
  Citywalk: "content/zh/citywalk",
  posts: "content/zh/posts",
  博客: "content/zh/posts",
};
const DEFAULT_DIR = "content/zh/posts";

async function sync() {
  console.log("Fetching published articles from Notion...");

  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      status: { equals: "Published" },
    },
    sorts: [{ property: "Date", direction: "descending" }],
  });

  console.log(`Found ${response.results.length} published articles.`);

  for (const page of response.results) {
    const props = page.properties;

    const titleProp = props.Title || props.Name;
    const title = titleProp?.title?.[0]?.plain_text || "Untitled";
    const date = props.Date?.date?.start || new Date().toISOString().split("T")[0];
    const tags = props.Tags?.multi_select?.map((t) => t.name) || [];
    const category = props.Category?.select?.name || "";
    const outputDir = CATEGORY_MAP[category] || DEFAULT_DIR;

    const slug = title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fff-]/g, "")
      .slice(0, 60);

    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdContent = n2m.toMarkdownString(mdBlocks);

    const frontMatter = [
      "---",
      `title: "${title.replace(/"/g, '\\"')}"`,
      `date: ${date}`,
      tags.length ? `tags: [${tags.map((t) => `"${t}"`).join(", ")}]` : null,
      `slug: "${slug}"`,
      "---",
      "",
    ]
      .filter((line) => line !== null)
      .join("\n");

    const fullContent = frontMatter + "\n" + mdContent.parent;

    fs.mkdirSync(outputDir, { recursive: true });
    const filename = path.join(outputDir, `${slug}.md`);
    fs.writeFileSync(filename, fullContent, "utf8");
    console.log(`✓ ${title} → ${filename}`);
  }

  console.log("Sync complete.");
}

sync().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
