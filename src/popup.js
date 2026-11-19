const toggleSwitch = document.getElementById("toggleSwitch");
const statusPill = document.getElementById("statusPill");
const statusMessage = document.getElementById("statusMessage");
const statusDetail = document.getElementById("statusDetail");
const primaryAction = document.getElementById("primaryAction");
const openOptions = document.getElementById("openOptions");
const siteHint = document.getElementById("siteHint");
const toastEl = document.getElementById("toast");

let toastTimer = null;
let currentHostname = null;
let isSupportedTab = false;
let websites = [];
let blockingState = false;
let isLocked = false;
let currentPageUrl = null;
let advancedRules = [];

const STATUS_PILL_BASE =
  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold";
const STATUS_PILL_COLORS = {
  "is-off": "bg-slate-100 text-slate-600",
  "is-unavailable": "bg-amber-50 text-amber-700",
  "is-allowed": "bg-green-50 text-green-700",
  "is-blocked": "bg-red-800 text-white",
};
const TOAST_BASE =
  "toast pointer-events-none fixed bottom-4 left-1/2 z-[1000] max-w-[90%] rounded-[10px] px-4 py-2 text-center text-[13px] text-white";

document.addEventListener("DOMContentLoaded", async () => {
  await refreshPopupState();
});

toggleSwitch.addEventListener("change", async (event) => {
  if (isLocked) {
    toggleSwitch.checked = blockingState;
    return;
  }

  blockingState = event.target.checked;
  await updateStoredSettings({ blockingState });
  chrome.runtime.sendMessage({ action: "toggleImageHiding" }).catch(() => {});
  renderPopup();
  showToast(blockingState ? "Blocking turned on" : "Blocking turned off");
});

primaryAction.addEventListener("click", async () => {
  if (isLocked || primaryAction.disabled) {
    return;
  }
  const action = primaryAction.dataset.action;
  if (action === "turn-on") {
    toggleSwitch.checked = true;
    toggleSwitch.dispatchEvent(new Event("change"));
    return;
  }

  if (!currentHostname) {
    return;
  }

  if (action === "add-site") {
    websites = [
      ...websites,
      { website: currentHostname, matchSubdomains: false },
    ];
    await updateStoredSettings({ websites });
    chrome.runtime.sendMessage({ action: "websitesUpdated" }).catch(() => {});
    showToast(`Allowed ${currentHostname}`);
    renderPopup();
    return;
  }

  if (action === "remove-site") {
    websites = websites.filter(
      (site) => normalizeDomain(site.website) !== currentHostname
    );
    await updateStoredSettings({ websites });
    chrome.runtime.sendMessage({ action: "websitesUpdated" }).catch(() => {});
    showToast(`Blocked ${currentHostname}`);
    renderPopup();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && IAVB_SETTINGS_KEY in changes) {
    refreshPopupState();
  }
});

openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function refreshPopupState() {
  const tab = await getActiveTab();
  const stored = await getStoredSettings();
  blockingState = stored.blockingState;
  websites = stored.websites;
  isLocked = stored.masterLock !== "unlocked";
  advancedRules = stored.advancedRules;

  isSupportedTab = Boolean(
    tab?.url &&
      (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  );
  currentPageUrl = isSupportedTab ? tab.url : null;
  currentHostname = isSupportedTab ? normalizeDomain(tab.url) : null;

  toggleSwitch.checked = blockingState;
  renderPopup();
}

function renderPopup() {
  const siteListed =
    currentHostname !== null && isSiteInList(currentHostname, websites);
  const decision = evaluateUrlBlocking(currentPageUrl, {
    blockingState,
    websites,
    advancedRules,
  });
  const siteBlocked = decision.blocked;

  siteHint.classList.remove("is-visible");
  primaryAction.disabled = false;
  toggleSwitch.disabled = isLocked;
  statusDetail.textContent = currentHostname
    ? currentHostname
    : isSupportedTab
      ? ""
      : "This page type cannot be blocked.";

  if (!blockingState) {
    if (isLocked) {
      setStatus(
        "is-off",
        "Locked",
        "Unlock in options to change blocking",
        "Locked",
        null
      );
      primaryAction.disabled = true;
    } else {
      setStatus(
        "is-off",
        "Off",
        "Blocking is off",
        "Turn on blocking",
        "turn-on"
      );
    }
    return;
  }

  if (!isSupportedTab) {
    setStatus(
      "is-unavailable",
      "Unavailable",
      "Cannot block this page",
      "Unavailable",
      null
    );
    primaryAction.disabled = true;
    return;
  }

  if (decision.rule) {
    setStatus(
      siteBlocked ? "is-blocked" : "is-allowed",
      siteBlocked ? "Restricted" : "Unblocked",
      siteBlocked ? "Blocking images and videos" : "Not blocking this page",
      "Rule Controlled",
      null,
    );
    primaryAction.disabled = true;
    siteHint.classList.toggle("is-visible", siteBlocked);
    return;
  }

  if (isLocked) {
    setStatus(
      siteBlocked ? "is-blocked" : "is-allowed",
      siteBlocked ? "Restricted" : "Unblocked",
      siteBlocked ? "Blocking images and videos" : "Not blocking this site",
      "Locked",
      null
    );
    primaryAction.disabled = true;
    if (siteBlocked) {
      siteHint.classList.add("is-visible");
    }
    return;
  }

  const { label, action } = getSiteAction(siteListed);

  if (siteBlocked) {
    setStatus(
      "is-blocked",
      "Restricted",
      "Blocking images and videos",
      label,
      action
    );
    siteHint.classList.add("is-visible");
    return;
  }

  setStatus("is-allowed", "Unblocked", "Not blocking this site", label, action);
}

function getSiteAction(siteListed) {
  if (!siteListed) {
    return {
      label: "Allow this site",
      action: "add-site",
    };
  }

  return {
    label: "Block this site",
    action: "remove-site",
  };
}

function setStatus(pillClass, pillText, message, buttonLabel, action) {
  statusPill.className = `${STATUS_PILL_BASE} ${STATUS_PILL_COLORS[pillClass]}`;
  statusPill.textContent = pillText;
  statusMessage.textContent = message;
  primaryAction.textContent = buttonLabel;
  if (action) {
    primaryAction.dataset.action = action;
  } else {
    delete primaryAction.dataset.action;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showToast(message, type = "success") {
  toastEl.textContent = message;
  const color = type === "error" ? "bg-red-700" : "bg-green-700";
  toastEl.className = `${TOAST_BASE} ${color} opacity-100 is-visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = `${TOAST_BASE} ${color} opacity-0`;
  }, 1800);
}
