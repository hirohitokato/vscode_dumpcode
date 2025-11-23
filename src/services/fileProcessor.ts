import * as path from "path";
import * as fs from "fs/promises";
import ignore, { Ignore } from "ignore";
import { isBinaryFile as defaultIsBinaryFile } from "isbinaryfile";
import { Dirent } from "fs";

// --- SOLID-friendly FileProcessor ---

export type FileOps = typeof fs;

export interface FileProcessorOptions {
    fs?: FileOps;
    isBinary?: (p: string) => Promise<boolean>;
    // allow overriding ignore factory for tests or alternate behaviour
    ignoreFactory?: (dirPath: string, fsOps: FileOps) => Promise<Ignore>;
}

export class FileProcessor {
    private readonly fs: FileOps;
    private readonly isBinary: (p: string) => Promise<boolean>;
    private readonly ignoreFactory: (dirPath: string, fsOps: FileOps) => Promise<Ignore>;

    constructor(opts?: FileProcessorOptions) {
        this.fs = opts?.fs ?? fs;
        this.isBinary = opts?.isBinary ?? defaultIsBinaryFile;
        this.ignoreFactory = opts?.ignoreFactory ?? FileProcessor.defaultCreateIgnore;
    }

    // --- Public domain methods keep the same behavior ---
    public async getFiles(dirPath: string, ignorePatterns: string[]): Promise<string[]> {
        const userIgnore = ignore();
        userIgnore.add(ignorePatterns);

        const files: string[] = [];
        await this.traverseDirectory(dirPath, files, dirPath, [], userIgnore);
        return files;
    }

    public async dumpFilesContent(rootDir: string, dumpFileRelative: string, files: string[]): Promise<void> {
        const dumpPath = path.join(rootDir, dumpFileRelative);
        await this.fs.writeFile(dumpPath, "", "utf8");

        for (const file of files) {
            const relative = path.relative(rootDir, file);
            const separator = `\n########## ${relative} ##########\n`;
            await this.fs.appendFile(dumpPath, separator, "utf8");
            const content = await this.fs.readFile(file, "utf8");
            await this.fs.appendFile(dumpPath, content + "\n", "utf8");
        }
    }

    public async readFilesContent(rootDir: string, dumpFileRelative: string, files: string[]): Promise<string> {
        let contents = "";
        for (const file of files) {
            const relative = path.relative(rootDir, file);
            const separator = `\n########## ${relative} ##########\n`;
            contents += separator;
            const content = await this.fs.readFile(file, "utf8");
            contents += content + "\n";
        }
        return contents;
    }

    // --- internal helpers ---
    private async traverseDirectory(currentPath: string, files: string[], rootDir: string, ignoreStack: Ignore[], userIgnore: Ignore) {
        const entries = await this.fs.readdir(currentPath, { withFileTypes: true });
        const ig = await this.ignoreFactory(currentPath, this.fs);

        const newIgnoreStack = ignoreStack.slice();
        if (ig) {
            newIgnoreStack.push(ig);
        }

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

            if (await this.shouldIgnore(fullPath, relativePath, entry, newIgnoreStack, userIgnore)) {
                continue;
            }

            if (entry.isDirectory()) {
                await this.traverseDirectory(fullPath, files, rootDir, newIgnoreStack, userIgnore);
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    }

    private async shouldIgnore(fullPath: string, relativePath: string, entry: Dirent, ignoreStack: Ignore[], userIgnore: Ignore): Promise<boolean> {
        if (entry.isDirectory() && entry.name === ".git") {
            return true;
        }

        if (entry.isFile()) {
            const binary = await this.isBinary(fullPath);
            if (binary) {
                return true;
            }
        }

        if (userIgnore.ignores(relativePath)) {
            return true;
        }

        for (const ig of ignoreStack) {
            if (ig.ignores(relativePath)) {
                return true;
            }
        }

        return false;
    }

    // default ignoreFactory -- preserves original behaviour
    private static async defaultCreateIgnore(dirPath: string, fsOps: FileOps): Promise<Ignore> {
        let currentPath = dirPath;
        const ig = ignore();

        while (currentPath !== path.parse(currentPath).root) {
            const gitignorePath = path.join(currentPath, ".gitignore");
            if (await existsWithFs(gitignorePath, fsOps)) {
                const gitignoreContent = await fsOps.readFile(gitignorePath, "utf8");
                ig.add(gitignoreContent);
            }
            currentPath = path.dirname(currentPath);
        }

        return ig;
    }
}

async function existsWithFs(filePath: string, fsOps: FileOps): Promise<boolean> {
    try {
        await fsOps.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Provide a default instance for convenience (keeps public API unchanged)
const defaultProcessor = new FileProcessor();

export async function getFiles(dirPath: string, ignorePatterns: string[]): Promise<string[]> {
    return defaultProcessor.getFiles(dirPath, ignorePatterns);
}

export async function dumpFilesContent(rootDir: string, dumpFileRelative: string, files: string[]): Promise<void> {
    return defaultProcessor.dumpFilesContent(rootDir, dumpFileRelative, files);
}

export async function readFilesContent(rootDir: string, dumpFileRelative: string, files: string[]): Promise<string> {
    return defaultProcessor.readFilesContent(rootDir, dumpFileRelative, files);
}
