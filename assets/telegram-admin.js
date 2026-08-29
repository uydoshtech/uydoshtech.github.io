UyDosh.initTelegramMiniApp();
const access = document.getElementById("admin-access"),
  tools = document.getElementById("admin-tools");
UyDosh.ensureTelegramMiniAppSession().then((ready) => {
  if (!ready || !UyDosh.isAdmin()) {
    access.textContent = "Этот раздел доступен только администраторам UyDosh.";
    return;
  }
  access.hidden = true;
  tools.hidden = false;
});
