import './globals.css';

export const metadata = {
  title: 'Health Tracker',
  description: 'AI-alapú Táplálkozási és Egészségügyi PWA',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
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
