const IAVB_SETTINGS_KEY = "IAVB_options";
const IAVB_SETTINGS_HASH_KEY = "IAVB_options_hash";
const IAVB_BACKUP_COUNT = 2;
const IAVB_APP_SECRET = "ivb.local-integrity.7c3f1a90b2d4e688";
const IAVB_DEFAULT_SETTINGS = Object.freeze({
  blockingState: true,
  websites: Object.freeze(
    DEFAULT_WEBSITES.map((entry) => Object.freeze({ ...entry }))
  ),
  advancedRules: Object.freeze(
    DEFAULT_ADVANCED_RULES.map((rule) => Object.freeze(rule))
  ),
  onboardingComplete: false,
  masterLock: "unlocked",
  masterLockHash: null,
  masterLockSalt: null,
  challengeDifficulty: "simple-addition",
  challengeQuestions: 10,
  safeSearch: Object.freeze({
    enabled: true,
    level: SAFE_SEARCH_LEVEL_STRICT,
    engines: Object.freeze([...SAFE_SEARCH_ENGINE_IDS]),
  }),
});

function fnv1a64(text) {
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function deriveIntegrityHash(json) {
  return (
    fnv1a64(`${IAVB_APP_SECRET}:a:${json}`) +
    fnv1a64(`${IAVB_APP_SECRET}:b:${json}`)
  );
}

function deriveBackupKey(index) {
  return `IAVB_backup_${fnv1a64(`${IAVB_APP_SECRET}:backup:${index}`)}`;
}

function normalizeWebsites(websites) {
  if (!Array.isArray(websites)) {
    return [];
  }
  return websites
    .filter(
      (entry) =>
        entry && typeof entry === "object" && typeof entry.website === "string"
    )
    .map((entry) => ({
      website: entry.website,
      matchSubdomains: Boolean(entry.matchSubdomains),
    }));
}

function normalizeSafeSearchSettings(value) {
  const safe = value && typeof value === "object" ? value : {};
  return {
    enabled:
      typeof safe.enabled === "boolean"
        ? safe.enabled
        : IAVB_DEFAULT_SETTINGS.safeSearch.enabled,
    level:
      safe.level === SAFE_SEARCH_LEVEL_STRICT ||
      safe.level === SAFE_SEARCH_LEVEL_MODERATE
        ? safe.level
        : IAVB_DEFAULT_SETTINGS.safeSearch.level,
    engines: Array.isArray(safe.engines)
      ? SAFE_SEARCH_ENGINE_IDS.filter((engine) => safe.engines.includes(engine))
      : [...IAVB_DEFAULT_SETTINGS.safeSearch.engines],
  };
}

function normalizeSettings(source) {
  const safe = source && typeof source === "object" ? source : {};
  return {
    blockingState:
      typeof safe.blockingState === "boolean"
        ? safe.blockingState
        : IAVB_DEFAULT_SETTINGS.blockingState,
    websites: Array.isArray(safe.websites)
      ? normalizeWebsites(safe.websites)
      : normalizeWebsites(IAVB_DEFAULT_SETTINGS.websites),
    onboardingComplete:
      typeof safe.onboardingComplete === "boolean"
        ? safe.onboardingComplete
        : IAVB_DEFAULT_SETTINGS.onboardingComplete,
    masterLock:
      ["locked", "challenge", "unlocked"].includes(safe.masterLock)
        ? safe.masterLock
        : IAVB_DEFAULT_SETTINGS.masterLock,
    masterLockHash:
      typeof safe.masterLockHash === "string"
        ? safe.masterLockHash
        : IAVB_DEFAULT_SETTINGS.masterLockHash,
    masterLockSalt:
      typeof safe.masterLockSalt === "string"
        ? safe.masterLockSalt
        : IAVB_DEFAULT_SETTINGS.masterLockSalt,
    challengeDifficulty: ["number-parrot", "simple-addition", "10-doors"].includes(safe.challengeDifficulty)
      ? safe.challengeDifficulty
      : IAVB_DEFAULT_SETTINGS.challengeDifficulty,
    challengeQuestions:
      Number.isInteger(safe.challengeQuestions) &&
      safe.challengeQuestions >= 1 && safe.challengeQuestions <= 100
        ? safe.challengeQuestions
        : IAVB_DEFAULT_SETTINGS.challengeQuestions,
    advancedRules: validateAdvancedRules(
      safe.advancedRules === undefined ? DEFAULT_ADVANCED_RULES : safe.advancedRules,
    ),
    safeSearch: normalizeSafeSearchSettings(safe.safeSearch),
  };
}

function parseSettings(json) {
  try {
    return normalizeSettings(JSON.parse(json));
  } catch {
    return null;
  }
}

function settingsToJson(settings) {
  return JSON.stringify(normalizeSettings(settings));
}

async function writeSettingsRecord(settings) {
  const json = settingsToJson(settings);
  const hash = deriveIntegrityHash(json);

  const payload = {
    [IAVB_SETTINGS_KEY]: json,
    [IAVB_SETTINGS_HASH_KEY]: hash,
  };
  for (let i = 0; i < IAVB_BACKUP_COUNT; i++) {
    payload[deriveBackupKey(i)] = { json, hash };
  }

  await chrome.storage.local.set(payload);
}

function backupsAreConsistent(settings, raw) {
  const json = settingsToJson(settings);
  const hash = deriveIntegrityHash(json);

  for (let i = 0; i < IAVB_BACKUP_COUNT; i++) {
    const record = raw[deriveBackupKey(i)];
    if (
      !record ||
      typeof record.json !== "string" ||
      record.json !== json ||
      record.hash !== hash
    ) {
      return false;
    }
  }
  return true;
}

async function readLegacySettings() {
  const result = await chrome.storage.local.get([
    "blockingState",
    "websites",
    "onboardingComplete",
    "masterLock",
    "masterLockHash",
    "masterLockSalt",
    "challengeDifficulty",
    "challengeQuestions",
  ]);

  const hasLegacy = [
    "blockingState",
    "websites",
    "onboardingComplete",
    "masterLock",
  ].some((key) => key in result);

  if (!hasLegacy) {
    return null;
  }

  return {
    blockingState: Boolean(result.blockingState),
    websites: normalizeWebsites(result.websites),
    onboardingComplete: Boolean(result.onboardingComplete),
    masterLock: ["locked", "challenge"].includes(result.masterLock)
      ? result.masterLock
      : "unlocked",
    challengeDifficulty: result.challengeDifficulty,
    challengeQuestions: result.challengeQuestions,
    masterLockHash:
      typeof result.masterLockHash === "string" ? result.masterLockHash : null,
    masterLockSalt:
      typeof result.masterLockSalt === "string" ? result.masterLockSalt : null,
  };
}

async function getStoredSettings() {
  const keys = [IAVB_SETTINGS_KEY, IAVB_SETTINGS_HASH_KEY];
  for (let i = 0; i < IAVB_BACKUP_COUNT; i++) {
    keys.push(deriveBackupKey(i));
  }

  const raw = await chrome.storage.local.get(keys);

  const primaryJson =
    typeof raw[IAVB_SETTINGS_KEY] === "string" ? raw[IAVB_SETTINGS_KEY] : null;
  const primaryHash =
    typeof raw[IAVB_SETTINGS_HASH_KEY] === "string"
      ? raw[IAVB_SETTINGS_HASH_KEY]
      : null;

  let invalidSettings = false;
  if (
    primaryJson &&
    primaryHash &&
    primaryHash === deriveIntegrityHash(primaryJson)
  ) {
    const settings = parseSettings(primaryJson);
    if (settings) {
      if (backupsAreConsistent(settings, raw)) {
        return settings;
      }
      await writeSettingsRecord(settings);
      return settings;
    }
    invalidSettings = true;
  }

  for (let i = 0; i < IAVB_BACKUP_COUNT; i++) {
    const record = raw[deriveBackupKey(i)];
    if (
      record &&
      typeof record.json === "string" &&
      typeof record.hash === "string" &&
      record.hash === deriveIntegrityHash(record.json)
    ) {
      const settings = parseSettings(record.json);
      if (settings) {
        await writeSettingsRecord(settings);
        return settings;
      }
      invalidSettings = true;
    }
  }

  if (invalidSettings) {
    throw new Error("Stored settings contain invalid URL rules.");
  }
  const legacy = await readLegacySettings();
  const settings = normalizeSettings(legacy);
  await writeSettingsRecord(settings);
  return settings;
}

async function updateStoredSettings(patch) {
  if (Object.hasOwn(patch, "advancedRules")) {
    validateAdvancedRules(patch.advancedRules);
  }
  const current = await getStoredSettings();
  const next = normalizeSettings({ ...current, ...patch });
  await writeSettingsRecord(next);
  return next;
}
