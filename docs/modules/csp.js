// Script stays same-origin. Style attributes stay, because the desk sets
// --hue and meter widths in markup. Google Fonts are the only third-party
// style and font hosts. frame-ancestors is header-only: a meta tag ignores it
// and Chrome logs an error.
const DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
  "style-src-elem 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://sleepercdn.com",
  "connect-src 'self' https://api.sleeper.app",
  "form-action 'self'",
  "upgrade-insecure-requests",
];

export const CONTENT_SECURITY_POLICY = DIRECTIVES.join("; ");
export const META_CONTENT_SECURITY_POLICY = DIRECTIVES
  .filter((directive) => !directive.startsWith("frame-ancestors"))
  .join("; ");
