import './globals.css';

export const metadata = {
  title: 'Health Tracker',
  description: 'AI-alapú Táplálkozási és Egészségügyi PWA',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="hu">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <div className="main-content">
          {children}
        </div>
      </body>
    </html>
  );
}
