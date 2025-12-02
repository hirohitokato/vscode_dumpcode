# AI Agent Guide: Dump Codes Extension

このガイドは、AI コーディングエージェントが Dump Codes Extension プロジェクトで効率的に作業するための包括的なリファレンスです。

---

## 🎯 プロジェクト概要

### 目的

VS Code 拡張機能として、複数のソースファイルを収集し、単一ファイルまたはクリップボードへエクスポートする機能を提供します。LLM との対話やコードレビューに適したフォーマットで出力します。

### 主要機能

1. **エクスプローラーコンテキストメニュー**: フォルダ右クリックで即座にダンプ
2. **ツリービュー**: チェックボックスによる細かいファイル選択と管理
3. **開いているエディタの選択**: 現在作業中のファイルを素早くツリーで選択
4. **.gitignore 統合**: 自動的にバージョン管理外のファイルを除外
5. **バイナリファイル検出**: バイナリファイルを自動除外
6. **永続的なチェック状態**: ワークスペースごとに選択状態を保存

---

## 📁 アーキテクチャ概要

### レイヤー構造

```
┌─────────────────────────────────────────┐
│  UI Layer (Views/Commands)              │
│  - extension.ts (エントリーポイント)     │
│  - extensionController.ts (コマンド管理) │
│  - fileTree.ts / FileNode.ts (ツリーUI) │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Service Layer                          │
│  - dumpChildren.ts (ダンプ処理の統合)   │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Domain Layer                           │
│  - fileProcessor.ts (ファイル処理)      │
│  - userDefaults.ts (設定管理)           │
│  - fsHelper.ts (ファイルシステム抽象化) │
└─────────────────────────────────────────┘
```

### 設計原則

- **関心の分離**: UI、サービス、ドメインロジックの明確な境界
- **依存性注入**: テスト容易性のための柔軟な依存関係管理（`FileProcessor`）
- **単一責任原則**: 各モジュールが単一の明確な責任を持つ
- **オープン・クローズド原則**: `ignoreFactory` などの拡張ポイントを提供

---

## 🗂️ ファイル構造と責務

### コアファイル

#### `src/extension.ts`

- **役割**: 拡張機能のエントリーポイント
- **責務**:
  - `activate()`: ツリービュー初期化、コントローラー起動
  - `deactivate()`: クリーンアップ（現在は空）
- **依存**: `FileTreeProvider`, `initializeTreeAndCommands`
- **重要**: `activationEvents` は空 - 手動/F5 起動を前提

#### `src/controllers/extensionController.ts`

- **役割**: コマンド登録とツリービューの振る舞いを統合
- **責務**:
  - アクティブエディタのツリー内での reveal
  - チェックボックス状態変更の処理
  - コマンドハンドラー登録（copy, refresh, clear, dump, selectOpenEditors）
- **設計ポイント**: UI ロジックを `extension.ts` から分離し、テスト容易性を向上
- **重要な関数**:
  - `revealActiveEditorInTree()`: エディタとツリーの同期
  - `selectOpenEditors()`: 開いているタブをツリーで選択

#### `src/views/fileTree.ts`

- **役割**: ツリービューのデータプロバイダー
- **責務**:
  - ファイルツリーの構築と表示
  - `.gitignore` と `userIgnorePatterns` の統合
  - チェック状態の永続化（`context.workspaceState`）
  - ノードキャッシュ管理（`nodeCache`）
- **キーメソッド**:
  - `getChildren()`: ツリー階層の構築
  - `getNodeForPath()`: reveal のためのノード取得/生成
  - `getParent()`: reveal 機能に必須
  - `markRecursively()` / `unmarkRecursively()`: ディレクトリ単位の選択
- **ignore ロジック**: `ignore` ライブラリで posix パス形式を使用
- **重要**: バイナリ判定は `isbinaryfile` を使用、`fileProcessor.ts` と一貫性を保つこと

#### `src/views/FileNode.ts`

