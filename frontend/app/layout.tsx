import type { Metadata } from "next";
import { Geist, Geist_Mono, ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const zcoolKuaiLe = ZCOOL_KuaiLe({
  variable: "--font-zcool-kuaile",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MiaoMiaoVerse · 喵喵宇宙",
  description:
    "面向猫奴的 AI 全栈娱乐平台，集猫咪百科、AI 文案、表情包生成与疗愈问答于一体。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${zcoolKuaiLe.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
