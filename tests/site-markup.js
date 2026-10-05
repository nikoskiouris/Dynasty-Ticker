import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

export function siteMarkup() {
  const pages = readdirSync(join(docs, "ui"))
    .filter((name) => name.endsWith(".html"))
    .sort()
    .map((name) => readFileSync(join(docs, "ui", name), "utf8"));
  return `${readFileSync(join(docs, "index.html"), "utf8")}\n${pages.join("\n")}`;
}
