UyDosh.initTelegramMiniApp();
const adminHeader = document.querySelector("[data-uydosh-mini-app-header]");
if (adminHeader && !adminHeader.dataset.uydoshHeaderMounted) {
  UyDosh.mountMiniAppHeader?.(adminHeader);
}
// Admin is a root destination in the bottom navigation, not a nested page.
// Keep Telegram's native Close control here; nested hostel pages enable Back.
window.Telegram?.WebApp?.BackButton?.hide();
const access = document.getElementById("admin-access"),
  tools = document.getElementById("admin-tools");
// Server endpoints remain the source of truth for staff authorization; don't
// block navigation if Telegram's background session request stalls.
access.hidden = true;
tools.hidden = false;
UyDosh.ensureTelegramMiniAppSession();
