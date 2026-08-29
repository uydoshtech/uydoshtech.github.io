UyDosh.initTelegramMiniApp();
const back = document.createElement("button");
back.type = "button";
back.className = "hostels-header-back";
back.setAttribute("aria-label", "Назад");
back.textContent = "←";
document.querySelector("header.uydosh-mini-app-header .brand")?.before(back);
back.addEventListener("click", () => {
  if (window.history.length > 1) window.history.back();
  else location.href = "/telegram/";
});
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
  const picker = document.querySelector(".hostel-filter-picker");
  return (
    hostelFilters.find((filter) => filter.gender === picker?.dataset.gender) ||
    hostelFilters[0]
  );
}

function applyHostelFilter(filter) {
  const picker = document.querySelector(".hostel-filter-picker");
  if (!picker) return;
  picker.dataset.gender = filter.gender;
  picker.className = `hostel-filter-picker hostel-filter-picker--${filter.modifier}`;
  picker.setAttribute("aria-label", `Тип размещения: ${filter.label}`);
  const label = picker.querySelector(".hostel-filter-picker-label");
  if (label) label.textContent = filter.label;
}

function photo(hostel) {
  return hostel.photos?.[0]?.photo_url || "";
}
async function listHostels() {
  const target = document.getElementById("hostels");
  if (!target) return;
  const status = document.getElementById("status");
  status.textContent = "Загрузка…";
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
    status.textContent = "";
  } catch (e) {
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
    root.innerHTML = `${photo(h) ? `<img class="hostel-hero" src="${escape(photo(h))}" alt="">` : ""}<div class="hostel-detail-body"><h1>${escape(h.name)}</h1><div class="hostel-meta">${escape(h.address || "Ташкент")}</div><p>${escape(h.description_ru || h.description_uz || h.description_en || "")}</p><h2>Свободные места</h2><div class="hostel-units">${units.map((u) => `<label class="hostel-unit"><div class="hostel-unit-top"><b>${escape(u.name)}</b><b>${money(u.price)}</b></div><div class="hostel-meta">${u.beds_available} из ${u.beds_total} мест · ${escape(u.gender)}</div><input type="radio" name="unit" value="${u.id}" ${u.beds_available > 0 ? "" : "disabled"}></label>`).join("")}</div><form id="request" class="hostel-request"><textarea name="message" placeholder="Комментарий для администратора (необязательно)"></textarea><button ${units.some((u) => u.beds_available > 0) ? "" : "disabled"}>Запросить место</button></form></div>`;
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
document
  .querySelector(".hostel-filter-picker")
  ?.addEventListener("click", () => {
    const current = selectedHostelFilter();
    const next =
      hostelFilters[
        (hostelFilters.indexOf(current) + 1) % hostelFilters.length
      ];
    applyHostelFilter(next);
    UyDosh.haptic?.selection?.();
    listHostels();
  });
listHostels();
detailHostel();
