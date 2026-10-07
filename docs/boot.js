const PAGE_FILES = [
  "./ui/landing.html",
  "./ui/players.html",
  "./ui/trades.html",
  "./ui/league.html",
];

const host = document.querySelector("#ui-pages");

function showBootError() {
  if (!host) return;
  host.innerHTML = `
    <section class="boot-error" role="alert">
      <h2>The desk did not open</h2>
      <p>The page files did not load. Refresh and try again.</p>
      <button type="button" onclick="location.reload()">Refresh</button>
    </section>
  `;
}

try {
  const parts = await Promise.all(PAGE_FILES.map(async (file) => {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`Missing page ${file}`);
    return response.text();
  }));
  if (!host) throw new Error("Missing #ui-pages");
  host.innerHTML = parts.join("\n");
} catch (err) {
  showBootError();
  throw err;
}
await import("./app.js");
