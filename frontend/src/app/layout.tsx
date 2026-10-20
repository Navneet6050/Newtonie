import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { LoginDialog } from "@/components/auth/login-dialog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Newtonite | Operations Command Center",
  description: "Internal operations and work-management platform for engineering teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased font-sans`}
    >
      <body className={`${geistSans.className} min-h-full flex flex-col bg-background text-foreground font-sans antialiased selection:bg-indigo-500/25 selection:text-indigo-200`}>
        <MotionProvider>
          <TooltipProvider delayDuration={200}>
            <AuthProvider>
              {children}
              <LoginDialog />
            </AuthProvider>
          </TooltipProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
