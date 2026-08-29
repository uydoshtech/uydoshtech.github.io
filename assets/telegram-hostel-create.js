UyDosh.initTelegramMiniApp();
if (UyDosh.isMiniApp()) {
  const webApp = window.Telegram?.WebApp;
  const goBack = () => {
    UyDosh.haptic?.light?.();
    if (window.history.length > 1) window.history.back();
    else location.href = "/telegram/hostels.html";
  };
  webApp?.BackButton?.onClick(goBack);
  webApp?.BackButton?.show();
  setTimeout(() => webApp?.BackButton?.show(), 200);
}
const form = document.getElementById("form"),
  access = document.getElementById("access"),
  units = document.getElementById("units"),
  template = document.getElementById("unit"),
  error = document.getElementById("error");
let hostelCoordinates = null;
function telegramUsername() {
  const direct = window.Telegram?.WebApp?.initDataUnsafe?.user?.username;
  if (direct) return String(direct);
  try {
    const raw = UyDosh.getTelegramInitData?.() || "";
    const user = new URLSearchParams(raw).get("user");
    return user ? String(JSON.parse(user)?.username || "") : "";
  } catch (_) {
    return "";
  }
}
function prefillTelegramUsername() {
  const field = form.elements.telegram_username;
  const username = telegramUsername().replace(/^@+/, "");
  if (username && !field.value) field.value = `@${username}`;
  return Boolean(username);
}
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
  prefillTelegramUsername();
  UyDosh.ensureTelegramMiniAppSession().then((ready) => {
    if (ready && UyDosh.isAdmin()) {
      document
        .querySelectorAll("[data-admin-hostel-create]")
        .forEach((el) => (el.hidden = false));
    }
  });
}
boot();
// Telegram's WebApp object may arrive slightly after this deferred script.
// Retry briefly without overwriting a username the operator has edited manually.
let telegramUsernamePrefillAttempts = 0;
const telegramUsernamePrefillTimer = setInterval(() => {
  telegramUsernamePrefillAttempts += 1;
  if (prefillTelegramUsername() || telegramUsernamePrefillAttempts >= 20) {
    clearInterval(telegramUsernamePrefillTimer);
  }
}, 250);
document.getElementById("use-location").addEventListener("click", async () => {
  const button = document.getElementById("use-location");
  button.disabled = true;
  button.textContent = "Определяем…";
  try {
    const { latitude, longitude } = await UyDosh.requestUserLocation();
    hostelCoordinates = { latitude, longitude };
    // The address lookup needs a session; location itself remains useful and
    // is persisted even if reverse geocoding is temporarily unavailable.
    const sessionReady = await Promise.race([
      UyDosh.ensureTelegramMiniAppSession(),
      new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
    ]);
    if (sessionReady) {
      const result = await UyDosh.fetchReverseGeocodeAddress(
        latitude,
        longitude,
        UyDosh.getLang(),
      );
      if (result?.addressText) form.elements.address.value = result.addressText;
      else {
        error.textContent =
          "Местоположение определено, но адрес не удалось получить.";
        error.hidden = false;
      }
    } else {
      error.textContent =
        "Местоположение определено, но адрес не удалось получить.";
      error.hidden = false;
    }
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
    latitude: hostelCoordinates?.latitude ?? null,
    longitude: hostelCoordinates?.longitude ?? null,
    phone: phoneInput.value.replace(/\D/g, "")
      ? `+998${phoneInput.value.replace(/\D/g, "")}`
      : null,
    telegram_username:
      String(data.get("telegram_username") || "").replace(/^@+/, "") || null,
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
