import "./globals.css";

export const metadata = {
  title: "A'rest Bukit Jalil — Stock",
  description: "Stock in / stock out tracker for A'rest Bukit Jalil Central Kitchen",
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
