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
const hostelPhotoInput = document.getElementById("hostel-photo-input");
const hostelPhotoPicker = document.getElementById("hostel-photo-picker");
const hostelPhotoPreviews = document.getElementById("hostel-photo-previews");
const MAX_HOSTEL_PHOTOS = 10;
const hostelPhotos = [];
let hostelCoordinates = null;
let hostelAddressResolvedText = null;
const editingHostelId = new URLSearchParams(location.search).get("id");
const hostelAddressInput = document.getElementById("hostel-address");
const hostelAddressSuggestions = document.getElementById("hostel-address-suggestions");
let hostelAddressSuggestTimer = null;
let hostelAddressSuggestRequestId = 0;
let hostelAddressSuggestSession = null;

function hostelGeosuggestSession() {
  if (!hostelAddressSuggestSession) {
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    hostelAddressSuggestSession = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return hostelAddressSuggestSession;
}
function parseHostelSuggestions(data) {
  return (Array.isArray(data?.results) ? data.results : [])
    .map((item) => item?.address?.formatted_address || item?.title?.text || "")
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());
}
function hideHostelAddressSuggestions() {
  hostelAddressSuggestions.hidden = true;
  hostelAddressSuggestions.innerHTML = "";
}
function renderHostelAddressSuggestions(items, { loading = false, empty = false } = {}) {
  if (document.activeElement !== hostelAddressInput) return hideHostelAddressSuggestions();
  if (loading) {
    hostelAddressSuggestions.innerHTML = '<div class="hostel-address-suggestions-loading">Ищем адрес…</div>';
  } else if (empty) {
    hostelAddressSuggestions.innerHTML = '<div class="hostel-address-suggestions-empty">Адрес не найден</div>';
  } else {
    hostelAddressSuggestions.innerHTML = items.map((value, index) => `<button type="button" class="hostel-address-suggestion" data-hostel-address-suggestion="${index}">${UyDosh.escapeHtml(value)}</button>`).join("");
  }
  hostelAddressSuggestions.hidden = !loading && !empty && items.length === 0;
}
async function resolveHostelAddress({ force = false } = {}) {
  const text = String(hostelAddressInput.value || "").trim();
  if (!text || (!force && text === hostelAddressResolvedText)) return;
  try {
    const result = await UyDosh.fetchGeocodeAddress({ text, lang: UyDosh.getLang() });
    const latitude = Number(result?.latitude);
    const longitude = Number(result?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      hostelCoordinates = { latitude, longitude };
      hostelAddressResolvedText = text;
    }
  } catch (_) {
    // The address remains usable even when coordinates cannot be resolved.
  }
}
async function loadHostelAddressSuggestions() {
  const query = hostelAddressInput.value.trim();
  const requestId = ++hostelAddressSuggestRequestId;
  if (query.length < 3) return hideHostelAddressSuggestions();
  renderHostelAddressSuggestions([], { loading: true });
  try {
    const result = await UyDosh.fetchGeosuggest({ text: query, sessionToken: hostelGeosuggestSession(), lang: UyDosh.getLang() });
    if (requestId !== hostelAddressSuggestRequestId) return;
    const items = parseHostelSuggestions(result);
    renderHostelAddressSuggestions(items, { empty: items.length === 0 });
  } catch (_) {
    if (requestId === hostelAddressSuggestRequestId) hideHostelAddressSuggestions();
  }
}

function renderHostelPhotoPreviews() {
  hostelPhotoPreviews.innerHTML = hostelPhotos
    .map(
      (photo, index) =>
        `<div class="hostel-photo-preview"><img src="${UyDosh.escapeHtml(photo.previewUrl)}" alt="Фото ${index + 1}"><button type="button" data-hostel-photo-remove="${index}" aria-label="Удалить фото ${index + 1}">×</button></div>`,
    )
    .join("");
  hostelPhotoPreviews
    .querySelectorAll("[data-hostel-photo-remove]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.hostelPhotoRemove);
        const [removed] = hostelPhotos.splice(index, 1);
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        renderHostelPhotoPreviews();
      });
    });
}