- **役割**: ツリーアイテムのドメインモデル
- **責務**:
  - `TreeItem` の生成とチェックボックス状態の同期
  - ファイル/ディレクトリの識別
  - コンテキストメニューの設定
- **設計**: UI ロジックとドメインモデルの分離

#### `src/services/dumpChildren.ts`

- **役割**: ダンプ処理の高レベル統合
- **責務**:
  - Explorer コンテキストメニューからの呼び出し処理
  - Progress UI の表示
  - 設定読み込みと `FileProcessor` への委譲
- **関数**:
  - `handleDumpFiles()`: file/clipboard 出力の分岐
  - `copyFilesToClipboard()`: クリップボードへの書き込み

#### `src/services/fileProcessor.ts`

- **役割**: ファイル探索とダンプのコアロジック
- **責務**:
  - ディレクトリの再帰的走査
  - `.gitignore` ルールの階層的な適用
  - バイナリファイルの除外
  - ファイル内容の読み取りとフォーマット
- **設計ハイライト**:
  - `FileProcessor` クラス: 依存性注入対応（`FileOps`, `isBinary`, `ignoreFactory`）
  - デフォルトインスタンス提供で既存 API との互換性維持
- **重要メソッド**:
  - `getFiles()`: 収集対象ファイルのリスト取得
  - `dumpFilesContent()`: ファイルへの書き込み
  - `readFilesContent()`: クリップボード用の文字列生成

#### `src/config/userDefaults.ts`

- **役割**: 設定値の読み取りラッパー
- **設定項目**:
  - `outputFileName`: 出力ファイル名
  - `userIgnorePatterns`: ユーザー定義の除外パターン
  - `defaultDumpTarget`: デフォルト出力先（file/clipboard）
  - `revealFocus`: reveal 時にツリーにフォーカスするか
  - `maxSelectOpenEditors`: 選択可能な最大タブ数

#### `src/utils/fsHelper.ts`

- **役割**: ファイルシステム操作の抽象化
- **目的**: テスト容易性と VS Code API の統一的な利用

---

## 🧪 テスト戦略

### テストファイル

- `src/test/extension.test.ts`: 基本的な拡張機能の起動テスト
- `src/test/dumpChildren.test.ts`: ダンプ処理の統合テスト
- `src/test/selectOpenEditors.test.ts`: 開いているエディタ選択機能のテスト
- `src/test/fileNode.test.ts`: FileNode のユニットテスト（存在予定）

### テスト実行環境

- **Extension Test Host**: VS Code の実環境で実行
- **ビルド**: `npm run compile-tests` で `out/` にビルド
- **実行**: `npm test` または `npm run test:win`（Windows の TLS 設定対応版）

### テストのベストプラクティス

1. **統合テスト**: `vscode.workspace.fs` など実 API を使用
2. **ユニットテスト**: `FileProcessor` のようにモック可能な設計を活用
3. **Extension Development Host (F5)**: 手動での動作確認に活用

---

## 🔧 開発ワークフロー

### セットアップ

```powershell
# 依存関係インストール
npm install

# TypeScript コンパイル
npm run compile

# Watch モード（開発時推奨）
npm run watch
```

### ビルドとテスト

```powershell
# 型チェック
npm run check-types

# リント
npm run lint

# テスト実行前のビルド
npm run compile-tests

# テスト実行
npm test            # Linux/Mac
npm run test:win   # Windows（TLS 設定対応）
```

### デバッグ

1. VS Code でプロジェクトを開く
2. `F5` を押して Extension Development Host を起動
3. 新しいウィンドウで拡張機能をテスト
4. `watch` タスクを実行中なら変更が自動反映

### パッケージング

```powershell
npm run package
```

---

## 🎨 コーディング規約

### TypeScript スタイル

- **厳格な型付け**: `tsconfig.json` の `strict: true`
- **明示的な型注釈**: 公開 API には必須
- **async/await**: Promise チェーンよりも優先
- **エラーハンドリング**: try-catch で適切に処理、ユーザーへの通知は控えめに

### 命名規則

