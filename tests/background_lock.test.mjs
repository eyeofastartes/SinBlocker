import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/background.js", import.meta.url), "utf8");
const commandSource = source.slice(
  source.indexOf("async function handleCommand("),
  source.indexOf("async function handleTabUpdate("),
);

function setup(masterLock, blockingState) {
  const settings = { masterLock, blockingState };
  const writes = [];
  const updates = [];
  const badges = [];
  const tabs = [{ id: 1 }, { id: 2 }];
  const context = vm.createContext({
    getStoredSettings: async () => ({ ...settings }),
    setBlockingState: async (value) => {
      settings.blockingState = value;
      writes.push(value);
    },
    chrome: { tabs: { query: (query, callback) => callback(tabs) } },
    updateContentScript: (tab, stored) => updates.push([tab.id, stored.blockingState]),
    updateBadge: (value) => badges.push(value),
  });
  vm.runInContext(commandSource, context);
  return { context, settings, writes, updates, badges };
}

for (const masterLock of ["locked", "challenge"]) {
  for (const blockingState of [true, false]) {
    test(`keyboard toggle preserves blocking=${blockingState} under ${masterLock} lock`, async () => {
      const env = setup(masterLock, blockingState);
      await env.context.handleCommand("toggle_image_blocking");
      assert.equal(env.settings.blockingState, blockingState);
      assert.deepEqual(env.writes, []);
      assert.deepEqual(env.updates, []);
      assert.deepEqual(env.badges, []);
    });
  }
}

for (const blockingState of [true, false]) {
  test(`unlocked keyboard toggle changes blocking=${blockingState} and refreshes tabs and badge`, async () => {
    const env = setup("unlocked", blockingState);
    await env.context.handleCommand("toggle_image_blocking");
    assert.equal(env.settings.blockingState, !blockingState);
    assert.deepEqual(env.writes, [!blockingState]);
    assert.deepEqual(env.updates, [[1, !blockingState], [2, !blockingState]]);
    assert.deepEqual(env.badges, [!blockingState]);
  });
}

test("unrelated keyboard commands leave blocking unchanged", async () => {
  const env = setup("unlocked", true);
  await env.context.handleCommand("unrelated");
  assert.deepEqual(env.writes, []);
  assert.deepEqual(env.updates, []);
  assert.deepEqual(env.badges, []);
});
