## クイックオリエンテーション — Dump Sources（VS Code 拡張機能）

このファイルは AI コーディングエージェントがリポジトリで素早く生産的になるためのガイドです。以下のファイルやワークフローに注目してください — 機能追加や修正を行う際に必要な動作、設定、ビルド / テスト手順が含まれています。

### 全体像
- このプロジェクトは、フォルダ内のテキストベースなソースファイルを収集して連結する、軽量な VS Code 拡張機能です。2つの操作モードがあります:
  - エクスプローラーのコンテキストメニュー: フォルダを右クリック → ファイルへ出力またはクリップボードへコピー。実装は `src/services/dumpChildren.ts` が担当します。
  - ツリービュー: エクスプローラー側にある `Dump Sourcecode` ビューで細かく選択 → クリップボードにコピー。ツリーの UI ロジックは `src/fileTree.ts` にあり、`src/extension.ts` で結び付けられています。

### 主要ファイルと責務
- `src/extension.ts` — 拡張機能の有効化、コマンド登録、ビューの接続を担当。
- `src/fileTree.ts` — ツリー UI プロバイダーと `FileNode` 実装。チェックされた項目の状態を `context.workspaceState`（キー: `checkedPaths:<workspace>`）に保存し、`.gitignore` とユーザー指定の除外パターンを読み込み、`isbinaryfile` を使ってバイナリ判定を行います。
- `src/fileProcessor.ts` — ファイル探索とフィルタリングのコアロジック。`getFiles()` はディレクトリを再帰的に走査し、ツリー上に集約された `.gitignore` ルールを守ります。追加の `dumpSource.userIgnorePatterns` もサポートし、バイナリファイルを除外します。サービスで使われるダンプ／読み取りヘルパーも含みます。
- `src/services/dumpChildren.ts` — `getFiles()` と `dumpFilesContent()` / `readFilesContent()` を結びつける高レベルロジック。VS Code の進行表示（Progress UI）を表示し、`UserDefaults` を参照します。
- `src/userDefaults.ts` — 設定値を取得するラッパー（デフォルト出力ファイル名、除外パターンなど）。

### 重要なパターンと注意点
- この拡張は `activationEvents` に依存しません（`package.json` の `activationEvents` は空）。テストや開発は Extension Development Host（F5）で実行します。機能追加の際は起動戦略を確認してください—テスト/開発は手動起動を前提にしています。
- ファイル探索では、ワークスペースツリーに沿って集約された `.gitignore` ルールと `dumpSource.userIgnorePatterns` の両方を利用します。スキャン時、ファイルパスは posix 形式に正規化してから無視ルールと照合します。
- バイナリファイルの除外は `isbinaryfile` を使って行われ、ツリービューと `fileProcessor` の両方で同じ方法が使われています。バイナリ処理に関する変更は両方を更新してください。
- ツリーのチェック状態の永続化: チェックされたファイルはワークスペースごとに `checkedPaths:<workspace.fsPath>` に保存されます。ツリープロバイダーは再帰的なマーク／アンマーク操作を実装しており、`nodeCache` を使うことで `FileNode` の再生成を避けています。

### 開発ワークフロー / 便利なコマンド
- ローカルで拡張を実行（Extension Development Host）:
  - VS Code でプロジェクトを開き F5 を押します。
- ビルド / コンパイル（TypeScript → 配布物）:
  - `npm run compile`
  - 反復開発向け: `npm run watch`（`watch:esbuild` と `watch:tsc` を起動します）
- Lint: `npm run lint`（`src/` に ESLint を実行）
- テスト:
  - `npm test`（`vscode-test` を使用）
  - `pretest` は `compile-tests` + `compile` + `lint` を実行します。テストを編集した場合、`npm run compile-tests` を先に実行する必要があることがあります。

### 変更を行うとき — 推奨手順
1. まず `src/extension.ts`、`src/fileTree.ts`、`src/fileProcessor.ts` を読み、実装の全体像を把握してください。
2. 実装を更新する際は、フィルタやバイナリ判定に関する変更があればツリービュー (`fileTree.ts`) と `fileProcessor.ts` の両方で整合性を保ってください。
3. `npm run compile`（または `npm run watch`）でビルドし、`npm test` でテストを実行して確認します。
4. `dumpSource.*` 設定（`package.json` の contributes.configuration）を尊重してください。例: `dumpSource.outputFileName`, `dumpSource.userIgnorePatterns`, `dumpSource.defaultDumpTarget`, `dumpSource.revealFocus`（ツリーにフォーカスを取るか否かの切替）。

### 具体例（参考コードの流れ）
- クリップボードへコピーするフロー: `src/extension.ts` → コマンド `dump-sourcecode.copySelected` → `getCheckedPaths()` → `workspace.fs.readFile(...)` → `vscode.env.clipboard.writeText`。
- ファイルへ出力するフロー: `src/extension.ts` → `dump-sourcecode.dump_files_to_file` → `src/services/dumpChildren.ts` → `src/fileProcessor.ts` の `dumpFilesContent()`。

### 避けるべきこと / 非明示的な前提
- 自動起動を前提にしないでください（`activationEvents` は空です）— テスト/開発は F5 や手動のコマンド登録で起動することに依存しています。
- 除外（ignore）ロジックを一箇所だけ変更しないでください — ツリービューと `fileProcessor` の両方で一貫性を保つ必要があります。

不明点や（テスト／デバッグの例などの）追加・簡素化の希望があれば、どのセクションを調整するか教えてください。
