import * as vscode from "vscode";
import { FileTreeProvider } from "./fileTree";
import { dumpFilesContent, getFiles, readFilesContent } from "./fileProcessor";
import { UserDefaults } from "./userDefaults";
import path from "path";
import { handleDumpFiles } from "./services/dumpChildren";

/**
 * VS Code エクステンションのエントリーポイントモジュール。
 * - activate(): エクステンション有効化時に実行される初期化処理
 * - deactivate(): エクステンション無効化時に実行されるクリーンアップ処理
 */

/**
 * エクステンション起動時に呼び出される関数
 * 各種コマンドの登録とツリービューの初期化を行う
 *
 * @param context エクステンションの実行コンテキスト
 */
export function activate(context: vscode.ExtensionContext) {
    // ワークスペースルートを取得（開いていない場合 undefined）
    /* ツリービュー生成 */
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

    // ファイルツリー表示用プロバイダーを常に登録
    const treeProvider = new FileTreeProvider(workspaceRoot, context);

    // ツリービューの初期化
    const treeView = vscode.window.createTreeView(
        "dump-sourcecode.targetTreeView",
        {
            treeDataProvider: treeProvider,
            canSelectMany: true,
            manageCheckboxStateManually: true,
        },
    );
    context.subscriptions.push(treeView);

    // 最後にクリックした時間と URI を保持
    let _lastClickTime = 0;
    let _lastClickUri = "";

    // DUMP SOURCECODE ツリービューでダブルクリックした時にファイルを開く
    const openFileOnDoubleClick = vscode.commands.registerCommand(
        "dump-sourcecode.openFileOnDoubleClick",
        (node: FileNode) => {
            const now = Date.now();
            // 前回と同じファイルが 500ms 以内にクリックされたらダブルクリックとみなす
            if (
                _lastClickUri === node.uri.fsPath &&
                now - _lastClickTime < 500
            ) {
                vscode.window.showTextDocument(node.uri);
            }
            _lastClickTime = now;
            _lastClickUri = node.uri.fsPath;
        },
    );
    context.subscriptions.push(openFileOnDoubleClick);

    /* チェック状態の変化を捕捉して Provider に反映 */
    treeView.onDidChangeCheckboxState(async (e) => {
        for (const [node, state] of e.items) {
            const isChecked = state === vscode.TreeItemCheckboxState.Checked;
            if (isChecked) {
                node.isDirectory
                    ? await treeProvider.markRecursively(node.uri.fsPath) // ★追加
                    : treeProvider.markChecked(node.uri.fsPath);
            } else {
                node.isDirectory
                    ? treeProvider.unmarkRecursively(node.uri.fsPath) // 既存実装
                    : treeProvider.unmarkChecked(node.uri.fsPath);
            }
        }
    });

    /* チェック済みアイテムをクリップボードへ */
    const copyDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.copySelected",
        async () => {
            const checkedPaths = treeProvider.getCheckedPaths();
            const filePaths: string[] = [];
            for (const p of checkedPaths) {
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));

                // ディレクトリを除外（Directory フラグが立っていなければファイル）
                const isDirectory =
                    (stat.type & vscode.FileType.Directory) !== 0;
                if (!isDirectory) {
                    filePaths.push(p);
                }
            }

            if (filePaths.length === 0) {
                vscode.window.showInformationMessage(
                    "No files selected. Please check some files first.",
                );
                return;
            }

            let dumpText = "";
            for (const p of filePaths) {
                const bytes = await vscode.workspace.fs.readFile(
                    vscode.Uri.file(p),
                );
                // プロジェクトルート(workspaceRoot)からの相対パスを取得
                const workspaceRoot =
                    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
                const rel = path.relative(workspaceRoot, p).replace(/\\/g, "/");
                dumpText += `\n########## ${rel} ##########\n`;
                dumpText += new TextDecoder().decode(bytes) + "\n";
            }
            await vscode.env.clipboard.writeText(dumpText);
            vscode.window.showInformationMessage(
                "チェックしたファイルの内容をクリップボードにコピーしました。",
            );
        },
    );
    context.subscriptions.push(copyDisposable);

    /* ツリーをリフレッシュ */
    const refreshDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.refreshTree",
        () => treeProvider.refresh(),
    );
    context.subscriptions.push(refreshDisposable);

    /* すべてのチェックを解除 */
    const clearDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.clearSelection",
        () => treeProvider.clearAllChecked(),
    );
    context.subscriptions.push(clearDisposable);

    // "Dump Sources" コマンド登録（ファイルへの出力）
    const dumpToFileDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files_to_file",
        async (uri: vscode.Uri) => {
            handleDumpFiles(uri, "file");
        },
    );
    context.subscriptions.push(dumpToFileDisposable);
    // "Dump Sources" コマンド登録（クリップボードへのコピー）
    const dumpToClipboardDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files_to_clipboard",
        async (uri: vscode.Uri) => {
            handleDumpFiles(uri, "clipboard");
        },
    );
    context.subscriptions.push(dumpToClipboardDisposable);
}

/**
 * エクステンション無効化時に呼び出される関数
 * 必要があればここでリソース解放や後処理を記述可能
 */
export function deactivate() {
    // No operation
}
