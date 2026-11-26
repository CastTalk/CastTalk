import { ReactNode } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel';
import { Source_Serif_4 } from 'next/font/google';
import localFont from 'next/font/local';

// Ember redesign type system (same pairing as bryllim.com):
// Geist Pixel Square for display headers, Source Serif 4 for descriptions,
// Geist Sans for UI text, Geist Mono for small labels.
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});

import "./theme.css";

const roobert = localFont({
  src: [
    {
      path: '../public/fonts/roobert-regular-webfont.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/roobert-medium-webfont.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/roobert-semibold-webfont.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/roobert-bold-webfont.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/roobert-bold-webfont.woff2',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-roobert',
  display: 'swap',
});

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
    <html lang="en" className={`light ${roobert.variable} ${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} ${sourceSerif.variable}`}>
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
