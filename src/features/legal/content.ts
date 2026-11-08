// The legal pages (/privacy, /terms, /code-of-conduct) as data, rendered by LegalPage. Still drafts: the
// template box, [BRACKETS] and attorney notes stay visible until counsel signs them off.

/** A run of text: plain, a bold lead-in, or an in-app link. */
export type Inline = string | { strong: string } | { href: string; text: string };
export type Rich = string | readonly Inline[];
export type Block =
  | { p: Rich }
  | { h3: string }
  | { ul: readonly Rich[] }
  /** An inline drafting note, e.g. "[IF GDPR APPLIES]", shown as a small muted aside. */
  | { note: string; text: string };
export interface LegalSection {
  id: string;
  /** Its label under "On this page". */
  toc: string;
  title: string;
  blocks: readonly Block[];
}
export interface LegalDoc {
  badge: string;
  title: string;
  lede: string;
  updated: string;
  version: string;
  template: { title: string; text: string };
  sections: readonly LegalSection[];
  head: { title: string; description: string };
}

const b = (strong: string) => ({ strong });
const CONDUCT = { href: "/code-of-conduct", text: "code of conduct" };
const UPDATED = "8 November 2026";

export const privacy: LegalDoc = {
  badge: "Privacy",
  title: "What We Hold, and Why",
  lede: "Written to be read, not to be survived. If anything here is unclear, that's a fault worth telling us about.",
  updated: UPDATED,
  version: "[1.1]",
  template: {
    title: "TEMPLATE — NOT YET LEGAL ADVICE.",
    text: "This describes what The Women's Collective system actually does, so a lawyer can work from something real rather than boilerplate. Before publishing: fill every [BRACKET], confirm the retention periods are what you actually intend, and have a New York attorney review the whole thing. Delete this box when it's signed off.",
  },
  head: {
    title: "Privacy Policy — The Women’s Collective",
    description: "What The Women’s Collective holds about applicants and members, why we hold it, who can see it, and how to ask us about it.",
  },
  sections: [
    {
      id: "who", toc: "Who we are", title: "Who we are", blocks: [
        { p: `The Women's Collective ("The Women's Collective", "we") operates this site and the member directory it hosts. We are [LEGAL ENTITY NAME AND STATUS — e.g. an unincorporated association / a New York not-for-profit corporation].` },
        { p: "The person responsible for privacy questions is [NAME AND ROLE], reachable at [PRIVACY EMAIL ADDRESS]." },
      ],
    },
    {
      id: "collect", toc: "What we collect", title: "What we collect", blocks: [
        { h3: "When you apply" },
        { ul: [
          "Your name and email address",
          "Your phone number, and your WhatsApp number if you ask to join the members' WhatsApp group",
          "Your neighbourhood — the area only. We never ask for or store a home address.",
          "Your profession, and your business name, website, or social handle if you give them",
          "A short bio, your reasons for applying, and what you'd contribute",
          "How you heard about us, and the names of any referring members",
        ] },
        { h3: "If you become a member" },
        { ul: [
          "Everything above, plus anything you add to your profile",
          "A profile photograph, if you upload one. Location metadata is stripped from every image on upload.",
          "Your business logo, if you upload one — stripped of metadata the same way",
          "Your visibility settings — whether you're listed in the members' directory and whether your card is public",
          "Sign-in records: for each signed-in session, the IP address and browser (user agent) it started from and when it expires — nothing about what you looked at",
        ] },
        { h3: "If you write to us" },
        { ul: ["There's no contact or partnership form on this site. Interest in partnering is a question on the application, and your answer is stored with it."] },
        { h3: "If you subscribe to the newsletter" },
        { ul: ["Your answer to the newsletter question on the application, stored with it. No newsletter platform is connected to this site, so nothing is sent to you from here"] },
        { h3: "When you send the application" },
        { ul: ["The IP address it arrives from is used, in memory only, to limit how many applications one address can send in ten minutes, so an automated flood can be told apart from real people writing in. It is not stored with your application, nothing is derived from it, and no profile is built."] },
      ],
    },
    {
      id: "why", toc: "Why we hold it", title: "Why we hold it", blocks: [
        { p: "To decide on applications, to run the directory, to organise events, and to answer you when you write. That's the whole list. We do not profile members, we do not score anyone, and we do not sell, rent, or share member information with anyone for any purpose." },
        { note: "[IF GDPR APPLIES]", text: "If you have members or applicants in the UK or EU, this section needs a lawful basis for each purpose — likely consent for the newsletter and legitimate interests for the directory. Ask your attorney whether The Women's Collective is in scope at all." },
      ],
    },
    {
      id: "sees", toc: "Who can see it", title: "Who can see it", blocks: [
        { ul: [
          [b("Your application"), " is read by the review team and nobody else. It is never shown to other members, including anyone you named as a referrer."],
          [b("Your public card"), " is opt-in: it appears on the site's public pages only once your membership is approved, you're listed in the members' directory, and you turn on “Show my profile on the public website”. It shows your name, role, business, neighbourhood, specialty, bio, who you're looking to meet, website, portrait and catalogue number."],
          [b("Your email address"), " is never displayed to anyone. There's no messaging on this site: approved members see each other's cards in the members' directory and as introductions on their account page, and get in touch through whatever a member puts on her card, such as her website."],
          [b("Administrators"), " can see member records in order to run The Women's Collective."],
        ] },
        { p: "The public directory is intentionally accessible without a sign-in. Public pages, including public member cards, can appear in search engines." },
      ],
    },
    {
      id: "directory", toc: "The directory", title: "The directory, specifically", blocks: [
        { p: ["The public directory exists so people can discover members and make genuine community connections. It is not a mailing list, and using it for bulk outreach, cold pitching, or adding people to anything is a breach of the ", CONDUCT, " that costs membership."] },
        { p: [
          "You control whether you're listed in the members' directory and whether your card is public. To change or remove a listing, use your ",
          { href: "/account", text: "account page" },
          ": you can edit your card, change your portrait and business logo, and switch your directory listing and public card off. Your membership and event access are not affected, and your email address is never published.",
        ] },
      ],
    },
    {
      id: "keep", toc: "How long we keep it", title: "How long we keep it", blocks: [
        { ul: [
          [b("Member records"), " — for as long as you're a member."],
          [b("After you leave"), " — your profile disappears from the directory immediately. The underlying record is deleted or anonymised within [RETENTION PERIOD, e.g. 90 days] unless you ask us to delete it sooner, which we'll do."],
          [b("Declined applications"), " — kept for [PERIOD, e.g. 12 months] so we can recognise a reapplication, then deleted."],
          [b("Contact and partnership messages"), " — kept for [PERIOD, e.g. 24 months]."],
          [b("Event photographs"), " — kept indefinitely unless you ask for removal, which we honour without needing a reason."],
        ] },
      ],
    },
    {
      id: "rights", toc: "Your rights", title: "Your rights", blocks: [
        { p: "You can, at any time and without giving a reason:" },
        { ul: [
          "See everything we hold about you",
          "Correct anything that's wrong — most of it you can edit yourself",
          "Hide yourself from the directory",
          "Have a photograph taken down",
          "Leave, and have your record deleted",
        ] },
        { p: "Write to [PRIVACY EMAIL ADDRESS] and we'll act within [RESPONSE PERIOD, e.g. 30 days]. There's no form and no process to navigate." },
        { note: "[JURISDICTION CHECK]", text: "New York has no general consumer privacy statute as of writing, but the SHIELD Act imposes data security obligations and breach notification duties that likely apply. Confirm current requirements and add a breach notification commitment if your attorney advises it." },
      ],
    },
    {
      id: "tools", toc: "Third-party tools", title: "Third-party tools", blocks: [
        { p: "We use a small number of outside services to run the site. Each holds only what it needs to do its job." },
        { ul: [
          [b("Hostinger"), " — rents The Women's Collective the server the site runs on. Your application, your account and your member profile are stored on that server, in a database only The Women's Collective can read. They are not passed to any form-handling service."],
          [b("Cloudflare"), " — all traffic to the site passes through Cloudflare's network on its way to that server, so Cloudflare sees your IP address."],
          [b("Cloudflare Email Sending"), " — sends the account emails: the link to confirm your email address, password-reset links, and the welcome email when your application is approved. It receives your email address and the message. Nothing is emailed when an application is submitted."],
          "No newsletter platform is connected to this site. A newsletter sign-up is an answer on your application, and nothing is sent to you from here.",
          [b("No analytics."), " No analytics service runs on this site — no cookies are set, no profile is built, and nothing about your visit is sent to an advertising network."],
          "Fonts and photographs are self-hosted: they're served by this site's own server, so no font or image service sees your visit.",
        ] },
      ],
    },
    {
      id: "cookies", toc: "Cookies", title: "Cookies", blocks: [
        { p: "We set one cookie, and only once you sign in: __Secure-better-auth.session_token, which keeps you signed in until you sign out, or for seven days, renewed as you use the site. It isn't used for tracking and it isn't shared. There are no advertising cookies on this site and no third-party trackers." },
      ],
    },
    {
      id: "changes", toc: "Changes", title: "Changes to this policy", blocks: [
        { p: "If we change something that affects you materially, we'll email members rather than quietly updating the date at the top. The version number and date at the head of this page always reflect the current text." },
      ],
    },
    {
      id: "ask", toc: "Asking us", title: "Asking us anything", blocks: [
        { p: "Write to [PRIVACY EMAIL ADDRESS]. A person answers." },
      ],
    },
  ],
};

