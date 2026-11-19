const formError = document.getElementById("formError");
const emptyState = document.getElementById("emptyState");
const websitesInnerContainer = document.getElementById(
  "websitesInnerContainer"
);
const removeAllContainer = document.getElementById(
  "removeAllWebsitesContainer"
);
const toastEl = document.getElementById("toast");
const optionsPage = document.getElementById("optionsPage");
const lockScreen = document.getElementById("lockScreen");
const unlockForm = document.getElementById("unlockForm");
const masterPasswordInput = document.getElementById("masterPassword");
const unlockError = document.getElementById("unlockError");
const setPasswordModal = document.getElementById("setPasswordModal");
const setPasswordForm = document.getElementById("setPasswordForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const setPasswordError = document.getElementById("setPasswordError");
const cancelSetPassword = document.getElementById("cancelSetPassword");
const bulkViewBtn = document.getElementById("bulkViewBtn");
const bulkEditor = document.getElementById("bulkEditor");
const bulkWebsites = document.getElementById("bulkWebsites");
const bulkEditorError = document.getElementById("bulkEditorError");
const siteSearch = document.getElementById("siteSearch");
const siteSearchContainer = document.getElementById("siteSearchContainer");
const searchResults = document.getElementById("searchResults");
const siteCount = document.getElementById("siteCount");
const sectionLinks = document.querySelectorAll('nav[aria-label="Settings sections"] a');
let modalReturnFocus = null;
let toastTimer = null;
let optionsUnlocked = false;
let renderedWebsites = [];
let draftUrlRules = [];
let savingUrlRules = false;
const urlRulesList = document.getElementById("urlRulesList");
const urlRulesError = document.getElementById("urlRulesError");
const saveUrlRules = document.getElementById("saveUrlRules");
const addUrlRule = document.getElementById("addUrlRule");
const challengeSettings = document.getElementById("challengeSettings");
const challengeDifficulty = document.getElementById("challengeDifficulty");
const challengeQuestions = document.getElementById("challengeQuestions");
const challengeForm = document.getElementById("challengeForm");
const challengeAnswer = document.getElementById("challengeAnswer");
const challengeDoors = document.getElementById("challengeDoors");
const challengePrompt = document.getElementById("challengePrompt");
const challengeTitle = document.getElementById("challengeTitle");
const challengeDescription = document.getElementById("challengeDescription");
const challengeProgress = document.getElementById("challengeProgress");
const challengeError = document.getElementById("challengeError");
const challengeConfirm = document.getElementById("challengeConfirm");
let currentLock = "unlocked";
let challengeSession = null;
let savingProtection = false;

const DEFAULT_CATEGORY = {
  label: "Manual",
  color: "#64748b",
  sites: [],
};

const TOAST_BASE =
  "toast pointer-events-none fixed bottom-4 left-1/2 z-[1000] max-w-[90%] rounded-[10px] px-4 py-2 text-center text-[13px] text-white";

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await getStoredSettings();
  currentLock = stored.masterLock;
  const isLocked = currentLock !== "unlocked";
  optionsUnlocked = !isLocked;
  challengeDifficulty.value = stored.challengeDifficulty;
  challengeQuestions.value = stored.challengeQuestions;

  setMasterLockRadio(currentLock);
  if (isLocked) {
    lockScreen.classList.add("is-visible");
    optionsPage.hidden = true;
    unlockForm.hidden = currentLock === "challenge";
    challengeForm.hidden = currentLock !== "challenge";
    if (currentLock === "challenge") {
      challengeSession = {
        difficulty: stored.challengeDifficulty,
        total: stored.challengeQuestions,
        completed: 0,
        answer: null,
      };
      nextChallengeQuestion();
    } else {
      masterPasswordInput.focus();
    }
  } else {
    lockScreen.classList.remove("is-visible");
    optionsPage.hidden = false;
  }

  renderSafeSearchSettings(stored.safeSearch);
  draftUrlRules = stored.advancedRules.map((rule) => ({
    ...rule,
    groups: Array.isArray(rule.groups) && rule.groups.length
      ? rule.groups.map((group) => Array.isArray(group) ? group : (group.conditions || [createEmptyCondition()]))
      : createEmptyRuleGroups(),
  }));
  renderUrlRules();

  renderWebsiteList(stored.websites);
});

document.querySelectorAll('input[name="safeSearchEnabled"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    if (!requireUnlocked() || !radio.checked) {
      return;
    }
    await updateSafeSearchSettings({ enabled: radio.value === "true" });
    showToast(radio.value === "true" ? "SafeSearch enforced" : "SafeSearch off");
  });
});

document.querySelectorAll('input[name="safeSearchLevel"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    if (!requireUnlocked() || !radio.checked) {
      return;
    }
    await updateSafeSearchSettings({ level: radio.value });
    showToast(`${radio.value === "strict" ? "Strict" : "Moderate"} filtering on`);
  });
});

