const STATUS_META = {
  submitted: { label: 'Submitted', className: 'status-neutral' },
  under_review: { label: 'Under review', className: 'status-progress' },
  approved: { label: 'Approved', className: 'status-success' },
  rejected: { label: 'Rejected', className: 'status-danger' },
  for_payment: { label: 'Waiting for payment', className: 'status-warning' },
  payment_rejected: { label: 'Payment rejected', className: 'status-danger' },
  paid: { label: 'Paid', className: 'status-progress' },
  ready_for_claim: { label: 'Ready for claim', className: 'status-gold' },
  claimed: { label: 'Claimed', className: 'status-success' },
};

export default function StatusTag({ status }) {
  const meta = STATUS_META[status] || { label: status, className: 'status-neutral' };
  return <span className={`status ${meta.className}`}>{meta.label}</span>;
}

export { STATUS_META };
