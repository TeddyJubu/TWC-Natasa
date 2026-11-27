import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@ui-sdk/react/alert-dialog";
import { dangerButton, primaryButton, secondaryButton } from "./app-classes";
import { confirmQuestion, type ConfirmQuestion } from "./confirm";

/**
 * The one confirm dialog of the signed-in shells, a square white panel with the canvas’s hard shadow. Focus starts on
 * the safe answer (Cancel, or the question's own `cancel` word).
 */
export function ConfirmHost() {
  return (
    <AlertDialog controller={confirmQuestion.controller}>
      <AlertDialogContent<ConfirmQuestion> className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-32px)] w-[min(440px,calc(100vw-32px))] overflow-y-auto rounded-air-card bg-air-paper p-6 text-left font-sans text-air-navy shadow-air-menu backdrop:bg-black/50">
        {({ payload }) => (
          <>
            <AlertDialogTitle className="font-display text-2xl break-words">{payload?.title}</AlertDialogTitle>
            {payload?.body && <AlertDialogDescription className="mt-2 text-[15px]/[1.5] break-words text-air-muted">{payload.body}</AlertDialogDescription>}
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <AlertDialogClose className={secondaryButton}>{payload?.cancel ?? "Cancel"}</AlertDialogClose>
              <AlertDialogClose value="confirm" className={payload?.danger ? dangerButton : primaryButton}>{payload?.label}</AlertDialogClose>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
