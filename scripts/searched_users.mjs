#!/usr/bin/env node
// Save the searched-username CSV from Netlify Blobs to a local file.
// Usage: node scripts/searched_users.mjs [out.csv]
// The repo is public. Never commit the file this writes.
import { writeFileSync } from "node:fs";
import {
  SEARCHED_USERS_HEADER,
  SEARCHED_USERS_KEY,
  SEARCHED_USERS_STORE,
  parseSearchedUsers,
} from "../netlify/lib/searched-users.js";

const siteID = process.env.NETLIFY_SITE_ID || "";
const token = process.env.NETLIFY_AUTH_TOKEN || "";
if (!siteID || !token) {
  console.error("Missing NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID.");
  console.error("  NETLIFY_AUTH_TOKEN  Netlify user access token");
  console.error("  NETLIFY_SITE_ID     Site API ID from Netlify → Site configuration");
  process.exit(1);
}

const out = process.argv[2] || "searched-users.csv";
const { getStore } = await import("@netlify/blobs");
const store = getStore({ name: SEARCHED_USERS_STORE, siteID, token });
const text = (await store.get(SEARCHED_USERS_KEY, { type: "text" })) || `${SEARCHED_USERS_HEADER}\n`;
writeFileSync(out, text);
console.log(`${parseSearchedUsers(text).length} usernames saved to ${out}`);
