import { postApi } from "@/app/api";
import type { ContactInput } from "./schema";

/** What the form posts: the checked message plus the honeypot field (empty for people). */
export type ContactMessage = ContactInput & { honeypot: string };

/** Sends a /contact message; throws the server's message when it couldn't be delivered. */
export const sendContact = (input: ContactMessage): Promise<void> => postApi<void>("/api/contact", input);
