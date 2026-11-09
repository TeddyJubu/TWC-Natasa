// Admin writes. The server functions enforce who may do each of these (requireAdmin); the client only
// validates early and refreshes every cache that shows the changed rows.
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { MembershipStatus } from "@/features/members/members.server";
import { checkLogo, validateNeighborhood } from "./format";
import { emailApproval, type ApprovalNotice } from "./approval-email";
import { postApi } from "@/app/api";
import {
  addLoggedActionFn, addNoteFn, adminCsvFn, archiveMessageFn, createEventFn, deleteNoteFn, createNeighborhoodFn, deleteEventFn,
  editLoggedActionFn, removeLoggedActionFn, restoreLoggedActionFn, reviewApplicationFn, setBookingStatusFn,
  setMemberNeighborhoodFn, setMemberStatusFn, updateEventFn, updateNeighborhoodFn,
} from "./fns";
import type { LoggedActionKind } from "./format";

export type Review = { id: string; status: MembershipStatus };
export type BookingReview = { id: string; status: "confirmed" | "declined" };

const invalidate = (qc: QueryClient, keys: QueryKey[]) =>
  Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));

/**
 * The server syncs the linked profile and records reviewed_at / reviewed_by.
 * An approval then sends the welcome email; decline and undo-decline (back to pending) send nothing.
 */
export async function reviewApplication({ id, status }: Review): Promise<ApprovalNotice | null> {
  await reviewApplicationFn({ data: { id, status } });
  return status === "approved" ? emailApproval(id) : null;
}

/**
 * Admins set the profile status directly; the server gives the newest application the same decision
 * (approve / decline / undo-decline → pending) and returns its id, so an approval can email that applicant.
 */
export async function setMemberStatus({ id, status }: Review): Promise<ApprovalNotice | null> {
  const newest = await setMemberStatusFn({ data: { id, status } });
  if (status !== "approved") return null;
  return newest ? emailApproval(newest) : { sent: false, reason: "no application on file" };
}

export const setBookingStatus = ({ id, status }: BookingReview): Promise<void> => setBookingStatusFn({ data: { id, status } });

export type NewNeighborhood = { name: string; slug: string; color: string; sort_order: number; logo?: File };
export type NeighborhoodEdit = {
  slug: string; name: string; color: string; active: boolean; sort_order: number;
  /** The row's current logo_path, so a logo saved under a new extension can clean up the old object. */
  previousLogoPath: string | null;
  logo?: File;
};
/** A save that went through, with anything the admin should still know about. */
export type SaveOutcome = { warning?: string };

/** Validates every field (and the logo) before any network call; throws a message an admin can act on. */
function assertValid(input: { name: string; color: string; slug?: string; logo?: File }) {
  const problem = validateNeighborhood(input);
  if (problem) throw new Error(problem);
  if (input.logo) checkLogo(input.logo);
}

/**
 * Uploads to `neighborhood-logos/<slug>.<ext>` (replacing a same-name logo, removing one under another extension)
 * and points the row at it. Only called once the row itself is saved, so an upload failure never loses it.
 */
async function saveLogo(slug: string, logo: File): Promise<string> {
  checkLogo(logo);
  const form = new FormData();
  form.set("slug", slug);
  form.set("file", logo);
  return postApi<string>("/api/neighborhood-logos", form);
}

/** Thrown when the row was saved but its logo wasn't: the admin retries the logo from Edit. */
export class LogoNotSavedError extends Error {}

async function saveLogoAfter(saved: string, slug: string, logo: File): Promise<string> {
  try {
    return await saveLogo(slug, logo);
  } catch (error) {
    const reason = (error as { message?: string } | null)?.message || "unknown error";
    throw new LogoNotSavedError(`${saved}, but the logo didn't upload: ${reason}`);
  }
}

