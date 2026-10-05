import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

const PAGE_ORDER = ["landing.html", "players.html", "trades.html", "league.html"];

export function siteMarkup() {
  const pages = PAGE_ORDER.map((name) => readFileSync(join(docs, "ui", name), "utf8"));
  return `${readFileSync(join(docs, "index.html"), "utf8")}\n${pages.join("\n")}`;
}
