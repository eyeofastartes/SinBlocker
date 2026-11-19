const URL_RULE_LIMIT = 100;
const URL_RULE_CONDITION_LIMIT = 32;
const URL_RULE_VALUE_LIMIT = 1024;
const URL_RULE_GROUP_LIMIT = 16;
const DEFAULT_ADVANCED_RULES = [
  {
    id: "default-host-allow",
    enabled: true,
    action: "allow",
    groups: ["*.com.*", "*.gov", "*.gov.*", "*.edu", "*.edu.*"].map((pattern) => [
      { field: "host", operator: "wildcard", value: pattern },
    ]),
  },
];

const ADVANCED_RULE_FIELDS = ["host", "path", "query"];
const ADVANCED_RULE_OPERATORS = [
  "wildcard", "equals", "not_equals", "contains", "not_contains",
  "starts_with", "ends_with",
];

function validateAdvancedRules(rules) {
  if (!Array.isArray(rules) || rules.length > URL_RULE_LIMIT) {
    throw new Error(`Rules must be a list of at most ${URL_RULE_LIMIT} entries.`);
  }
  const identities = new Set();
  return rules.map((rule, index) => {
    try {
      if (
        !rule || typeof rule.id !== "string" || !rule.id.trim() ||
        rule.id.length > 128 || identities.has(rule.id) ||
        typeof rule.enabled !== "boolean" ||
        !["allow", "block"].includes(rule.action)
      ) {
        throw new Error("Invalid identity, enablement, or action.");
      }
      identities.add(rule.id);
      return {
        id: rule.id,
        enabled: rule.enabled,
        action: rule.action,
        groups: validateUrlRuleGroups(rule.groups),
      };
    } catch (error) {
      throw new Error(`Rule ${index + 1}: ${error.message}`);
    }
  });
}

function validateUrlRuleGroups(groups) {
  if (!Array.isArray(groups) || groups.length === 0 || groups.length > URL_RULE_GROUP_LIMIT) {
    throw new Error(`Each rule needs 1 to ${URL_RULE_GROUP_LIMIT} condition lines.`);
  }
  return groups.map((group, index) => {
    const conditions = Array.isArray(group)
      ? group
      : group && Array.isArray(group.conditions)
        ? group.conditions
        : null;
    if (!Array.isArray(conditions) || conditions.length === 0) {
      throw new Error(`Line ${index + 1} has no conditions.`);
    }
    const mapped = conditions.map((condition, conditionIndex) => {
      if (
        !condition ||
        !ADVANCED_RULE_FIELDS.includes(condition.field) ||
        !ADVANCED_RULE_OPERATORS.includes(condition.operator) ||
        typeof condition.value !== "string"
      ) {
        throw new Error(`Line ${index + 1} condition ${conditionIndex + 1} is incomplete.`);
      }
      if (condition.value.length > URL_RULE_VALUE_LIMIT) {
        throw new Error(`Line ${index + 1} condition ${conditionIndex + 1} value is too long.`);
      }
      return {
        field: condition.field,
        operator: condition.operator,
        value: condition.field === "host"
          ? condition.value.toLowerCase()
          : condition.value,
      };
    });
    if (mapped.length > URL_RULE_CONDITION_LIMIT) {
      throw new Error(`Line ${index + 1} has too many conditions.`);
    }
    return mapped;
  });
}

function matchesUrlValue(value, operator, expected) {
  if (operator === "wildcard") {
    return wildcardMatches(value, expected);
  }
  const contains = value.includes(expected);
  const starts = value.startsWith(expected);
  const ends = value.endsWith(expected);
  switch (operator) {
    case "equals": return value === expected;
    case "not_equals": return !(value === expected);
    case "contains": return contains;
    case "not_contains": return !contains;
    case "starts_with": return starts;
    case "ends_with": return ends;
  }
  return false;
}

function wildcardMatches(value, pattern) {
  const parts = pattern.split("*");
  if (parts.length === 1) {
    return value === pattern;
  }
  if (!value.startsWith(parts[0]) || !value.endsWith(parts[parts.length - 1])) {
    return false;
  }
  let offset = parts[0].length;
  const end = value.length - parts[parts.length - 1].length;
  for (const part of parts.slice(1, -1)) {
    const found = value.indexOf(part, offset);
    if (found < 0 || found + part.length > end) {
      return false;
    }
    offset = found + part.length;
  }
  return offset <= end;
}

function evaluateUrlBlocking(pageUrl, settings) {
  if (!settings.blockingState) {
    return { blocked: false, rule: null };
  }
  let url;
  try {
    url = new URL(pageUrl);
  } catch {
    return { blocked: false, rule: null };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { blocked: false, rule: null };
  }
  const baseline = isBlocked(normalizeDomain(url.href), settings.websites);
  const fields = {
    host: url.hostname.toLowerCase(),
    path: url.pathname,
    query: url.search.slice(1),
  };
  for (const rule of settings.advancedRules || []) {
    if (rule.enabled && ruleMatches(rule.groups, fields)) {
      return { blocked: rule.action === "block", rule };
    }
  }
  return { blocked: baseline, rule: null };
}

function ruleMatches(groups, fields) {
  return groups.some((group) =>
    group.every(
      (condition) => matchesUrlValue(
        fields[condition.field],
        condition.operator,
        condition.value
      )
    )
  );
}
