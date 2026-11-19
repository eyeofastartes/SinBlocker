const blockingRoot = document.documentElement;
const BLOCKING_CLASS = "ivb-hide-images";
const revealedMedia = new WeakSet();
let lastContextMedia = null;
let shouldHideMedia = blockingRoot.classList.contains(BLOCKING_CLASS);

new MutationObserver(() => {
  if (shouldHideMedia && !blockingRoot.classList.contains(BLOCKING_CLASS)) {
    blockingRoot.classList.add(BLOCKING_CLASS);
  }
}).observe(blockingRoot, {
  attributes: true,
  attributeFilter: ["class"],
});

init();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (IAVB_SETTINGS_KEY in changes) {
    applyBlockingFromStorage();
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "hide" || request.action === "show") {
    updateBlockingState(request.action === "hide", request.blockingState);
  } else if (request.action === "showMedia") {
    const revealed = request.srcUrl
      ? revealMedia(request.srcUrl, request.mediaType)
      : false;
    if (!revealed && lastContextMedia) {
      lastContextMedia.classList.add("ivb-shown");
      revealedMedia.add(lastContextMedia);
      lastContextMedia = null;
    }
  }
});

async function init() {
  await applyBlockingFromStorage();
}

async function applyBlockingFromStorage() {
  const settings = await getStoredSettings();
  const decision = evaluateUrlBlocking(window.location.href, settings);

  updateBlockingState(
    decision.blocked,
    settings.blockingState
  );
}

function updateBlockingState(hideImages, blockingState) {
  const wasHiding = blockingRoot.classList.contains(BLOCKING_CLASS);
  shouldHideMedia = Boolean(hideImages && blockingState);

  if (shouldHideMedia) {
    blockingRoot.classList.add(BLOCKING_CLASS);
    installContextMenuFallback();
  } else {
    blockingRoot.classList.remove(BLOCKING_CLASS);
    if (wasHiding) {
      removeContextMenuFallback();
    }
    lastContextMedia = null;
  }
}

function installContextMenuFallback() {
  if (blockingRoot.dataset.ivbContextMenu === "true") {
    return;
  }
  blockingRoot.dataset.ivbContextMenu = "true";
  document.addEventListener("contextmenu", handleBlockedMediaContextMenu, true);
}

function removeContextMenuFallback() {
  if (blockingRoot.dataset.ivbContextMenu !== "true") {
    return;
  }
  delete blockingRoot.dataset.ivbContextMenu;
  document.removeEventListener("contextmenu", handleBlockedMediaContextMenu, true);
}

function handleBlockedMediaContextMenu(event) {
  const media = findBlockedMediaAtPoint(event.clientX, event.clientY);
  if (!media || media.classList.contains("ivb-shown")) {
    lastContextMedia = null;
    return;
  }

  lastContextMedia = media;
}

function findBlockedMediaAtPoint(x, y) {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (
      (el.tagName === "IMG" || el.tagName === "VIDEO") &&
      blockingRoot.classList.contains(BLOCKING_CLASS) &&
      !el.classList.contains("ivb-shown")
    ) {
      return el;
    }
  }
  return null;
}

function revealMedia(srcUrl, mediaType) {
  if (!srcUrl) {
    return false;
  }

  const selector = mediaType === "video" ? "video" : "img";
  const elements = document.querySelectorAll(selector);
  let revealed = false;

  for (const el of elements) {
    if (mediaMatches(el, srcUrl)) {
      el.classList.add("ivb-shown");
      revealedMedia.add(el);
      revealed = true;
    }
  }

  return revealed;
}

function mediaMatches(el, srcUrl) {
  const candidates = [];

  if (el.currentSrc) {
    candidates.push(el.currentSrc);
  }
  if (el.src) {
    candidates.push(el.src);
  }
  if (el.getAttribute("src")) {
    candidates.push(el.getAttribute("src"));
  }

  if (el.tagName === "PICTURE" || el.parentElement?.tagName === "PICTURE") {
    const picture = el.tagName === "PICTURE" ? el : el.parentElement;
    for (const source of picture.querySelectorAll("source")) {
      if (source.srcset) {
        candidates.push(
          ...source.srcset.split(",").map((s) => s.trim().split(/\s+/)[0])
        );
      }
      if (source.src) {
        candidates.push(source.src);
      }
    }
  }

  if (el.tagName === "VIDEO") {
    for (const source of el.querySelectorAll("source")) {
      if (source.src) {
        candidates.push(source.src);
      }
    }
  }

  return candidates.some((candidate) => urlsMatch(candidate, srcUrl));
}

function urlsMatch(a, b) {
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }

  try {
    const urlA = new URL(a, window.location.href);
    const urlB = new URL(b, window.location.href);
    return (
      urlA.href === urlB.href ||
      urlA.origin + urlA.pathname === urlB.origin + urlB.pathname
    );
  } catch {
    return false;
  }
}
