import * as vscode from "vscode";
import { FileTreeProvider } from "./fileTree";
import { dumpFilesContent, getFiles, readFilesContent } from "./fileProcessor";
import { UserDefaults } from "./userDefaults";
import path from "path";

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
    // "Dump Sources" コマンド登録
    const dumpDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files",
        async (uri: vscode.Uri) => {
            const folderPath = uri.fsPath;
            const userDefaults = new UserDefaults();
            let files: string[] = [];

            // 1) ファイル一覧の取得
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Window,
                    title: `(1/2) Retrieving files in ${folderPath}...`,
                },
                async () => {
                    files = await getFiles(
                        folderPath,
                        userDefaults.ignorePatterns,
                    );
                },
            );

            // 2) ファイル内容ダンプおよび表示
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Window,
                    title:
                        `(2/2) Generating "${userDefaults.outputFileName}"...`,
                },
                async () => {
                    await dumpFilesContent(
                        folderPath,
                        userDefaults.outputFileName,
                        files,
                    );

                    // ダンプ結果をエディタで開く
                    const dumpPath = path.join(
                        folderPath,
                        userDefaults.outputFileName,
                    );
                    const doc = await vscode.workspace.openTextDocument(
                        dumpPath,
                    );
                    await vscode.window.showTextDocument(doc);

                    // 完了メッセージ
                    vscode.window.showInformationMessage(
                        `Output completed: ${userDefaults.outputFileName}`,
                    );
                },
            );
        },
    );
    context.subscriptions.push(dumpDisposable);

    // ワークスペースルートを取得（開いていない場合 undefined）
    /* ツリービュー生成 ------------- */
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  // ファイルツリー表示用プロバイダーを常に登録
    const treeProvider = new FileTreeProvider(workspaceRoot);

    const treeView = vscode.window.createTreeView("myFileExplorer", {
        treeDataProvider: treeProvider,
        canSelectMany: true,
    });
    context.subscriptions.push(treeView);

    /* チェック状態の変化を捕捉して Provider に反映 */
    treeView.onDidChangeCheckboxState((e) => {
        const changed = e.items.length
            ? e.items
            : treeView.visible
            ? e.items
            : [];
        for (const [node, checkboxState] of changed) {
            const checked =
                checkboxState === vscode.TreeItemCheckboxState.Checked;
            checked
                ? treeProvider.markChecked(node.uri.fsPath)
                : treeProvider.unmarkChecked(node.uri.fsPath);
        }
    });

    /* チェック済みアイテムをクリップボードへ ---------- */
    const copyDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.copySelected",
        async () => {
            const checked = await treeProvider.getCheckedNodes();
            if (checked.length === 0) {
                vscode.window.showInformationMessage(
                    "No files selected. Please check some files first.",
                );
                return;
            }

            let dumpText = "";
            for (const node of checked) {
                if (node.isDirectory) {
                    continue; // ディレクトリはスキップ
                }
                const bytes = await vscode.workspace.fs.readFile(node.uri);
                dumpText += `\n########## ${node.uri.fsPath} ##########\n`;
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
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "dump-sourcecode.refreshTree",
            () => treeProvider.refresh(),
        ),
    );
}

/**
 * エクステンション無効化時に呼び出される関数
 * 必要があればここでリソース解放や後処理を記述可能
 */
export function deactivate() {
    // No operation
}
