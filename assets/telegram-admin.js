UyDosh.initTelegramMiniApp();
const access = document.getElementById("admin-access"),
  tools = document.getElementById("admin-tools");
document.getElementById("page-back").addEventListener("click", () => {
  if (window.history.length > 1) window.history.back();
  else location.href = "/telegram/";
});
// Server endpoints remain the source of truth for staff authorization; don't
// block navigation if Telegram's background session request stalls.
access.hidden = true;
tools.hidden = false;
UyDosh.ensureTelegramMiniAppSession();
