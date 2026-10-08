// Makes the app installable: "Add to Home Screen" on iPhone (Safari) and
// "Install app" / "Add to Home screen" on Android (Chrome). Opens full
// screen, without the browser address bar.
export default function manifest() {
  return {
    name: "CK Store — Bukit Jalil",
    short_name: "CK Store",
    description: "Stock in / stock out and orders for CK Store Bukit Jalil",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f5f1",
    theme_color: "#f7f5f1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
