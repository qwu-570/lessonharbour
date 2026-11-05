import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LessonHarbour — Find your next tutor",
  description: "Find independent tutors and request online or in-person lessons.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
