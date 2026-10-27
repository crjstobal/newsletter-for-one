import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Serif_4 } from "next/font/google";
import { SiteFooter, SiteNav } from "./components/chrome";
import { ReadOnlyBanner } from "./components/ReadOnlyBanner";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Newsletter for One: the newsletter you wish existed",
  description:
    "Describe the newsletter you want. Newsletter for One researches the web every week, checks every date, and writes it for you with NVIDIA Nemotron on Nebius.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${sourceSerif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ReadOnlyBanner />
        <SiteNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
