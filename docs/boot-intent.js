// Classic script in <head>. Catches Find presses before boot.js (a deferred module) downloads.
// Shares the queue with docs/modules/boot-gate.js via __dynastyBootFind.
(function () {
  var host = typeof globalThis !== "undefined" ? globalThis : window;
  var bag = host.__dynastyBootFind || (host.__dynastyBootFind = { pending: true, queued: false, username: "" });
  var IDS = ["sleeper-username", "landing-username"];

  function remember(name) {
    if (!bag.pending) return;
    bag.queued = true;
    var trimmed = String(name || "").trim();
    if (trimmed) bag.username = trimmed;
  }

  function nameFrom(target) {
    if (!target) return "";
    if (IDS.indexOf(target.id) !== -1) return target.value || "";
    var form = target.tagName === "FORM" ? target : (target.closest && target.closest("form"));
    var scopes = [form, document];
    for (var s = 0; s < scopes.length; s++) {
      var scope = scopes[s];
      if (!scope || !scope.querySelector) continue;
      for (var i = 0; i < IDS.length; i++) {
        var input = scope.querySelector("#" + IDS[i]);
        if (input && String(input.value || "").trim()) return input.value;
      }
    }
    return "";
  }

  function isFind(button) {
    if (!button || String(button.tagName || "").toUpperCase() !== "BUTTON") return false;
    var action = button.getAttribute("data-action") || "";
    if (action === "find-my-leagues") return true;
    var id = button.id || "";
    if (id === "find-leagues-btn" || id === "landing-find-btn" || id === "sticky-find-btn") return true;
    return (button.getAttribute("data-idle-label") || "") === "Find my leagues";
  }

  function formHasFind(form) {
    if (!form || !form.querySelectorAll) return false;
    var buttons = form.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      if (isFind(buttons[i])) return true;
    }
    return false;
  }

  document.addEventListener("submit", function (event) {
    if (!bag.pending || !formHasFind(event.target)) return;
    event.preventDefault();
    remember(nameFrom(event.target));
  }, true);

  document.addEventListener("keydown", function (event) {
    if (!bag.pending || event.key !== "Enter") return;
    if (IDS.indexOf(event.target && event.target.id) === -1) return;
    event.preventDefault();
    remember(event.target.value);
  }, true);

  document.addEventListener("click", function (event) {
    if (!bag.pending) return;
    var button = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!isFind(button)) return;
    event.preventDefault();
    event.stopPropagation();
    remember(nameFrom(button));
  }, true);
})();
