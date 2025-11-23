import * as vscode from "vscode";
import { dumpFilesContent, getFiles, readFilesContent } from "./fileProcessor";
import { UserDefaults } from "../config/userDefaults";
import path from "path";

/**
 * "dump-sourcecode.dump_files_to_file" コマンドの処理を切り出した関数
 */
export async function handleDumpFiles(uri: vscode.Uri, target: "file" | "clipboard"): Promise<void> {
    const folderPath = uri.fsPath;
    const userDefaults = new UserDefaults();
    
    // 1) ファイル一覧の取得
    let files: string[] = [];
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: `(1/2) Retrieving files in ${folderPath}...`,
        },
        async () => {
            files = await getFiles(folderPath, userDefaults.ignorePatterns);
        },
    );

    // 2) ファイル内容ダンプ or クリップボードコピー
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: target === "file"
                ? `(2/2) Generating "${userDefaults.outputFileName}"...`
                : "(2/2) Copying to clipboard...",
        },
        async () => {
            if (target === "file") {
                await dumpFilesContent(
                    folderPath,
                    userDefaults.outputFileName,
                    files,
                );
                const dumpPath = path.join(
                    folderPath,
                    userDefaults.outputFileName,
                );
                const doc = await vscode.workspace.openTextDocument(dumpPath);
                await vscode.window.showTextDocument(doc);
            } else {
                const contents = await readFilesContent(
                    folderPath,
                    userDefaults.outputFileName,
                    files,
                );
                await vscode.env.clipboard.writeText(contents);
            }

            vscode.window.showInformationMessage(
                target === "file"
                    ? `File output completed: ${userDefaults.outputFileName}`
                    : "Copy to clipboard completed.",
            );
        },
    );
}

/**
 * Copy specified absolute file paths to clipboard as a single concatenated
 * string (same format as dumpFilesContent/readFilesContent).
 *
 * This function is UI/service layer and intentionally accepts absolute
 * paths so callers (e.g. tree controller) can pass selected files directly
 * without reimplementing formatting.
 */
export async function copyFilesToClipboard(filePaths: string[], workspaceRoot?: string): Promise<void> {
    if (!filePaths || filePaths.length === 0) {
        // nothing to do
        return;
    }

    // Guess workspace root if not provided
    const root = workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

    // Build content using readFilesContent logic but operate using absolute paths
    let contents = "";
    for (const file of filePaths) {
        const relative = path.relative(root, file).replace(/\\/g, "/");
        const separator = `\n########## ${relative} ##########\n`;
        contents += separator;
        const content = await (async () => {
            try {
                const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
                return Buffer.from(bytes).toString("utf8");
            } catch {
                return "";
            }
        })();
        contents += content + "\n";
    }

    await vscode.env.clipboard.writeText(contents);
    // Best-effort user feedback
    try {
        vscode.window.showInformationMessage("Copy to clipboard completed.");
    } catch {
        // ignore in headless tests
    }
}
