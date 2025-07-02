import * as path from "path";
import * as fs from "fs/promises";
import ignore, { Ignore } from "ignore";
import { isBinaryFile } from "isbinaryfile";
import { Dirent } from "fs";

/**
 * このファイルは、フォルダー配下のファイル一覧を取得する機能を提供する。
 * 外部に公開するAPIはgetFiles()のみとし、その他の処理は内部関数として閉じ込める。
 * これにより、呼び出し元はシンプルなgetFiles()呼び出しでファイル一覧取得が可能となる。
 *
 * 本機能では、以下を考慮してファイル一覧をフィルタリングする。
 * - `.gitignore`で定義された無視ルールに該当するファイルを除外
 * - `.git`ディレクトリを除外
 * - バイナリファイルを除外（テキストファイルのみ列挙）
 *
 * 最終的に、条件を満たしたファイル一覧（テキストファイルのみ）が取得できる。
 */

/**
 * 公開API: getFiles()
 *
 * 指定されたディレクトリ配下を再帰的に探索し、テキストファイル一覧を取得する。
 * `.gitignore`による無視ルール、`.git`ディレクトリ除外、バイナリファイル除外を適用することで、
 * ソースコードやテキストファイルに特化した一覧取得が可能となる。
 *
 * @param dirPath 探索を開始するディレクトリの絶対パス
 * @param ignorePatterns 無視するファイルパターンの一覧
 * @returns テキストファイルのみを含むファイルパスの配列
 */
export async function getFiles(
    dirPath: string,
    ignorePatterns: string[]
): Promise<string[]> {
    // ユーザー指定の無視パターンをignoreインスタンスに適用
    // 下記では、ユーザーパターンを新たなIgnoreインスタンスとして生成し、
    // 他の.gitignore由来のルールと同様に取り扱う。
    const userIgnore = ignore();
    userIgnore.add(ignorePatterns);

    const files: string[] = [];
    await traverseDirectory(dirPath, files, dirPath, [], userIgnore);
    return files;
}

/**
 * 取得したファイル一覧の内容をdump.txtへ出力する。
 * 指定されたrootDir（ルートディレクトリ）からの相対パスdumpFileRelativeを用いて
 * dump.txtまでの絶対パスを求め、ファイルを初期化した後、すべてのテキストファイル内容を追記していく。
 * 各ファイル内容の前には区切り行を挿入する。
 *
 * 区切り行形式:
 * ########## {相対パス} ##########
 *
 * @param rootDir ルートディレクトリ（VS Codeが開いているフォルダーの絶対パス）
 * @param dumpFileRelative dump.txtへの相対パス（rootDirからの相対パス）
 * @param files ファイルパス配列（絶対パス）
 */
export async function dumpFilesContent(
    rootDir: string,
    dumpFileRelative: string,
    files: string[]
): Promise<void> {
    // dump.txtの絶対パスを生成
    const dumpPath = path.join(rootDir, dumpFileRelative);

    // dump.txtを初期化（中身を空にする）
    await fs.writeFile(dumpPath, "", "utf8");

    // 全ファイルについて処理
    for (const file of files) {
        // 区切り行に記載するための相対パスを求める
        const relative = path.relative(rootDir, file);
        const separator = `\n########## ${relative} ##########\n`;

        // 区切り行を書き込み
        await fs.appendFile(dumpPath, separator, "utf8");

        // ファイル内容を読み込み
        const content = await fs.readFile(file, "utf8");
        // ファイル内容を追記（最後に改行を入れることで整形）
        await fs.appendFile(dumpPath, content + "\n", "utf8");
    }

    // ここでの処理完了後、extension.ts側でユーザー通知を行うため、特に返り値やメッセージはなし
}

export async function readFilesContent(
    rootDir: string,
    dumpFileRelative: string,
    files: string[]
): Promise<string> {
    let contents: string = "";

    // 全ファイルについて処理
    for (const file of files) {
        // 区切り行に記載するための相対パスを求める
        const relative = path.relative(rootDir, file);
        const separator = `\n########## ${relative} ##########\n`;

        // 区切り行を書き込み
        contents += separator;

        // ファイル内容を読み込み
        const content = await fs.readFile(file, "utf8");
        // ファイル内容を追記（最後に改行を入れることで整形）
        contents += content + "\n";
    }

    return contents;
}

/**
 * traverseDirectory()
 *
 * 指定ディレクトリを再帰的に探索し、ファイル一覧を収集する内部関数。
 * 各ディレクトリで`.gitignore`ファイルを読込み、それらをスタック（ignoreStack）として積み重ねることで、
 * 階層的な無視ルールの適用を実現する。
 *
 * @param currentPath 現在探索中のディレクトリ（絶対パス）
 * @param files 結果格納用のファイルパス配列
 * @param rootDir 初期ルートディレクトリ（相対パス計算用）
 * @param ignoreStack 上位階層で読込んだIgnoreインスタンスのスタック
 * @param userIgnore .gitignore以外に無視するファイルパターンの一覧
 */
