import * as vscode from "vscode";
import * as path from "path";
import { isBinaryFile } from "isbinaryfile";

/* ---------- FileNode ---------- */
export class FileNode extends vscode.TreeItem {
    /** バイナリなら true */
    constructor(
        public readonly uri: vscode.Uri,
        public readonly isDirectory: boolean,
        private readonly provider: FileTreeProvider,
        private readonly isBinary: boolean,
    ) {
        super(
            path.basename(uri.fsPath),
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
        );

        this.resourceUri = uri;
        this.contextValue = isDirectory ? "folder" : "file";

        /* バイナリファイルはチェック無し & アイコン変更 */
        if (this.isBinary) {
            this.iconPath = new vscode.ThemeIcon("file-binary");
            // checkboxState を設定しない ⇒ チェックボックス非表示
        } else {
            this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
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

/* ---------- FileTreeProvider ---------- */
export class FileTreeProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FileNode | void>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /* チェック済みパス集合（バイナリ・不可視ファイルは含めない） */
    private checked = new Set<string>();

    /* ノードキャッシュ（fsPath → FileNode） */
    private nodeCache = new Map<string, FileNode>();

    constructor(private readonly workspaceRoot?: vscode.Uri) {}

    /* ---------- 公開 API ---------- */
    public isChecked(fsPath: string) {
        return this.checked.has(fsPath);
    }
    public markChecked(fsPath: string) {
        this.checked.add(fsPath);
        this.refresh();
    }
    public unmarkChecked(fsPath: string) {
        this.checked.delete(fsPath);
        this.refresh();
    }
    /** コピー用にチェック済みノードを返却 */
    public getCheckedNodes(): FileNode[] {
        return Array.from(this.checked)
            .map((p) => this.nodeCache.get(p))
            .filter((n): n is FileNode => !!n);
    }
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /* ---------- TreeDataProvider 実装 ---------- */
    public getTreeItem(element: FileNode): vscode.TreeItem {
        element.syncCheckbox();
        return element;
    }

    public async getChildren(element?: FileNode): Promise<FileNode[]> {
        if (!this.workspaceRoot) return [];
        const dirUri = element ? element.uri : this.workspaceRoot;
        const entries = await vscode.workspace.fs.readDirectory(dirUri);

        /* Promise でバイナリ判定を同時進行 */
        const nodes = await Promise.all(
            entries.map(async ([name, fileType]) => {
                const uri = vscode.Uri.joinPath(dirUri, name);
                const isDir = fileType === vscode.FileType.Directory;
                const isBin = !isDir &&
                    (await isBinaryFile(uri.fsPath).catch(() => false));

                let node = this.nodeCache.get(uri.fsPath);
                if (!node) {
                    node = new FileNode(uri, isDir, this, isBin);
                    this.nodeCache.set(uri.fsPath, node);
                }
                return node;
            }),
        );

        return nodes;
    }
}
