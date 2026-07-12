import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetFlow — Enterprise Asset & Resource Management",
  description:
    "AssetFlow replaces spreadsheets and paper logs with one system of record for asset lifecycles, resource bookings, maintenance approvals, and audit cycles.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
