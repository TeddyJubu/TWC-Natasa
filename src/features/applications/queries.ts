import { queryOptions } from "@tanstack/react-query";
import { applicantFn } from "./fns";

export type { Applicant } from "./applications.server";

/** The signed-in applicant's name and email for prefilling /join; null when signed out. */
export const applicantQuery = queryOptions({
  queryKey: ["applicant"],
  queryFn: () => applicantFn(),
});
