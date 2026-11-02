/**
 * Admin directory screens for the Mini App: moderation users and Telegram
 * location reports. Both pages share this script and pick a mode from
 * `[data-admin-directory]`.
 */
(function () {
  const USERS_PAGE_SIZE = 20;
  const LOCATIONS_PAGE_SIZE = 30;
  const HISTORY_PAGE_SIZE = 200;

  function text(key) {
    return typeof t === "function" ? t(key) : key;
  }

  function fill(key, count) {
    return text(key).replace("{count}", String(count));
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

  function userTitle(user) {
    const username = String(user.telegramUsername || user.telegram_username || "")
      .trim()
      .replace(/^@/, "");
    if (username) return `@${username}`;
    if (user.email) return String(user.email);
    return text("admin.users.unspecified");
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
    const card = document.createElement("article");
    card.className = "admin-card";
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
    const created = formatWhen(user.created_at);
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

  function locationCard(user) {
    const id = String(user.telegramUserId ?? "");
    const username = String(user.telegramUsername || "").trim().replace(/^@/, "");
    const card = document.createElement("a");
    card.className = "admin-card";
    card.href = `/telegram/admin-locations.html?user=${encodeURIComponent(id)}`;
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
    card.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "admin-card-meta";
    meta.textContent = fill("admin.locations.pings", user.pingCount ?? 0);
    card.appendChild(meta);
    return card;
  }

  async function startHistory(root, telegramUserId) {
    const status = root.querySelector("[data-admin-status]");
    const list = root.querySelector("[data-admin-list]");
    const back = root.querySelector("[data-admin-back]");
    const title = root.querySelector("h1");
    back.hidden = false;
    let page = 1;
    let loading = false;
    let hasMore = true;
    const pager = bindLoadMore(list, () => load(true));

    async function load(more) {
      if (loading || (more && !hasMore)) return;
      loading = true;
      if (!more) showStatus(status, text("admin.loading"));
      try {
        let payload;
        if (!more) {
          const probe = await UyDosh.fetchAdminTelegramLocationHistory(telegramUserId, {
            page: 1,
            limit: HISTORY_PAGE_SIZE,
          });
          const total = Number(probe?.total) || 0;
          page = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
          payload =
            page === 1
              ? probe
              : await UyDosh.fetchAdminTelegramLocationHistory(telegramUserId, {
                  page,
                  limit: HISTORY_PAGE_SIZE,
                });
        } else {
          page -= 1;
          payload = await UyDosh.fetchAdminTelegramLocationHistory(telegramUserId, {
            page,
            limit: HISTORY_PAGE_SIZE,
          });
        }
        const rows = Array.isArray(payload?.history) ? payload.history : [];
        hasMore = page > 1;
        const username = String(payload?.telegramUsername || "").trim().replace(/^@/, "");
        if (title && !more) title.textContent = username ? `@${username}` : `#${telegramUserId}`;
        const newestFirst = rows.slice().reverse();
        for (const point of newestFirst) list.appendChild(historyCard(point));
        list.hidden = list.childElementCount === 0;
        if (list.childElementCount === 0) {
          showStatus(status, text("admin.locations.historyEmpty"));
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

  function historyCard(point) {
    const lat = Number(point.latitude);
    const lng = Number(point.longitude);
    const card = document.createElement("a");
    card.className = "admin-card";
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.href = `https://yandex.ru/maps/?ll=${encodeURIComponent(`${lng},${lat}`)}&z=16&pt=${encodeURIComponent(`${lng},${lat}`)}`;
    const title = document.createElement("div");
    title.className = "admin-card-title";
    const name = document.createElement("b");
    name.textContent = formatWhenTime(point.createdAt);
    title.appendChild(name);
    const map = document.createElement("span");
    map.className = "admin-card-side";
    map.textContent = text("admin.locations.openMap");
    title.appendChild(map);
    card.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "admin-card-meta";
    meta.textContent = Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : "";
    card.appendChild(meta);
    return card;
  }

  async function start() {
    const root = document.querySelector("[data-admin-directory]");
    if (!root || !window.UyDosh) return;
    try {
      UyDosh.initTelegramMiniApp();
    } catch (error) {
      console.error("UyDosh Mini App startup failed on admin directory", error);
    }
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