document.querySelectorAll('input[name="safeSearchEngine"]').forEach((checkbox) => {
  checkbox.addEventListener("change", async () => {
    if (!requireUnlocked()) {
      checkbox.checked = !checkbox.checked;
      return;
    }
    const engines = Array.from(
      document.querySelectorAll('input[name="safeSearchEngine"]:checked')
    ).map((input) => input.value);
    await updateSafeSearchSettings({ engines });
    showToast("SafeSearch engines updated");
  });
});

unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  unlockError.textContent = "";

  if (currentLock !== "locked") {
    return;
  }
  const password = masterPasswordInput.value;
  if (!password) {
    unlockError.textContent = "Enter your master password.";
    return;
  }

  const valid = await verifyMasterPassword(password);
  if (!valid) {
    unlockError.textContent = "Incorrect password.";
    return;
  }

  optionsUnlocked = true;
  masterPasswordInput.value = "";
  lockScreen.classList.remove("is-visible");
  optionsPage.hidden = false;
  document.getElementById("newWebsite").focus();
});

document.querySelectorAll('input[name="masterLock"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    if (!requireUnlocked() || !radio.checked || savingProtection) {
      setMasterLockRadio(currentLock);
      return;
    }

    if (radio.value === "locked") {
      openSetPasswordModal();
      return;
    }
    if (currentLock === "locked" && !window.confirm(
      "Changing protection will remove your password. Continue?",
    )) {
      setMasterLockRadio(currentLock);
      return;
    }
    const nextLock = radio.value;
    savingProtection = true;
    try {
      await updateStoredSettings({
        masterLock: nextLock,
        masterLockHash: null,
        masterLockSalt: null,
      });
      currentLock = nextLock;
      showToast(nextLock === "challenge" ? "Challenge lock enabled" : "Master lock turned off");
    } catch {
      showToast("Could not save protection settings", "error");
    } finally {
      savingProtection = false;
      setMasterLockRadio(currentLock);
    }
  });
});

cancelSetPassword.addEventListener("click", () => {
  setMasterLockRadio(currentLock);
  closeSetPasswordModal();
});

setPasswordModal.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelSetPassword.click();
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const controls = Array.from(
    setPasswordModal.querySelectorAll("input, button"),
  ).filter((control) => !control.disabled);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

siteSearch.addEventListener("input", filterWebsiteList);

sectionLinks.forEach((link) => {
  link.addEventListener("click", () => setActiveSection(link.hash));
});

window.addEventListener("hashchange", () => setActiveSection(window.location.hash));
setActiveSection(window.location.hash || "#sites");

function setActiveSection(hash) {
  const activeHash = ["#sites", "#url-rules", "#safesearch", "#security"].includes(hash)
    ? hash
    : "#sites";
  sectionLinks.forEach((link) => {
    if (link.hash === activeHash) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

setPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireUnlocked()) {
    return;
  }
  setPasswordError.textContent = "";

  const password = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!password) {
    setPasswordError.textContent = "Enter a password.";
    return;
  }
  if (password !== confirmPassword) {
    setPasswordError.textContent = "Passwords do not match.";
    return;
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  await updateStoredSettings({
    masterLock: "locked",
    masterLockHash: hash,
    masterLockSalt: salt,
  });

  currentLock = "locked";
  setMasterLockRadio(currentLock);
  closeSetPasswordModal();
  showToast("Master lock enabled");
});

document
  .getElementById("addWebsiteForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireUnlocked()) {
      return;
    }
    formError.textContent = "";

    const newWebsiteInput = document.getElementById("newWebsite");
    const matchSubdomainsCheckbox = document.getElementById(
      "matchSubdomainsCheckbox"
    );
    const raw = newWebsiteInput.value.trim();
    const newWebsite = normalizeDomain(raw);

    if (!newWebsite) {
      formError.textContent =
        "Enter a valid domain like example.com or https://example.com";
      return;
    }

    const websites = await getWebsites();
    const alreadyExists = websites.some(
      (site) => normalizeDomain(site.website) === newWebsite
    );
    if (alreadyExists) {
      formError.textContent = `${newWebsite} is already in your list.`;
      return;
    }

    const siteObj = {
      website: newWebsite,
      matchSubdomains: matchSubdomainsCheckbox.checked,
    };

    await addWebsiteToStorage(siteObj);
    renderWebsiteList([...websites, siteObj]);
    newWebsiteInput.value = "";
    matchSubdomainsCheckbox.checked = false;
    showToast(`Added ${newWebsite}`);
  });

document
  .getElementById("addDefaultSitesBtn")
  .addEventListener("click", applyDefaultSites);

