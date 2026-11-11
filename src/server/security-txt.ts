/**
 * /.well-known/security.txt (RFC 9116): where to report a vulnerability. Expires is a year from `now`, so a served
 * copy never goes stale; Canonical is on the app's own origin (APP_URL).
 */
export function securityTxt(appUrl: string, now = new Date()): string {
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return [
    "Contact: mailto:info@thewomenscollective.club",
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    `Canonical: ${appUrl}/.well-known/security.txt`,
    "",
  ].join("\n");
}