async function traverseDirectory(
    currentPath: string,
    files: string[],
    rootDir: string,
    ignoreStack: Ignore[],
    userIgnore: Ignore
) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    // 現在ディレクトリにある.gitignoreを読み込み、Ignoreインスタンスを作成
    const ig = await createIgnore(currentPath);

    // 上位階層のignoreStackをコピーし、現在階層用に拡張
    // こうすることで親階層には影響を与えずに階層別の無視ルールを適用できる
    const newIgnoreStack = ignoreStack.slice();
    if (ig) {
        newIgnoreStack.push(ig);
    }

    // ディレクトリ内のすべてのエントリを処理
    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path
            .relative(rootDir, fullPath)
            .replace(/\\/g, "/");

        // 無視対象かどうかを総合判定
        if (
            await shouldIgnore(
                fullPath,
                relativePath,
                entry,
                newIgnoreStack,
                userIgnore
            )
        ) {
            continue; // 無視対象ならスキップ
        }

        // 無視対象でなければ、さらに階層を下りるか、ファイル一覧に追加する
        if (entry.isDirectory()) {
            // ディレクトリなら再帰的に探索
            await traverseDirectory(
                fullPath,
                files,
                rootDir,
                newIgnoreStack,
                userIgnore
            );
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
}

/**
 * shouldIgnore()
 *
 * 指定されたエントリ（ファイルまたはディレクトリ）が無視対象かどうかを判定する内部関数。
 * 以下の条件をチェックする:
 * - `.git`ディレクトリは常に無視（Git管理用であり、ソース一覧として不要）
 * - ファイルがバイナリの場合は無視（テキストデータのみ対象）
 * - ignoreStackに基づく`.gitignore`ルールで無視されている場合も除外
 *
 * @param fullPath 対象エントリの絶対パス
 * @param relativePath ルートディレクトリからの相対パス
 * @param entry ディレクトリエントリ情報(Dirent)
 * @param ignoreStack 階層的に積み重ねられたIgnoreインスタンスのスタック
 * @param userIgnore .gitignore以外の無視するファイルパターン
 * @returns 無視すべきならtrue、そうでなければfalse
 */
async function shouldIgnore(
    fullPath: string,
    relativePath: string,
    entry: Dirent,
    ignoreStack: Ignore[],
    userIgnore: Ignore
): Promise<boolean> {
    // .gitディレクトリはソースコード一覧には不要なので無視
    if (entry.isDirectory() && entry.name === ".git") {
        return true;
    }

    // ファイルの場合はバイナリ判定を行い、バイナリなら無視
    if (entry.isFile()) {
        const binary = await isBinaryFile(fullPath);
        if (binary) {
            return true;
        }
    }

    // ユーザー指定の無視パターンチェック（共通ルール）
    if (userIgnore.ignores(relativePath)) {
        return true;
    }

    // .gitignoreルールで無視対象かをチェック
    for (const ig of ignoreStack) {
        if (ig.ignores(relativePath)) {
            return true;
        }
    }

    return false;
}

/**
 * createIgnore()
 *
 * `.gitignore`ファイルが存在する場合にその内容を読み込み、Ignoreインスタンスを生成する内部関数。
 * `.gitignore`に記された無視ルールをIgnoreインスタンスとして扱うことで、
 * 下位階層へ無視ルールを継承可能な仕組みを実現する。
 *
 * @param dirPath 対象ディレクトリパス
 * @returns Ignoreインスタンス、または.gitignoreがなければnull
 */
// async function createIgnore(dirPath: string): Promise<Ignore | null> {
//     const gitignorePath = path.join(dirPath, ".gitignore");
//     if (await exists(gitignorePath)) {
//         const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
//         const ig = ignore();
//         ig.add(gitignoreContent);
//         return ig;
//     }
//     return null;
// }
async function createIgnore(dirPath: string): Promise<Ignore> {
    let currentPath = dirPath;
    const ig = ignore();

    while (currentPath !== path.parse(currentPath).root) {
        const gitignorePath = path.join(currentPath, ".gitignore");

        if (await exists(gitignorePath)) {
            const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
            ig.add(gitignoreContent);
        }

        currentPath = path.dirname(currentPath); // 親ディレクトリへ移動
    }

    // 以下のコードは .vscodeignore ファイルを読み込むためのものだが、
    // 現在の要件では不要なためコメントアウトしている。

    // currentPath = dirPath;
    // while (currentPath !== path.parse(currentPath).root) {
    //     const gitignorePath = path.join(currentPath, ".vscodeignore");

    //     if (await exists(gitignorePath)) {
    //         const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
    //         ig.add(gitignoreContent);
    //     }

    //     currentPath = path.dirname(currentPath); // 親ディレクトリへ移動
    // }

    return ig;
}

/**
 * exists()
 *
 * 指定されたパスがファイルシステム上に存在するかを判定する内部関数。
 * 存在チェックを行うことで、`.gitignore`が存在しない場合でも安全に処理を進められる。
 *
 * @param filePath 存在確認するパス
 * @returns 存在すればtrue、なければfalse
 */
async function exists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}
