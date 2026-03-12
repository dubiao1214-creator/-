const state = {
  direction: "pm_to_dev",
  finalText: "",
  liveText: "",
};

const directionButtons = Array.from(document.querySelectorAll(".direction-btn"));
const exampleButtons = Array.from(document.querySelectorAll(".example-chip"));
const sourceText = document.querySelector("#sourceText");
const autoDetect = document.querySelector("#autoDetect");
const runButton = document.querySelector("#runButton");
const copyButton = document.querySelector("#copyButton");
const liveOutput = document.querySelector("#liveOutput");
const sectionCards = document.querySelector("#sectionCards");
const feedback = document.querySelector("#feedback");
const directionBadge = document.querySelector("#directionBadge");
const sceneBadge = document.querySelector("#sceneBadge");
const modelBadge = document.querySelector("#modelBadge");
const heroMode = document.querySelector("#heroMode");
const strategySummary = document.querySelector("#strategySummary");

function updateDirection(direction) {
  state.direction = direction;
  document.body.dataset.direction = direction;
  directionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.direction === direction);
  });
  const isPmToDev = direction === "pm_to_dev";
  const directionText = isPmToDev ? "产品 -> 开发" : "开发 -> 产品";
  directionBadge.textContent = directionText;
  if (heroMode) {
    heroMode.textContent = directionText;
  }
  if (strategySummary) {
    strategySummary.textContent = isPmToDev
      ? "当前方向会优先输出技术路径、依赖项与待确认问题。"
      : "当前方向会优先解释用户体验、业务价值与风险边界。";
  }
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSections(text) {
  if (!text.trim()) {
    sectionCards.innerHTML = '<p class="empty-state">模型完成输出后，这里会自动整理成结构化卡片。</p>';
    return;
  }

  const parts = text
    .split("\n## ")
    .map((part, index) => (index === 0 ? part : `## ${part}`))
    .map((part) => part.trim())
    .filter(Boolean);

  const cards = parts
    .map((part) => {
      const lines = part.split("\n");
      const title = lines[0].replace(/^##\s*/, "");
      const content = lines.slice(1).join("\n").trim() || "暂无补充内容";
      return `
        <section class="section-card">
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(content).replaceAll("\n", "<br />")}</p>
        </section>
      `;
    })
    .join("");

  sectionCards.innerHTML = cards || '<p class="empty-state">未能识别结构化标题，已保留在实时输出区。</p>';
}

function resetResult() {
  state.finalText = "";
  state.liveText = "";
  liveOutput.textContent = "正在等待模型输出...";
  renderSections("");
  feedback.textContent = "";
  sceneBadge.textContent = "场景待识别";
  sceneBadge.classList.add("muted");
  modelBadge.textContent = "模型待连接";
  modelBadge.classList.add("muted");
}

function applyMeta(data) {
  sceneBadge.textContent = `识别场景：${data.scene || "待判断"}`;
  sceneBadge.classList.remove("muted");
  modelBadge.textContent = `模型：${data.model || "unknown"}`;
  modelBadge.classList.remove("muted");
}

async function streamTranslation() {
  const text = sourceText.value.trim();
  if (!text) {
    feedback.textContent = "请输入要翻译的内容。";
    return;
  }

  resetResult();
  runButton.disabled = true;
  runButton.textContent = "翻译中...";

  try {
    const response = await fetch("/api/translate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: state.direction,
        text,
        auto_detect: autoDetect.checked,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error("服务暂时不可用，请稍后重试。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      blocks.forEach((block) => {
        const lines = block.split("\n");
        const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        const dataLine = lines.find((line) => line.startsWith("data:"))?.slice(5).trim();
        if (!event || !dataLine) return;

        const data = JSON.parse(dataLine);

        if (event === "meta") {
          applyMeta(data);
        }

        if (event === "chunk") {
          state.liveText += data.text || "";
          liveOutput.textContent = state.liveText;
        }

        if (event === "done") {
          state.finalText = data.text || state.liveText;
          liveOutput.textContent = state.finalText || "模型未返回内容。";
          renderSections(state.finalText);
        }

        if (event === "error") {
          feedback.textContent = data.message || "翻译失败，请检查配置。";
          liveOutput.textContent = "模型调用失败。";
          renderSections("");
        }
      });
    }
  } catch (error) {
    feedback.textContent = error.message || "翻译失败，请稍后重试。";
    liveOutput.textContent = "无法连接到后端服务。";
  } finally {
    runButton.disabled = false;
    runButton.textContent = "开始翻译";
  }
}

directionButtons.forEach((button) => {
  button.addEventListener("click", () => updateDirection(button.dataset.direction));
});

exampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateDirection(button.dataset.direction);
    sourceText.value = button.dataset.text;
  });
});

runButton.addEventListener("click", streamTranslation);

copyButton.addEventListener("click", async () => {
  const text = state.finalText || state.liveText;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  feedback.textContent = "结果已复制到剪贴板。";
});

updateDirection(state.direction);
