import * as vscode from "vscode";
import { isBinaryFile } from "isbinaryfile";

export async function readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    return vscode.workspace.fs.readDirectory(uri);
}

export async function stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    return vscode.workspace.fs.stat(uri);
}

export async function readFileUtf8(uri: vscode.Uri): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
}

export async function isBinaryPath(fsPath: string): Promise<boolean> {
    // `isbinaryfile` can throw for some special files; callers should handle errors
    return isBinaryFile(fsPath).catch(() => false);
}