/** Inserts the row (no logo), then adds the logo. A duplicate slug or name fails before any upload. */
export async function createNeighborhood({ logo, ...input }: NewNeighborhood): Promise<void> {
  assertValid({ ...input, logo });
  await createNeighborhoodFn({ data: { ...input, name: input.name.trim() } });
  if (logo) await saveLogoAfter("Neighborhood added", input.slug, logo);
}

/**
 * Saves the row fields first (never the slug: it's the key; a rename cascades to profiles and events through
 * the foreign keys), then the logo; the server removes an old logo saved under another extension.
 */
export async function updateNeighborhood({ slug, logo, previousLogoPath: _previous, ...patch }: NeighborhoodEdit): Promise<SaveOutcome> {
  assertValid({ ...patch, logo });
  await updateNeighborhoodFn({ data: { slug, ...patch, name: patch.name.trim() } });
  if (logo) await saveLogoAfter("Changes saved", slug, logo);
  return {};
}

// A neighborhood change can rename it on every profile and event, so refresh everything that shows one.
const NEIGHBORHOOD_KEYS: QueryKey[] = [
  ["neighborhoods"], ["admin", "neighborhoods"], ["admin", "members"], ["directory"], ["public-profiles"], ["intros"], ["profile"], ["events"],
];

export const reviewApplicationMutation = (qc: QueryClient) => ({
  mutationFn: reviewApplication,
  onSuccess: () => invalidate(qc, [["admin", "applications"], ["admin", "members"], ["admin", "actions"], ["directory"], ["public-profiles"], ["intros"]]),
});

export const setMemberStatusMutation = (qc: QueryClient) => ({
  mutationFn: setMemberStatus,
  onSuccess: () => invalidate(qc, [["admin", "members"], ["admin", "applications"], ["admin", "actions"], ["directory"], ["public-profiles"], ["intros"]]),
});

// Her neighborhood shows on the directory, her public page and in intros.
export const setMemberNeighborhoodMutation = (qc: QueryClient) => ({
  mutationFn: (data: { id: string; neighborhood: string | null }) => setMemberNeighborhoodFn({ data }),
  onSuccess: () => invalidate(qc, [["admin", "members"], ["admin", "actions"], ["directory"], ["public-profiles"], ["intros"], ["profile"]]),
});

export const setBookingStatusMutation = (qc: QueryClient) => ({
  mutationFn: setBookingStatus,
  onSuccess: () => invalidate(qc, [["admin", "bookings"]]),
});

// onSettled, not onSuccess: a LogoNotSavedError means the row did change.
const refreshAfterLogo = (qc: QueryClient) => (_data: unknown, error: unknown) =>
  !error || error instanceof LogoNotSavedError ? invalidate(qc, NEIGHBORHOOD_KEYS) : undefined;

export const createNeighborhoodMutation = (qc: QueryClient) => ({
  mutationFn: createNeighborhood,
  onSettled: refreshAfterLogo(qc),
});

export const updateNeighborhoodMutation = (qc: QueryClient) => ({
  mutationFn: updateNeighborhood,
  onSettled: refreshAfterLogo(qc),
});

/** Today's events columns; `starts_at` is an ISO instant (the form converts its New York wall-clock input). */
export type GatheringInput = { title: string; description: string; location: string; neighborhood: string; starts_at: string; kind: string };

/** Creates the gathering, or updates it when `id` is given. */
export const saveEvent = async ({ id, ...input }: GatheringInput & { id?: string }): Promise<void> => {
  if (id) await updateEventFn({ data: { id, ...input } });
  else await createEventFn({ data: input });
};

// Admin card, members' account list and the public calendar all show gatherings.
const EVENT_KEYS: QueryKey[] = [["admin", "events"], ["events"], ["public-events"]];

export const saveEventMutation = (qc: QueryClient) => ({
  mutationFn: saveEvent,
  onSuccess: () => invalidate(qc, EVENT_KEYS),
});

/** Its saved seats go with it (cascade); the card confirms first. */
export const deleteEventMutation = (qc: QueryClient) => ({
  mutationFn: (id: string) => deleteEventFn({ data: { id } }),
  onSuccess: () => invalidate(qc, EVENT_KEYS),
});

