const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.value = "";
    this.textContent = "";
    this.handlers = {};
    this.dataset = {};
    this.disabled = false;
    this.isConnected = true;
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  setAttribute(key, value) {
    this[key] = value;
  }
  addEventListener(key, fn) {
    this.handlers[key] = fn;
  }
  reportValidity() {
    return true;
  }
  scrollIntoView() {}
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup({ admin = false, allowed = true, detail = false } = {}) {
  const elements = new Map(),
    calls = [],
    events = {};
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const context = {
    URL,
    URLSearchParams,
    Intl,
    Date,
    console,
    location: {
      pathname: detail ? "/telegram/event.html" : "/telegram/events.html",
      search: detail ? "?id=1" : "",
    },
    document: {
      createElement: (tag) => new Element(tag),
      getElementById: el,
      querySelectorAll: () => [],
      addEventListener: (key, fn) => (events[key] = fn),
    },
    UyDosh: {
      getLang: () => "ru",
      initTelegramMiniApp() {},
      ensureTelegramMiniAppSession: async () => allowed,
      isAdmin: () => allowed,
    },
  };
  const request = (path, options) =>
    new Promise((resolve, reject) =>
      calls.push({ path, options, resolve, reject }),
    );
  context.UyDosh.cityRadarPublic = request;
  context.UyDosh.cityRadarAdmin = request;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("assets/city-radar-ui.js", "utf8"), context);
  vm.runInContext(
    fs.readFileSync(
      admin ? "assets/telegram-admin-events.js" : "assets/telegram-events.js",
      "utf8",
    ),
    context,
  );
  return { context, el, calls, events };
}
const event = {
  id: "1",
  title: "<img src=x onerror=alert(1)>",
  category: "sports_and_fitness",
  starts_at: "2026-12-01T18:00:00+05:00",
  venue: "Ташкент",
  price: null,
  registration_url: "javascript:alert(1)",
  source_url: "https://t.me/example/1",
};
test("late public responses cannot overwrite filters; pagination uses server next offset", async () => {
  const s = setup();
  s.el("event-category").value = "sports_and_fitness";
  s.el("event-filters").handlers.submit({ preventDefault() {} });
  assert.equal(s.calls[1].options.category, "sports_and_fitness");
  s.calls[1].resolve({ events: [event], next_offset: 20 });
  await tick();
  s.calls[0].resolve({ events: [], next_offset: null });
  await tick();
  assert.equal(s.el("radar-list").children.length, 1);
  s.el("radar-next").handlers.click();
  assert.equal(s.calls[2].options.offset, 20);
});
test("event title stays text, unsafe URLs are omitted and unknown price stays unknown", async () => {
  const s = setup({ detail: true });
  s.calls[0].resolve(event);
  await tick();
  const card = s.el("radar-list").children[0];
  assert.equal(card.children[1].textContent, event.title);
  assert.equal(
    card.children.find((n) => n.tag === "strong").textContent,
    "Стоимость не указана",
  );
  const links = card.children.at(-1).children;
  assert.equal(links.length, 1);
  assert.equal(links[0].href, event.source_url);
});
test("503 clears old events and offers retry", async () => {
  const s = setup();
  s.calls[0].reject({ status: 503 });
  await tick();
  assert.match(s.el("radar-status").textContent, /недоступна/);
  assert.equal(s.el("radar-list").children.length, 0);
  assert.equal(s.el("radar-retry").hidden, false);
});
test("non-admin never requests private endpoints", async () => {
  const s = setup({ admin: true, allowed: false });
  await tick();
  assert.equal(s.calls.length, 0);
  assert.match(s.el("radar-status").textContent, /администратора/);
});
test("source review preserves revision and never starts collection on opening", async () => {
  const s = setup({ admin: true });
  await tick();
  s.calls[0].resolve({
    sources: [
      {
        id: 7,
        revision: 12,
        handle: "example",
        enabled: false,
        access_status: "pending",
        collection_permission: "pending",
        ai_permission: "pending",
        publication_permission: "pending",
      },
    ],
  });
  await tick();
  s.el("radar-list").children[0].children.at(-1).handlers.click();
  assert.equal(s.calls.length, 1);
  const form = s
    .el("radar-editor")
    .children[0].children.find((e) => e.tag === "form");
  form.handlers.submit({ preventDefault() {} });
  assert.equal(s.calls[1].path, "/sources/7/review");
  assert.equal(s.calls[1].options.body.expected_revision, 12);
  assert.equal(s.calls[1].options.body.enabled, false);
  s.calls[1].reject({ status: 409 });
  await tick();
  assert.match(s.el("radar-status").textContent, /Обновите/);
  assert.equal(s.el("radar-editor").children.length, 0);
});
