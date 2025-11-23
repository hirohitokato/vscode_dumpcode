## クイックオリエンテーション — Dump Sources（VS Code 拡張）

このガイドは、AI コーディングエージェントがこのリポジトリで素早く生産的になるための最短メモです。
重要なファイル、実行手順、プロジェクト特有の設計決定と注意点だけに絞って記載しています。

### 全体像（短く）
小さな VS Code 拡張で、フォルダ内のテキストソースを収集してまとめるツールです。動作モードは2つ:
  - エクスプローラーのコンテキストメニュー: フォルダを右クリック → ファイルへ出力またはクリップボードへコピー。実装は `src/services/dumpChildren.ts` が担当します。
  - ツリービュー: `Dump Sourcecode` ビューで選択してクリップボードへコピー。ツリー UI は `src/fileTree.ts`、起動/コマンドの繋ぎは `src/extension.ts`。

- ### 主要ファイルと責務（すぐ参照すべき）
- `src/extension.ts` — 拡張機能の有効化、コマンド登録、ビューの接続を担当。
- `src/fileTree.ts` — ツリー UI プロバイダーと `FileNode` 実装。チェックされた項目の状態を `context.workspaceState`（キー: `checkedPaths:<workspace>`）に保存し、`.gitignore` とユーザー指定の除外パターンを読み込み、`isbinaryfile` を使ってバイナリ判定を行います。
- `src/fileProcessor.ts` — ファイル探索とフィルタリングのコアロジック。`getFiles()` はディレクトリを再帰的に走査し、ツリー上に集約された `.gitignore` ルールを守ります。追加の `dumpSource.userIgnorePatterns` もサポートし、バイナリファイルを除外します。サービスで使われるダンプ／読み取りヘルパーも含みます。
 - `src/services/dumpChildren.ts` — `getFiles()` と `dumpFilesContent()` / `readFilesContent()` を結びつける高レベルロジック（Progress UI と設定参照）。
 - `src/userDefaults.ts` — 設定（`dumpSource.*`）の読み出しラッパー（`outputFileName`, `userIgnorePatterns`, `defaultDumpTarget`, `revealFocus` など）。

- ### 重要なパターンと注意点（必読）
- この拡張は `activationEvents` に依存しません（`package.json` の `activationEvents` は空）。テストや開発は Extension Development Host（F5）で実行します。機能追加の際は起動戦略を確認してください—テスト/開発は手動起動を前提にしています。
 - 探索は `.gitignore` を上位から集約し、`dumpSource.userIgnorePatterns` も適用します。パスは posix 形式で比較します。
 - バイナリ判定は `isbinaryfile` を利用しています。ツリー (`src/fileTree.ts`) とプロセッサ (`src/fileProcessor.ts`) の両方を同時に更新する必要があります。
 - チェック状態は `context.workspaceState`（キー: `checkedPaths:<workspace>`）で永続化。`nodeCache` によるキャッシュと再帰的 mark/unmark がある点を把握してください。

### 開発ワークフロー / 便利コマンド（要確認）
- ローカルで拡張を実行（Extension Development Host）:
  - VS Code でプロジェクトを開き F5 を押します。
- ビルド / コンパイル（TypeScript → 配布物）:
  - `npm run compile`
  - 反復開発向け: `npm run watch`（`watch:esbuild` と `watch:tsc` を起動します）
- Lint: `npm run lint`（`src/` に ESLint を実行）
 - テスト:
   - `npm run compile-tests` → TypeScript テストを `out/` にビルド（テストを直接編集したら必ず実行）
   - `npm test`（`vscode-test`／Extension Test Host で実行）
   - Windows 用に `npm run test:win` があり、テスト実行時に TLS 設定を操作しています（CI ログを参照してください）。

### 変更を行うとき（短いチェックリスト）
1. まず `src/extension.ts`、`src/fileTree.ts`、`src/fileProcessor.ts` を読み、実装の全体像を把握してください。
2. 実装を更新する際は、フィルタやバイナリ判定に関する変更があればツリービュー (`fileTree.ts`) と `fileProcessor.ts` の両方で整合性を保ってください。
3. `npm run compile`（または `npm run watch`）でビルドし、`npm test` でテストを実行して確認します。
4. `dumpSource.*` 設定は `package.json` の contributes を参照。最近追加された `dumpSource.revealFocus`（true/false）で reveal の focus を切り替えられます。

### 具体例（すぐ見るべきパス）
- クリップボードへコピーするフロー: `src/extension.ts` → コマンド `dump-sourcecode.copySelected` → `getCheckedPaths()` → `workspace.fs.readFile(...)` → `vscode.env.clipboard.writeText`。
- ファイルへ出力するフロー: `src/extension.ts` → `dump-sourcecode.dump_files_to_file` → `src/services/dumpChildren.ts` → `src/fileProcessor.ts` の `dumpFilesContent()`。

追加テスト:
 - `src/test/extension.test.ts`, `src/test/dumpChildren.test.ts`（dumpChildren の file/clipboard の統合テスト）、および `fileProcessor` のユニットテストが `src/test` にあります。テストは Extension Test Host で動作します。

重要：`TreeView.reveal()` を正しく機能させるため `getParent()` が実装され、`getNodeForPath()` は reveal のためにノードを準備します。reveal の挙動:
 - Explorer を自動で開く
 - ノードが無ければ `treeProvider.refresh()` → 再試行（未キャッシュ対策）
 - `dumpSource.revealFocus` で focus を与えるか制御

### 注意／避けるべきこと
- 自動起動を前提にしないでください（`activationEvents` は空です）— テスト/開発は F5 や手動のコマンド登録で起動することに依存しています。
- 除外（ignore）ロジックを一箇所だけ変更しないでください — ツリービューと `fileProcessor` の両方で一貫性を保つ必要があります。

---
このファイルでカバーしきれない点や、テストの失敗原因（最近の test:win の失敗等）を深掘りする場合は、どの箇所を優先して調査したいか教えてください。

不明点や（テスト／デバッグの例などの）追加・簡素化の希望があれば、どのセクションを調整するか教えてください。

## 会話を行うときの注意点

日本語で会話をしてください。