- **ファイル**: camelCase (`fileTree.ts`, `dumpChildren.ts`)
- **クラス**: PascalCase (`FileTreeProvider`, `FileNode`)
- **インターフェース**: PascalCase (`FileOps`)
- **関数/メソッド**: camelCase (`getFiles`, `markRecursively`)
- **定数**: UPPER_SNAKE_CASE（設定キーなど）

### コメント

- **日本語 OK**: コードコメントは日本語で記述可能
- **JSDoc**: 公開 API には型と説明を記載
- **インラインコメント**: 複雑なロジックには必ず説明を追加

---

## ⚠️ 重要な注意点と制約

### activationEvents が空

- **理由**: 現在のテスト/開発は手動起動（F5）を前提
- **影響**: 自動起動を期待する機能追加時は要検討
- **対応**: 必要に応じて `package.json` の `activationEvents` を設定

### ignore ロジックの一貫性

- **ツリービュー** (`fileTree.ts`) と **ファイルプロセッサー** (`fileProcessor.ts`) で同じ除外ルールを適用
- **変更時**: 両方のファイルを同時に更新すること
- **パス形式**: posix 形式 (`/` 区切り) で統一

### バイナリファイル判定

- **ライブラリ**: `isbinaryfile` を使用
- **適用場所**: ツリービューとファイルプロセッサーの両方
- **エラーハンドリング**: ファイルアクセスエラーは無視（best-effort）

### チェック状態の永続化

- **ストレージ**: `context.workspaceState`
- **キー**: `checkedPaths:<workspace>`
- **タイミング**: チェック状態変更時に即座に保存
- **注意**: ワークスペースごとに独立

### reveal 機能の実装要件

- `getParent()` 実装が必須
- `getNodeForPath()` でノードを準備
- `dumpSource.revealFocus` 設定でフォーカス制御
- 再試行ロジック: ノードが未キャッシュの場合 refresh → 再試行

---

## 🚀 機能追加ガイドライン

### 新しいコマンドの追加

1. `package.json` の `contributes.commands` に登録
2. `extensionController.ts` でハンドラーを実装
3. 必要に応じて `contributes.menus` でメニュー配置
4. `context.subscriptions.push()` で Disposable を登録

### 新しい設定の追加

1. `package.json` の `contributes.configuration.properties` に定義
2. `userDefaults.ts` に getter を追加
3. 使用箇所で `new UserDefaults()` を通じてアクセス

### ファイル処理ロジックの変更

1. `FileProcessor` クラスを優先的に使用
2. テスト容易性のため依存性注入を活用
3. `fileTree.ts` の ignore ロジックとの一貫性を確認

### UI の変更

1. `FileNode` クラスで表示ロジックを変更
2. `FileTreeProvider` でツリー構造を調整
3. `extensionController.ts` でイベントハンドリングを追加

---

## 🐛 トラブルシューティング

### よくある問題

#### ツリーに表示されないファイルがある

- **原因**: `.gitignore` または `userIgnorePatterns` で除外されている
- **確認**: `fileTree.ts` の `loadIgnorePatterns()` と `getChildren()` のフィルタロジック
- **デバッグ**: `ig.ignores(relPath)` の結果をログ出力

#### チェック状態が保存されない

- **原因**: `persist()` が呼ばれていない、または `workspaceState` のキーが不正
- **確認**: `markChecked()` / `unmarkChecked()` で `persist()` 呼び出しを確認
- **デバッグ**: `context.workspaceState.get(this.stateKey)` の値を確認

#### reveal が動作しない

- **原因**: `getParent()` 未実装、またはノードがキャッシュされていない
- **確認**: `getNodeForPath()` がノードを返すか確認
- **デバッグ**: `nodeCache` の内容を確認、refresh 後の再試行を実装

#### テストが失敗する

- **Windows の場合**: `npm run test:win` を使用（TLS 設定）
- **ビルド忘れ**: `npm run compile-tests` を実行
- **Extension Host**: テストは実 VS Code 環境で実行されることを認識

---

