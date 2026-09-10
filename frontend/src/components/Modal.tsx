"use client";

import { RefObject, useEffect, useRef } from "react";

export default function Modal({
  children,
  titleId,
  onClose,
  busy = false,
  initialFocusRef,
}: {
  children: React.ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    initialFocusRef?.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-border-custom bg-bg-dark text-text-white p-5 sm:p-8 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {children}
    </dialog>
  );
}
