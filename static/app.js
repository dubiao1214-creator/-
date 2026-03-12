import { renderMarkdown } from "./markdown.mjs";

const state = {
  direction: "pm_to_dev",
  finalText: "",
  liveText: "",
  previewText: "",
};

const directionButtons = Array.from(document.querySelectorAll(".direction-btn"));
const exampleButtons = Array.from(document.querySelectorAll(".example-chip"));
const sourceText = document.querySelector("#sourceText");
const autoDetect = document.querySelector("#autoDetect");
const runButton = document.querySelector("#runButton");
const copyButton = document.querySelector("#copyButton");
const liveOutput = document.querySelector("#liveOutput");
const markdownPreview = document.querySelector("#markdownPreview");
const feedback = document.querySelector("#feedback");
const directionBadge = document.querySelector("#directionBadge");
const sceneBadge = document.querySelector("#sceneBadge");
const modelBadge = document.querySelector("#modelBadge");
const streamState = document.querySelector("#streamState");

let previewFrameId = null;

function setStreamState(label, tone = "idle") {
  streamState.textContent = label;
  streamState.dataset.tone = tone;
}

function updateDirection(direction) {
  state.direction = direction;
  document.body.dataset.direction = direction;
  directionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.direction === direction);
  });
  directionBadge.textContent = direction === "pm_to_dev" ? "产品 -> 开发" : "开发 -> 产品";
}

function renderPreviewNow(text) {
  if (!text.trim()) {
    markdownPreview.innerHTML = '<div class="empty-state">生成后这里会以 Markdown 格式实时呈现。</div>';
    return;
  }

  markdownPreview.innerHTML = `<article class="markdown-doc">${renderMarkdown(text)}</article>`;
}

function schedulePreviewRender(text) {
  state.previewText = text;

  if (previewFrameId) {
    return;
  }

  // Streaming can arrive token-by-token; batch DOM work to the next animation frame.
  previewFrameId = window.requestAnimationFrame(() => {
    renderPreviewNow(state.previewText);
    previewFrameId = null;
  });
}

function resetResult() {
  state.finalText = "";
  state.liveText = "";
  state.previewText = "";
  liveOutput.textContent = "正在等待模型输出...";
  renderPreviewNow("");
  feedback.textContent = "";
  sceneBadge.textContent = "场景待识别";
  sceneBadge.classList.add("muted");
  modelBadge.textContent = "模型待连接";
  modelBadge.classList.add("muted");
  setStreamState("流式生成中", "streaming");
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
          // Re-render the formatted preview while keeping the raw stream visible for debugging.
          schedulePreviewRender(state.liveText);
        }

        if (event === "done") {
          state.finalText = data.text || state.liveText;
          liveOutput.textContent = state.finalText || "模型未返回内容。";
          schedulePreviewRender(state.finalText);
          setStreamState("已完成", "ready");
        }

        if (event === "error") {
          feedback.textContent = data.message || "翻译失败，请检查配置。";
          liveOutput.textContent = "模型调用失败。";
          renderPreviewNow("");
          setStreamState("调用失败", "error");
        }
      });
    }
  } catch (error) {
    feedback.textContent = error.message || "翻译失败，请稍后重试。";
    liveOutput.textContent = "无法连接到后端服务。";
    renderPreviewNow("");
    setStreamState("连接失败", "error");
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
renderPreviewNow("");
setStreamState("等待中", "idle");
