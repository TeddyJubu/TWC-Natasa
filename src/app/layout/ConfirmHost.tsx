import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@ui-sdk/react/alert-dialog";
import { primaryButton, redButton, secondaryButton } from "./app-classes";
import { confirmQuestion, type ConfirmQuestion } from "./confirm";

/** The one confirm dialog of the signed-in shells, on the airmail letter. Focus starts on Cancel. */
export function ConfirmHost() {
  return (
    <AlertDialog controller={confirmQuestion.controller}>
      <AlertDialogContent<ConfirmQuestion> className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-32px)] w-[min(440px,calc(100vw-32px))] overflow-y-auto rounded-air-card bg-air-paper p-6 text-left font-geist text-air-navy shadow-air-menu backdrop:bg-black/50">
        {({ payload }) => (
          <>
            <AlertDialogTitle className="font-display text-2xl break-words">{payload?.title}</AlertDialogTitle>
            {payload?.body && <AlertDialogDescription className="mt-2 text-[15px]/[1.5] break-words text-air-muted">{payload.body}</AlertDialogDescription>}
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <AlertDialogClose className={secondaryButton}>Cancel</AlertDialogClose>
              <AlertDialogClose value="confirm" className={payload?.danger ? redButton : primaryButton}>{payload?.label}</AlertDialogClose>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