export const terms: LegalDoc = {
  badge: "Terms",
  title: "The Short Version",
  lede: "Be decent, don't misuse the directory, and understand that we're a community rather than a service you've bought.",
  updated: UPDATED,
  version: "[1.0]",
  template: {
    title: "TEMPLATE — NOT YET LEGAL ADVICE.",
    text: "Written to reflect how The Women's Collective actually operates so an attorney has something concrete to work from. Before publishing: fill every [BRACKET], and have a New York attorney review sections 8 and 9 in particular — liability and governing law are where templates do real damage.",
  },
  head: {
    title: "Terms of Membership — The Women’s Collective",
    description: "The terms for using this site and being a member of The Women’s Collective: membership, your account, the directory, what you post, events and leaving.",
  },
  sections: [
    {
      id: "agree", toc: "What you're agreeing to", title: "What you're agreeing to", blocks: [
        { p: ["By using this site, applying for membership, or attending an event hosted by The Women's Collective, you agree to these terms and to the ", CONDUCT, ". The code of conduct is the one that matters day to day; this page covers the rest."] },
        { p: "These terms are between you and [LEGAL ENTITY NAME]." },
      ],
    },
    {
      id: "membership", toc: "Membership", title: "Membership", blocks: [
        { ul: [
          "Membership is free. There are no dues, no tiers, and no paid upgrades.",
          "Applications are reviewed by people, and admission is at our discretion. We aim to answer within two weeks and we'll tell you either way.",
          "Being declined isn't permanent. You're welcome to apply again after [REAPPLICATION PERIOD, e.g. six months].",
          "Membership is personal to you. You can't transfer it, share your login, or use it on behalf of an organisation.",
        ] },
        { note: "[ELIGIBILITY]", text: "If The Women's Collective has stated eligibility criteria beyond geography and participation, they belong here." },
      ],
    },
    {
      id: "account", toc: "Your account", title: "Your account", blocks: [
        { ul: [
          "Keep your sign-in details to yourself. Anything done through your account is treated as done by you.",
          "Tell us promptly if you think someone else has got in.",
          "Keep your profile broadly accurate. You don't have to fill it in, but what's there shouldn't be misleading.",
        ] },
      ],
    },
    {
      id: "use", toc: "Acceptable use", title: "Acceptable use", blocks: [
        { p: "The directory is for finding and contacting individual members. You agree not to:" },
        { ul: [
          "Use it for bulk outreach, cold pitching, or recruiting — however it's dressed up",
          "Add any member to a mailing list, newsletter, or CRM without her asking",
          "Copy, scrape, export, or otherwise collect member information",
          "Share member information with anyone outside The Women's Collective",
          "Use automated tools against this site, or try to get at anything you're not signed in for",
        ] },
        { p: "This is the clause we enforce most often, and enforcement means losing your membership rather than a warning." },
      ],
    },
    {
      id: "content", toc: "What you post", title: "What you post", blocks: [
        { ul: [
          "You keep ownership of your bio, photograph, and anything else you add.",
          "You give us permission to display it in the member directory and, where you've agreed, in The Women's Collective communications. That permission ends when you remove the content or leave.",
          "Only upload things you have the right to upload — a photograph you took or commissioned, not one you found.",
          "We can remove content that breaches these terms or the code of conduct.",
        ] },
      ],
    },
    {
      id: "events", toc: "Events", title: "Events", blocks: [
        { ul: [
          "Events are organised by The Women's Collective and hosted in venues we don't own. Follow the host's rules while you're there.",
          "Where an event has a cost, it's stated up front and The Women's Collective takes nothing from it.",
          "Photographs are usually taken. We ask before publishing, you can decline on arrival, and anything already published comes down on request without a reason.",
          "Repeatedly reserving a place and not appearing may cost you access to future events.",
        ] },
      ],
    },
    {
      id: "ending", toc: "Ending membership", title: "Ending membership", blocks: [
        { ul: [
          "You can leave whenever you like, by writing to [CONTACT EMAIL]. Your entry disappears from the directory immediately.",
          "We may suspend or end a membership for a breach of these terms or the code of conduct. Where it's practical and safe to do so, we'll tell you why.",
          "Serious breaches — harassment, misuse of member information, anything that puts a member at risk — end membership immediately and without notice.",
        ] },
      ],
    },
    {
      id: "liability", toc: "Liability", title: "Liability", blocks: [
        { p: "The Women's Collective introduces people. It doesn't vet anyone's professional qualifications, insure anyone's work, or take part in whatever members arrange between themselves." },
        { ul: [
          "Any work, contract, or arrangement you enter into with another member is between the two of you.",
          "We don't verify credentials, licences, or insurance, and membership isn't an endorsement.",
          "The site is provided as it is. We'll do our best to keep it working and secure, but we can't promise it will never be unavailable.",
        ] },
        { note: "[ATTORNEY REQUIRED]", text: "Limitation-of-liability and indemnity wording is jurisdiction-specific and unenforceable if drafted badly. Do not copy standard language from another site. Have this section written or approved by a New York attorney." },
      ],
    },
    {
      id: "law", toc: "Governing law", title: "Governing law", blocks: [
        { p: "These terms are governed by the laws of the State of New York, and any dispute will be handled in the courts of [COUNTY], New York." },
        { note: "[CONFIRM]", text: "Venue and any arbitration or class-action provisions need an attorney's decision, not a template's." },
      ],
    },
    {
      id: "changes", toc: "Changes", title: "Changes", blocks: [
        { p: "We'll email members before anything material changes here, rather than updating the page quietly. Continuing to use your membership after a change means you accept it." },
        { p: "Questions about any of this go to [CONTACT EMAIL]." },
      ],
    },
  ],
};

