import { postApi } from "@/app/api";
import type { SignupRequest } from "./schema";

/** Signs an address up for the letter; throws the server's message when it couldn't. */
export const sendSignup = (input: SignupRequest): Promise<void> => postApi<void>("/api/newsletter", input);
