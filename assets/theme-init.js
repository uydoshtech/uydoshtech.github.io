// Apply a saved manual UI theme (mini app header sun/moon toggle) before first paint to
// avoid a flash. This only affects the app's own interface colors — the map's light/dark
// rendering is independent and is never controlled by this toggle.
//
// Must be loaded with a plain (non-async, non-defer) <script src="..."> tag as early as
// possible in <head>, so it still runs before the browser paints — same guarantee as the
// inline script it replaces.
(function () {
  try {
    var uiTheme = localStorage.getItem('uydosh_manual_theme');
    var vars = uiTheme === 'dark'
      ? { '--bg': '#061525', '--fg': 'rgba(255, 255, 255, 0.92)', '--muted': 'rgba(255, 255, 255, 0.7)', '--card': 'rgba(255, 255, 255, 0.06)', '--stroke': 'rgba(255, 255, 255, 0.12)' }
      : uiTheme === 'light'
        ? { '--bg': '#f6f7fb', '--fg': 'rgba(15, 23, 42, 0.92)', '--muted': 'rgba(15, 23, 42, 0.7)', '--card': 'rgba(15, 23, 42, 0.04)', '--stroke': 'rgba(15, 23, 42, 0.12)' }
        : null;
    if (vars) {
      var root = document.documentElement;
      for (var prop in vars) root.style.setProperty(prop, vars[prop]);
    }
  } catch (e) { /* ignore */ }
})();
