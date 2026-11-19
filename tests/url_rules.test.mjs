import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SHARED = [
  "extension/domain.js",
  "extension/url_rules.js",
  "extension/safesearch.js",
  "extension/site_categories.js",
  "extension/default_sites.js",
];

function loadFiles(context, files) {
  for (const relative of files) {
    const source = readFileSync(path.join(ROOT, relative), "utf8");
    vm.runInContext(source, context, { filename: relative });
  }
}

function makeContext() {
  let data = {};
  const chrome = {
    storage: {
      local: {
        get: async () => ({ ...data }),
        set: async (payload) => Object.assign(data, payload),
      },
    },
  };
  const context = vm.createContext({ URL, chrome });
  loadFiles(context, SHARED);
  loadFiles(context, ["src/store.js"]);
  return { context, get data() { return data; }, set data(value) { data = value; } };
}

const condition = (field, operator, value) => ({ field, operator, value });
const rule = (lines, enabled = true, action = "allow", id = "r1") => ({
  id,
  enabled,
  action,
  groups: lines,
});
const settings = (patch = {}) => ({
  blockingState: true,
  websites: [{ website: "example.com", matchSubdomains: false }],
  advancedRules: [],
  ...patch,
});

test("allowlist baseline and global off", () => {
  const { context } = makeContext();
  assert.equal(context.evaluateUrlBlocking("https://example.com/", settings()).blocked, false);
  assert.equal(context.evaluateUrlBlocking("https://other.test/", settings()).blocked, true);
  assert.equal(
    context.evaluateUrlBlocking("https://other.test/", settings({ blockingState: false })).blocked,
    false
  );
});

test("allow and block overrides with first-match priority", () => {
  const { context } = makeContext();
  const block = settings({
    advancedRules: [
      rule([[condition("path", "equals", "/private")]], true, "block", "one"),
    ],
  });
  assert.equal(context.evaluateUrlBlocking("https://example.com/private", block).blocked, true);

  const allow = settings({
    advancedRules: [rule([[condition("path", "equals", "/x")]], true, "allow")],
  });
  assert.equal(context.evaluateUrlBlocking("https://other.test/x", allow).blocked, false);

  const first = settings({
    advancedRules: [
      rule([[condition("path", "equals", "/a")]], true, "block", "one"),
      rule([[condition("host", "wildcard", "*")]], true, "allow", "two"),
    ],
  });
  assert.equal(context.evaluateUrlBlocking("https://example.com/a", first).rule.id, "one");
});

test("unmatched, disabled, and fallback", () => {
  const { context } = makeContext();
  const unmatched = context.evaluateUrlBlocking(
    "https://example.com/a",
    settings({ advancedRules: [rule([[condition("path", "equals", "/b")]], true, "block")] })
  );
  assert.equal(unmatched.blocked, false);
  assert.equal(unmatched.rule, null);

  const disabled = settings({
    advancedRules: [rule([[condition("path", "equals", "/a")]], false, "block")],
  });
  assert.equal(context.evaluateUrlBlocking("https://example.com/a", disabled).blocked, false);
});

test("operators", () => {
  const { context } = makeContext();
  const cases = [
    ["not_equals", "/b", "https://example.com/a", true],
    ["contains", "path/", "https://example.com/path/a", true],
    ["starts_with", "/a", "https://example.com/a", true],
    ["ends_with", "a", "https://example.com/a", true],
    ["wildcard", "/a*", "https://example.com/a", true],
    ["wildcard", "/a*", "https://example.com/ba", false],
  ];
  for (const [operator, value, url, blocked] of cases) {
    const patch = { advancedRules: [rule([[condition("path", operator, value)]], true, "block")] };
    assert.equal(context.evaluateUrlBlocking(url, settings(patch)).blocked, blocked);
  }
});

test("host, query, and URL field handling", () => {
  const { context } = makeContext();
  const host = settings({
    advancedRules: [rule([[condition("host", "equals", "www.example.com")]], true, "block")],
  });
  assert.equal(context.evaluateUrlBlocking("https://www.example.com/a", host).blocked, true);
  assert.equal(context.evaluateUrlBlocking("https://WWW.EXAMPLE.com/a", host).blocked, true);

  const query = settings({
    advancedRules: [rule([[condition("query", "equals", "q=1")]], true, "block")],
  });
  assert.equal(context.evaluateUrlBlocking("https://example.com/?q=1#f", query).blocked, true);
});

test("OR lines and AND conditions", () => {
  const { context } = makeContext();
  const orRule = settings({
    advancedRules: [
      rule(
        [[condition("path", "equals", "/a")], [condition("host", "equals", "example.com")]],
        true,
        "block"
      ),
    ],
  });
  assert.equal(context.evaluateUrlBlocking("https://example.com/x", orRule).blocked, true);

  const andRule = settings({
    advancedRules: [
      rule(
        [[condition("path", "equals", "/x"), condition("host", "equals", "other.test")]],
        true,
        "block"
      ),
    ],
  });
  assert.equal(context.evaluateUrlBlocking("https://other.test/x", andRule).blocked, true);
  const noMatch = context.evaluateUrlBlocking("https://other.test/z", andRule);
  assert.equal(noMatch.rule, null);
  assert.equal(noMatch.blocked, true);
});

test("validation rejects bad collections", () => {
  const { context } = makeContext();
  const bad = [
    [[condition("path", "nope", "x")]],
    [{ id: "x", enabled: true, action: "block", groups: [] }],
    [{ id: "x", enabled: true, action: "skip", groups: [[condition("host", "equals", "x")]] }],
  ];
  for (const rules of bad) {
    assert.throws(() => context.validateAdvancedRules(rules));
  }
});

test("legacy group objects normalize to flat lines", () => {
  const { context } = makeContext();
  const legacy = context.validateAdvancedRules([
    {
      id: "legacy",
      enabled: true,
      action: "block",
      groups: [{ match: "all", conditions: [condition("host", "equals", "example.com")] }],
    },
  ]);
  assert.equal(Array.isArray(legacy[0].groups[0]), true);
});

test("storage persists rules and rejects invalid saves atomically", async () => {
  const ctx = makeContext();
  const initial = await ctx.context.getStoredSettings();
  assert.equal(initial.advancedRules.length, 1);
  assert.equal(initial.advancedRules[0].groups.length, 5);

  await ctx.context.updateStoredSettings({
    advancedRules: [rule([[condition("path", "equals", "/private")]], true, "block")],
  });
  const saved = await ctx.context.getStoredSettings();
  assert.equal(saved.advancedRules[0].groups[0][0].operator, "equals");

  const before = JSON.stringify(ctx.data);
  await assert.rejects(
    ctx.context.updateStoredSettings({
      advancedRules: [rule([[condition("path", "badop", "x")]])],
    })
  );
  assert.equal(JSON.stringify(ctx.data), before);
});