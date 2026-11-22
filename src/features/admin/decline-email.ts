// The decline email's words, approved by the owner on 2026-11-23: change them only with the owner's approval. Shared
// so the admin's dialog previews exactly what the server sends. No reason, and nothing that implies a later yes.
export const DECLINE_SUBJECT = "About your application to The Women’s Collective";

export const declineText = (name: string, contactUrl: string) => `${name.trim() ? `Dear ${name.trim()},` : "Hello,"}

Thank you for applying to The Women’s Collective, and for telling us about yourself and your work.

We read every application, and we aren’t able to offer you a membership.

We know this isn’t the answer you were hoping for, and we’re sorry to disappoint you. If you have a question, you can write to us here:
${contactUrl}

Wishing you all the best,
The Women’s Collective
`;
