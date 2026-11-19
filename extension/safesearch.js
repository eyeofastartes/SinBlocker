const SAFE_SEARCH_LEVEL_STRICT = "strict";
const SAFE_SEARCH_LEVEL_MODERATE = "moderate";
const SAFE_SEARCH_ENGINE_IDS = [
  "google",
  "bing",
  "duckduckgo",
  "brave",
];
const SAFE_SEARCH_RULESET_IDS = [
  "safesearch_google",
  "safesearch_bing_strict",
  "safesearch_bing_moderate",
  "safesearch_duckduckgo_strict",
  "safesearch_duckduckgo_moderate",
  "safesearch_brave_strict",
  "safesearch_brave_moderate",
];

function getSafeSearchRulesetIds(settings) {
  const safeSearch = settings.safeSearch;
  if (!safeSearch.enabled) {
    return [];
  }

  return safeSearch.engines.map((engine) => {
    if (engine === "google") {
      return "safesearch_google";
    }
    return `safesearch_${engine}_${safeSearch.level}`;
  });
}
