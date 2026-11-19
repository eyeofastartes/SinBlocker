import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

function setup(initial = {}) {
  let data = { ...initial };
  const elements = new Map();
  const listeners = new Map();
  const radios = ["unlocked", "locked", "challenge"].map((value) => {
    const events = new Map();
    return {
      value,
      checked: false,
      addEventListener: (name, handler) => events.set(name, handler),
      fire: (name) => events.get(name)?.(),
    };
  });
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      const events = new Map();
      elements.set(id, {
        value: "",
        checked: false,
        children: [],
        attributes: {},
        hidden: false,
        style: {},
        dataset: {},
        textContent: "",
        offsetWidth: 100,
        offsetHeight: 44,
        classList: {
          add: (...names) => names.forEach((name) => classes.add(name)),
          remove: (...names) => names.forEach((name) => classes.delete(name)),
          contains: (name) => classes.has(name),
        },
        addEventListener: (name, handler) => events.set(name, handler),
        fire: (name, event = {}) => events.get(name)?.({ preventDefault() {}, ...event }),
        focus() { document.activeElement = this; },
        setAttribute(name, value) { this.attributes[name] = value; },
        append(...children) { this.children.push(...children); },
        querySelectorAll(selector) {
          const descendants = this.children.flatMap((child) =>
            typeof child === "object" ? [child, ...child.querySelectorAll("input")] : []
          );
          return descendants.filter((child) => child.tagName === "input" &&
            (selector !== "input:checked" || child.checked));
        },
        querySelector(selector) { return this.querySelectorAll(selector)[0]; },
        replaceChildren(...children) { this.children = children; },
        checkValidity() {
          return /^\d+$/.test(String(this.value)) && Number(this.value) >= 1 && Number(this.value) <= 100;
        },
        reportValidity() {},
        getBoundingClientRect: () => ({ left: 390, right: 810, top: 200, bottom: 600 }),
      });
    }
    return elements.get(id);
  }
  const chrome = {
    storage: {
      local: {
        get: async () => ({ ...data }),
        set: async (payload) => Object.assign(data, payload),
      },
      onChanged: { addListener() {} },
    },
    tabs: { query: async () => [{ url: "https://example.com/" }] },
    runtime: { openOptionsPage() {} },
  };
  const document = {
    getElementById: element,
    createElement: (tagName) => Object.assign(element(Symbol(tagName)), { tagName }),
    body: { style: {} },
    addEventListener: (name, handler) => listeners.set(name, handler),
    querySelectorAll: (selector) => selector === 'input[name="masterLock"]' ? radios : [],
    querySelector: (selector) => radios.find((radio) => selector.includes(`value="${radio.value}"`)),
    documentElement: { clientWidth: 1200, clientHeight: 800 },
  };
  const context = vm.createContext({
    URL, chrome, document,
    window: { location: { hash: "" }, addEventListener() {}, confirm: () => true },
    setTimeout: () => 1,
    clearTimeout() {},
  });
  for (const file of ["extension/domain.js", "extension/url_rules.js", "extension/safesearch.js", "extension/site_categories.js", "extension/default_sites.js", "src/store.js"]) {
    vm.runInContext(source(file), context);
  }
  return {
    context, element, listeners, radios,
    load: (file) => vm.runInContext(source(file), context),
    run: (code) => vm.runInContext(code, context),
    get data() { return data; },
    set data(value) { data = value; },
  };
}

test("challenge defaults, validation, persistence and backup recovery", async () => {
  const env = setup();
  const defaults = await env.context.getStoredSettings();
  assert.equal(defaults.masterLock, "unlocked");
  assert.equal(defaults.challengeDifficulty, "simple-addition");
  assert.equal(defaults.challengeQuestions, 10);
  for (const value of [0, -1, 101, 1.5, "10", null]) {
    assert.equal(env.context.normalizeSettings({ challengeQuestions: value }).challengeQuestions, 10);
  }
  assert.equal(env.context.normalizeSettings({ challengeDifficulty: "invalid" }).challengeDifficulty, "simple-addition");
  await env.context.updateStoredSettings({ masterLock: "challenge", challengeDifficulty: "10-doors", challengeQuestions: 24 });
  delete env.data.IAVB_options;
  const restored = await env.context.getStoredSettings();
  assert.equal(restored.masterLock, "challenge");
  assert.equal(restored.challengeDifficulty, "10-doors");
  assert.equal(restored.challengeQuestions, 24);
});

