import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ticketsDir = join(root, "tickets");
const readmePath = join(ticketsDir, "README.md");

function parseTicket(text) {
  const fields = {};
  for (const part of text.trim().split(/\n\n+/)) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    fields[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return fields;
}

function tableRows(markdown, heading) {
  const section = markdown.split(new RegExp(`^## ${heading}\\s*$`, "m"))[1];
  assert.ok(section, `tickets/README.md missing ## ${heading}`);
  const untilNext = section.split(/^## /m)[0];
  return [...untilNext.matchAll(/\| \[(\d+)\]\(([^)]+)\) \| ([^|]+) \|/g)].map((match) => ({
    id: match[1],
    file: match[2],
    rest: match[3].trim(),
  }));
}

const files = readdirSync(ticketsDir)
  .filter((name) => /^\d+-.*\.txt$/.test(name))
  .sort();
const readme = readFileSync(readmePath, "utf8");
const openRows = tableRows(readme, "Open");
const doneRows = tableRows(readme, "Done");

test("every ticket file stays on the board with Status Open or Done", () => {
  assert.ok(files.length >= 12, "ticket files went missing");
  const openIds = new Set(openRows.map((row) => row.id));
  const doneIds = new Set(doneRows.map((row) => row.id));

  for (const name of files) {
    const id = name.match(/^(\d+)/)[1];
    const fields = parseTicket(readFileSync(join(ticketsDir, name), "utf8"));
    const status = fields.Status || "";
    assert.match(status, /^(Open|Done)\b/, `${name} needs Status Open or Done`);
    assert.equal(Boolean(openIds.has(id)) && Boolean(doneIds.has(id)), false, `${name} listed in Open and Done`);

    if (status.startsWith("Done")) {
      const shipped = fields.Shipped || "";
      const pr = shipped.match(/#(\d+)/);
      assert.ok(pr, `${name} Done needs Shipped #PR`);
      const row = doneRows.find((entry) => entry.id === id);
      assert.ok(row, `${name} Done must stay in the Done table`);
      assert.equal(row.file, name);
      assert.match(readme, new RegExp(`\\[#${pr[1]}\\]\\(https://github.com/nikoskiouris/Dynasty-Ticker/pull/${pr[1]}\\)`));
    } else {
      const row = openRows.find((entry) => entry.id === id);
      assert.ok(row, `${name} Open must stay in the Open table`);
      assert.equal(row.file, name);
    }
  }

  for (const row of [...openRows, ...doneRows]) {
    assert.ok(files.includes(row.file), `README points at missing ${row.file}`);
  }
});

test("ticket README says not to delete shipped files", () => {
  assert.match(readme, /Do not delete ticket files/);
  assert.match(readme, /^## Open\s*$/m);
  assert.match(readme, /^## Done\s*$/m);
});
