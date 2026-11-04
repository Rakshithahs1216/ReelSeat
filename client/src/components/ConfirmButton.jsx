import { useState } from 'react';

/** A button that asks for an inline second click before running a destructive action. */
export default function ConfirmButton({ onConfirm, children, confirmLabel = 'Confirm?', className = 'btn btn-danger btn-sm', disabled }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <span className="confirm-btn">
      <button type="button" className={className} onClick={handleClick} disabled={disabled || busy}>
        {busy ? 'Working…' : armed ? confirmLabel : children}
      </button>
      {armed && !busy && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArmed(false)}>Cancel</button>
      )}
    </span>
  );
}
