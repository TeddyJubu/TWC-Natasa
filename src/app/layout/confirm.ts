import { createConfirm } from "@ui-sdk/react/alert-dialog";

/** `cancel` names the safe answer when "Cancel" would be unclear (Stay, when the question is about leaving). */
export type ConfirmQuestion = { title: string; body: string; label: string; danger: boolean; cancel?: string };

export const confirmQuestion = createConfirm<ConfirmQuestion>();

/** Asks in the shell's alert dialog: the message's first question is its title, the rest its description. */
export function askConfirm(message: string, label: string, danger = false, cancel?: string): Promise<boolean> {
  const [, title = message, body = ""] = /^(.*?\?)\s*(.*)$/s.exec(message) ?? [];
  return confirmQuestion({ title, body, label, danger, ...(cancel ? { cancel } : {}) });
}
