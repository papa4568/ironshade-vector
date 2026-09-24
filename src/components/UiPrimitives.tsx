import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type RequirementPresentation =
  | {
      state: 'ready';
      label: string;
      detail?: string;
    }
  | {
      state: 'active';
      label: string;
      detail?: string;
    }
  | {
      state: 'blocked';
      label: string;
      reason: string;
      nextRequirement: string;
    };

export function ActionRequirement({ presentation }: { presentation: RequirementPresentation }) {
  return (
    <section
      className={'iv-requirement iv-requirement--' + presentation.state}
      data-requirement-state={presentation.state}
      role="status"
      aria-label={presentation.state + ' action requirement'}
    >
      <div className="iv-requirement__state">
        <span aria-hidden="true" className="iv-requirement__mark" />
        <small>{presentation.state.toUpperCase()}</small>
        <b>{presentation.label}</b>
      </div>
      {presentation.state === 'blocked' ? (
        <div className="iv-requirement__copy">
          <span><strong>Why blocked:</strong> {presentation.reason}</span>
          <span><strong>Next:</strong> {presentation.nextRequirement}</span>
        </div>
      ) : presentation.detail ? (
        <div className="iv-requirement__copy"><span>{presentation.detail}</span></div>
      ) : null}
    </section>
  );
}

type ProgressiveDisclosureProps = {
  triggerLabel: string;
  heading: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

function focusableElements(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

export function ProgressiveDisclosure({ triggerLabel, heading, eyebrow = 'Details', children, className = '' }: ProgressiveDisclosureProps) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const historyMarker = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const historyEntryActiveRef = useRef(false);

  const dismiss = useCallback(() => {
    if (historyEntryActiveRef.current && window.history.state?.__ironshadeDisclosure === historyMarker) {
      historyEntryActiveRef.current = false;
      window.history.back();
    }
    setOpen(false);
  }, [historyMarker]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    window.history.pushState({ ...window.history.state, __ironshadeDisclosure: historyMarker }, '');
    historyEntryActiveRef.current = true;

    const handlePopState = () => {
      historyEntryActiveRef.current = false;
      setOpen(false);
    };
    window.addEventListener('popstate', handlePopState);

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first = focusableElements(dialog)[0];
      (first ?? dialog).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('popstate', handlePopState);
      window.setTimeout(() => {
        const focusTarget = previousFocus && document.contains(previousFocus) ? previousFocus : triggerRef.current;
        focusTarget?.focus();
      }, 0);
    };
  }, [historyMarker, open]);

  const onDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = focusableElements(dialog);
    if (focusables.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const sheet = open ? (
    <div
      className="iv-disclosure-backdrop"
      data-progressive-disclosure="open"
      onPointerDown={event => {
        if (event.currentTarget === event.target) dismiss();
      }}
    >
      <section
        ref={dialogRef}
        className={'iv-disclosure-sheet iv-panel iv-panel--glass ' + className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <header className="iv-disclosure-sheet__header">
          <div>
            <small className="iv-label">{eyebrow}</small>
            <h2 id={labelId}>{heading}</h2>
          </div>
          <button type="button" className="iv-disclosure-sheet__close" aria-label="Close details" onClick={dismiss}>Close</button>
        </header>
        <div className="iv-disclosure-sheet__body iv-stack">{children}</div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="iv-disclosure-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet}
    </>
  );
}