hostelPhotoPicker.addEventListener("click", () => hostelPhotoInput.click());
hostelPhotoInput.addEventListener("change", async () => {
  const files = [...(hostelPhotoInput.files || [])];
  hostelPhotoInput.value = "";
  const remaining = MAX_HOSTEL_PHOTOS - hostelPhotos.length;
  for (const file of files.slice(0, Math.max(0, remaining))) {
    try {
      hostelPhotos.push({
        dataUrl: await UyDosh.resizeImageFileForUpload(file),
        previewUrl: URL.createObjectURL(file),
      });
    } catch (_) {
      error.textContent = "Не удалось обработать фото. Попробуйте другое.";
      error.hidden = false;
    }
  }
  renderHostelPhotoPreviews();
});
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
function addUnit({ reveal = false, value = null } = {}) {
  const item = template.content.cloneNode(true);
  item
    .querySelector(".remove")
    .addEventListener("click", (e) =>
      e.currentTarget.closest(".unit").remove(),
    );
  units.appendChild(item);
  const unit = units.lastElementChild;
  if (unit && value) {
    unit.querySelector("[name=unit_name]").value = value.name || "";
    unit.querySelector("[name=beds_total]").value = value.beds_total ?? "";
    unit.querySelector("[name=beds_available]").value = value.beds_available ?? "";
    unit.querySelector("[name=price]").value = value.price ?? "";
    unit.querySelector("[name=unit_gender]").value = value.gender || "mixed";
  }
  if (reveal && unit) {
    unit.classList.add("unit--new");
    unit.scrollIntoView({ behavior: "smooth", block: "center" });
    unit.querySelector("[name=unit_name]")?.focus({ preventScroll: true });
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
    setTimeout(() => unit.classList.remove("unit--new"), 900);
  }
}
function setEditMode(hostel) {
  document.title = "UyDosh — Редактировать хостел";
  document.querySelector(".hostel-create h1").textContent = "Редактировать хостел";
  form.querySelector(".save").textContent = "Сохранить изменения";
  form.elements.name.value = hostel.name || "";
  form.elements.address.value = hostel.address || "";
  hostelAddressResolvedText = form.elements.address.value.trim() || null;
  form.elements.phone.value = String(hostel.phone || "").replace(/^\+998/, "");
  phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
  form.elements.telegram_username.value = hostel.telegram_username
    ? `@${String(hostel.telegram_username).replace(/^@+/, "")}`
    : "";
  form.elements.description_ru.value = hostel.description_ru || "";
  form.elements.check_in_time.value = hostel.hostel_details?.check_in_time || "";
  form.elements.check_out_time.value = hostel.hostel_details?.check_out_time || "";
  form.elements.rules.value = hostel.hostel_details?.rules || "";
  const policy = form.querySelector(`[name=gender_policy][value="${hostel.gender_policy || "mixed"}"]`);
  if (policy) policy.checked = true;
  const latitude = Number(hostel.latitude);
  const longitude = Number(hostel.longitude);
  hostelCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
  units.innerHTML = "";
  (hostel.units || []).forEach((unit) => addUnit({ value: unit }));
  if (!units.children.length) addUnit();
}
addUnit();
async function boot() {
  // Never block the form on a Telegram-auth request: this request can stall
  // in a WebView, while the server remains the authoritative admin check on
  // POST /admin/hostels.
  access.hidden = true;
  form.hidden = false;
  if (!editingHostelId) prefillTelegramUsername();
  const ready = await UyDosh.ensureTelegramMiniAppSession();
  if (!ready || !UyDosh.isAdmin()) {
    if (editingHostelId) {
      error.textContent = "Редактирование хостелов доступно только администратору.";
      error.hidden = false;
      form.hidden = true;
    }
    return;
  }
  document
    .querySelectorAll("[data-admin-hostel-create]")
    .forEach((el) => (el.hidden = false));
  if (!editingHostelId) return;
  try {
    setEditMode(await UyDosh.fetchHostelForAdminEdit(editingHostelId));
  } catch (err) {
    error.textContent = err.message || "Не удалось загрузить хостел для редактирования.";
    error.hidden = false;
    form.hidden = true;
  }
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
  button.classList.add("is-loading");
  button.setAttribute("aria-busy", "true");
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
      if (result?.addressText) {
        form.elements.address.value = result.addressText;
        hostelAddressResolvedText = result.addressText.trim();
      }
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
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
  }
});
document
  .getElementById("add-unit")
  .addEventListener("click", () => addUnit({ reveal: true }));
