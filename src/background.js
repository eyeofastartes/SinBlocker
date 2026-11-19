importScripts("domain.js", "url_rules.js", "safesearch.js", "site_categories.js", "default_sites.js", "store.js");

const CONTEXT_MENU_IMAGE = "ivb-show-image";
const CONTEXT_MENU_VIDEO = "ivb-show-video";
const PREHIDE_SCRIPT_ID = "ivb-prehide";
let prehideSync = Promise.resolve();
let safeSearchSync = Promise.resolve();

chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.tabs.onActivated.addListener(handleTabActivated);
chrome.storage.onChanged.addListener(handleStorageChanged);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.commands.onCommand.addListener(handleCommand);
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

createContextMenus();
queuePrehideRegistrationSync();
queueSafeSearchRulesSync();
updateBadge();

async function handleInstalled(details) {
  createContextMenus();
  await Promise.all([
    queuePrehideRegistrationSync(),
    queueSafeSearchRulesSync(),
  ]);

  if (details.reason === "install") {
    const { onboardingComplete } = await getStoredSettings();
    if (!onboardingComplete) {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }
  }

  updateBadge();
}

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.warn("contextMenus.removeAll:", chrome.runtime.lastError.message);
    }

    chrome.contextMenus.create(
      {
        id: CONTEXT_MENU_IMAGE,
        title: "SinBlocker: Show image",
        contexts: ["image"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("contextMenus.create image:", chrome.runtime.lastError.message);
        }
      }
    );

    chrome.contextMenus.create(
      {
        id: CONTEXT_MENU_VIDEO,
        title: "SinBlocker: Show video",
        contexts: ["video"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("contextMenus.create video:", chrome.runtime.lastError.message);
        }
      }
    );
  });
}

if (chrome.contextMenus.onShown) {
  chrome.contextMenus.onShown.addListener(async (info, tab) => {
    const visible = await shouldShowContextMenus(tab);
    chrome.contextMenus.update(CONTEXT_MENU_IMAGE, { visible });
    chrome.contextMenus.update(CONTEXT_MENU_VIDEO, { visible });
  });
}

async function shouldShowContextMenus(tab) {
  if (!tab?.url) {
    return false;
  }

  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
    return false;
  }

  const settings = await getStoredSettings();
  return evaluateUrlBlocking(tab.url, settings).blocked;
}

async function handleContextMenuClick(info, tab) {
  if (
    info.menuItemId !== CONTEXT_MENU_IMAGE &&
    info.menuItemId !== CONTEXT_MENU_VIDEO
  ) {
    return;
  }

  if (!tab?.id || !tab.url) {
    return;
  }

  const settings = await getStoredSettings();
  if (!evaluateUrlBlocking(tab.url, settings).blocked) {
    return;
  }

  const mediaType =
    info.menuItemId === CONTEXT_MENU_VIDEO || info.mediaType === "video"
      ? "video"
      : "image";

  await sendTabMessage(tab.id, {
    action: "showMedia",
    srcUrl: info.srcUrl,
    mediaType,
  });
}

async function handleStorageChanged(changes, areaName) {
  if (areaName !== "local") {
    return;
  }

  if (!(IAVB_SETTINGS_KEY in changes)) {
    return;
  }

  await Promise.all([
    queuePrehideRegistrationSync(),
    queueSafeSearchRulesSync(),
  ]);
  const settings = await getStoredSettings();

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      updateContentScript(tab, settings);
    }
  });

  updateBadge();
}

function queuePrehideRegistrationSync() {
  prehideSync = prehideSync
    .catch((error) => console.error("Pre-hide registration:", error))
    .then(synchronizePrehideRegistration);
  return prehideSync;
}

function queueSafeSearchRulesSync() {
  safeSearchSync = safeSearchSync
    .catch((error) => console.error("SafeSearch rules:", error))
    .then(synchronizeSafeSearchRules);
  return safeSearchSync;
}

