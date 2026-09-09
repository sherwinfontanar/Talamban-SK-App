'use client';

import { useEffect, useState } from 'react';

/**
 * Generic confirmation modal.
 *
 * Plain confirm (approve, verify, logout):
 *   <ConfirmModal open title="Log out?" onConfirm={...} onClose={...} />
 *
 * Confirm with a required reason (reject flows):
 *   <ConfirmModal open title="Reject this request?" requireReason
 *     onConfirm={(reason) => ...} onClose={...} />
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary', // 'primary' | 'danger'
  requireReason = false,
  reasonLabel = 'Reason',
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('');

  // Reset the reason field each time the modal opens fresh.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const canConfirm = !requireReason || reason.trim().length > 0;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(requireReason ? reason.trim() : undefined);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {message && <p className="muted">{message}</p>}

        {requireReason && (
          <div className="field">
            <label htmlFor="modal-reason">{reasonLabel}</label>
            <textarea
              id="modal-reason"
              rows={3}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}