bulkViewBtn.addEventListener("click", async () => {
  setSiteListView(bulkEditor.classList.contains("is-visible") ? "grid" : "bulk");
});

document
  .getElementById("saveBulkWebsitesBtn")
  .addEventListener("click", saveBulkWebsites);

document
  .getElementById("removeAllWebsitesBtn")
  .addEventListener("click", async () => {
    if (!requireUnlocked()) {
      return;
    }
    if (!confirm("Are you sure you want to remove all websites?")) {
      return;
    }
    await removeAllWebsitesFromStorage();
    renderWebsiteList([]);
    showToast("Removed all sites");
  });

async function getWebsites() {
  const settings = await getStoredSettings();
  return settings.websites;
}

function renderSafeSearchSettings(safeSearch) {
  const enabledRadio = document.querySelector(
    `input[name="safeSearchEnabled"][value="${safeSearch.enabled}"]`
  );
  const levelRadio = document.querySelector(
    `input[name="safeSearchLevel"][value="${safeSearch.level}"]`
  );
  if (enabledRadio) {
    enabledRadio.checked = true;
  }
  if (levelRadio) {
    levelRadio.checked = true;
  }

  document.querySelectorAll('input[name="safeSearchEngine"]').forEach((checkbox) => {
    checkbox.checked = safeSearch.engines.includes(checkbox.value);
  });
}

async function updateSafeSearchSettings(patch) {
  if (!requireUnlocked()) {
    return;
  }
  const settings = await getStoredSettings();
  await updateStoredSettings({
    safeSearch: {
      ...settings.safeSearch,
      ...patch,
    },
  });
}

async function applyDefaultSites() {
  if (!requireUnlocked()) {
    return;
  }

  const websites = await getWebsites();
  const existingDomains = new Set(
    websites.map((site) => normalizeDomain(site.website))
  );
  const newSites = DEFAULT_SITES.filter(
    (domain) => !existingDomains.has(domain)
  ).map((domain) => ({
    website: domain,
    matchSubdomains: true,
  }));

  if (newSites.length === 0) {
    showToast("All default sites are already in your list.", "error");
    return;
  }

  const confirmed = confirm(
    `Add ${newSites.length} default site${newSites.length === 1 ? "" : "s"} to your list?`
  );
  if (!confirmed) {
    return;
  }

  const updatedWebsites = [...websites, ...newSites];
  await updateStoredSettings({ websites: updatedWebsites });
  notifyBackgroundScript();
  renderWebsiteList(updatedWebsites);
  showToast(`Added ${newSites.length} site${newSites.length === 1 ? "" : "s"}`);
}

function getSiteCategory(website) {
  const normalizedWebsite = normalizeDomain(website);
  return (
    Object.values(SITE_CATEGORIES).find((category) =>
      category.sites.includes(normalizedWebsite)
    ) || DEFAULT_CATEGORY
  );
}

function createCategorySection(category) {
  const section = document.createElement("section");
  section.className = "site-category is-collapsed flex flex-col gap-2.5";
  section.style.setProperty("--category-color", category.color);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className =
    "site-category-toggle inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0";
  toggle.setAttribute("aria-expanded", "false");

  const title = document.createElement("span");
  title.className = "site-category-title";
  title.textContent = category.label;

  const chevron = document.createElement("span");
  chevron.className = "site-category-chevron";
  chevron.setAttribute("aria-hidden", "true");

  toggle.append(title, chevron);

  const grid = document.createElement("div");
  grid.className = "site-category-grid flex-wrap gap-2";

  toggle.addEventListener("click", () => {
    const collapsed = section.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
  });

  section.append(toggle, grid);
  return { section, grid };
}

function renderWebsiteList(websites) {
  renderedWebsites = websites.map((site) => ({ ...site }));
  websitesInnerContainer.replaceChildren();
  const categorySections = new Map();

  for (const websiteObj of renderedWebsites) {
    const category = getSiteCategory(websiteObj.website);
    if (!categorySections.has(category.label)) {
      const categorySection = createCategorySection(category);
      categorySections.set(category.label, categorySection);
      if (category.label === DEFAULT_CATEGORY.label) {
        websitesInnerContainer.prepend(categorySection.section);
      } else {
        websitesInnerContainer.appendChild(categorySection.section);
      }
    }
    addWebsiteToUI(websiteObj, categorySections.get(category.label).grid);
  }

  renderBulkEditor(renderedWebsites);
  updateEmptyState();
  filterWebsiteList();
}