async function synchronizeSafeSearchRules() {
  const settings = await getStoredSettings();
  const enabledRulesetIds = new Set(getSafeSearchRulesetIds(settings));
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [...enabledRulesetIds],
    disableRulesetIds: SAFE_SEARCH_RULESET_IDS.filter(
      (rulesetId) => !enabledRulesetIds.has(rulesetId)
    ),
  });
}

async function synchronizePrehideRegistration() {
  const settings = await getStoredSettings();
  const registration = buildPrehideRegistration(settings);
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [PREHIDE_SCRIPT_ID],
  });

  if (!registration) {
    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [PREHIDE_SCRIPT_ID] });
    }
    return;
  }

  if (existing.length > 0) {
    await chrome.scripting.updateContentScripts([registration]);
  } else {
    await chrome.scripting.registerContentScripts([registration]);
  }
}

function buildPrehideRegistration(settings) {
  if (!settings.blockingState) {
    return null;
  }

  return {
    id: PREHIDE_SCRIPT_ID,
    js: ["prehide.js"],
    matches: ["*://*/*"],
    excludeMatches: settings.advancedRules.some((rule) => rule.enabled)
      ? []
      : getSiteMatchPatterns(settings.websites),
    runAt: "document_start",
    persistAcrossSessions: true,
  };
}

function getSiteMatchPatterns(websites) {
  const patterns = new Set();

  for (const site of normalizeWebsites(websites)) {
    const hostname = normalizeDomain(site.website);
    if (!hostname) {
      continue;
    }

    const isIpAddress = hostname.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    if (site.matchSubdomains && !isIpAddress) {
      patterns.add(`*://*.${hostname}/*`);
    } else {
      patterns.add(`*://${hostname}/*`);
      if (!isIpAddress) {
        patterns.add(`*://www.${hostname}/*`);
      }
    }
  }

  return [...patterns];
}

function handleMessage(request, sender, sendResponse) {
  (async () => {
    const settings = await getStoredSettings();
    if (request.action === "toggleImageHiding") {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (activeTab) {
        updateContentScript(activeTab, settings);
      }
      updateBadge();
    } else if (request.action === "websitesUpdated") {
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          updateContentScript(tab, settings);
        }
      });
    } else if (request.action === "getBlockingState") {
      sendResponse({ blockingState: await getBlockingState() });
    } else if (request.action === "getWebsites") {
      sendResponse({ websites: settings.websites });
    }
  })();
  return true;
}

async function handleCommand(command) {
  if (command === "toggle_image_blocking") {
    const { blockingState, masterLock } = await getStoredSettings();
    if (masterLock !== "unlocked") {
      return;
    }
    await setBlockingState(!blockingState);
    const settings = await getStoredSettings();
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        updateContentScript(tab, settings);
      }
    });
    updateBadge(!blockingState);
  }
}

async function handleTabUpdate(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete") {
    const settings = await getStoredSettings();
    updateContentScript(tab, settings);
  }
}

async function handleTabActivated() {
  updateBadge();
}

async function getWebsites() {
  const settings = await getStoredSettings();
  return settings.websites;
}

async function updateContentScript(tab, settings) {
  if (!tab?.id || !tab.url) {
    return;
  }

  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
    return;
  }

  if (!Array.isArray(settings.websites)) {
    console.error("Unexpected data type for websites:", settings.websites);
    return;
  }

  const decision = evaluateUrlBlocking(tab.url, settings);

  await sendTabMessage(tab.id, {
    action: decision.blocked ? "hide" : "show",
    blockingState: settings.blockingState,
  });
}

async function sendTabMessage(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script is not injected yet or the tab cannot host extensions.
  }
}

async function getBlockingState() {
  const settings = await getStoredSettings();
  return settings.blockingState;
}

async function setBlockingState(blockingState) {
  await updateStoredSettings({ blockingState });
}

async function updateBadge(explicitState) {
  const blockingState =
    typeof explicitState === "boolean"
      ? explicitState
      : await getBlockingState();

  if (blockingState) {
    await chrome.action.setBadgeText({ text: "on" });
    await chrome.action.setBadgeBackgroundColor({ color: "#035f00" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}
