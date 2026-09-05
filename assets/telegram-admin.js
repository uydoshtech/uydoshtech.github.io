UyDosh.initTelegramMiniApp();
const adminHeader = document.querySelector("[data-uydosh-mini-app-header]");
if (adminHeader && !adminHeader.dataset.uydoshHeaderMounted) {
  UyDosh.mountMiniAppHeader?.(adminHeader);
}
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
const access = document.getElementById("admin-access"),
  tools = document.getElementById("admin-tools");
// Server endpoints remain the source of truth for staff authorization; don't
// block navigation if Telegram's background session request stalls.
access.hidden = true;
tools.hidden = false;
UyDosh.ensureTelegramMiniAppSession();
