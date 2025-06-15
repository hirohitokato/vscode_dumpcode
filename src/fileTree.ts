import * as vscode from "vscode";
import * as path from "path";

/**
 * ファイルまたはフォルダを表すノード。
 * ツリーに表示するラベルにはファイル名（basename）のみを使用します。
 */
export class FileNode extends vscode.TreeItem {
    /**
     * @param uri ファイルまたはフォルダの URI
     * @param isDirectory ディレクトリなら true
     */
    constructor(
        public readonly uri: vscode.Uri,
        public readonly isDirectory: boolean,
    ) {
        // basename のみをラベルに指定して表示を簡潔に
        super(
            path.basename(uri.fsPath),
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
        );

        this.resourceUri = uri;
        this.contextValue = isDirectory ? "folder" : "file";
    }
}

/**
 * ワークスペース配下のファイル／フォルダ構造を
 * VS Code のツリーとして提供する DataProvider。
 */
export class FileTreeProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FileNode | void>();
    /** ツリー更新イベント */
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /**
     * @param workspaceRoot ワークスペースのルート URI（未設定時は undefined）
     */
    constructor(private readonly workspaceRoot?: vscode.Uri) {}

    /** ツリーを再描画する */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /** TreeItem を返却 */
    public getTreeItem(element: FileNode): vscode.TreeItem {
        return element;
    }

    /**
     * 指定ノードの子要素を取得。
     * workspaceRoot がない場合は空配列を返す。
     */
    public async getChildren(element?: FileNode): Promise<FileNode[]> {
        if (!this.workspaceRoot) {
            return [];
        }
        const dirUri = element ? element.uri : this.workspaceRoot;
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        return entries.map(([name, fileType]) => {
            const uri = vscode.Uri.joinPath(dirUri, name);
            const isDirectory = fileType === vscode.FileType.Directory;
            return new FileNode(uri, isDirectory);
        });
    }
}
