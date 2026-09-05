UyDosh.initTelegramMiniApp();
if (UyDosh.isMiniApp()) {
  const webApp = window.Telegram?.WebApp;
  const goBack = () => {
    UyDosh.haptic?.light?.();
    if (window.history.length > 1) window.history.back();
    else location.href = "/telegram/";
  };
  webApp?.BackButton?.onClick(goBack);
  webApp?.BackButton?.show();
  // Some Telegram WebViews finish applying their header state after `ready`.
  // Reassert visibility after that pass without adding another click handler.
  setTimeout(() => webApp?.BackButton?.show(), 200);
}
const money = (n) =>
  new Intl.NumberFormat("ru-RU").format(Number(n || 0)) + " сум/мес";
const escape = (v) => UyDosh.escapeHtml(String(v ?? ""));
const hostelFilters = [
  { gender: "", label: "Все", modifier: "all" },
  { gender: "male", label: "Мужские", modifier: "male" },
  { gender: "female", label: "Женские", modifier: "female" },
  { gender: "mixed", label: "Смешанные", modifier: "mixed" },
];

function selectedHostelFilter() {
  const picker = document.querySelector(".hostel-filter-pill.active");
  return (
    hostelFilters.find((filter) => filter.gender === picker?.dataset.gender) ||
    hostelFilters[0]
  );
}

function applyHostelFilter(filter) {
  document.querySelectorAll(".hostel-filter-pill").forEach((pill) => {
    const active = pill.dataset.gender === filter.gender;
    pill.classList.toggle("active", active);
    pill.setAttribute("aria-pressed", String(active));
  });
}

function photo(hostel) {
  return hostel.photos?.[0]?.photo_url || UyDosh.hostelPlaceholderImageUrl();
}
async function listHostels() {
  const target = document.getElementById("hostels");
  if (!target) return;
  const status = document.getElementById("status");
  status.classList.add("hostels-loading");
  status.innerHTML = '<span class="hostels-loading-spinner" aria-label="Загрузка"></span>';
  try {
    const gender = selectedHostelFilter().gender;
    const hostels = await UyDosh.fetchHostels({ gender });
    target.innerHTML =
      hostels
        .map((h) => {
          const min = (h.units || [])
            .filter((u) => u.beds_available > 0)
            .map((u) => Number(u.price))
            .sort((a, b) => a - b)[0];
          const beds = (h.units || []).reduce(
            (n, u) => n + Number(u.beds_available || 0),
            0,
          );
          return `<a class="hostel-card" href="/telegram/hostel.html?id=${encodeURIComponent(h.id)}">${photo(h) ? `<img src="${escape(photo(h))}" alt="">` : ""}<div class="hostel-card-body"><h2>${escape(h.name)}</h2><div class="hostel-meta">${escape(h.address || "Ташкент")} · ${beds} свободных мест</div><div class="hostel-price">${min ? "от " + money(min) : "Нет свободных мест"}</div></div></a>`;
        })
        .join("") || '<div class="status">Хостелы не найдены</div>';
    status.classList.remove("hostels-loading");
    status.textContent = "";
  } catch (e) {
    status.classList.remove("hostels-loading");
    status.textContent = "Не удалось загрузить хостелы";
  }
}
async function detailHostel() {
  const root = document.getElementById("hostel-detail");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    root.textContent = "Хостел не найден";
    return;
  }
  try {
    const h = await UyDosh.fetchHostel(id);
    const units = h.units || [];
    root.innerHTML = `${photo(h) ? `<img class="hostel-hero" src="${escape(photo(h))}" alt="">` : ""}<div class="hostel-detail-body"><div class="hostel-detail-title"><h1>${escape(h.name)}</h1><a id="hostel-admin-edit" class="hostel-admin-edit" href="/telegram/hostel-create.html?id=${encodeURIComponent(h.id)}" hidden aria-label="Редактировать хостел" title="Редактировать хостел">✎</a></div><div class="hostel-meta">${escape(h.address || "Ташкент")}</div><p>${escape(h.description_ru || h.description_uz || h.description_en || "")}</p><h2>Свободные места</h2><div class="hostel-units">${units.map((u) => `<label class="hostel-unit"><div class="hostel-unit-top"><b>${escape(u.name)}</b><b>${money(u.price)}</b></div><div class="hostel-meta">${u.beds_available} из ${u.beds_total} мест · ${escape(u.gender)}</div><input type="radio" name="unit" value="${u.id}" ${u.beds_available > 0 ? "" : "disabled"}></label>`).join("")}</div><form id="request" class="hostel-request"><textarea name="message" placeholder="Комментарий для администратора (необязательно)"></textarea><button ${units.some((u) => u.beds_available > 0) ? "" : "disabled"}>Запросить место</button></form></div>`;
    UyDosh.ensureTelegramMiniAppSession().then((ready) => {
      const edit = document.getElementById("hostel-admin-edit");
      if (ready && UyDosh.isAdmin() && edit) edit.hidden = false;
    });
    document
      .getElementById("request")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const unit = Number(new FormData(e.currentTarget).get("unit"));
        if (!unit)
          return window.Telegram?.WebApp?.showAlert("Выберите комнату");
        try {
          await UyDosh.requestHostelPlace(id, {
            hostelUnitId: unit,
            message: new FormData(e.currentTarget).get("message"),
          });
          window.Telegram?.WebApp?.showAlert("Запрос отправлен");
        } catch (_) {
          window.Telegram?.WebApp?.showAlert(
            "Войдите через Telegram и попробуйте снова",
          );
        }
      });
  } catch (_) {
    root.innerHTML = '<div class="status">Не удалось загрузить хостел</div>';
  }
}
function selectHostelFilter(pill) {
  const filter = hostelFilters.find(
    (item) => item.gender === pill.dataset.gender,
  );
  if (!filter || pill.classList.contains("active")) return;
  applyHostelFilter(filter);
  UyDosh.haptic?.selection?.();
  listHostels();
}

document.querySelectorAll(".hostel-filter-pill").forEach((pill) => {
  // The global Mini App zoom guard can cancel the synthetic `click` generated
  // after touchend. Handle pointerup as well, so pill selection remains
  // responsive on every Telegram WebView.
  pill.addEventListener("pointerup", () => selectHostelFilter(pill));
  pill.addEventListener("click", () => selectHostelFilter(pill));
});
listHostels();
detailHostel();
