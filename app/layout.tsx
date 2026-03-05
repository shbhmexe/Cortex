import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import "./globals.css";
import { PreviewSidebar } from "@/components/preview-sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CortEx - Deep Research Agent",
  description: "AI-powered deep research assistant with multi-step analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "group glass-effect border border-border bg-background/60 backdrop-blur-2xl text-foreground shadow-2xl rounded-2xl p-4 flex gap-3",
                title: "text-foreground font-bold text-[14px]",
                description: "text-muted-foreground text-[12px]",
                actionButton: "bg-primary text-primary-foreground font-medium rounded-md px-3 py-1",
                cancelButton: "bg-foreground/10 text-foreground font-medium rounded-md px-3 py-1",
                icon: "text-primary w-5 h-5",
              },
            }}
          />
          <PreviewSidebar />
        </Providers>
      </body>
    </html>
  );
}
