import * as vscode from "vscode";
import { dumpFilesContent, getFiles } from "./fileProcessor";
import { UserDefaults } from "./userDefaults";
import path from "path";

/**
 * このファイルは、Visual Studio Codeのエクステンションエントリーポイントとして機能する。
 * - activate(): エクステンションが有効化された際に呼び出される初期化処理を行う。
 * - deactivate(): エクステンションが無効化された際の後処理を行う（今回は特に処理なし）。
 *
 * 本エクステンションでは、エクスプローラー上でフォルダーを右クリックしたときに「Dump Sources」という
 * コンテキストメニューを追加する。選択されたフォルダー以下のファイル一覧（テキストファイルのみ）を取得し、
 * 一覧としてユーザーに表示する。`.gitignore`で無視されるファイルや、`.git`ディレクトリ、バイナリファイルなどは除外する。
 */

/**
 * エクステンションが有効化された際に呼び出される関数。
 * コマンド"dump-sourcecode.dump_files"を登録し、フォルダー右クリック時のコンテキストメニューから
 * ファイル一覧取得処理を実行できるようにする。
 */
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files",
        async (uri: vscode.Uri) => {
            // VS Codeが開いているフォルダー内で選択されたフォルダーの絶対パス
            const folderPath = uri.fsPath;
            // コマンド実行時の処理部分
            const userDefaults = new UserDefaults();
            vscode.window.showInformationMessage(
                `Selected folder: ${folderPath}`
            );
            let files: string[] = [];

            // 処理全体を２つのプログレスインジケーター内で実行
            // 1.ファイル収集
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Window,
                    title: "(1/2) Retrieving files...",
                },
                async () => {
                    // ファイル一覧取得
                    files = await getFiles(
                        folderPath,
                        userDefaults.ignorePatterns
                    );
                }
            );
            // 2.ダンプ処理
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Window,
                    title: `(2/2) Generating "${userDefaults.outputFileName}"...`,
                },
                async () => {
                    // ファイル内容ダンプ
                    await dumpFilesContent(
                        folderPath,
                        userDefaults.outputFileName,
                        files
                    );

                    // ダンプ結果ファイルをエディタで開く
                    const dumpPath = path.join(
                        folderPath,
                        userDefaults.outputFileName
                    );
                    const doc = await vscode.workspace.openTextDocument(
                        dumpPath
                    );
                    await vscode.window.showTextDocument(doc);

                    // 完了メッセージ表示（設定で指定されたファイル名を反映）
                    vscode.window.showInformationMessage(
                        `Output completed: ${userDefaults.outputFileName}`
                    );
                }
            );
        }
    );

    context.subscriptions.push(disposable);
}

/**
 * エクステンションが無効化された際に呼び出される関数。
 * 今回は特に後処理は必要ないため、空実装としている。
 */
export function deactivate() {
    // No operation
}
