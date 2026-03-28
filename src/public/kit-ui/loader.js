(function () {
  function findLoaderScript() {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || "";
      if (src.indexOf("/kit-ui-loader.js") !== -1) {
        return scripts[i];
      }
    }
    return null;
  }

  function getEmailFromPage(root) {
    const directEmail = (root.getAttribute("data-user-email") || "").trim();
    if (directEmail && directEmail.includes("@")) {
      return directEmail;
    }

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

  function buildIframe(root, baseUrl, partId, email) {
    if (root.getAttribute("data-kit-mounted") === "1") return;

    root.setAttribute("data-kit-mounted", "1");
    root.innerHTML = "";

    let src =
      baseUrl +
      "/kit-ui?email=" + encodeURIComponent(email) +
      "&apiBase=" + encodeURIComponent(baseUrl);

    if (partId) {
      src += "&partId=" + encodeURIComponent(partId);
    }

    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.style.width = "100%";
    iframe.style.minHeight = "1600px";
    iframe.style.border = "none";
    iframe.style.background = "transparent";

    root.appendChild(iframe);
  }

  function tryInit() {
    const root = document.getElementById("kitApp");
    if (!root) return false;

    const loaderScript = findLoaderScript();
    const scriptSrc = loaderScript ? (loaderScript.src || "") : "";
    const baseUrl = scriptSrc.replace(/\/kit-ui-loader\.js(?:\?.*)?$/, "");

    const partId = (root.getAttribute("data-partid") || "").trim();
    const email = getEmailFromPage(root);

    console.log("KIT LOADER DEBUG", {
      partId,
      email,
      scriptSrc,
      baseUrl,
      rootHtml: root.outerHTML
    });

    if (!baseUrl || !email) {
      return false;
    }

    buildIframe(root, baseUrl, partId, email);
    return true;
  }

  function waitAndInit() {
    let attempts = 0;
    const maxAttempts = 80;

    const timer = setInterval(function () {
      attempts += 1;
      const ok = tryInit();

      if (ok) {
        clearInterval(timer);
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);

        const root = document.getElementById("kitApp");
        if (root && !root.getAttribute("data-kit-mounted")) {
          root.innerHTML =
            '<div style="padding:20px;border:1px solid #ddd;border-radius:12px;background:#fff;">Configuration incomplète : baseUrl ou email utilisateur introuvable.</div>';
        }
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitAndInit);
  } else {
    waitAndInit();
  }
})();