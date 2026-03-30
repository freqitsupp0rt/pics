import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProviderWrapper from '@/components/AuthProviderWrapper';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "PICS-NMS",
  description: "PICS Network Monitoring System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" webcrx="" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
      </body>
    </html>
  );
}