(function () {
  function loadMermaid(callback) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    script.onload = callback;
    document.head.appendChild(script);
  }

  function convertCodeBlocksToMermaidDivs() {
    const codeBlocks = Array.from(
      document.querySelectorAll(
        "pre > code.language-mermaid, pre > code.mermaid, code.language-mermaid"
      )
    );
    for (const code of codeBlocks) {
      const pre = code.closest("pre") || code.parentElement;
      const container = document.createElement("div");
      container.className = "mermaid";
      container.textContent = code.textContent;
      if (pre && pre.parentElement) {
        pre.parentElement.replaceChild(container, pre);
      } else if (code.parentElement) {
        code.parentElement.replaceChild(container, code);
      }
    }
  }

  function renderMermaid() {
    convertCodeBlocksToMermaidDivs();
    if (window.mermaid) {
      window.mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
      window.mermaid.run();
    }
  }

  function init() {
    loadMermaid(renderMermaid);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
