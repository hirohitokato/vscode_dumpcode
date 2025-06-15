import * as vscode from "vscode";
import { FileTreeProvider } from "./fileTree";
import { dumpFilesContent, getFiles } from "./fileProcessor";
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
          files = await getFiles(folderPath, userDefaults.ignorePatterns);
        }
      );

      // 2) ファイル内容ダンプおよび表示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: `(2/2) Generating "${userDefaults.outputFileName}"...`,
        },
        async () => {
          await dumpFilesContent(
            folderPath,
            userDefaults.outputFileName,
            files
          );

          // ダンプ結果をエディタで開く
          const dumpPath = path.join(folderPath, userDefaults.outputFileName);
          const doc = await vscode.workspace.openTextDocument(dumpPath);
          await vscode.window.showTextDocument(doc);

          // 完了メッセージ
          vscode.window.showInformationMessage(
            `Output completed: ${userDefaults.outputFileName}`
          );
        }
      );
    }
  );
  context.subscriptions.push(dumpDisposable);

  // ワークスペースルートを取得（開いていない場合 undefined）
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  // ファイルツリー表示用プロバイダーを常に登録
  const treeProvider = new FileTreeProvider(workspaceRoot);
  const treeView = vscode.window.createTreeView("myFileExplorer", {
    treeDataProvider: treeProvider,
    canSelectMany: true,
  });
  context.subscriptions.push(treeView);

  // 選択アイテムをクリップボードにコピーするコマンド
  const copyDisposable = vscode.commands.registerCommand(
    "dump-sourcecode.copySelected",
    async () => {
      const selection = treeView.selection;
      if (selection.length === 0) {
        vscode.window.showInformationMessage("何も選択されていません。");
        return;
      }

      let dumpText = "";
      for (const node of selection) {
        if (node.isDirectory) {
          dumpText += `--- ${node.uri.fsPath} (folder) ---\n\n`;
        } else {
          const bytes = await vscode.workspace.fs.readFile(node.uri);
          dumpText += `--- ${node.uri.fsPath} ---\n`;
          dumpText += new TextDecoder().decode(bytes) + "\n\n";
        }
      }
      await vscode.env.clipboard.writeText(dumpText);
      vscode.window.showInformationMessage(
        "選択したファイルの内容をクリップボードにコピーしました。"
      );
    }
  );
  context.subscriptions.push(copyDisposable);

  // ツリーをリフレッシュするコマンド
  const refreshDisposable = vscode.commands.registerCommand(
    "dump-sourcecode.refreshTree",
    () => treeProvider.refresh()
  );
  context.subscriptions.push(refreshDisposable);
}

/**
 * エクステンション無効化時に呼び出される関数
 * 必要があればここでリソース解放や後処理を記述可能
 */
export function deactivate() {
  // No operation
}
