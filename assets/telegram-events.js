(() => {
  const R = CityRadarUI,
    $ = (id) => document.getElementById(id);
  const detail = /\/event\.html$/.test(location.pathname);
  let offset = 0,
    next = null,
    generation = 0,
    data = null;
  let filters = { category: "" };
  let loading = false;
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
      $("event-categories").replaceChildren(
        ...["", ...R.categories].map((value) => {
          const button = R.node(
            "button",
            value ? R.category(value) : R.t("all"),
          );
          button.type = "button";
          button.setAttribute(
            "aria-pressed",
            String(filters.category === value),
          );
          button.addEventListener("click", () => {
            if (filters.category === value) return;
            filters = { category: value };
            offset = 0;
            for (const chip of $("event-categories").children) {
              chip.setAttribute("aria-pressed", String(chip === button));
            }
            load();
          });
          return button;
        }),
      );
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
    if (offset === 0 || detail) {
      data = null;
      $("radar-list").replaceChildren();
    }
    $("radar-status").textContent = R.t("loading");
    $("radar-retry").hidden = true;
    if (!detail) {
      $("radar-next").hidden = true;
      $("radar-next").disabled = true;
    }
    loading = true;
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
      data =
        !detail && offset > 0 && data
          ? {
              ...result,
              events: [
                ...new Map(
                  [...data.events, ...result.events].map((event) => [
                    String(event.id),
                    event,
                  ]),
                ).values(),
              ],
            }
          : result;
      next = result.next_offset;
      render();
      if (!detail) {
        $("radar-next").hidden = next == null;
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
    } finally {
      if (ticket === generation) loading = false;
    }
  }
  if (!detail) {
    $("radar-next").addEventListener("click", () => {
      if (next != null && !loading) {
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
