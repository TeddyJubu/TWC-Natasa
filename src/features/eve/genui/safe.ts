// Eve's answers can quote text members submitted, so a planted image or link must not carry data off the site.
// /admin/events allows https images for covers, which makes this check necessary rather than relying on the CSP.

/** A path on this site, never another origin (`//host` and `/\host` both leave it). */
export const isSitePath = (value: unknown): value is string =>
  typeof value === "string" && /^\/(?![/\\])[^\s\\]*$/.test(value);

/** Only this site's uploads may load as images. */
export const safeImage = (value: unknown): string | undefined =>
  isSitePath(value) && value.startsWith("/media/") ? value : undefined;

/** Site paths and plain mailto links stay clickable. Anything else is shown as text. */
export const safeHref = (value: unknown): string | undefined => {
  if (isSitePath(value)) return value;
  return typeof value === "string" && /^mailto:[^\s?&#]+@[^\s?&#]+$/i.test(value) ? value : undefined;
};

export const safeCssKey = (value: string) => /^[\w-]{1,64}$/.test(value);
export const safeCssColor = (value: string) =>
  /^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch)\([\d\s.,%/-]{1,60}\)|var\(--[\w-]{1,40}\)|[a-z]{3,20})$/i.test(value.trim());
