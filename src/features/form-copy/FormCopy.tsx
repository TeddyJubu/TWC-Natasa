// A page wraps its form in <FormCopyProvider copy={…}> with what its loader read; the shared fields and the forms
// then call useCopy() (./use-copy) and pass every editable text through t().
import * as React from "react";
import { CopyContext, type Translate } from "./use-copy";

export function FormCopyProvider({ copy, children }: { copy?: Record<string, string>; children: React.ReactNode }) {
  const t = React.useMemo<Translate>(() => (text) => copy?.[text] ?? text, [copy]);
  return <CopyContext.Provider value={t}>{children}</CopyContext.Provider>;
}
