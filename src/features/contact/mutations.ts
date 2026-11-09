import { postApi } from "@/app/api";
import type { ContactInput } from "./schema";

/** Sends a /contact message; throws the server's message when it couldn't be delivered. */
export const sendContact = (input: ContactInput): Promise<void> => postApi<void>("/api/contact", input);
