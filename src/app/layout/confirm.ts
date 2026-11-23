import { createConfirm } from "@ui-sdk/react/alert-dialog";

export type ConfirmQuestion = { title: string; body: string; label: string; danger: boolean };

export const confirmQuestion = createConfirm<ConfirmQuestion>();

/** Asks in the shell's alert dialog: the message's first question is its title, the rest its description. */
export function askConfirm(message: string, label: string, danger = false): Promise<boolean> {
  const [, title = message, body = ""] = /^(.*?\?)\s*(.*)$/s.exec(message) ?? [];
  return confirmQuestion({ title, body, label, danger });
}
