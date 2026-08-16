# office-lifechange.com — Life行政書士事務所 公式サイト

Astro（静的サイト）＋ Cloudflare Pages。WordPress からの作り直し版（2026-08）。
プロジェクトの経緯・決定事項は Vault の `01_プロジェクト/AI関係/HP移行プロジェクト/プロジェクトメモ.md`。

## 構成

```
src/
  data/site.ts            事務所情報・ナビ・対応エリア（ここを直せば全ページに反映）
  layouts/Base.astro      共通レイアウト（ヘッダー・フッター・meta・構造化データ）
  styles/global.css       デザイントークンと共通スタイル
  content/services/*.md   業務別ページ（7本）。frontmatter で期間・料金の目安
  content/news/*.md       お知らせ
  pages/                  トップ／業務一覧／対応エリア／士業・事業者の方へ／事務所について／お問い合わせ／プライバシー
functions/api/contact.ts  お問い合わせフォームの受け口（Pages Functions）
public/                   favicon・robots.txt
```

## ローカルで見る

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # dist/ に生成
```

## 公開の流れ（承認ゲート）

1. AI が `preview` ブランチに変更を push → Cloudflare がプレビューURLを発行
2. 本人がプレビューURLで検収
3. 本人が `main` にマージ → 本番（office-lifechange.com）へ自動デプロイ

**`main` への直接 push はしない。** マージが「公開の承認」に当たる。

## Cloudflare Pages の設定（初回のみ・本人がダッシュボードで）

- Workers & Pages → Create → Pages → **Connect to Git** → GitHub の `office-lifechange` リポジトリを選択
- Framework preset: **Astro** ／ Build command: `npm run build` ／ Build output: `dist`
- Production branch: `main`（`preview` ブランチは自動でプレビュー環境になる）
- Custom domains: `office-lifechange.com` と `www.office-lifechange.com` を追加（DNSはCloudflare管理下なので自動）

### 環境変数（Settings → Variables and Secrets）

| 名前 | 用途 | 種別 |
|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | フォームの Turnstile ウィジェット（ビルド時に埋め込み） | Variable |
| `TURNSTILE_SECRET_KEY` | Turnstile の検証（未設定なら検証スキップ） | Secret |
| `RESEND_API_KEY` | フォームのメール送信（Resend） | Secret |
| `MAIL_TO` | 受信先アドレス | Variable |
| `MAIL_FROM` | 送信元（Resend でドメイン認証済みのアドレス。例 `form@office-lifechange.com`） | Variable |

- Turnstile: Cloudflare ダッシュボード → Turnstile → サイト追加（ドメイン `office-lifechange.com`）でキーを取得
- Resend: https://resend.com で無料アカウント → Domains に `office-lifechange.com` を追加（表示されるDNSレコードをCloudflare DNSに登録）→ API Key 発行
- 未設定の間、フォームは「送信完了」画面まで進むがメールは飛ばず、Functions のログに内容が出るだけ

## 旧サイトからの切替時にやること

- [ ] 上記の環境変数を設定し、フォームのテスト送信
- [ ] `public/_redirects` に旧WordPressのURL → 新URLの301を書く（旧サイトのURL一覧を確認してから）
- [ ] Custom domain を有効化（DNSの向き先が Xserver → Pages に切り替わる）
- [ ] 数週間の様子見後、Xserver の WordPress・契約を整理

## 【要確認】公開前に本人が埋める箇所

- `src/data/site.ts` の `registrationNo`（行政書士登録番号）
- 各業務ページの料金の目安・所要期間の表現（士業広告規制の安全側ルールに沿っているか）