function filterWebsiteList() {
  const query = siteSearch.value.trim().toLowerCase();
  let visibleCount = 0;
  websitesInnerContainer.querySelectorAll(".site-category").forEach((section) => {
    const category = section.querySelector(".site-category-title").textContent.toLowerCase();
    let categoryCount = 0;
    section.querySelectorAll(".website").forEach((row) => {
      const matches = row.dataset.domain.toLowerCase().includes(query) || category.includes(query);
      row.hidden = !matches;
      if (matches) {
        categoryCount += 1;
      }
    });
    section.hidden = categoryCount === 0;
    if (query && categoryCount > 0) {
      section.classList.remove("is-collapsed");
      section.querySelector(".site-category-toggle").setAttribute("aria-expanded", "true");
    }
    visibleCount += categoryCount;
  });
  searchResults.hidden = !query;
  searchResults.textContent = visibleCount === 0
    ? "No matching sites. Try another domain or category."
    : `${visibleCount} of ${renderedWebsites.length} sites shown`;
}

function renderBulkEditor(websites) {
  bulkWebsites.value = websites.map((site) => site.website).join("\n");
  bulkEditorError.textContent = "";
}

function addWebsiteToUI(websiteObj, container) {
  const { website, matchSubdomains } = websiteObj;
  const websiteDiv = document.createElement("div");
  websiteDiv.className =
    "website inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5";
  websiteDiv.dataset.domain = website;

  const domainSpan = document.createElement("span");
  domainSpan.className = "whitespace-nowrap font-semibold";
  domainSpan.textContent = website;
  domainSpan.title = website;

  const subdomainLabel = document.createElement("span");
  if (matchSubdomains) {
    subdomainLabel.className =
      "inline-block rounded-full bg-blue-50 px-[0.45rem] py-[0.1rem] text-[10px] font-semibold text-blue-600";
    subdomainLabel.textContent = "S";
    subdomainLabel.title = "Matches subdomains";
  } else {
    subdomainLabel.className =
      "inline-block rounded-full bg-orange-50 px-[0.45rem] py-[0.1rem] text-[10px] font-semibold text-amber-700";
    subdomainLabel.textContent = "E";
    subdomainLabel.title = "Matches exact host only";
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className =
    "inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-transparent p-0 text-base leading-none text-slate-600 min-h-5 -mt-0.5 -mr-1 -mb-0.5 hover:bg-red-50 hover:text-red-700";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", `Remove ${website}`);
  removeBtn.addEventListener("click", async () => {
    if (!requireUnlocked()) {
      return;
    }
    await removeWebsiteFromStorage(websiteObj);
    renderWebsiteList(
      renderedWebsites.filter(
        (site) => normalizeDomain(site.website) !== normalizeDomain(website)
      )
    );
    showToast(`Removed ${website}`);
  });

  websiteDiv.append(domainSpan, subdomainLabel, removeBtn);
  container.appendChild(websiteDiv);
}

function setSiteListView(view) {
  const showBulkEditor = view === "bulk";
  websitesInnerContainer.hidden = showBulkEditor;
  siteSearchContainer.hidden = showBulkEditor;
  emptyState.hidden = showBulkEditor;
  bulkEditor.classList.toggle("is-visible", showBulkEditor);
  bulkViewBtn.classList.toggle("is-active", showBulkEditor);
  bulkViewBtn.setAttribute("aria-pressed", String(showBulkEditor));
  bulkViewBtn.textContent = showBulkEditor ? "View sites" : "Bulk edit";
  if (showBulkEditor) {
    getWebsites().then((websites) => {
      renderBulkEditor(websites);
      bulkWebsites.focus();
    });
  }
}

async function saveBulkWebsites() {
  if (!requireUnlocked()) {
    return;
  }

  bulkEditorError.textContent = "";
  const currentWebsites = await getWebsites();
  const existingByDomain = new Map(
    currentWebsites.map((site) => [normalizeDomain(site.website), site])
  );
  const seenDomains = new Set();
  const websites = [];
  const invalidLines = [];

  let duplicateCount = 0;
  for (const [index, raw] of bulkWebsites.value.split(/\r?\n/).entries()) {
    if (!raw.trim()) {
      continue;
    }
    const website = normalizeDomain(raw);
    if (!website) {
      invalidLines.push(index + 1);
      continue;
    }
    if (seenDomains.has(website)) {
      duplicateCount += 1;
      continue;
    }
    seenDomains.add(website);
    const existing = existingByDomain.get(website);
    websites.push({
      website,
      matchSubdomains: existing ? existing.matchSubdomains : true,
    });
  }

  if (invalidLines.length > 0) {
    bulkEditorError.textContent = `Invalid domain on line${
      invalidLines.length === 1 ? "" : "s"
    } ${invalidLines.join(", ")}.`;
    return;
  }

  await updateStoredSettings({ websites });
  notifyBackgroundScript();
  renderWebsiteList(websites);
  showToast(
    duplicateCount > 0
      ? `Saved ${websites.length} sites and removed ${duplicateCount} duplicate${
          duplicateCount === 1 ? "" : "s"
        }`
      : `Saved ${websites.length} site${websites.length === 1 ? "" : "s"}`
  );
}

async function addWebsiteToStorage(website) {
  if (!requireUnlocked()) {
    return;
  }
  const websites = await getWebsites();
  websites.push(website);
  await updateStoredSettings({ websites });
  notifyBackgroundScript();
}

async function removeWebsiteFromStorage(website) {
  if (!requireUnlocked()) {
    return;
  }
  const websites = await getWebsites();
  const updatedWebsites = websites.filter(
    (site) => normalizeDomain(site.website) !== normalizeDomain(website.website)
  );
  await updateStoredSettings({ websites: updatedWebsites });
  notifyBackgroundScript();
}

async function removeAllWebsitesFromStorage() {
  if (!requireUnlocked()) {
    return;
  }
  await updateStoredSettings({ websites: [] });
  notifyBackgroundScript();
}

function notifyBackgroundScript() {
  chrome.runtime.sendMessage({ action: "websitesUpdated" }).catch(() => {});
}

function updateEmptyState() {
  const count = renderedWebsites.length;
  const hasSites = count > 0;
  siteCount.textContent = `${count} site${count === 1 ? "" : "s"}`;
  emptyState.classList.toggle("is-visible", !hasSites);
  removeAllContainer.classList.toggle("is-visible", hasSites);
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

addUrlRule.addEventListener("click", () => {
  if (!requireUnlocked() || savingUrlRules || draftUrlRules.length >= URL_RULE_LIMIT) {
    return;
  }
  draftUrlRules.push({
    id: crypto.randomUUID(),
    enabled: true,
    action: "block",
    groups: createEmptyRuleGroups(),
  });
  renderUrlRules();
});

document.getElementById("urlRulesForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireUnlocked() || savingUrlRules || !validateUrlRuleDraft()) {
    return;
  }
  savingUrlRules = true;
  renderUrlRules();
  try {
    await updateStoredSettings({ advancedRules: draftUrlRules });
    notifyBackgroundScript();
    showToast("URL rules saved");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    savingUrlRules = false;
    renderUrlRules();
  }
});

