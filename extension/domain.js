/**
 * Shared domain normalization for popup, options, background, and content scripts.
 * Strips www., lowercases, and accepts either a full URL or a bare hostname.
 */
function normalizeDomain(input) {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  let hostname;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    hostname = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  if (!hostname || hostname === ".") {
    return null;
  }

  return hostname.replace(/^www\./, "");
}

function isSiteMatch(currentHostname, site) {
  const siteDomain = normalizeDomain(site.website);
  if (!siteDomain || !currentHostname) {
    return false;
  }

  return (
    siteDomain === currentHostname ||
    (site.matchSubdomains && currentHostname.endsWith("." + siteDomain))
  );
}

function isSiteInList(hostname, websites) {
  if (!hostname || !Array.isArray(websites)) {
    return false;
  }
  return websites.some((site) => isSiteMatch(hostname, site));
}

function isBlocked(hostname, websites) {
  return !isSiteInList(hostname, websites);
}
