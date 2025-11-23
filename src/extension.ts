import * as vscode from "vscode";
import { FileTreeProvider } from "./views/fileTree";
import initializeTreeAndCommands from "./controllers/extensionController";

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
        }
    );
    context.subscriptions.push(treeView);

    // Delegate reveal- and command-related behavior to the controller module
    initializeTreeAndCommands(workspaceRoot, treeProvider, treeView, context);

    // behavior and commands handled by initializeTreeAndCommands
}

/**
 * エクステンション無効化時に呼び出される関数
 * 必要があればここでリソース解放や後処理を記述可能
 */
export function deactivate() {
    // No operation
}
