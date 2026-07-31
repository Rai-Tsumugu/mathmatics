import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollToTop } from "@/components/ScrollToTop";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "大学数学 学習マップ",
    template: "%s | 大学数学 学習マップ",
  },
  description:
    "大学数学の単元を前提関係で結び、講義・演習・インタラクティブ教材を横断して学ぶための基盤。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1020",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>
        <ScrollToTop />
        <header className="siteHeader">
          <Link className="brand" href="/">
            <span className="brandMark">Σ</span>
            <span>
              <strong>大学数学 学習マップ</strong>
              <small>前提から、次の一歩へ。</small>
            </span>
          </Link>
          <nav aria-label="メインナビゲーション">
            <Link href="/">学習ツリー</Link>
            <Link href="/admin">管理画面</Link>
            <a href="/reference/math-treemap-full.html">原案マップ</a>
          </nav>
        </header>
        {children}
        <footer className="siteFooter">
          ツリー構造・教材・UIを分離した、拡張可能な学習コンテンツ基盤
        </footer>
      </body>
    </html>
  );
}
