// The public forms' wording lookup: t(text) returns an admin's replacement for a default text, else the text itself.
import * as React from "react";

export type Translate = (text: string) => string;
export const CopyContext = React.createContext<Translate>((text) => text);

/** Pass every editable text through the returned t(). Outside a <FormCopyProvider> it returns the text unchanged. */
export const useCopy = () => React.useContext(CopyContext);
