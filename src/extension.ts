import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import ignore, { Ignore } from "ignore";

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files",
        async (uri: vscode.Uri) => {
            const folderPath = uri.fsPath;
            vscode.window.showInformationMessage(
                `選択されたフォルダー: ${folderPath}`
            );

            // ファイル一覧を取得
            try {
                const files = await getFiles(folderPath);
                vscode.window.showInformationMessage(
                    `ファイル一覧:\n${files.join("\n")}`
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

/**
 * 指定したディレクトリ内のファイルを列挙し、.gitignoreで無視されているファイルを除外する
 * @param dirPath 列挙するディレクトリのパス
 * @returns ファイルパスの配列
 */
async function getFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    await traverseDirectory(dirPath, files, dirPath, []);
    return files;
}

/**
 * ディレクトリを再帰的に探索し、ファイルを収集する
 * @param currentPath 現在のディレクトリパス
 * @param files ファイルパスを格納する配列
 * @param rootDir ルートディレクトリのパス
 * @param ignoreStack 無視パターンのスタック
 */
async function traverseDirectory(
    currentPath: string,
    files: string[],
    rootDir: string,
    ignoreStack: Ignore[]
) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    // 現在のディレクトリのIgnoreオブジェクトを作成
    const ig = await createIgnore(currentPath);

    // 新しいスタックを作成（親のパターンを含む）
    const newIgnoreStack = ignoreStack.slice();
    if (ig) {
        newIgnoreStack.push(ig);
    }

    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path
            .relative(rootDir, fullPath)
            .replace(/\\/g, "/"); // Windows対応

        // .gitignoreで無視されているかチェック
        if (shouldIgnore(relativePath, newIgnoreStack)) {
            continue;
        }

        if (entry.isDirectory()) {
            // .gitディレクトリ自体は無視
            if (entry.name === ".git") {
                continue;
            }
            await traverseDirectory(fullPath, files, rootDir, newIgnoreStack);
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
}

/**
 * 無視パターンを適用して、エントリを無視するかどうかを判定
 * @param relativePath ルートからの相対パス
 * @param ignoreStack 無視パターンのスタック
 * @returns 無視する場合はtrue、しない場合はfalse
 */
function shouldIgnore(relativePath: string, ignoreStack: Ignore[]): boolean {
    for (const ig of ignoreStack) {
        if (ig.ignores(relativePath)) {
            return true;
        }
    }
    return false;
}

/**
 * 指定したディレクトリのIgnoreオブジェクトを作成する
 * @param dirPath ディレクトリのパス
 * @returns Ignoreオブジェクトまたはnull
 */
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

/**
 * ファイルやディレクトリが存在するかチェックする
 * @param path チェックするパス
 * @returns 存在する場合はtrue、存在しない場合はfalse
 */
async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}
