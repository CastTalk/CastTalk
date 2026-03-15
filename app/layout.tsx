import { ReactNode } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CastTalk",
  description: "Video calling App",
  icons: {
    icon: "/icons/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <ClerkProvider
        appearance={{
          layout: {
            socialButtonsVariant: "iconButton",
            logoImageUrl: "/logo/logoMain.svg",
          },
          variables: {
            colorText: "#fff",
            colorPrimary: "#0E78F9",
            colorBackground: "#1C1F2E",
            colorInputBackground: "#252A41",
            colorInputText: "#fff",
          },
          elements: {
            socialButtonsIconButton: {
              border: "1px solid #565761",
            },
            socialButtonsProviderIcon: {
              filter: "brightness(0) invert(1)",
            },
            socialButtonsProviderIcon__google: {
              filter: "none",
            },
            formFieldInputShowPasswordButton: {
              color: "#9ca3af",
            },
            formFieldInputShowPasswordIcon: {
              color: "#9ca3af",
            },
            formFieldLabelRow__firstName: {
              display: "flex",
              justifyContent: "space-between",
            },
            formFieldLabelRow__lastName: {
              display: "flex",
              justifyContent: "space-between",
            },
            formFieldOptionalLabel: {
              display: "none",
            },
          },
        }}
      >
        <body className={`${inter.className}`}>
          <Toaster />
          {children}
        </body>
      </ClerkProvider>
    </html>
  );
}
