import {
  AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from "@ui-sdk/react/alert-dialog";
import { primaryButton, secondaryButton } from "@/app/layout/app-classes";
import { DECLINE_SUBJECT, declineText } from "./decline-email";

/**
 * The decline confirmation: shows the exact email and makes sending it a choice. An alert dialog; its first Close part
 * is the safe answer, so that is where focus lands, and Escape cancels.
 */
export function DeclineDialog({ subject, name, email, onDecline, onClose }: {
  /** Who the admin is deciding about; `name` is who the email greets. */
  subject: string; name: string; email: string | null; onDecline: (sendEmail: boolean) => void; onClose: () => void;
}) {
  return (
    <AlertDialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <AlertDialogContent className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto rounded-air-card bg-air-paper p-6 text-left font-sans text-air-navy shadow-air-menu backdrop:bg-black/50">
        <AlertDialogTitle className="font-display text-2xl break-words">Decline {subject}?</AlertDialogTitle>
        <AlertDialogDescription className="mt-2 text-[15px]/[1.5] text-air-muted">
          The email below goes out only if you choose to send it. Once sent, it can’t be taken back.
        </AlertDialogDescription>
        <div className="mt-4 rounded-air-cell border border-air-rule p-4 text-sm/[1.55]">
          <dl className="flex flex-col gap-1 border-b border-air-rule pb-3">
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-air-muted">To</dt><dd className="min-w-0 break-all">{email ?? "No email address on file"}</dd></div>
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-air-muted">Subject</dt><dd className="min-w-0">{DECLINE_SUBJECT}</dd></div>
          </dl>
          <p className="mt-3 break-words whitespace-pre-wrap">{declineText(name, `${window.location.origin}/contact`).trim()}</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <AlertDialogClose className={secondaryButton}>Keep as is</AlertDialogClose>
          <button type="button" className={secondaryButton} onClick={() => onDecline(false)}>Decline without email</button>
          <button type="button" className={primaryButton} disabled={!email} onClick={() => onDecline(true)}>Decline and send email</button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
