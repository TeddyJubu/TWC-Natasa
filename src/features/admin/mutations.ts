// Admin writes. The database enforces who may do each of these (is_admin() policies); the client only
// validates early and refreshes every cache that shows the changed rows.
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";
import type { Database } from "@/integrations/supabase/types";
import { checkLogo, validateNeighborhood } from "./format";
import { emailApproval, type ApprovalNotice } from "./approval-email";

type MembershipStatus = Database["public"]["Enums"]["membership_status"];
export type Review = { id: string; status: Exclude<MembershipStatus, "pending"> };
export type BookingReview = { id: string; status: "confirmed" | "declined" };

const invalidate = (qc: QueryClient, keys: QueryKey[]) =>
  Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));

/**
 * The review trigger syncs the linked profile and records reviewed_at / reviewed_by.
 * An approval then sends the welcome email; the result is a notice (null for a decline), never a failure.
 */
export async function reviewApplication({ id, status }: Review): Promise<ApprovalNotice | null> {
  const supabase = await getSupabase();
  const { error } = await supabase.from("applications").update({ status }).eq("id", id);
  if (error) throw error;
  return status === "approved" ? emailApproval(id) : null;
}

/**
 * Admins set the profile status directly; 0004 gives the newest application the same status, so an
 * approval emails that application's applicant (or says there's none on file).
 */
export async function setMemberStatus({ id, status }: Review): Promise<ApprovalNotice | null> {
  const supabase = await getSupabase();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) throw error;
  if (status !== "approved") return null;
  const { data: app } = await supabase
    .from("applications").select("id").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return app ? emailApproval(app.id) : { sent: false, reason: "no application on file" };
}

export async function setBookingStatus({ id, status }: BookingReview): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from("headshot_bookings").update({ status }).eq("id", id);
  if (error) throw error;
}

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
 * Uploads to `neighborhood-logos/<slug>.<ext>` (replacing a same-name logo), then points the row at it.
 * Only called once the row itself is saved, so a storage failure never loses it.
 */
async function saveLogo(slug: string, logo: File): Promise<string> {
  const path = `${slug}.${checkLogo(logo)}`;
  const supabase = await getSupabase();
  // Short cache so a replaced logo reaches visitors within a minute (see adminNeighborhoodsQuery).
  const upload = await supabase.storage
    .from("neighborhood-logos")
    .upload(path, logo, { upsert: true, contentType: logo.type, cacheControl: "60" });
  if (upload.error) throw upload.error;
  const { error } = await supabase.from("neighborhoods").update({ logo_path: path }).eq("slug", slug);
  if (error) throw error;
  return path;
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

/** Inserts the row (no logo), then adds the logo. A duplicate slug or name fails before storage is touched. */
export async function createNeighborhood({ logo, ...input }: NewNeighborhood): Promise<void> {
  assertValid({ ...input, logo });
  const supabase = await getSupabase();
  const { error } = await supabase.from("neighborhoods").insert({ ...input, name: input.name.trim() });
  if (error) throw error;
  if (logo) await saveLogoAfter("Neighborhood added", input.slug, logo);
}

/**
 * Saves the row fields first (never the slug: it's the key; a rename cascades to profiles and events through
 * the FKs), then the logo. A logo under a new extension removes the old object; failing that is only a warning.
 */
export async function updateNeighborhood({ slug, logo, previousLogoPath, ...patch }: NeighborhoodEdit): Promise<SaveOutcome> {
  assertValid({ ...patch, logo });
  const supabase = await getSupabase();
  const { error } = await supabase.from("neighborhoods").update({ ...patch, name: patch.name.trim() }).eq("slug", slug);
  if (error) throw error;
  if (!logo) return {};
  const path = await saveLogoAfter("Changes saved", slug, logo);
  if (!previousLogoPath || previousLogoPath === path) return {};
  const removed = await supabase.storage.from("neighborhood-logos").remove([previousLogoPath]);
  return removed.error
    ? { warning: `Saved. The old logo file (${previousLogoPath}) couldn’t be removed: ${removed.error.message}` }
    : {};
}

// A neighborhood change can rename it on every profile and event, so refresh everything that shows one.
const NEIGHBORHOOD_KEYS: QueryKey[] = [
  ["neighborhoods"], ["admin", "neighborhoods"], ["admin", "members"], ["directory"], ["public-profiles"], ["intros"], ["profile"], ["events"],
];

export const reviewApplicationMutation = (qc: QueryClient) => ({
  mutationFn: reviewApplication,
  onSuccess: () => invalidate(qc, [["admin", "applications"], ["admin", "members"], ["directory"], ["public-profiles"], ["intros"]]),
});

export const setMemberStatusMutation = (qc: QueryClient) => ({
  mutationFn: setMemberStatus,
  onSuccess: () => invalidate(qc, [["admin", "members"], ["admin", "applications"], ["directory"], ["public-profiles"], ["intros"]]),
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

export const useReviewApplication = () => useMutation(reviewApplicationMutation(useQueryClient()));
export const useSetMemberStatus = () => useMutation(setMemberStatusMutation(useQueryClient()));
export const useSetBookingStatus = () => useMutation(setBookingStatusMutation(useQueryClient()));
export const useCreateNeighborhood = () => useMutation(createNeighborhoodMutation(useQueryClient()));
export const useUpdateNeighborhood = () => useMutation(updateNeighborhoodMutation(useQueryClient()));
