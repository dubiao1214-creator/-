import test from "node:test";
import assert from "node:assert/strict";

import { buildStructuredCardsHtml, renderMarkdown } from "../static/markdown.mjs";

test("renderMarkdown renders headings, emphasis, lists, blockquotes, and code", () => {
  const html = renderMarkdown(`## 标题

**重点**说明

- 第一项
- 第二项

> 需要确认范围

\`inline\` 代码`);

  assert.match(html, /<h2>标题<\/h2>/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>第一项<\/li>/);
  assert.match(html, /<blockquote><p>需要确认范围<\/p><\/blockquote>/);
  assert.match(html, /<code>inline<\/code>/);
});

test("buildStructuredCardsHtml builds cards from second-level markdown sections", () => {
  const html = buildStructuredCardsHtml(`## 需求目标
先明确目标

## 建议技术路径
- 推荐策略
- 数据依赖`);

  assert.match(html, /section-card/);
  assert.match(html, /需求目标/);
  assert.match(html, /建议技术路径/);
  assert.match(html, /<ul>/);
});
