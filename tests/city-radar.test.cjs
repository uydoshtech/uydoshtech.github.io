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
function setup({ admin = false, allowed = true, detail = false, gathering = false, createGathering = false } = {}) {
  const elements = new Map(),
    calls = [],
    events = {};
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const sections = ["sources", "drafts", "events"].map((id) => {
    const b = new Element("button");
    b.dataset.section = id;
    return b;
  });
  const context = {
    URL,
    URLSearchParams,
    crypto: require("node:crypto").webcrypto,
    Intl,
    Date,
    console,
    location: {
      pathname: gathering ? (createGathering ? "/telegram/create-gathering.html" : "/telegram/gathering.html") : detail ? "/telegram/event.html" : "/telegram/events.html",
      search: detail || (gathering && !createGathering) ? "?id=1" : "",
    },
    document: {
      createElement: (tag) => new Element(tag),
      getElementById: el,
      querySelectorAll: (selector) =>
        selector === "[data-section]" ? sections : [],
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
  context.UyDosh.communityEvent = request;
  context.UyDosh.communityEventPublic = request;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("assets/city-radar-ui.js", "utf8"), context);
  vm.runInContext(
    fs.readFileSync(
      gathering ? "assets/telegram-gatherings.js" : admin ? "assets/telegram-admin-events.js" : "assets/telegram-events.js",
      "utf8",
    ),
    context,
  );
  return { context, el, calls, events, sections };
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
  s.el("event-categories").children.at(-1).handlers.click();
  assert.equal(s.calls[1].options.category, "sports_and_fitness");
  s.calls[1].resolve({ events: [event], next_offset: 20 });
  await tick();
  s.calls[0].resolve({ events: [], next_offset: null });
  await tick();
  assert.equal(s.el("radar-list").children.length, 1);
  s.el("radar-next").handlers.click();
  assert.equal(s.calls[2].options.offset, 20);
  s.calls[2].resolve({
    events: [event, { ...event, id: "2" }],
    next_offset: null,
  });
  await tick();
  assert.equal(s.el("radar-list").children.length, 2);
  assert.equal(s.el("radar-next").hidden, true);
  s.el("event-categories").children[0].handlers.click();
  assert.equal(s.calls[3].options.offset, 0);
  assert.equal(s.calls[3].options.date_from, undefined);
  s.calls[3].resolve({ events: [], next_offset: null });
  await tick();
});
test("event title stays text, unsafe URLs are omitted and unknown price stays unknown", async () => {
  const s = setup({ detail: true });
  s.calls[0].resolve(event);
  await tick();
  const card = s.el("radar-list").children[0].children[0];
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

test("draft acceptance stays separate from publication and preserves Tashkent time", async () => {
  const s = setup({ admin: true });
  await tick();
  s.calls[0].resolve({ sources: [] });
  await tick();
  s.sections[1].handlers.click();
  const d = {
    id: "4",
    revision: 9,
    status: "needs_review",
    source: { handle: "example" },
    text: "Event",
    verification: { canAccept: true, blockers: [] },
    event: {
      ...event,
      title: "Event",
      announcement_status: "scheduled",
      registration_url: null,
      evidence: { title: "Event", date: null, venue: null, price: null },
    },
  };
  s.calls[1].resolve({ drafts: [d] });
  await tick();
  s.el("radar-list").children[0].children.at(-1).handlers.click();
  s.calls[2].resolve(d);
  await tick();
  const form = s
    .el("radar-editor")
    .children[0].children.find((n) => n.tag === "details" && n.children.some(c => c.tag === "form")).children.find(n => n.tag === "form");
  const decision = form.children.find((n) => n.textContent === "Решение")
    .children[0];
  decision.value = "accepted";
  form.handlers.submit({ preventDefault() {} });
  assert.equal(s.calls[3].path, "/drafts/4/review");
  assert.equal(s.calls[3].options.body.expected_revision, 9);
  assert.equal(
    s.calls[3].options.body.event.starts_at,
    "2026-12-01T18:00:00+05:00",
  );
  assert.equal(
    s.calls.some((call) => call.path.endsWith("/publish")),
    false,
  );
  s.calls[3].reject({ status: 409 });
  await tick();
});

test("load-more failure keeps the feed and retry requests the same offset", async () => {
  const s = setup();
  s.calls[0].resolve({ events: [event], next_offset: 20 });
  await tick();
  s.el("radar-next").handlers.click();
  s.calls[1].reject({ status: 500 });
  await tick();
  assert.equal(s.el("radar-list").children.length, 1);
  s.el("radar-retry").handlers.click();
  assert.equal(s.calls[2].options.offset, 20);
  s.calls[2].resolve({ events: [{ ...event, id: "2" }], next_offset: null });
  await tick();
  assert.equal(s.el("radar-list").children.length, 2);
});

test("covers use only guarded API URLs and disappear cleanly on download error",async()=>{
 const s=setup();s.calls[0].resolve({events:[{...event,photo_url:"/events/1/photo"},{...event,id:"2",photo_url:"https://tracker.invalid/image.jpg"}],next_offset:null});await tick();
 const first=s.el("radar-list").children[0],second=s.el("radar-list").children[1];
 assert.equal(first.children[0].tag,"img");assert.equal(first.children[0].src,"https://api.uydosh.com/events/1/photo");
 first.children[0].handlers.error();assert.equal(first.children[0].hidden,true);
 assert.equal(second.children[0].tag,"div");
});

test("event detail hides deletion from ordinary visitors", async () => {
  const s = setup({ detail: true, allowed: false });
  s.calls[0].resolve(event);
  await tick();
  assert.equal(s.el("radar-list").children.length, 1);
  assert.equal(s.calls.length, 1);
});

test("admin deletion requires confirmation and uses the current publication revision", async () => {
  const s = setup({ detail: true });
  s.context.confirm = () => false;
  s.calls[0].resolve(event);
  await tick();
  const button = s.el("radar-list").children.at(-1);
  assert.equal(button.textContent, "Удалить мероприятие");
  await button.handlers.click();
  assert.equal(s.calls.length, 1);
  s.context.confirm = () => true;
  const deleting = button.handlers.click();
  assert.equal(s.calls[1].path, "/events/1");
  s.calls[1].resolve({ event: { id: "1", revision: 7 } });
  await tick();
  assert.equal(s.calls[2].path, "/events/1/withdraw");
  assert.equal(s.calls[2].options.body.expected_revision, 7);
  assert.equal(s.calls[2].options.method, "POST");
  s.calls[2].resolve({ event: { status: "withdrawn" } });
  await deleting;
  assert.equal(s.el("radar-list").children.length, 0);
  assert.equal(s.el("radar-status").textContent, "Мероприятие удалено из афиши.");
});

test("a rejected admin deletion keeps the event visible and allows retry", async () => {
  const s = setup({ detail: true });
  s.context.confirm = () => true;
  s.calls[0].resolve(event);
  await tick();
  const button = s.el("radar-list").children.at(-1);
  const deleting = button.handlers.click();
  s.calls[1].reject({ status: 403 });
  await deleting;
  assert.equal(s.el("radar-list").children.length, 2);
  assert.equal(button.disabled, false);
  assert.equal(s.calls.length, 2);
});

function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
test('community feed cards route to the gathering instead of a Telegram event', () => {
  const s=setup();
  const card=s.context.CityRadarUI.card({...event,id:'community:42',source_kind:'community'});
  const links=descendants(card).filter(e=>e.tag==='a');
  assert.equal(links.length,2);
  for(const link of links)assert.equal(link.href,'/telegram/gathering.html?id=42');
});
test('gathering form sends a private address separately and preserves Tashkent time', async()=>{
  const s=setup({gathering:true,createGathering:true});await tick();
  const form=descendants(s.el('radar-list')).find(e=>e.tag==='form');
  const fields=descendants(form).filter(e=>['input','textarea','select'].includes(e.tag));
  ['Мафия дома','Играем в мафию с новыми друзьями','board_games_and_social','2026-12-12T18:00','Ташкент, Юнусабад','Квартира 99','6','0'].forEach((v,i)=>fields[i].value=v);
  const action=form.handlers.submit({preventDefault(){}});
  assert.equal(s.calls[0].options.body.starts_at,'2026-12-12T18:00:00+05:00');
  assert.equal(s.calls[0].options.body.private_location,'Квартира 99');
  assert.equal(s.calls[0].options.body.venue,'Ташкент, Юнусабад');
  assert.equal(s.calls[0].options.body.price.amount,0);
  s.calls[0].resolve({id:'42'});await action;
  assert.equal(s.context.location.href,'/telegram/gathering.html?id=42');
});
test('requesting to join refreshes membership instead of granting immediate admission',async()=>{
  const s=setup({gathering:true});await tick();
  const detail={...event,description:'Мафия с друзьями',owner_name:'Организатор',capacity:6,spots_left:5,status:'published',is_owner:false,can_manage:false,my_status:null,private_location:null};
  s.calls[0].resolve(detail);await tick();
  const join=descendants(s.el('radar-list')).find(e=>e.textContent==='Хочу с вами');
  const action=join.handlers.click();assert.equal(s.calls[1].path,'/1/join');
  s.calls[1].resolve({status:'pending'});await tick();
  s.calls[2].resolve({...detail,my_status:'pending'});await action;
  assert.ok(descendants(s.el('radar-list')).some(e=>e.textContent.includes('Ждём решения организатора')));
});
