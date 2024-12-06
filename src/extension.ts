import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { Dirent } from "fs";
import ignore, { Ignore } from "ignore";
import { isBinaryFile } from "isbinaryfile";

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files",
        async (uri: vscode.Uri) => {
            const folderPath = uri.fsPath;
            vscode.window.showInformationMessage(
                `選択されたフォルダー: ${folderPath}`
            );

            try {
                const files = await getFiles(folderPath);
                vscode.window.showInformationMessage(
                    `テキストファイル一覧:\n${files.join("\n")}`
                );
            } catch (error: any) {
                vscode.window.showErrorMessage(
                    `エラーが発生しました: ${error.message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}

async function getFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    await traverseDirectory(dirPath, files, dirPath, []);
    return files;
}

async function traverseDirectory(
    currentPath: string,
    files: string[],
    rootDir: string,
    ignoreStack: Ignore[]
) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const ig = await createIgnore(currentPath);
    const newIgnoreStack = ignoreStack.slice();
    if (ig) {
        newIgnoreStack.push(ig);
    }

    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path
            .relative(rootDir, fullPath)
            .replace(/\\/g, "/");

        // shouldIgnoreを先に呼び出して、ディレクトリ・バイナリ判定や.gitignore判定をまとめて行う
        if (await shouldIgnore(fullPath, relativePath, entry, newIgnoreStack)) {
            continue;
        }

        // 無視しない場合のみ、ディレクトリなら再帰的探索、ファイルならpush
        if (entry.isDirectory()) {
            await traverseDirectory(fullPath, files, rootDir, newIgnoreStack);
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
}

/**
 * この関数で以下を総合的に判定する:
 * - .gitフォルダなど特定ディレクトリの無条件無視
 * - バイナリファイルの無視
 * - .gitignoreルールに基づく無視
 */
async function shouldIgnore(
    fullPath: string,
    relativePath: string,
    entry: Dirent,
    ignoreStack: Ignore[]
): Promise<boolean> {
    // .gitディレクトリは無条件で無視
    if (entry.isDirectory() && entry.name === ".git") {
        return true;
    }

    // ファイルの場合はバイナリチェック
    if (entry.isFile()) {
        const binary = await isBinaryFile(fullPath);
        if (binary) {
            return true; // バイナリは無視
        }
    }

    // .gitignoreルールに従った無視判定
    for (const ig of ignoreStack) {
        if (ig.ignores(relativePath)) {
            return true;
        }
    }

    return false;
}

async function createIgnore(dirPath: string): Promise<Ignore | null> {
    const gitignorePath = path.join(dirPath, ".gitignore");
    if (await exists(gitignorePath)) {
        const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
        const ig = ignore();
        ig.add(gitignoreContent);
        return ig;
    }
    return null;
}

async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}
