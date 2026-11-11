// The legal pages' titles and descriptions, apart from their text: a route's `head` stays in the route file
// TanStack doesn't split, so importing the whole doc there would put all three documents in the entry chunk.

export interface LegalHeadText {
  title: string;
  description: string;
}

export const legalHeads = {
  privacy: {
    title: "Privacy Policy — The Women’s Collective",
    description: "What The Women’s Collective holds about applicants and members, why we hold it, who can see it, and how to ask us about it.",
  },
  terms: {
    title: "Terms of Membership — The Women’s Collective",
    description: "The terms for using this site and being a member of The Women’s Collective: membership, your account, the directory, what you post, events and leaving.",
  },
  codeOfConduct: {
    title: "Code of Conduct — The Women’s Collective",
    description: "What members of The Women’s Collective expect of each other, the directory rule, and how to report something and what happens next.",
  },
} satisfies Record<string, LegalHeadText>;

/** The route's head: title, description and their Open Graph twins. */
export const legalHead = (head: LegalHeadText) => ({
  meta: [
    { title: head.title },
    { name: "description", content: head.description },
    { property: "og:title", content: head.title },
    { property: "og:description", content: head.description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