function validateUrlRuleDraft() {
  try {
    validateAdvancedRules(draftUrlRules);
    urlRulesError.textContent = "";
    saveUrlRules.disabled = savingUrlRules;
    return true;
  } catch (error) {
    urlRulesError.textContent = error.message;
    saveUrlRules.disabled = true;
    return false;
  }
}

const RULE_OPERATOR_LABELS = {
  wildcard: "wildcard",
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
};

function createEmptyRuleGroups() {
  return [[createEmptyCondition()]];
}

function createEmptyCondition() {
  return { field: "host", operator: "wildcard", value: "" };
}

function select(options, current, ariaLabel) {
  const element = document.createElement("select");
  element.className = "rounded-[10px] border border-slate-200 bg-white px-3 py-2";
  element.setAttribute("aria-label", ariaLabel);
  for (const { value, label } of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    element.appendChild(option);
  }
  element.value = current;
  return element;
}

function renderUrlRules() {
  urlRulesList.replaceChildren();
  document.getElementById("urlRulesEmpty").hidden = draftUrlRules.length !== 0;
  addUrlRule.disabled = savingUrlRules || draftUrlRules.length >= URL_RULE_LIMIT;
  draftUrlRules.forEach((rule, index) => {
    const ruleRow = document.createElement("div");
    ruleRow.className = "rounded-xl border border-slate-200 p-3";
    const header = document.createElement("div");
    header.className = "mb-3 flex flex-wrap items-center gap-3";
    const title = document.createElement("span");
    title.textContent = `Rule ${index + 1}`;
    title.className = "font-semibold";
    const enabledLabel = document.createElement("label");
    enabledLabel.className = "inline-flex items-center gap-2 text-[13px]";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = rule.enabled;
    enabledLabel.append(enabled, document.createTextNode("Enabled"));

    const action = select(
      [{ value: "allow", label: "Allow media" }, { value: "block", label: "Block media" }],
      rule.action,
      `Rule ${index + 1} action`
    );

    const updateRule = () => {
      if (!requireUnlocked() || savingUrlRules) {
        renderUrlRules();
        return;
      }
      rule.enabled = enabled.checked;
      rule.action = action.value;
      validateUrlRuleDraft();
    };
    enabled.addEventListener("change", updateRule);
    action.addEventListener("change", updateRule);

    header.append(title, enabledLabel, action);
    for (const [label, offset] of [["Move up", -1], ["Move down", 1], ["Delete", 0]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-50";
      button.textContent = label;
      button.setAttribute("aria-label", `${label} rule ${index + 1}`);
      button.disabled = savingUrlRules || (offset !== 0 && !draftUrlRules[index + offset]);
      button.addEventListener("click", () => {
        if (!requireUnlocked() || savingUrlRules) {
          return;
        }
        if (offset === 0) {
          draftUrlRules.splice(index, 1);
        } else {
          [draftUrlRules[index], draftUrlRules[index + offset]] =
            [draftUrlRules[index + offset], draftUrlRules[index]];
        }
        renderUrlRules();
      });
      header.appendChild(button);
    }

    const groups = document.createElement("div");
    groups.className = "flex flex-col gap-2.5";
    const groupLabel = document.createElement("span");
    groupLabel.className = "text-xs font-semibold text-slate-600";
    groupLabel.textContent = "Rule expression";
    const groupHint = document.createElement("span");
    groupHint.className = "text-xs text-slate-600";
    groupHint.textContent = "Conditions on a line are combined with And. Or starts a new line.";
    groups.append(groupLabel, groupHint);

    rule.groups.forEach((group, groupIndex) => {
      groups.appendChild(renderRuleGroup(rule, group, index, groupIndex));
      if (groupIndex < rule.groups.length - 1) {
        const orDivider = document.createElement("div");
        orDivider.className = "text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400";
        orDivider.textContent = "or";
        groups.appendChild(orDivider);
      }
    });

    enabled.disabled = action.disabled = savingUrlRules;
    ruleRow.append(header, groups);
    urlRulesList.appendChild(ruleRow);
  });
  validateUrlRuleDraft();
}

function renderRuleGroup(rule, group, ruleIndex, groupIndex) {
  const box = document.createElement("div");
  box.className = "rounded-xl bg-slate-50 p-3";

  const list = document.createElement("div");
  list.className = "flex flex-col gap-2";
  group.forEach((condition, conditionIndex) => {
    list.appendChild(
      renderRuleCondition(rule, group, condition, ruleIndex, groupIndex, conditionIndex)
    );
  });

  box.append(list);
  return box;
}

function renderRuleCondition(rule, group, condition, ruleIndex, groupIndex, conditionIndex) {
  const row = document.createElement("div");
  row.className = "flex flex-wrap items-center gap-2";
  const field = select(
    [
      { value: "host", label: "Host" },
      { value: "path", label: "Path" },
      { value: "query", label: "Query" },
    ],
    condition.field,
    `Condition ${conditionIndex + 1} field`
  );
  const operator = select(
    ADVANCED_RULE_OPERATORS.map((value) => ({ value, label: RULE_OPERATOR_LABELS[value] })),
    condition.operator,
    `Condition ${conditionIndex + 1} operator`
  );
  const value = document.createElement("input");
  value.type = "text";
  value.className = "rounded-[10px] border border-slate-200 bg-white px-3 py-2 flex-[1_1_160px]";
  value.value = condition.value;
  value.maxLength = URL_RULE_VALUE_LIMIT;
  value.placeholder = condition.field === "host" ? "example.com" : "value";
  value.spellcheck = false;
  value.setAttribute("aria-label", `Rule ${ruleIndex + 1} line ${groupIndex + 1} value ${conditionIndex + 1}`);

  const updateCondition = () => {
    if (!requireUnlocked() || savingUrlRules) {
      renderUrlRules();
      return;
    }
    condition.field = field.value;
    condition.operator = operator.value;
    condition.value = value.value;
    value.placeholder = condition.field === "host" ? "example.com" : "value";
    validateUrlRuleDraft();
  };
  field.addEventListener("change", updateCondition);
  operator.addEventListener("change", updateCondition);
  value.addEventListener("input", updateCondition);

  const andConditionButton = document.createElement("button");
  andConditionButton.type = "button";
  andConditionButton.className = "rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50";
  andConditionButton.textContent = "and";
  andConditionButton.setAttribute(
    "aria-label",
    `Add condition after condition ${conditionIndex + 1} in line ${groupIndex + 1}`
  );
  andConditionButton.title = "Add a condition below";
  andConditionButton.disabled = savingUrlRules || group.length >= URL_RULE_CONDITION_LIMIT;
  andConditionButton.addEventListener("click", () => {
    if (!requireUnlocked() || savingUrlRules) {
      return;
    }
    group.splice(conditionIndex + 1, 0, createEmptyCondition());
    renderUrlRules();
  });

  const isLastCondition =
    groupIndex === rule.groups.length - 1 && conditionIndex === group.length - 1;

  const orConditionButton = document.createElement("button");
  orConditionButton.type = "button";
  orConditionButton.className = "rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50";
  orConditionButton.textContent = "or";
  orConditionButton.setAttribute("aria-label", "Add a condition line");
  orConditionButton.title = "Start a new condition line";
  orConditionButton.hidden = !isLastCondition;
  orConditionButton.disabled = savingUrlRules || rule.groups.length >= URL_RULE_GROUP_LIMIT;
  orConditionButton.addEventListener("click", () => {
    if (!requireUnlocked() || savingUrlRules) {
      return;
    }
    rule.groups.push([createEmptyCondition()]);
    renderUrlRules();
  });

  const isFirstCondition = conditionIndex === 0;
  const hasMultipleGroups = rule.groups.length > 1;

  const removeConditionButton = document.createElement("button");
  removeConditionButton.type = "button";
  removeConditionButton.className = "rounded-[10px] border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50";
  removeConditionButton.textContent = "×";
  removeConditionButton.setAttribute(
    "aria-label",
    isFirstCondition
      ? `Remove condition line ${groupIndex + 1}`
      : `Remove condition ${conditionIndex + 1} from line ${groupIndex + 1}`
  );
  removeConditionButton.title = isFirstCondition
    ? "Remove this condition line"
    : "Remove this condition";
  removeConditionButton.disabled =
    savingUrlRules || (isFirstCondition && !hasMultipleGroups);
  removeConditionButton.addEventListener("click", () => {
    if (!requireUnlocked() || savingUrlRules) {
      return;
    }
    if (isFirstCondition) {
      rule.groups.splice(groupIndex, 1);
    } else {
      group.splice(conditionIndex, 1);
    }
    renderUrlRules();
  });

  field.disabled = operator.disabled = value.disabled = savingUrlRules;
  row.append(field, operator, value, andConditionButton, orConditionButton, removeConditionButton);
  return row;
}

function requireUnlocked() {
  if (optionsUnlocked) {
    return true;
  }
  showToast("Unlock options to make changes", "error");
  return false;
}

function setMasterLockRadio(value) {
  challengeSettings.hidden = value !== "challenge";
  const radio = document.querySelector(
    `input[name="masterLock"][value="${value}"]`
  );
  if (radio) {
    radio.checked = true;
  }
}

function openSetPasswordModal() {
  modalReturnFocus = document.activeElement;
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  setPasswordError.textContent = "";
  optionsPage.inert = true;
  document.body.style.overflow = "hidden";
  setPasswordModal.hidden = false;
  setPasswordModal.classList.add("is-visible");
  newPasswordInput.focus();
}

function closeSetPasswordModal() {
  setPasswordModal.classList.remove("is-visible");
  setPasswordModal.hidden = true;
  optionsPage.inert = false;
  document.body.style.overflow = "";
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  if (modalReturnFocus) {
    modalReturnFocus.focus();
    modalReturnFocus = null;
  }
}

async function saveChallengeSettings() {
  if (!requireUnlocked()) {
    return;
  }
  if (!challengeQuestions.checkValidity()) {
    challengeQuestions.reportValidity();
    return;
  }
  try {
    await updateStoredSettings({
      challengeDifficulty: challengeDifficulty.value,
      challengeQuestions: Number(challengeQuestions.value),
    });
    showToast("Challenge settings saved");
  } catch {
    showToast("Could not save challenge settings", "error");
  }
}

challengeDifficulty.addEventListener("change", saveChallengeSettings);
challengeQuestions.addEventListener("change", saveChallengeSettings);
challengeForm.addEventListener("submit", (event) => event.preventDefault());
document.addEventListener("paste", (event) => {
  if (challengeSession && !optionsUnlocked) {
    event.preventDefault();
  }
});
challengeAnswer.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
  }
});
challengeConfirm.addEventListener("click", () => {
  if (!challengeSession || optionsUnlocked) {
    return;
  }
  const isDoors = challengeSession.difficulty === "10-doors";
  const answer = isDoors
    ? Array.from(challengeDoors.querySelectorAll("input:checked"))
      .map((input) => input.value).join(",")
    : challengeAnswer.value.trim();
  const isCorrect = isDoors
    ? answer === challengeSession.answer
    : /^\d+$/.test(answer) && Number(answer) === challengeSession.answer;
  if (!isCorrect) {
    challengeError.textContent = "Incorrect answer. Try again.";
    positionChallengeConfirm();
    (isDoors ? challengeDoors.querySelector("input") : challengeAnswer).focus();
    return;
  }
  challengeSession.completed += 1;
  if (challengeSession.completed === challengeSession.total) {
    challengeSession = null;
    optionsUnlocked = true;
    challengeAnswer.value = "";
    challengeDoors.replaceChildren();
    lockScreen.classList.remove("is-visible");
    optionsPage.hidden = false;
    document.getElementById("newWebsite").focus();
    return;
  }
  nextChallengeQuestion();
});
window.addEventListener("resize", () => {
  if (challengeSession) {
    positionChallengeConfirm();
  }
});

