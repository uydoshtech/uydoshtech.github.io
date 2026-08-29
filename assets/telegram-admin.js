UyDosh.initTelegramMiniApp();
// Admin HTML includes a visual tab-bar fallback so it is available even while
// a Telegram WebView is still serving a cached mini-app bootstrap script.
UyDosh.hydrateIcons?.(document.querySelector(".mini-app-tabbar"));
const access = document.getElementById("admin-access"),
  tools = document.getElementById("admin-tools");
const back = document.createElement("button");
back.type = "button";
back.className = "admin-header-back";
back.setAttribute("aria-label", "Назад");
back.textContent = "←";
document.querySelector("header.uydosh-mini-app-header .brand")?.before(back);
back.addEventListener("click", () => {
  if (window.history.length > 1) window.history.back();
  else location.href = "/telegram/";
});
// Server endpoints remain the source of truth for staff authorization; don't
// block navigation if Telegram's background session request stalls.
access.hidden = true;
tools.hidden = false;
UyDosh.ensureTelegramMiniAppSession();
