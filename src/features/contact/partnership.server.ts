// Server-only: POST /api/partnerships — a STUB until the admin-inbox work lands storage (see
// migration/briefs/admin-inbox.md). It checks the size like every body route, reads nothing, and answers 501
// with a message the form shows, so a partner is pointed at /contact instead of left guessing.
import { checkSize, HttpError, respond } from "@/server/request";

export const PARTNERSHIP_NOT_READY = "Partnership inquiries aren’t open online just yet. Please send us a note through the contact page instead.";

export function partnershipRequest(request: Request): Promise<Response> {
  return respond(() => {
    checkSize(request, 16 * 1024);
    throw new HttpError(PARTNERSHIP_NOT_READY, 501);
  });
}
