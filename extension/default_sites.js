const DEFAULT_SITES = Object.values(SITE_CATEGORIES).flatMap(
  (category) => category.sites
);

const DEFAULT_WEBSITES = DEFAULT_SITES.map((website) => ({
  website,
  matchSubdomains: true,
}));