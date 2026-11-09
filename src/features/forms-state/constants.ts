// Shared membership-form open/close constants (no server imports — safe for routes).

export const KINDS = ["application", "review"] as const;
export type FormKind = (typeof KINDS)[number];

/** OPS-031 fallback when the stored message is blank. */
export const CLOSED_DEFAULT = "This form is closed for now. Thank you for your interest — please check back soon.";
export const CLOSED_MESSAGE_MAX = 1000;

export const CLOSED_TITLE: Record<FormKind, string> = {
  application: "Applications are closed",
  review: "Member reviews are paused",
};

export const KIND_LABEL: Record<FormKind, string> = {
  application: "Membership application",
  review: "Member review",
};