const phoneInput = form.elements.phone;
document
  .getElementById("hostel-phone-share")
  .addEventListener("click", async () => {
    const contactRaw = await UyDosh.requestTelegramContactShare();
    const phoneNumber = UyDosh.phoneNumberFromContactShareResponse(contactRaw);
    if (!phoneNumber) return;
    const digits = phoneNumber.replace(/\D/g, "");
    // The hostel form currently uses Uzbekistan's fixed +998 prefix, matching
    // its phone control. Keep only the national part after Telegram shares it.
    phoneInput.value = (
      digits.startsWith("998") ? digits.slice(3) : digits
    ).slice(-9);
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    try {
      await UyDosh.updateMyPhoneNumber(phoneNumber);
    } catch (_) {
      // The number is already filled in the hostel form; account persistence is
      // best-effort, exactly as on the listing creation flow.
    }
  });
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
hostelAddressInput.addEventListener("input", () => {
  hostelCoordinates = null;
  hostelAddressResolvedText = null;
  clearTimeout(hostelAddressSuggestTimer);
  hostelAddressSuggestTimer = setTimeout(loadHostelAddressSuggestions, 260);
});
hostelAddressInput.addEventListener("focus", () => {
  if (hostelAddressInput.value.trim().length >= 3) loadHostelAddressSuggestions();
});
hostelAddressInput.addEventListener("blur", () => {
  setTimeout(() => {
    hideHostelAddressSuggestions();
    resolveHostelAddress();
  }, 180);
});
hostelAddressSuggestions.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-hostel-address-suggestion]");
  if (!choice) return;
  hostelAddressInput.value = choice.textContent.trim();
  hostelCoordinates = null;
  hostelAddressResolvedText = null;
  hostelAddressSuggestSession = null;
  hideHostelAddressSuggestions();
  resolveHostelAddress({ force: true });
  UyDosh.haptic?.selection?.();
});
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.hidden = true;
  await resolveHostelAddress();
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
    check_in_time: data.get("check_in_time") || null,
    check_out_time: data.get("check_out_time") || null,
    rules: data.get("rules") || null,
    status: "active",
    units: rows.map((row) => ({
      name: row.querySelector("[name=unit_name]").value,
      beds_total: Number(row.querySelector("[name=beds_total]").value),
      beds_available: Number(row.querySelector("[name=beds_available]").value),
      price: Number(row.querySelector("[name=price]").value),
      gender: row.querySelector("[name=unit_gender]").value,
    })),
  };
  try {
    const hostel = editingHostelId
      ? await UyDosh.updateHostel(editingHostelId, payload)
      : await UyDosh.createHostel(payload);
    let failedPhotos = 0;
    for (let index = 0; index < hostelPhotos.length; index += 1) {
      try {
        await UyDosh.uploadHostelPhoto(hostel.id, hostelPhotos[index].dataUrl, {
          isPrimary: index === 0,
        });
      } catch (_) {
        failedPhotos += 1;
      }
    }
    if (failedPhotos) {
      error.textContent = `${editingHostelId ? "Изменения сохранены" : "Хостел создан"}, но не удалось загрузить фото: ${failedPhotos}.`;
      error.hidden = false;
      return;
    }
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    location.href = "/telegram/hostel.html?id=" + encodeURIComponent(hostel.id);
  } catch (err) {
    error.textContent = err.message || (editingHostelId ? "Не удалось сохранить изменения." : "Не удалось создать хостел.");
    error.hidden = false;
  }
});
