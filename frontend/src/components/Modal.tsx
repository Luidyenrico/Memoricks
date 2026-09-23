"use client";

import { RefObject, useEffect, useRef } from "react";

export default function Modal({
  children,
  titleId,
  onClose,
  busy = false,
  initialFocusRef,
  className = "",
}: {
  children: React.ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
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
      className={`modal ${className}`}
    >
      {children}
    </dialog>
  );
}
