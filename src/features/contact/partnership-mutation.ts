import { postApi } from "@/app/api";
import type { PartnershipInput } from "./partnership";

/** Sends a /partnerships inquiry; throws the server's message when it couldn't be delivered. */
export const sendPartnership = (input: PartnershipInput): Promise<void> => postApi<void>("/api/partnerships", input);