## 📚 参考リソース

### VS Code API

- [TreeView API](https://code.visualstudio.com/api/references/vscode-api#TreeView)
- [TreeDataProvider](https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider)
- [Workspace State](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.workspaceState)
- [Commands](https://code.visualstudio.com/api/references/vscode-api#commands)

### 使用ライブラリ

- [ignore](https://www.npmjs.com/package/ignore): .gitignore パターンマッチング
- [isbinaryfile](https://www.npmjs.com/package/isbinaryfile): バイナリファイル検出

### プロジェクトドキュメント

- `README.md`: ユーザー向け機能説明
- `CHANGELOG.md`: バージョン履歴
- `.github/copilot-instructions.md`: AI 向けクイックリファレンス

---

## 🎯 品質目標

### コード品質

- **型安全性**: TypeScript の厳格モードで型エラーゼロ
- **リント**: ESLint ルール違反ゼロ
- **テストカバレッジ**: 主要ロジック（`fileProcessor.ts`）は 80% 以上

### パフォーマンス

- **大規模プロジェクト**: 10,000 ファイル以上でもスムーズな動作
- **UI 応答性**: ツリー展開・チェック操作は 100ms 以内
- **メモリ効率**: ノードキャッシュの適切な管理

### ユーザビリティ

- **直感的な UI**: エクスプローラーと同じソート順、アイコン使用
- **適切なフィードバック**: Progress UI、情報メッセージの適切な使用
- **エラーハンドリング**: ユーザーに分かりやすいエラーメッセージ

---

## 🔄 変更を行う際のチェックリスト

1. **コンテキスト把握**
   - [ ] 変更対象のファイルとその責務を理解
   - [ ] 関連する他のモジュールへの影響を確認
   - [ ] 既存のテストを確認

2. **実装**
   - [ ] 型安全なコードを記述
   - [ ] エラーハンドリングを適切に実装
   - [ ] 必要に応じてコメントを追加

3. **一貫性の確認**
   - [ ] ignore ロジック: `fileTree.ts` と `fileProcessor.ts` の両方
   - [ ] バイナリ判定: 同じライブラリ・ロジックを使用
   - [ ] 設定: `package.json` と `userDefaults.ts` が同期

4. **ビルドとテスト**
   - [ ] `npm run compile` でエラーなし
   - [ ] `npm run lint` で警告なし
   - [ ] `npm test` でテスト通過
   - [ ] F5 で Extension Development Host で手動テスト

5. **ドキュメント**
   - [ ] 必要に応じて `README.md` を更新
   - [ ] 重要な変更は `CHANGELOG.md` に記載
   - [ ] 新しい設定は `package.json` で適切に説明

---

## 💡 設計パターンと原則

### 採用している設計パターン

1. **Provider パターン**: `FileTreeProvider` で VS Code API とのインターフェース
2. **Strategy パターン**: `ignoreFactory` で ignore 生成ロジックの差し替え可能
3. **Repository パターン**: `fsHelper.ts` でファイルシステム操作の抽象化
4. **Facade パターン**: `dumpChildren.ts` で複雑な処理フローを簡素化

### SOLID 原則の適用

- **S (Single Responsibility)**: 各クラス・モジュールが単一の責任
- **O (Open/Closed)**: `FileProcessor` は拡張に開き、修正に閉じている
- **L (Liskov Substitution)**: インターフェース（`FileOps`）を通じた置換可能性
- **I (Interface Segregation)**: 必要最小限のインターフェース定義
- **D (Dependency Inversion)**: 高レベルモジュールが低レベルモジュールに依存しない

---

## 📝 最後に

このプロジェクトは、**シンプルさと拡張性のバランス**を重視しています。新機能追加時は：

1. **既存の設計パターンに従う**
2. **テスト容易性を維持する**
3. **ユーザー体験を最優先する**
4. **パフォーマンスに配慮する**

不明点があれば、既存のコードパターンを参照し、一貫性のある実装を心がけてください。

---

**Happy Coding! 🚀**
