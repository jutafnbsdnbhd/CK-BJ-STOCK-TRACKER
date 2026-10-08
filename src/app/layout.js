import "./globals.css";

export const metadata = {
  title: "CK Store — Bukit Jalil",
  description: "Stock in / stock out and orders for CK Store Bukit Jalil",
  applicationName: "CK Store",
  // iPhone: "Add to Home Screen" from Safari opens it as a full-screen app
  appleWebApp: {
    capable: true,
    title: "CK Store",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f5f1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
