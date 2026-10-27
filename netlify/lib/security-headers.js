// The security headers netlify.toml sets for /*. Edge function responses
// built here may not get the toml [[headers]], so they set these directly.
// tests/security-headers.test.js fails if this and netlify.toml drift.
export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https://sleepercdn.com https://*.sleepercdn.com; connect-src 'self' https://api.sleeper.app; form-action 'self'; frame-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
});