export const archiveMessageMutation = (qc: QueryClient) => ({
  mutationFn: (id: string) => archiveMessageFn({ data: { id } }),
  onSuccess: () => invalidate(qc, [["admin", "inbox"]]),
});

export type NoteInput = { applicationId: string; body: string } | { memberId: string; body: string };

export const addNoteMutation = (qc: QueryClient) => ({
  mutationFn: (data: NoteInput) => addNoteFn({ data }),
  onSuccess: () => invalidate(qc, [["admin", "notes"], ["admin", "actions"]]),
});

export const deleteNoteMutation = (qc: QueryClient) => ({
  mutationFn: (id: string) => deleteNoteFn({ data: { id } }),
  onSuccess: () => invalidate(qc, [["admin", "notes"], ["admin", "actions"]]),
});

/** Fetches the CSV (requireAdmin on the server) and saves it through a temporary blob link; nothing is cached. */
export async function downloadCsv(kind: "applications" | "members"): Promise<void> {
  const { filename, csv } = await adminCsvFn({ data: { kind } });
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const useReviewApplication = () => useMutation(reviewApplicationMutation(useQueryClient()));
export const useSetMemberStatus = () => useMutation(setMemberStatusMutation(useQueryClient()));
export const useSetMemberNeighborhood = () => useMutation(setMemberNeighborhoodMutation(useQueryClient()));
export const useSetBookingStatus = () => useMutation(setBookingStatusMutation(useQueryClient()));
export const useCreateNeighborhood = () => useMutation(createNeighborhoodMutation(useQueryClient()));
export const useUpdateNeighborhood = () => useMutation(updateNeighborhoodMutation(useQueryClient()));
export const useSaveEvent = () => useMutation(saveEventMutation(useQueryClient()));
export const useDeleteEvent = () => useMutation(deleteEventMutation(useQueryClient()));
export const useArchiveMessage = () => useMutation(archiveMessageMutation(useQueryClient()));
export const useAddNote = () => useMutation(addNoteMutation(useQueryClient()));
export const useDeleteNote = () => useMutation(deleteNoteMutation(useQueryClient()));
export const useDownloadCsv = () => useMutation({ mutationFn: downloadCsv });

export type LoggedActionInput = {
  kind: LoggedActionKind;
  actionDate: string;
  note?: string;
} & ({ applicationId: string } | { memberId: string });

export type LoggedActionEdit = { id: string; kind: LoggedActionKind; actionDate: string; note?: string };

const LOGGED_KEYS: QueryKey[] = [["admin", "logged-actions"]];

export const addLoggedActionMutation = (qc: QueryClient) => ({
  mutationFn: (data: LoggedActionInput) => addLoggedActionFn({ data }),
  onSuccess: () => invalidate(qc, LOGGED_KEYS),
});

export const editLoggedActionMutation = (qc: QueryClient) => ({
  mutationFn: (data: LoggedActionEdit) => editLoggedActionFn({ data }),
  onSuccess: () => invalidate(qc, LOGGED_KEYS),
});

export const removeLoggedActionMutation = (qc: QueryClient) => ({
  mutationFn: (id: string) => removeLoggedActionFn({ data: { id } }),
  onSuccess: () => invalidate(qc, LOGGED_KEYS),
});

export const restoreLoggedActionMutation = (qc: QueryClient) => ({
  mutationFn: (id: string) => restoreLoggedActionFn({ data: { id } }),
  onSuccess: () => invalidate(qc, LOGGED_KEYS),
});

export const useAddLoggedAction = () => useMutation(addLoggedActionMutation(useQueryClient()));
export const useEditLoggedAction = () => useMutation(editLoggedActionMutation(useQueryClient()));
export const useRemoveLoggedAction = () => useMutation(removeLoggedActionMutation(useQueryClient()));
export const useRestoreLoggedAction = () => useMutation(restoreLoggedActionMutation(useQueryClient()));
