import Link from "next/link";

export default function NotFound() {
  return (
    <main className="notFound">
      <p className="eyebrow">404</p>
      <h1>単元が見つかりません</h1>
      <p>URLを確認するか、学習ツリーから単元を選び直してください。</p>
      <Link className="primaryLink" href="/">
        学習ツリーへ戻る
      </Link>
    </main>
  );
}

