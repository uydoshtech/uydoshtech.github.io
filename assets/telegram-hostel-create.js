UyDosh.initTelegramMiniApp();
const form = document.getElementById("form"),
  access = document.getElementById("access"),
  units = document.getElementById("units"),
  template = document.getElementById("unit"),
  error = document.getElementById("error");
function addUnit({ reveal = false } = {}) {
  const item = template.content.cloneNode(true);
  item
    .querySelector(".remove")
    .addEventListener("click", (e) =>
      e.currentTarget.closest(".unit").remove(),
    );
  units.appendChild(item);
  const unit = units.lastElementChild;
  if (reveal && unit) {
    unit.classList.add("unit--new");
    unit.scrollIntoView({ behavior: "smooth", block: "center" });
    unit.querySelector("[name=unit_name]")?.focus({ preventScroll: true });
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
    setTimeout(() => unit.classList.remove("unit--new"), 900);
  }
}
addUnit();
async function boot() {
  // Never block the form on a Telegram-auth request: this request can stall
  // in a WebView, while the server remains the authoritative admin check on
  // POST /admin/hostels.
  access.hidden = true;
  form.hidden = false;
  const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (telegramUserId && !form.elements.telegram_username.value) {
    form.elements.telegram_username.value = String(telegramUserId);
  }
  UyDosh.ensureTelegramMiniAppSession().then((ready) => {
    if (ready && UyDosh.isAdmin()) {
      document
        .querySelectorAll("[data-admin-hostel-create]")
        .forEach((el) => (el.hidden = false));
    }
  });
}
boot();
if (UyDosh.isMiniApp()) {
  const back = window.Telegram?.WebApp?.BackButton;
  back?.show();
  back?.onClick(() => {
    location.href = "/telegram/hostels.html";
  });
}
document.getElementById("use-location").addEventListener("click", async () => {
  const button = document.getElementById("use-location");
  button.disabled = true;
  button.textContent = "Определяем…";
  try {
    const { latitude, longitude } = await UyDosh.requestUserLocation();
    const result = await UyDosh.fetchReverseGeocodeAddress(
      latitude,
      longitude,
      UyDosh.getLang(),
    );
    if (!result?.addressText) throw new Error("Address not found");
    form.elements.address.value = result.addressText;
  } catch (_) {
    error.textContent =
      "Не удалось определить адрес. Проверьте доступ к геолокации.";
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "⌖ Моя локация";
  }
});
document
  .getElementById("add-unit")
  .addEventListener("click", () => addUnit({ reveal: true }));
const phoneInput = form.elements.phone;
phoneInput.addEventListener("input", () => {
  const digits = phoneInput.value.replace(/\D/g, "").slice(0, 9);
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter(Boolean);
  phoneInput.value = groups.length
    ? `(${groups[0]})${groups.length > 1 ? `-${groups.slice(1).join("-")}` : ""}`
    : "";
});
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.hidden = true;
  const data = new FormData(form),
    rows = [...units.querySelectorAll(".unit")];
  const payload = {
    name: data.get("name"),
    address: data.get("address"),
    phone: phoneInput.value.replace(/\D/g, "")
      ? `+998${phoneInput.value.replace(/\D/g, "")}`
      : null,
    telegram_username: data.get("telegram_username") || null,
    gender_policy: data.get("gender_policy"),
    description_ru: data.get("description_ru"),
    status: "active",
    photos: String(data.get("photos") || "")
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    units: rows.map((row) => ({
      name: row.querySelector("[name=unit_name]").value,
      beds_total: Number(row.querySelector("[name=beds_total]").value),
      beds_available: Number(row.querySelector("[name=beds_available]").value),
      price: Number(row.querySelector("[name=price]").value),
      gender: row.querySelector("[name=unit_gender]").value,
    })),
  };
  try {
    const hostel = await UyDosh.createHostel(payload);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    location.href = "/telegram/hostel.html?id=" + encodeURIComponent(hostel.id);
  } catch (err) {
    error.textContent = err.message || "Не удалось создать хостел.";
    error.hidden = false;
  }
});
