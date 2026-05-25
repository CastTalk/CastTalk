import { ReactNode } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

import "./theme.css";

export const metadata: Metadata = {
  title: "CastTalk | Premium Video Communications",
  description: "Next-generation video collaboration platform for modern teams.",
  icons: {
    icon: "/icons/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="light">
      <ClerkProvider
        appearance={{
          layout: {
            socialButtonsVariant: "iconButton",
          },
          variables: {
            colorText: "#110b21",
            colorPrimary: "#004bff",
            colorBackground: "#ffffff",
            colorInputBackground: "#f8f9fa",
            colorInputText: "#110b21",
          },
        }}
      >
        <body className="font-sans bg-background">
          <Toaster />
          {children}
        </body>
      </ClerkProvider>
    </html>
  );
}