export const codeOfConduct: LegalDoc = {
  badge: "Code of conduct",
  title: "What We Expect of Each Other",
  lede: "Not a poster in a break room. This is the document we actually use when something goes wrong.",
  updated: UPDATED,
  version: "[1.1]",
  template: {
    title: "TEMPLATE — NEEDS The Women's Collective'S DECISIONS.",
    text: "The structure and language are ready to use. What needs filling in: who sits on the review group, the reporting address, and whether the escalation path below matches what you'd actually do. An attorney should read the consequences and appeals sections before publishing.",
  },
  head: {
    title: "Code of Conduct — The Women’s Collective",
    description: "What members of The Women’s Collective expect of each other, the directory rule, and how to report something and what happens next.",
  },
  sections: [
    {
      id: "applies", toc: "Who this applies to", title: "Who this applies to", blocks: [
        { p: "Everyone, everywhere The Women's Collective exists: at events, in the directory, in the Facebook group, and in one-to-one contact that started here." },
        { p: "That last one matters. If you met through The Women's Collective, how you behave afterwards is still our business." },
      ],
    },
    {
      id: "expect", toc: "What we expect", title: "What we expect", blocks: [
        { ul: [
          [b("Show up."), " Membership is a verb. The directory is only as useful as the people willing to answer it."],
          [b("Give first."), " Referrals, introductions, and advice move before anyone asks for anything back."],
          [b("Say the real thing."), " We'd rather hear what went wrong last quarter than what's on your website."],
          [b("Keep the room in the room."), " What's shared at an event isn't yours to repeat elsewhere unless you're told otherwise."],
          [b("Assume good faith, and say so early."), " Most friction is a misunderstanding. Raise it while it's small."],
        ] },
      ],
    },
    {
      id: "directory", toc: "The directory rule", title: "The directory rule", blocks: [
        { p: [b("The public directory is not a mailing list."), " Members' selected public details are there so people can make genuine connections, never so anyone can broadcast."] },
        { p: "Specifically, you don't:" },
        { ul: [
          "Send bulk messages to members you haven't spoken to",
          "Cold pitch a service, however warmly it's worded",
          "Add anyone to a newsletter, mailing list, or CRM without her asking",
          "Copy, export, or scrape member information",
          "Pass private member information to anyone outside The Women's Collective",
        ] },
        { p: "This is the rule most likely to be broken by someone who means no harm, and it's the one that would quietly kill the directory if we let it slide. Breaking it costs your membership." },
      ],
    },
    {
      id: "never", toc: "What isn't tolerated", title: "What isn't tolerated", blocks: [
        { ul: [
          "Harassment of any kind, including after someone has asked you to stop",
          "Sexual attention that isn't wanted, in person or in writing",
          "Demeaning or discriminatory comments — about race, ethnicity, religion, disability, age, body, sexuality, gender identity, immigration status, class, or anything else",
          "Sharing anyone's private information, photograph, or contact details without consent",
          "Photographing or recording someone who's asked you not to",
          "Threats, intimidation, or aggression",
          "Retaliating against someone for making a report",
        ] },
        { p: "None of these need to be repeated to count, and none of them are excused by intent." },
      ],
    },
    {
      id: "report", toc: "Reporting something", title: "Reporting something", blocks: [
        { p: ["Write to ", b("[REPORTING EMAIL ADDRESS]"), " and it's handled the same day."] },
        { p: "You can ask to stay anonymous to everyone but the reviewer. You do not need to:" },
        { ul: [
          "Have proof",
          "Be the person it happened to",
          "Be certain it was serious enough",
          "Have raised it with the other person first",
        ] },
        { p: "If you're not sure whether something counts, report it. Deciding that is our job, not yours." },
        { p: [b("If you're in immediate danger, call 911 first."), " Tell us afterwards, when you're safe."] },
      ],
    },
    {
      id: "happens", toc: "What happens next", title: "What happens next", blocks: [
        { ul: [
          [b("Same day"), " — you get a reply confirming we have it and who's handling it."],
          [b("Within [X] days"), " — the review group looks at it. That's [NAMES OR ROLES]. Anyone named in a report steps out of handling it."],
          [b("We'll talk to you first"), " before doing anything that involves you, unless someone's safety means we can't wait."],
          [b("You'll be told the outcome"), " — what was decided and what happens now. We won't share private details about anyone else."],
        ] },
        { p: "Reports are kept confidential within the review group. We won't tell the person you reported who made the report unless you agree, and we will tell you before we do." },
      ],
    },
    {
      id: "consequences", toc: "Consequences", title: "Consequences", blocks: [
        { p: "What we do depends on what happened. In rough order:" },
        { ul: [
          "A private conversation",
          "A formal warning on record",
          "Being asked not to attend events for a period",
          "Removal from the directory",
          "Membership ended",
        ] },
        { p: "Harassment, misuse of member information, and anything that puts a member at risk go straight to the last one. There's no warning ladder for those, and there hasn't been an exception." },
      ],
    },
    {
      id: "appeal", toc: "Appeals", title: "Appeals", blocks: [
        { p: "If your membership is ended you can ask for one review, in writing, within [X] days. It's looked at by someone who wasn't involved in the original decision. That decision is final." },
        { note: "[DECISION NEEDED]", text: "Who reviews appeals when The Women's Collective is small enough that everyone knows everyone? An outside person, or a member not on the review group? Decide now rather than during a live case." },
      ],
    },
    {
      id: "us", toc: "If it's one of us", title: "If the problem is one of us", blocks: [
        { p: "If a report concerns the founder, an administrator, or a review group member, it goes to [ALTERNATIVE CONTACT], and the person concerned takes no part in handling it and sees nothing about it." },
        { p: "A code of conduct that only points downward isn't one." },
      ],
    },
    {
      id: "questions", toc: "Questions", title: "Questions", blocks: [
        { p: "Anything unclear here is a fault in the writing. Tell us and we'll fix it — [CONTACT EMAIL]." },
      ],
    },
  ],
};

/** The route's head: title, description and their Open Graph twins. */
export const legalHead = (doc: LegalDoc) => ({
  meta: [
    { title: doc.head.title },
    { name: "description", content: doc.head.description },
    { property: "og:title", content: doc.head.title },
    { property: "og:description", content: doc.head.description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