test("legacy password lock stays intact and challenge settings migrate", async () => {
  const password = setup({ masterLock: "locked", masterLockHash: "hash", masterLockSalt: "salt" });
  const stored = await password.context.getStoredSettings();
  assert.equal(stored.masterLock, "locked");
  assert.equal(stored.masterLockHash, "hash");
  const challenge = setup({ masterLock: "challenge", challengeDifficulty: "number-parrot", challengeQuestions: 3 });
  assert.equal((await challenge.context.getStoredSettings()).challengeQuestions, 3);
});

test("question generators implement copying and normal addition", () => {
  const env = setup();
  env.load("src/options.js");
  for (let count = 0; count < 100; count++) {
    const easy = env.context.createChallengeQuestion("number-parrot");
    assert.match(easy.prompt, new RegExp(String(easy.answer)));
    assert.match(String(easy.answer), /^[1-9]\d{5}$/);
    const question = env.context.createChallengeQuestion("simple-addition");
    const operands = question.prompt.match(/\d+/g).map(Number);
    assert.equal(question.answer, operands[0] + operands[1]);
    assert.ok(operands.every((value) => value >= 1 && value <= 20));
  }
});

test("hard puzzles calculate nontrivial open sets for every possible hallway", () => {
  const env = setup();
  env.load("src/options.js");
  for (let count = 2; count <= 5; count++) {
    for (let combination = 0; combination < 5 ** count; combination++) {
      const people = Array.from({ length: count }, (_, index) =>
        Math.floor(combination / 5 ** index) % 5 + 1
      );
      env.context.randomValues = [(count - 2) / 4, ...people.map((step) => (step - 1) / 5)];
      env.run("Math.random = () => randomValues.shift();");
      const question = env.context.createChallengeQuestion("10-doors");
      assert.equal(question.kind, "doors");
      assert.equal(question.people.length, count);
      assert.ok(question.people.every((step) => step >= 1 && step <= 5));
      const doors = Array(10).fill(false);
      for (const step of question.people) {
        for (let door = step; door <= 10; door += step) {
          doors[door - 1] = !doors[door - 1];
        }
      }
      const expected = doors.flatMap((open, index) => open ? [index + 1] : []);
      assert.ok(expected.length > 0 && expected.length < 10);
      assert.deepEqual(Array.from(question.openDoors), expected);
      assert.equal(question.answer, expected.join(","));
      question.people.forEach((step, index) => {
        assert.ok(question.prompt.includes(`Person ${index + 1}: n = ${step}.`));
      });
    }
  }
});

test("hard challenge requires exact checkbox selections and resets every question", async () => {
  const env = setup();
  await env.context.updateStoredSettings({ masterLock: "challenge", challengeDifficulty: "10-doors", challengeQuestions: 2 });
  env.load("src/options.js");
  env.run("renderSafeSearchSettings = () => {}; renderUrlRules = () => {}; renderWebsiteList = () => {};");
  await env.listeners.get("DOMContentLoaded")();
  const container = env.element("challengeDoors");
  let checkboxes = container.querySelectorAll("input");
  assert.equal(checkboxes.length, 10);
  assert.equal(container.hidden, false);
  assert.equal(env.element("challengeAnswer").hidden, true);
  assert.equal(env.element("challengeConfirm").textContent, "Submit");
  assert.equal(env.context.document.activeElement, checkboxes[0]);
  assert.deepEqual(checkboxes.map((input) => input.value), Array.from({ length: 10 }, (_, index) => String(index + 1)));
  assert.equal(checkboxes[9].attributes["aria-label"], "Door 10");
  assert.ok(checkboxes.every((input) => input.checked === false));
  env.element("challengeAnswer").value = env.run("challengeSession.answer");
  env.element("challengeConfirm").fire("click");
  assert.equal(env.run("challengeSession.completed"), 0);
  assert.match(env.element("challengeError").textContent, /Incorrect/);
  for (const checkbox of checkboxes) checkbox.checked = true;
  env.element("challengeConfirm").fire("click");
  assert.equal(env.run("challengeSession.completed"), 0);
  for (let question = 0; question < 2; question++) {
    const answer = env.run("challengeSession.answer").split(",");
    checkboxes = container.querySelectorAll("input");
    for (const checkbox of checkboxes) checkbox.checked = answer.includes(checkbox.value);
    env.element("challengeForm").fire("submit");
    assert.equal(env.run("optionsUnlocked"), false);
    env.element("challengeConfirm").fire("click");
    if (question === 0) {
      assert.equal(env.run("challengeSession.completed"), 1);
      assert.equal(container.querySelectorAll("input:checked").length, 0);
      assert.equal(env.element("challengeError").textContent, "");
    }
  }
  assert.equal(env.run("optionsUnlocked"), true);
  assert.equal(env.element("optionsPage").hidden, false);
  assert.equal(container.children.length, 0);
  assert.equal((await env.context.getStoredSettings()).masterLock, "challenge");
});

