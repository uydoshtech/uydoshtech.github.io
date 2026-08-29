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
  setTimeout(() => webApp?.BackButton?.show(), 200);
}
// Admin HTML includes a visual tab-bar fallback so it is available even while
// a Telegram WebView is still serving a cached mini-app bootstrap script.
UyDosh.hydrateIcons?.(document.querySelector(".mini-app-tabbar"));
const access = document.getElementById("admin-access"),
  tools = document.getElementById("admin-tools");
// Server endpoints remain the source of truth for staff authorization; don't
// block navigation if Telegram's background session request stalls.
access.hidden = true;
tools.hidden = false;
UyDosh.ensureTelegramMiniAppSession();