function createChallengeQuestion(difficulty) {
  if (difficulty === "number-parrot") {
    const answer = Math.floor(Math.random() * 900000) + 100000;
    return { prompt: `Type this number: ${answer}`, answer };
  }
  if (difficulty === "10-doors") {
    const people = Array.from(
      { length: Math.floor(Math.random() * 4) + 2 },
      () => Math.floor(Math.random() * 5) + 1,
    );
    const doors = Array.from({ length: 10 }, (_, index) => index + 1);
    const findOpenDoors = () => doors.filter((door) =>
      people.filter((step) => door % step === 0).length % 2 === 1
    );
    let openDoors = findOpenDoors();
    if (openDoors.length === 0 || openDoors.length === doors.length) {
      people[people.length - 1] = people[people.length - 1] % 5 + 1;
      openDoors = findOpenDoors();
    }
    return {
      kind: "doors",
      people,
      openDoors,
      answer: openDoors.join(","),
      prompt: `${people.map((step, index) => `P${index + 1}: n=${step}`).join(" · ")} After everyone has passed, which doors are open? Select all open doors.`,
    };
  }
  const first = Math.floor(Math.random() * 20) + 1;
  const second = Math.floor(Math.random() * 20) + 1;
  return { prompt: `${first} + ${second} = ?`, answer: first + second };
}

