import { Lora, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const lora = Lora({ subsets: ['latin'], variable: '--font-serif', weight: ['500', '600'] });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600'] });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['500'] });

export const metadata = {
  title: 'Barangay Talamban SK',
  description: 'News, document requests, sports courts, and hiking trail guides for Barangay Talamban SK.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${lora.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}