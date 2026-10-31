import base from "./playwright.config.js";
export default { ...base, use: { ...base.use, launchOptions: { executablePath: "/opt/pw-browsers/chromium" } } };
