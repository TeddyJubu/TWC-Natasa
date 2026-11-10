/** Her member pass's colour (0012). Shared by the server check and the /account swatches; the database checks the same list. */
export const CARD_COLORS = ["mustard", "rose", "lilac", "mint"] as const;
export type CardColor = (typeof CARD_COLORS)[number];
