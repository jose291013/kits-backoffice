(function () {
  function getCurrentScript() {
    return document.currentScript || (function () {
      const scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();
  }

  function getUserEmailFromPage() {
    const correo = document.querySelector("#correo");
    if (correo) {
      const txt = (correo.textContent || "").trim();
      if (txt && txt.includes("@")) return txt;
    }

    const emailLink = document.querySelector('a[href^="mailto:"]');
    if (emailLink) {
      const href = emailLink.getAttribute("href") || "";
      const email = href.replace(/^mailto:/i, "").trim();
      if (email && email.includes("@")) return email;
    }

    return "";
  }

  function initLoader() {
    const root = document.getElementById("kitApp");
    if (!root) return;

    const scriptEl = getCurrentScript();
    const scriptSrc = scriptEl && scriptEl.src ? scriptEl.src : "";
    const baseUrl = scriptSrc.replace(/\/kit-ui-loader\.js(?:\?.*)?$/, "");

    const partId = (root.dataset.partid || "").trim();
    const explicitEmail = (root.dataset.userEmail || "").trim();
    const email = explicitEmail || getUserEmailFromPage();

    if (!partId || !baseUrl || !email) {
      root.innerHTML = '<div style="padding:20px;border:1px solid #ddd;border-radius:12px;background:#fff;">Configuration incomplète : PartID, baseUrl ou email utilisateur introuvable.</div>';
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src =
      `${baseUrl}/kit-ui?partId=${encodeURIComponent(partId)}&email=${encodeURIComponent(email)}&apiBase=${encodeURIComponent(baseUrl)}`;
    iframe.style.width = "100%";
    iframe.style.minHeight = "1600px";
    iframe.style.border = "none";
    iframe.style.background = "transparent";

    root.innerHTML = "";
    root.appendChild(iframe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLoader);
  } else {
    initLoader();
  }
})();