test("challenge requires every correct answer and cannot use password or Enter submission", async () => {
  const env = setup();
  await env.context.updateStoredSettings({ masterLock: "challenge", challengeQuestions: 2 });
  env.load("src/options.js");
  env.run("renderSafeSearchSettings = () => {}; renderUrlRules = () => {}; renderWebsiteList = () => {};");
  await env.listeners.get("DOMContentLoaded")();
  assert.equal(env.run("optionsUnlocked"), false);
  assert.equal(env.element("challengeDoors").hidden, true);
  assert.equal(env.element("challengeAnswer").hidden, false);
  assert.equal(env.element("optionsPage").hidden, true);
  assert.equal(env.element("unlockForm").hidden, true);
  assert.equal(env.element("challengeSettings").hidden, false);
  env.run("let confirmationMoves = 0; const originalPositionConfirm = positionChallengeConfirm; positionChallengeConfirm = () => { confirmationMoves += 1; originalPositionConfirm(); };");
  env.element("challengeAnswer").value = "wrong";
  env.element("challengeConfirm").fire("click");
  assert.equal(env.run("confirmationMoves"), 1);
  assert.equal(env.run("challengeSession.completed"), 0);
  assert.match(env.element("challengeError").textContent, /Incorrect/);
  env.element("challengeAnswer").value = String(env.run("challengeSession.answer"));
  let prevented = false;
  env.element("challengeForm").fire("submit", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(env.run("optionsUnlocked"), false);
  await env.element("unlockForm").fire("submit");
  assert.equal(env.run("optionsUnlocked"), false);
  env.element("challengeConfirm").fire("click");
  assert.equal(env.run("challengeSession.completed"), 1);
  assert.equal(env.element("challengeAnswer").value, "");
  env.element("challengeAnswer").value = String(env.run("challengeSession.answer"));
  env.element("challengeConfirm").fire("click");
  assert.equal(env.run("optionsUnlocked"), true);
  assert.equal(env.element("optionsPage").hidden, false);
  assert.equal((await env.context.getStoredSettings()).masterLock, "challenge");
});

test("challenge screen shows type-specific titles and short descriptions", async () => {
  for (const [difficulty, title, description] of [
    ["number-parrot", "Number Parrot Challenge", "Type the number shown."],
    ["simple-addition", "Simple Addition Challenge", "Add the two numbers."],
    ["10-doors", "10 Doors Challenge", "All 10 doors start closed. Each person opens or closes a door every n-th door."],
  ]) {
    const env = setup();
    await env.context.updateStoredSettings({ masterLock: "challenge", challengeDifficulty: difficulty });
    env.load("src/options.js");
    env.run("renderSafeSearchSettings = () => {}; renderUrlRules = () => {}; renderWebsiteList = () => {};");
    await env.listeners.get("DOMContentLoaded")();
    assert.equal(env.element("challengeTitle").textContent, title);
    assert.equal(env.element("challengeDescription").textContent, description);
    if (difficulty === "10-doors") {
      assert.ok(!env.element("challengePrompt").textContent.includes(description));
      assert.match(env.element("challengePrompt").textContent, /Person 1: n = [1-5]/);
    }
  }
  const html = source("src/options.html");
  assert.match(html, /<h1 id="challengeTitle"><\/h1>/);
  assert.match(html, /<p id="challengeDescription"><\/p>/);
});

test("easy challenge wraps only the number in an unselectable span", () => {
  const env = setup();
  env.load("src/options.js");
  env.run('challengeSession = { difficulty: "number-parrot", total: 10, completed: 0 }; nextChallengeQuestion();');
  const [prefix, number] = env.element("challengePrompt").children;
  assert.equal(prefix, "Type this number: ");
  assert.equal(number.tagName, "span");
  assert.equal(number.className, "select-none");
  assert.match(number.textContent, /^[1-9]\d{5}$/);
  assert.equal(number.textContent, String(env.run("challengeSession.answer")));
});

test("paste is prevented only during a locked challenge session", () => {
  const env = setup();
  env.load("src/options.js");
  const paste = env.listeners.get("paste");
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  paste(event);
  assert.equal(prevented, false);
  env.run("challengeSession = {}; optionsUnlocked = false;");
  paste(event);
  assert.equal(prevented, true);
  prevented = false;
  env.run("optionsUnlocked = true;");
  paste(event);
  assert.equal(prevented, false);
  env.run("challengeSession = null; optionsUnlocked = false;");
  paste(event);
  assert.equal(prevented, false);
});

test("rotated confirmation stays inside viewport", () => {
  const env = setup();
  env.load("src/options.js");
  for (let count = 0; count < 100; count++) {
    env.context.positionChallengeConfirm();
    const style = env.element("challengeConfirm").style;
    const radians = Number(style.transform.match(/-?\d+/)[0]) * Math.PI / 180;
    const width = Math.abs(100 * Math.cos(radians)) + Math.abs(44 * Math.sin(radians));
    const height = Math.abs(100 * Math.sin(radians)) + Math.abs(44 * Math.cos(radians));
    const left = parseFloat(style.left) + (100 - width) / 2;
    const top = parseFloat(style.top) + (44 - height) / 2;
    assert.ok(left >= 11.99 && left + width <= 1188.01);
    assert.ok(top >= 11.99 && top + height <= 788.01);
  }
});

test("challenge fields autosave and reject invalid question counts", async () => {
  const env = setup();
  env.load("src/options.js");
  env.run("optionsUnlocked = true;");
  env.element("challengeDifficulty").value = "number-parrot";
  env.element("challengeQuestions").value = "4";
  await env.element("challengeDifficulty").fire("change");
  assert.equal((await env.context.getStoredSettings()).challengeDifficulty, "number-parrot");
  assert.equal((await env.context.getStoredSettings()).challengeQuestions, 4);
  env.element("challengeQuestions").value = "0";
  await env.element("challengeQuestions").fire("change");
  assert.equal((await env.context.getStoredSettings()).challengeQuestions, 4);
});

test("protection transitions persist and cancelling password restores challenge mode", async () => {
  const env = setup();
  env.load("src/options.js");
  env.run("optionsUnlocked = true;");
  const challenge = env.radios.find((radio) => radio.value === "challenge");
  challenge.checked = true;
  await challenge.fire("change");
  assert.equal((await env.context.getStoredSettings()).masterLock, "challenge");
  assert.equal(env.element("challengeSettings").hidden, false);
  const password = env.radios.find((radio) => radio.value === "locked");
  password.checked = true;
  await password.fire("change");
  assert.equal(env.element("setPasswordModal").hidden, false);
  env.element("cancelSetPassword").fire("click");
  assert.equal(env.run("currentLock"), "challenge");
  assert.equal(env.element("challengeSettings").hidden, false);
  const unlocked = env.radios.find((radio) => radio.value === "unlocked");
  unlocked.checked = true;
  await unlocked.fire("change");
  assert.equal((await env.context.getStoredSettings()).masterLock, "unlocked");
  assert.equal(env.element("challengeSettings").hidden, true);
});

test("popup disables both actions for challenge and password locks", async () => {
  for (const masterLock of ["challenge", "locked", "unlocked"]) {
    const env = setup();
    await env.context.updateStoredSettings({ masterLock });
    env.load("src/popup.js");
    await env.context.refreshPopupState();
    assert.equal(env.element("toggleSwitch").disabled, masterLock !== "unlocked");
    assert.equal(env.element("primaryAction").disabled, masterLock !== "unlocked");
  }
});
