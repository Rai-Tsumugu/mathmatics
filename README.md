# 大学数学 学習コンテンツ基盤

既存の `tree-map/math-treemap-full.html` を正本として、各単元を相互リンクした
Next.js（React）アプリです。共通ページ構成と単元別コンテンツを分離しているため、
教材を増やしてもデザインやナビゲーションを一括管理できます。

## 開発

```bash
npm install
npm run dev
```

`http://localhost:3000` を開いてください。`npm run dev` と `npm run build` の前に、
ツリーマップの単元・依存関係が自動同期されます。

## 主な構成

```text
tree-map/
  math-treemap-full.html          # ツリー構造の正本
scripts/
  sync-treemap.mjs               # 正本からデータと単元フォルダを生成
src/
  app/                            # 共通レイアウトとページルーティング
  components/                     # 共通UI
  content/
    admin-data.json               # 管理画面のローカル制作データ
    tree.generated.json           # 生成済みナビゲーションデータ
    units/
      <分野>/<単元ID>/
        metadata.json
        lecture/README.md
        interactive/README.md
        workbook/problems.md
        workbook/solutions.md
project-management/
  progress.md                     # ローカル工程管理
```

単元ページは `/learn/<単元ID>` です。前提単元と後続単元は
`tree.generated.json` の依存関係から自動で相互リンクされます。
ホーム画面はツリーフロー表示で、各単元カードから講義・インタラクティブ・
問題集・解答解説の進捗を更新できます。学習進捗はブラウザのローカルストレージへ
保存され、旧HTMLマップの完了状態も初回アクセス時に引き継がれます。

## 管理画面

`http://localhost:3000/admin` では、次の制作業務をまとめて管理できます。

- 57単元の講義・インタラクティブ・問題集・解答解説の工程
- 担当者、期限、公開状態、参考資料と制作メモ
- 問題文、解答、解説、推定・実測難易度、必要技能、誤答傾向
- 数学レビュー、UI確認、公開判定のレビューキュー

開発環境で「変更を保存」を押すと `src/content/admin-data.json` が更新されます。
Vercel上では読み取り専用です。複数管理者で本番運用する段階では、認証と共有
データベースを追加し、同じデータ型を保存層へ接続してください。

## コンテンツ追加の原則

- ページ外枠・ヘッダー・カード・相互リンクは `src/app` と `src/components` で共通化する。
- 講義、インタラクティブ教材、問題、解説は各単元フォルダで個別管理する。
- 新しい単元や依存関係は原則として元HTMLへ追加し、`npm run content:sync` を実行する。
- 自動生成済みの教材ファイルは上書きされないため、同期後も編集内容を保持する。

## Vercel

Next.jsとして自動検出されます。GitリポジトリをVercelへ接続し、ルートディレクトリを
このディレクトリに設定すれば、`npm run build` でデプロイできます。
データベースや環境変数は現段階では不要です。

## 進捗管理

`project-management/progress.md` で、全体工程と57単元それぞれの
講義・インタラクティブ・問題集・解答解説の進捗を管理します。
このファイルは初回生成後に自動上書きされないため、Gitで履歴を残しながら更新できます。