function nextChallengeQuestion() {
  const challengeTypes = {
    "number-parrot": {
      title: "Number Parrot Challenge",
      description: "Type the number shown.",
    },
    "simple-addition": {
      title: "Simple Addition Challenge",
      description: "Add the two numbers.",
    },
    "10-doors": {
      title: "10 Doors Challenge",
      description: "All 10 doors start closed. Each person opens or closes a door every n-th door.",
    },
  };
  const type = challengeTypes[challengeSession.difficulty];
  challengeTitle.textContent = type.title;
  challengeDescription.textContent = type.description;
  const question = createChallengeQuestion(challengeSession.difficulty);
  challengeSession.answer = question.answer;
  const isDoors = question.kind === "doors";
  challengeAnswer.hidden = isDoors;
  challengeDoors.hidden = !isDoors;
  challengeDoors.replaceChildren();
  challengeConfirm.textContent = isDoors ? "Submit" : "Confirm";
  if (isDoors) {
    for (let door = 1; door <= 10; door++) {
      const label = document.createElement("label");
      label.className = "min-w-0 cursor-pointer select-none";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = String(door);
      checkbox.className = "sr-only";
      checkbox.classList.add("peer");
      checkbox.setAttribute("aria-label", `Door ${door}`);
      const number = document.createElement("span");
      number.className = "flex min-h-[44px] items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-900 peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600 peer-focus-visible:outline-offset-1";
      number.textContent = String(door);
      label.replaceChildren(checkbox, number);
      challengeDoors.append(label);
    }
    challengePrompt.textContent = question.prompt;
  } else if (challengeSession.difficulty === "number-parrot") {
    const number = document.createElement("span");
    number.className = "select-none";
    number.textContent = String(question.answer);
    challengePrompt.replaceChildren("Type this number: ", number);
  } else {
    challengePrompt.textContent = question.prompt;
  }
  challengeProgress.textContent = `Question ${challengeSession.completed + 1} of ${challengeSession.total}`;
  challengeAnswer.value = "";
  challengeError.textContent = "";
  positionChallengeConfirm();
  (isDoors ? challengeDoors.querySelector("input") : challengeAnswer).focus();
}

