import Link from 'next/link';

const DOCUMENT_TYPES = [
  { type: 'barangay_cert', label: 'Barangay Certificate', fee: '₱70' },
  { type: 'ftjs_cert', label: 'First Time Jobseeker Certificate', fee: 'Free' },
  { type: 'indigency_cert', label: 'Certificate of Indigency', fee: 'TBD' },
];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <h1>Request a barangay document</h1>
      <p>Submit online, then claim your physical copy at the barangay hall — no waiting in line.</p>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {DOCUMENT_TYPES.map((doc) => (
          <li key={doc.type} style={{ marginBottom: '1rem', border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
            <strong>{doc.label}</strong> — {doc.fee}
            <div>
              <Link href={`/request/new?type=${doc.type}`}>Request this document →</Link>
            </div>
          </li>
        ))}
      </ul>

      <p>
        Already submitted a request? <Link href="/request/status">Check its status</Link>
      </p>
    </main>
  );
}
