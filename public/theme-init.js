(() => {
  var pref = "system";
  var palette = "pulso";
  var glass = false;
  var resolved = "dark";
  var params;
  var label;
  try {
    params = new URLSearchParams(location.search);
    pref =
      params.get("theme") || localStorage.getItem("pulso:theme") || "system";
    palette =
      params.get("palette") || localStorage.getItem("pulso:palette") || "pulso";
    glass =
      params.get("glass") === "1" ||
      localStorage.getItem("pulso:transparency") === "1";
    resolved =
      pref === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : pref === "light"
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePref = pref;
    document.documentElement.dataset.sephiroTheme = palette;
    document.documentElement.dataset.transparency = glass ? "on" : "off";
    label = window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
    document.documentElement.dataset.surface =
      label === "popover" || params.get("surface") === "popover"
        ? "popover"
        : "app";
    document.documentElement.style.colorScheme = resolved;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
