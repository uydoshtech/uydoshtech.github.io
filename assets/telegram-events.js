(() => {
  const R = CityRadarUI,
    $ = (id) => document.getElementById(id);
  const detail = /\/event\.html$/.test(location.pathname);
  let offset = 0,
    next = null,
    generation = 0,
    data = null;
  let filters = { category: "", date_from: "", date_to: "" };
  UyDosh.initTelegramMiniApp?.();
  if (detail) {
    const back = window.Telegram?.WebApp?.BackButton;
    back?.show();
    back?.onClick(() => {
      location.href = "/telegram/events.html";
    });
  }
  function labels() {
    document.querySelectorAll("[data-radar-label]").forEach((el) => {
      el.textContent = R.t(el.dataset.radarLabel);
    });
    if (!detail) {
      const selected = $("event-category").value;
      $("event-category").replaceChildren(
        ...["", ...R.categories].map((value) => {
          const o = R.node("option", value ? R.category(value) : R.t("all"));
          o.value = value;
          return o;
        }),
      );
      $("event-category").value = selected;
    }
  }
  function render() {
    $("radar-list").replaceChildren(
      ...(detail ? [R.card(data, true)] : data.events.map((e) => R.card(e))),
    );
    $("radar-status").textContent =
      !detail && !data.events.length ? R.t("empty") : "";
  }
  async function load() {
    const ticket = ++generation;
    $("radar-list").replaceChildren();
    $("radar-status").textContent = R.t("loading");
    $("radar-retry").hidden = true;
    if (!detail) {
      $("radar-prev").disabled = true;
      $("radar-next").disabled = true;
    }
    data = null;
    try {
      const id = new URLSearchParams(location.search).get("id");
      if (detail && !/^[1-9]\d*$/.test(id || ""))
        throw Object.assign(new Error(), { status: 404 });
      const result = await UyDosh.cityRadarPublic(detail ? "/" + id : "", {
        ...filters,
        offset,
        limit: 20,
      });
      if (ticket !== generation) return;
      data = result;
      next = result.next_offset;
      render();
      if (!detail) {
        $("radar-prev").disabled = offset === 0;
        $("radar-next").disabled = next == null;
      }
    } catch (error) {
      if (ticket !== generation) return;
      $("radar-status").textContent = R.t(
        error.status === 503
          ? "unavailable"
          : error.status === 404
            ? "missing"
            : "error",
      );
      $("radar-retry").hidden = error.status === 404;
    }
  }
  if (!detail) {
    $("event-filters").addEventListener("submit", (event) => {
      event.preventDefault();
      const from = $("event-from").value,
        to = $("event-to").value;
      if (from && to && from > to) {
        $("radar-status").textContent = R.t("dates");
        return;
      }
      filters = {
        category: $("event-category").value,
        date_from: from,
        date_to: to,
      };
      offset = 0;
      load();
    });
    $("radar-prev").addEventListener("click", () => {
      offset = Math.max(0, offset - 20);
      load();
    });
    $("radar-next").addEventListener("click", () => {
      if (next != null) {
        offset = next;
        load();
      }
    });
  }
  $("radar-retry").addEventListener("click", load);
  document.addEventListener("uydosh:langchange", () => {
    labels();
    if (data) render();
  });
  labels();
  load();
})();
