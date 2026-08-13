import { useEffect, useRef, type ReactNode, type RefObject } from "react";

// Minimal accessible dialog shell shared by create-form modals (Add habit,
// Add goal). Owns the a11y/lifecycle behavior — backdrop close (guarded by
// `busy`), Escape close, focus into the dialog on open and back to the
// page's trigger button on close — while each page keeps its own form.
export default function Modal({
  open,
  busy,
  titleId,
  title,
  supporting,
  onClose,
  triggerRef,
  children,
}: {
  open: boolean;
  busy: boolean;
  titleId: string;
  title: string;
  supporting: string;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Focus: into the dialog when opened; back to the trigger when closed.
  // Skipped on initial mount (open=false) so page load keeps natural focus.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      dialogRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef?.current?.focus();
    }
  }, [open, triggerRef]);

  // Escape closes unless a submission is in flight.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  return (
    <>
      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) onClose();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="modal"
            tabIndex={-1}
          >
            <div className="modal-head">
              <div>
                <h2 id={titleId}>{title}</h2>
                <p className="section-sub">{supporting}</p>
              </div>
              <button type="button" className="modal-close" aria-label="Close dialog" disabled={busy} onClick={onClose}>
                ×
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
