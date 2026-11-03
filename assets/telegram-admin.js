try {
  UyDosh.initTelegramMiniApp();
} catch (error) {
  // Shared chrome below must still be usable if an optional page capability
  // fails during bootstrap.
  console.error("UyDosh Mini App startup failed on admin", error);
}
const adminHeader = document.querySelector("[data-uydosh-mini-app-header]");
if (adminHeader && !adminHeader.dataset.uydoshHeaderMounted) {
  UyDosh.mountMiniAppHeader?.(adminHeader);
}
// Admin is a root tab: make its shared footer explicit as well. This also
// recovers safely if a preceding optional startup concern finishes late.
UyDosh.mountMiniAppTabbar?.();
// Admin is a root destination in the bottom navigation, not a nested page.
// Keep Telegram's native Close control here; nested hostel pages enable Back.
window.Telegram?.WebApp?.BackButton?.hide();
const access = document.getElementById("admin-access"),
  tools = document.getElementById("admin-tools");
// Server endpoints remain the source of truth for staff authorization; don't
// block navigation if Telegram's background session request stalls.
access.hidden = true;
tools.hidden = false;
for (const slot of document.querySelectorAll("[data-admin-icon]")) {
  const icon = UyDosh.iconChrome?.(slot.getAttribute("data-admin-icon"));
  if (icon) slot.innerHTML = icon;
}
UyDosh.ensureTelegramMiniAppSession();
