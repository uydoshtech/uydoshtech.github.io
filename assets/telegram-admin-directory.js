/**
 * Admin directory screens for the Mini App: moderation users and Telegram
 * location reports. Both pages share this script and pick a mode from
 * `[data-admin-directory]`.
 */
(function () {
  const USERS_PAGE_SIZE = 20;
  const LOCATIONS_PAGE_SIZE = 30;
  const HISTORY_LIMIT = 1000;
  const DEDUP_OPTIONS = [2, 3, 4, 5, 6];
  const WEEKDAY_COLORS = {
    1: "#1E88E5",
    2: "#43A047",
    3: "#E53935",
    4: "#8E24AA",
    5: "#FB8C00",
    6: "#00ACC1",
    0: "#D81B60",
  };

  function text(key) {
    return typeof t === "function" ? t(key) : key;
  }

  function fill(key, value, token = "count") {
    return text(key).replaceAll(`{${token}}`, String(value));
  }

  function formatWhen(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const lang = typeof getLang === "function" ? getLang() : "ru";
    const locale = lang === "en" ? "en" : lang === "uz" ? "uz" : "ru";
    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatWhenTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const lang = typeof getLang === "function" ? getLang() : "ru";
    const locale = lang === "en" ? "en" : lang === "uz" ? "uz" : "ru";
    return date.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function roleLabel(role) {
    if (!role) return text("admin.users.unspecified");
    const key = `admin.role.${role}`;
    const label = text(key);
    return label === key ? role : label;
  }

  function telegramHandle(user) {
    return String(user.telegramUsername || user.telegram_username || "")
      .trim()
      .replace(/^@/, "");
  }

  function userTitle(user) {
    const username = telegramHandle(user);
    if (username) return `@${username}`;
    if (user.email) return String(user.email);
    return text("admin.users.unspecified");
  }

  function openTelegramChat(handle) {
    const clean = String(handle || "").trim().replace(/^@/, "");
    if (!clean) return;
    const url = `https://t.me/${encodeURIComponent(clean)}`;
    const tg = window.Telegram?.WebApp;
    UyDosh.haptic?.light?.();
    if (typeof tg?.openTelegramLink === "function") tg.openTelegramLink(url);
    else if (typeof tg?.openLink === "function") tg.openLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  function showStatus(status, message, { error = false, retry = null } = {}) {
    status.hidden = false;
    status.textContent = message;
    const button = status.querySelector("button");
    if (button) button.remove();
    if (retry) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "admin-retry";
      action.textContent = text("admin.retry");
      action.addEventListener("click", retry);
      status.appendChild(document.createElement("br"));
      status.appendChild(action);
    }
    status.classList.toggle("error", error);
  }

  function bindLoadMore(list, loadMore) {
    const sentinel = document.createElement("div");
    sentinel.hidden = true;
    list.after(sentinel);
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(sentinel);
    return {
      setHasMore(hasMore) {
        sentinel.hidden = !hasMore;
      },
    };
  }

  async function startUsers(root) {
    const status = root.querySelector("[data-admin-status]");
    const list = root.querySelector("[data-admin-list]");
    let page = 1;
    let loading = false;
    let hasMore = true;
    const pager = bindLoadMore(list, () => load(true));

    async function load(more) {
      if (loading || (more && !hasMore)) return;
      loading = true;
      if (!more) {
        page = 1;
        list.replaceChildren();
        showStatus(status, text("admin.loading"));
      }
      try {
        const users = await UyDosh.fetchAdminUsers({
          pageNumber: more ? page + 1 : 1,
          pageSize: USERS_PAGE_SIZE,
        });
        const rows = Array.isArray(users) ? users : [];
        page = more ? page + 1 : 1;
        hasMore = rows.length >= USERS_PAGE_SIZE;
        for (const user of rows) list.appendChild(userCard(user));
        list.hidden = list.childElementCount === 0;
        if (list.childElementCount === 0) {
          showStatus(status, text("admin.users.empty"));
        } else {
          status.hidden = true;
        }
        pager.setHasMore(hasMore);
      } catch {
        if (list.childElementCount === 0) {
          showStatus(status, text("admin.users.error"), {
            error: true,
            retry: () => load(false),
          });
        }
        hasMore = false;
        pager.setHasMore(false);
      } finally {
        loading = false;
      }
    }

    load(false);
  }

  function userCard(user) {
    const handle = telegramHandle(user);
    const card = document.createElement(handle ? "button" : "article");
    card.className = "admin-card";
    if (handle) {
      card.type = "button";
      card.classList.add("is-tappable");
      card.addEventListener("click", () => openTelegramChat(handle));
    }
    const title = document.createElement("div");
    title.className = "admin-card-title";
    if (user.isOnline) {
      const dot = document.createElement("span");
      dot.className = "admin-online";
      dot.title = text("admin.users.online");
      title.appendChild(dot);
    }
    const name = document.createElement("b");
    name.textContent = `ID ${user.id} · ${userTitle(user)}`;
    title.appendChild(name);
    card.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "admin-card-meta";
    const created = formatWhen(user.lastActiveAt || user.created_at);
    meta.textContent = created ? `${roleLabel(user.role)} · ${created}` : roleLabel(user.role);
    card.appendChild(meta);
    return card;
  }

  async function startLocations(root) {
    const params = new URLSearchParams(location.search);
    const telegramUserId = params.get("user");
    if (telegramUserId && /^[0-9]{1,20}$/.test(telegramUserId)) {
      return startHistory(root, telegramUserId);
    }
    const status = root.querySelector("[data-admin-status]");
    const list = root.querySelector("[data-admin-list]");
    const search = root.querySelector("[data-admin-search]");
    search.hidden = false;
    let page = 1;
    let loading = false;
    let hasMore = true;
    let query = "";
    let timer = 0;
    const pager = bindLoadMore(list, () => load(true));

    search.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        query = search.value.trim();
        load(false);
      }, 350);
    });

    async function load(more) {
      if (loading || (more && !hasMore)) return;
      loading = true;
      if (!more) {
        page = 1;
        list.replaceChildren();
        showStatus(status, text("admin.loading"));
      }
      try {
        const payload = await UyDosh.fetchAdminTelegramLocationUsers({
          q: query || undefined,
          page: more ? page + 1 : 1,
          limit: LOCATIONS_PAGE_SIZE,
        });
        const rows = Array.isArray(payload?.users) ? payload.users : [];
        page = Number(payload?.page) || (more ? page + 1 : 1);
        const total = Number(payload?.total) || 0;
        hasMore = page * LOCATIONS_PAGE_SIZE < total;
        for (const user of rows) list.appendChild(locationCard(user));
        list.hidden = list.childElementCount === 0;
        if (list.childElementCount === 0) {
          showStatus(status, text("admin.locations.empty"));
        } else {
          status.hidden = true;
        }
        pager.setHasMore(hasMore);
      } catch {
        if (list.childElementCount === 0) {
          showStatus(status, text("admin.locations.error"), {
            error: true,
            retry: () => load(false),
          });
        }
        hasMore = false;
        pager.setHasMore(false);
      } finally {
        loading = false;
      }
    }

    load(false);
  }

  function locationInitials(username, id) {
    const source = username || String(id);
    const chars = Array.from(source).filter((ch) => /[\p{L}\p{N}]/u.test(ch));
    return (chars.slice(0, 2).join("") || "?").toLocaleUpperCase("ru");
  }

  function locationAvatar(username, id) {
    const avatar = document.createElement("span");
    avatar.className = "admin-card-avatar";
    avatar.setAttribute("aria-hidden", "true");
    const letters = document.createElement("span");
    letters.textContent = locationInitials(username, id);
    avatar.appendChild(letters);
    const url = typeof UyDosh?.telegramAvatarUrl === "function" ? UyDosh.telegramAvatarUrl(username) : "";
    if (url) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = url;
      img.addEventListener("error", () => img.remove());
      avatar.appendChild(img);
    }
    return avatar;
  }

  function locationCard(user) {
    const id = String(user.telegramUserId ?? "");
    const username = String(user.telegramUsername || "").trim().replace(/^@/, "");
    const card = document.createElement("a");
    card.className = "admin-card admin-card-row";
    card.href = `/telegram/admin-locations.html?user=${encodeURIComponent(id)}`;
    card.appendChild(locationAvatar(username, id));
    const body = document.createElement("div");
    body.className = "admin-card-body";
    const title = document.createElement("div");
    title.className = "admin-card-title";
    const name = document.createElement("b");
    name.textContent = username ? `@${username}` : `#${id}`;
    title.appendChild(name);
    if (user.phoneNumber) {
      const phone = document.createElement("span");
      phone.className = "admin-phone";
      phone.textContent = "☎";
      phone.setAttribute("aria-hidden", "true");
      title.appendChild(phone);
    }
    const when = document.createElement("span");
    when.className = "admin-card-side";
    when.textContent = formatWhenTime(user.lastSeenAt);
    title.appendChild(when);
    body.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "admin-card-meta";
    meta.textContent = fill("admin.locations.pings", user.pingCount ?? 0);
    body.appendChild(meta);
    card.appendChild(body);
    return card;
  }

  function localeTag() {
    const lang = typeof getLang === "function" ? getLang() : "ru";
    return lang === "en" ? "en" : lang === "uz" ? "uz" : "ru";
  }

  function formatDedupDistance(precision) {
    const meters = 111320 / 10 ** precision;
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    if (meters >= 10) return `${Math.round(meters)} m`;
    return `${meters.toFixed(1)} m`;
  }

  function zoomForSpan(latSpan, lonSpan) {
    const span = Math.max(Math.abs(latSpan), Math.abs(lonSpan));
    const thresholds = [0.0008, 0.0015, 0.003, 0.006, 0.012, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6];
    let zoom = 17;
    for (const threshold of thresholds) {
      if (span <= threshold) return zoom;
      zoom -= 1;
    }
    return zoom;
  }

  function computeDayGroups(points) {
    const groupIndexForPoint = [];
    const colorForPoint = [];
    const dayNumberForPoint = [];
    const chronologicalGroups = [];
    let currentKey = "";
    for (let i = 0; i < points.length; i += 1) {
      const createdAt = new Date(points[i].createdAt);
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
      if (key !== currentKey) {
        chronologicalGroups.push([]);
        currentKey = key;
      }
      const groupIndex = chronologicalGroups.length - 1;
      chronologicalGroups[groupIndex].push(i);
      groupIndexForPoint[i] = groupIndex;
      colorForPoint[i] = WEEKDAY_COLORS[createdAt.getDay()] || WEEKDAY_COLORS[1];
      dayNumberForPoint[i] = chronologicalGroups[groupIndex].length;
    }
    return { groupIndexForPoint, colorForPoint, chronologicalGroups, dayNumberForPoint };
  }

  function pointTimeLabel(point) {
    const locale = localeTag();
    const start = new Date(point.createdAt);
    const end = new Date(point.lastSeenAt || point.createdAt);
    const datePart = start.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (Number(point.repeatCount) > 1 && !Number.isNaN(end.getTime())) {
      const endTime = end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      return `${datePart} – ${endTime}`;
    }
    return datePart;
  }

  async function startHistory(root, telegramUserId) {
    const status = root.querySelector("[data-admin-status]");
    const list = root.querySelector("[data-admin-list]");
    const back = root.querySelector("[data-admin-back]");
    const title = root.querySelector("h1");
    const shell = root.querySelector("[data-admin-history]");
    if (back) back.hidden = true;
    list.hidden = true;
    document.body.classList.add("admin-history-open");

    const view = {
      history: [],
      groups: computeDayGroups([]),
      total: 0,
      dedup: 4,
      selected: null,
      expanded: null,
      loading: false,
      map: null,
      ymaps: null,
      badgeLayout: null,
    };

    shell.hidden = false;
    shell.replaceChildren();
    const summary = document.createElement("div");
    summary.className = "admin-history-summary";
    const count = document.createElement("span");
    const tools = document.createElement("div");
    tools.className = "admin-history-tools";
    const dedupButton = document.createElement("button");
    dedupButton.type = "button";
    dedupButton.className = "admin-dedup";
    const dedupMenu = document.createElement("div");
    dedupMenu.className = "admin-dedup-menu";
    dedupMenu.hidden = true;
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "admin-history-delete";
    deleteButton.setAttribute("aria-label", text("admin.locations.delete"));
    deleteButton.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V5h6v2"></path><path d="M8 7l1 13h6l1-13"></path></svg>';
    tools.append(dedupButton, dedupMenu, deleteButton);
    summary.append(count, tools);
    const mapEl = document.createElement("div");
    mapEl.className = "admin-history-map";
    const timeline = document.createElement("div");
    timeline.className = "admin-history-list";
    shell.append(summary, mapEl, timeline);

    function visibleIndices() {
      const groups = view.groups.chronologicalGroups;
      if (view.expanded == null || view.expanded >= groups.length) return [];
      return groups[view.expanded];
    }

    function paintDedup() {
      dedupButton.textContent = fill(
        "admin.locations.merge",
        formatDedupDistance(view.dedup),
        "distance",
      );
      dedupMenu.replaceChildren();
      for (const option of DEDUP_OPTIONS) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "admin-dedup-option";
        item.textContent = `${option === view.dedup ? "✓ " : ""}${formatDedupDistance(option)}`;
        item.addEventListener("click", () => {
          dedupMenu.hidden = true;
          if (option === view.dedup) return;
          view.dedup = option;
          load();
        });
        dedupMenu.appendChild(item);
      }
    }

    function renderTimeline() {
      timeline.replaceChildren();
      const groups = view.groups.chronologicalGroups;
      for (let i = groups.length - 1; i >= 0; i -= 1) {
        const pointIndices = groups[i];
        const latest = view.history[pointIndices[pointIndices.length - 1]];
        const color = view.groups.colorForPoint[pointIndices[0]];
        const expanded = view.expanded === i;
        const section = document.createElement("section");
        section.className = "admin-day";
        const header = document.createElement("button");
        header.type = "button";
        header.className = "admin-day-header";
        const dot = document.createElement("span");
        dot.className = "admin-day-dot";
        dot.style.background = color;
        const label = document.createElement("b");
        label.textContent = new Date(latest.createdAt).toLocaleDateString(localeTag(), {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const amount = document.createElement("span");
        amount.textContent = `(${pointIndices.length})`;
        const rule = document.createElement("span");
        rule.className = "admin-day-rule";
        const chevron = document.createElement("span");
        chevron.className = "admin-day-chevron";
        chevron.textContent = expanded ? "▴" : "▾";
        header.append(dot, label, amount, rule, chevron);
        header.addEventListener("click", () => {
          UyDosh.haptic?.light?.();
          if (expanded) view.expanded = null;
          else {
            view.expanded = i;
            view.selected = pointIndices[pointIndices.length - 1];
          }
          renderTimeline();
          drawMap(true);
        });
        section.appendChild(header);
        if (expanded) {
          const points = document.createElement("div");
          points.className = "admin-day-points";
          for (const index of pointIndices.slice().reverse()) {
            points.appendChild(pointRow(index));
          }
          section.appendChild(points);
        }
        timeline.appendChild(section);
      }
      const selectedRow = timeline.querySelector(".admin-point.is-selected");
      selectedRow?.scrollIntoView({ block: "nearest" });
    }

    function pointRow(index) {
      const point = view.history[index];
      const selected = view.selected === index;
      const row = document.createElement("button");
      row.type = "button";
      row.className = `admin-point${selected ? " is-selected" : ""}`;
      const badge = document.createElement("span");
      badge.className = "admin-point-num";
      badge.textContent = String(view.groups.dayNumberForPoint[index]);
      const body = document.createElement("span");
      body.className = "admin-point-body";
      const when = document.createElement("b");
      when.textContent = pointTimeLabel(point);
      const coords = document.createElement("small");
      coords.textContent = `${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}`;
      body.append(when, coords);
      row.append(badge, body);
      if (Number(point.repeatCount) > 1) {
        const repeats = document.createElement("span");
        repeats.className = "admin-point-repeat";
        repeats.textContent = `×${point.repeatCount}`;
        row.appendChild(repeats);
      }
      if (point.phoneNumber) {
        const phone = document.createElement("span");
        phone.className = "admin-phone";
        phone.textContent = "☎";
        phone.setAttribute("aria-hidden", "true");
        row.appendChild(phone);
      }
      row.addEventListener("click", () => {
        view.selected = index;
        renderTimeline();
        drawMap(false, { fit: false });
        focusSelected();
      });
      return row;
    }

    async function ensureMap() {
      if (view.map) return true;
      const module = await UyDosh.loadYandexMapModule();
      view.ymaps = await module.loadYandexScript(typeof getLang === "function" ? getLang() : "ru");
      view.map = new view.ymaps.Map(
        mapEl,
        { center: [41.31139, 69.27972], zoom: 12, controls: ["zoomControl"] },
        { suppressMapOpenBlock: true },
      );
      view.badgeLayout = view.ymaps.templateLayoutFactory.createClass(
        '<div class="admin-map-badge"></div>',
        {
          build() {
            view.badgeLayout.superclass.build.call(this);
            const el = this.getElement()?.firstChild;
            const props = this.getData().properties;
            if (!el || !props) return;
            el.textContent = props.get("label") || "";
            el.style.background = props.get("color") || WEEKDAY_COLORS[1];
            el.classList.toggle("is-selected", Boolean(props.get("selected")));
          },
        },
      );
      return true;
    }

    function drawMap(animate, { fit = true } = {}) {
      const indices = visibleIndices();
      if (!view.map) return;
      view.map.geoObjects.removeAll();
      if (indices.length > 1) {
        const color = view.groups.colorForPoint[indices[0]];
        view.map.geoObjects.add(
          new view.ymaps.Polyline(
            indices.map((index) => [view.history[index].latitude, view.history[index].longitude]),
            {},
            { strokeColor: `${color}cc`, strokeWidth: 3 },
          ),
        );
      }
      for (const index of indices) {
        const point = view.history[index];
        const selected = view.selected === index;
        const placemark = new view.ymaps.Placemark(
          [point.latitude, point.longitude],
          {
            label: String(view.groups.dayNumberForPoint[index]),
            color: view.groups.colorForPoint[index],
            selected,
          },
          {
            iconLayout: view.badgeLayout,
            iconOffset: [-16, -16],
            iconShape: { type: "Circle", coordinates: [16, 16], radius: 18 },
            zIndex: selected ? 1000 : index,
          },
        );
        placemark.events.add("click", () => {
          view.selected = index;
          renderTimeline();
          drawMap(false, { fit: false });
          focusSelected();
        });
        view.map.geoObjects.add(placemark);
      }
      if (fit) fitVisible(Boolean(animate) && indices.length > 0);
    }

    function fitVisible(animate) {
      const indices = visibleIndices();
      if (!view.map || !indices.length) return;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLon = Infinity;
      let maxLon = -Infinity;
      for (const index of indices) {
        const point = view.history[index];
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLon = Math.min(minLon, point.longitude);
        maxLon = Math.max(maxLon, point.longitude);
      }
      const zoom = Math.min(18, Math.max(12, zoomForSpan(maxLat - minLat, maxLon - minLon)));
      view.map.setCenter([(minLat + maxLat) / 2, (minLon + maxLon) / 2], zoom, {
        duration: animate ? 300 : 0,
      });
    }

    function focusSelected() {
      const point = view.history[view.selected];
      if (!view.map || !point) return;
      view.map.setCenter([point.latitude, point.longitude], 15, { duration: 300 });
    }

    async function load() {
      if (view.loading) return;
      view.loading = true;
      const first = view.history.length === 0;
      if (first) showStatus(status, text("admin.loading"));
      paintDedup();
      dedupButton.disabled = true;
      try {
        const payload = await UyDosh.fetchAdminTelegramLocationHistory(telegramUserId, {
          page: 1,
          limit: HISTORY_LIMIT,
          dedupPrecision: view.dedup,
        });
        view.history = Array.isArray(payload?.history) ? payload.history : [];
        view.total = Number(payload?.total) || view.history.length;
        view.groups = computeDayGroups(view.history);
        const groupCount = view.groups.chronologicalGroups.length;
        view.expanded = groupCount ? groupCount - 1 : null;
        view.selected = view.history.length ? view.history.length - 1 : null;
        const username = String(payload?.telegramUsername || "").trim().replace(/^@/, "");
        if (title) {
          title.replaceChildren();
          if (username) {
            const userLink = document.createElement("button");
            userLink.type = "button";
            userLink.className = "admin-history-user";
            userLink.textContent = `@${username}`;
            userLink.addEventListener("click", () => openTelegramChat(username));
            title.appendChild(userLink);
          } else {
            title.textContent = `#${telegramUserId}`;
          }
        }
        count.textContent = fill("admin.locations.pings", view.total);
        deleteButton.hidden = view.history.length === 0;
        if (!view.history.length) {
          shell.hidden = true;
          showStatus(status, text("admin.locations.historyEmpty"));
          return;
        }
        status.hidden = true;
        shell.hidden = false;
        renderTimeline();
        try {
          await ensureMap();
          requestAnimationFrame(() => {
            try {
              view.map.container.fitToViewport();
            } catch {
              /* The map still draws if the container already has a size. */
            }
            drawMap(false);
          });
        } catch {
          mapEl.textContent = text("admin.locations.error");
        }
      } catch {
        if (first) {
          shell.hidden = true;
          showStatus(status, text("admin.locations.error"), { error: true, retry: load });
        }
      } finally {
        view.loading = false;
        dedupButton.disabled = false;
        paintDedup();
      }
    }

    dedupButton.addEventListener("click", () => {
      dedupMenu.hidden = !dedupMenu.hidden;
    });
    document.addEventListener("click", (event) => {
      if (!tools.contains(event.target)) dedupMenu.hidden = true;
    });
    deleteButton.addEventListener("click", () => confirmDelete());

    function confirmDelete() {
      const dialog = document.createElement("div");
      dialog.className = "admin-dialog";
      dialog.innerHTML = `<div class="admin-dialog-card" role="alertdialog"><b></b><p></p><div class="admin-dialog-actions"><button type="button" data-cancel></button><button type="button" data-confirm></button></div></div>`;
      dialog.querySelector("b").textContent = text("admin.locations.deleteTitle");
      dialog.querySelector("p").textContent = text("admin.locations.deleteBody");
      dialog.querySelector("[data-cancel]").textContent = text("admin.locations.cancel");
      const confirm = dialog.querySelector("[data-confirm]");
      confirm.textContent = text("admin.locations.deleteAction");
      dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.remove());
      confirm.addEventListener("click", async () => {
        confirm.disabled = true;
        try {
          await UyDosh.deleteAdminTelegramLocationHistory(telegramUserId);
          location.href = "/telegram/admin-locations.html";
        } catch {
          confirm.disabled = false;
          dialog.querySelector("p").textContent = text("admin.locations.error");
        }
      });
      document.body.appendChild(dialog);
    }

    paintDedup();
    load();
  }

  function bindTelegramBack(fallback) {
    if (!UyDosh.isMiniApp?.()) return;
    const back = window.Telegram?.WebApp?.BackButton;
    if (!back) return;
    if (!window.__uydoshAdminBackBound) {
      window.__uydoshAdminBackBound = true;
      back.onClick(() => {
        UyDosh.haptic?.light?.();
        if (window.history.length > 1) window.history.back();
        else location.href = fallback;
      });
    }
    back.show();
    setTimeout(() => back.show(), 200);
  }

  async function start() {
    const root = document.querySelector("[data-admin-directory]");
    if (!root || !window.UyDosh) return;
    try {
      UyDosh.initTelegramMiniApp();
    } catch (error) {
      console.error("UyDosh Mini App startup failed on admin directory", error);
    }
    const historyUser = new URLSearchParams(location.search).get("user");
    const onHistory =
      root.dataset.adminDirectory === "locations" &&
      historyUser &&
      /^[0-9]{1,20}$/.test(historyUser);
    bindTelegramBack(onHistory ? "/telegram/admin-locations.html" : "/telegram/");
    UyDosh.applyI18n?.();
    const status = root.querySelector("[data-admin-status]");
    let allowed = false;
    try {
      allowed = Boolean(await UyDosh.ensureTelegramMiniAppSession()) && UyDosh.isAdmin();
    } catch {
      allowed = false;
    }
    if (!allowed) {
      showStatus(status, text("admin.denied"));
      return;
    }
    if (root.dataset.adminDirectory === "users") startUsers(root);
    else startLocations(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
