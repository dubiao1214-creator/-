export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(text) {
  const tokens = [];
  let output = escapeHtml(text);

  // Protect inline code first so emphasis rules do not rewrite content inside backticks.
  output = output.replace(/`([^`]+)`/g, (_, code) => {
    const token = `__CODE_TOKEN_${tokens.length}__`;
    tokens.push(`<code>${code}</code>`);
    return token;
  });

  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return tokens.reduce((result, tokenHtml, index) => {
    return result.replace(`__CODE_TOKEN_${index}__`, tokenHtml);
  }, output);
}

export function renderMarkdown(markdown) {
  const normalized = (markdown || "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  const html = [];
  let paragraph = [];
  let quote = [];
  let listItems = [];
  let listType = null;
  let codeFence = [];
  let inCodeFence = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushQuote = () => {
    if (!quote.length) return;
    html.push(`<blockquote><p>${renderInlineMarkdown(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) return;
    const items = listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("");
    html.push(`<${listType}>${items}</${listType}>`);
    listItems = [];
    listType = null;
  };

  const flushCodeFence = () => {
    if (!codeFence.length) return;
    html.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
    codeFence = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      // Fence boundaries flush any pending rich text blocks before toggling code mode.
      flushParagraph();
      flushQuote();
      flushList();
      if (inCodeFence) {
        flushCodeFence();
        inCodeFence = false;
      } else {
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeFence.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushQuote();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushQuote();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const blockquote = trimmed.match(/^>\s?(.*)$/);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(blockquote[1]);
      continue;
    }

    const unorderedItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedItem) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedItem[1]);
      continue;
    }

    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedItem[1]);
      continue;
    }

    if (listItems.length) {
      flushList();
    }

    if (quote.length) {
      flushQuote();
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushQuote();
  flushList();
  if (inCodeFence || codeFence.length) {
    flushCodeFence();
  }

  return html.join("");
}

export function buildStructuredCardsHtml(markdown) {
  const normalized = (markdown || "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: line.replace(/^##\s+/, "").trim(),
        body: [],
      };
      continue;
    }

    if (currentSection) {
      currentSection.body.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  if (!sections.length) {
    return '<div class="empty-state">未识别到结构化章节。</div>';
  }

  // Each second-level heading becomes a separate card so long responses stay scannable.
  return sections
    .map((section) => {
      const body = section.body.join("\n").trim();
      const content = body ? renderMarkdown(body) : "<p>暂无补充内容</p>";
      return `
        <section class="section-card">
          <h4>${escapeHtml(section.title)}</h4>
          <div class="section-body">${content}</div>
        </section>
      `;
    })
    .join("");
}
