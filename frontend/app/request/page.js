import Link from 'next/link';
import Masthead from '../components/Masthead';

const DOCUMENT_TYPES = [
  {
    type: 'barangay_cert',
    label: 'Barangay Certificate',
    fee: '₱70',
    note: 'General-purpose residency certificate',
  },
  {
    type: 'ftjs_cert',
    label: 'First Time Jobseeker Certificate',
    fee: 'Free',
    note: 'One per resident, under RA 11261',
  },
  {
    type: 'indigency_cert',
    label: 'Certificate of Indigency',
    fee: 'See staff',
    note: 'Fee confirmed during review',
  },
];

export default function RequestIndexPage() {
  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content">
        <h1>Request a document</h1>
        <p className="muted">
          Submit your request online. When it's ready, bring your claim code to the barangay
          hall — no waiting in line for processing.
        </p>

        <div className="ledger">
          {DOCUMENT_TYPES.map((doc) => (
            <div className="ledger-row" key={doc.type}>
              <div className="ledger-row-main">
                <span className="ledger-row-title">{doc.label}</span>
                <span className="ledger-row-meta">{doc.note}</span>
              </div>
              <div className="ledger-row-side">
                <span className="fee">{doc.fee}</span>
                <Link href={`/request/new?type=${doc.type}`} className="btn btn-primary btn-sm">
                  Request
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: '2rem' }}>
          Already submitted a request? <Link href="/request/status">Check its status</Link>
        </p>
      </main>
    </div>
  );
}