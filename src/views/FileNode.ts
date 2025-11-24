import * as vscode from "vscode";
import * as path from "path";

/**
 * Pure domain object representing a node in the Dump Codes tree.
 * Kept intentionally free of file system operations so tests can mock provider
 * behaviour without touching fs APIs.
 */
export class FileNode extends vscode.TreeItem {
    constructor(
        public readonly uri: vscode.Uri,
        public readonly isDirectory: boolean,
        private readonly provider: any,
        private readonly isBinary: boolean
    ) {
        super(
            path.basename(uri.fsPath),
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.resourceUri = uri;
        this.contextValue = isDirectory ? "folder" : "file";

        /* バイナリファイルはチェック無し & アイコン変更 */
        if (this.isBinary) {
            this.iconPath = new vscode.ThemeIcon("file-binary");
        } else {
            this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
            // ファイルをクリックしたときに開くコマンドを設定
            if (!isDirectory) {
                this.command = {
                    command: "dump-sourcecode.openFileOnClick",
                    title: "Open File",
                    arguments: [this],
                };
            }
        }
    }

    /** 描画直前にチェック状態を同期 */
    public syncCheckbox(): void {
        if (!this.isBinary) {
            this.checkboxState = this.provider.isChecked(this.uri.fsPath)
                ? vscode.TreeItemCheckboxState.Checked
                : vscode.TreeItemCheckboxState.Unchecked;
        }
    }
}
