// Client reads/writes for the /join · /review open-close switch (requireAdmin on the toggle).
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFormsStateFn, publicFormStateFn, setMembershipFormOpenFn } from "./fns";
import type { FormKind } from "./constants";

export type { FormKind } from "./constants";
export type { AdminFormState, PublicFormState } from "./forms-state.server";

export const publicFormStateQuery = (kind: FormKind) => queryOptions({
  queryKey: ["forms-state", kind],
  queryFn: () => publicFormStateFn({ data: { kind } }),
});

export const adminFormsStateQuery = queryOptions({
  queryKey: ["admin", "forms-state"],
  queryFn: () => adminFormsStateFn(),
});

export type MembershipFormOpenInput = { kind: FormKind; open: boolean; message?: string };

export function useSetMembershipFormOpen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MembershipFormOpenInput) => setMembershipFormOpenFn({ data }),
    onSuccess: (_void, data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "forms-state"] });
      void qc.invalidateQueries({ queryKey: ["forms-state", data.kind] });
    },
  });
}
