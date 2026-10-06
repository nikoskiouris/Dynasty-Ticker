const PAGE_FILES = [
  "./ui/landing.html",
  "./ui/players.html",
  "./ui/trades.html",
  "./ui/league.html",
];

const host = document.querySelector("#ui-pages");
const parts = await Promise.all(PAGE_FILES.map(async (file) => {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`Missing page ${file}`);
  return response.text();
}));
host.innerHTML = parts.join("\n");
await import("./app.js");