function positionChallengeConfirm() {
  const angle = Math.floor(Math.random() * 301) - 150;
  const radians = angle * Math.PI / 180;
  const width = challengeConfirm.offsetWidth;
  const height = challengeConfirm.offsetHeight;
  const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const margin = 12;
  const card = challengeForm.getBoundingClientRect();
  let left;
  let top;
  for (let attempt = 0; attempt < 100; attempt++) {
    left = margin + Math.random() * Math.max(0, viewportWidth - rotatedWidth - margin * 2);
    top = margin + Math.random() * Math.max(0, viewportHeight - rotatedHeight - margin * 2);
    if (left + rotatedWidth < card.left || left > card.right ||
        top + rotatedHeight < card.top || top > card.bottom) {
      break;
    }
  }
  challengeConfirm.style.left = `${left + (rotatedWidth - width) / 2}px`;
  challengeConfirm.style.top = `${top + (rotatedHeight - height) / 2}px`;
  challengeConfirm.style.transform = `rotate(${angle}deg)`;
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyMasterPassword(password) {
  const stored = await getStoredSettings();
  if (!stored.masterLockHash || !stored.masterLockSalt) {
    return false;
  }
  const hash = await hashPassword(password, stored.masterLockSalt);
  return hash === stored.masterLockHash;
}
