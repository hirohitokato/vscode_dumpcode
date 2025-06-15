import * as vscode from "vscode";
import * as path from "path";
import { isBinaryFile } from "isbinaryfile";

/* ---------- FileNode ---------- */
export class FileNode extends vscode.TreeItem {
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
    private readonly checked = new Set<string>();
    private readonly nodeCache = new Map<string, FileNode>();
    private readonly stateKey: string; // workspaceState 用キー

    private _onDidChangeTreeData = new vscode.EventEmitter<FileNode | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private readonly workspaceRoot: vscode.Uri | undefined,
        private readonly context: vscode.ExtensionContext,
    ) {
        if (workspaceRoot) {
            this.stateKey = `checkedPaths:${workspaceRoot.fsPath}`;
            // 保存済みチェック状態を復元
            const saved = context.workspaceState.get<string[]>(
                this.stateKey,
                [],
            );
            saved.forEach((p) => this.checked.add(p));
        } else {
            this.stateKey = "checkedPaths:<no-workspace>";
        }
    }

    /** チェック状態を永続化 */
    private persist(): void {
        this.context.workspaceState.update(
            this.stateKey,
            Array.from(this.checked),
        );
    }
    /** 指定パスがチェック済みかどうか */
    public isChecked(p: string) {
        return this.checked.has(p);
    }
    /** チェックを付ける */
    public markChecked(p: string) {
        if (this.checked.has(p)) return;
        this.checked.add(p);
        this.persist();
        this.refresh();
    }
    /** 指定パスのチェックを外す */
    public unmarkChecked(p: string) {
        if (!this.checked.has(p)) return;
        this.checked.delete(p);
        this.persist();
        this.refresh();
    }

    /* ディレクトリ再帰チェック */
    public async markRecursively(dirPath: string): Promise<void> {
        const paths: string[] = [];
        await this.collectAllPaths(dirPath, paths);
        for (const p of paths) {
            this.checked.add(p);
        }
        this.persist();
        this.refresh();
    }

    /** パス集合をそのまま返すユーティリティ */
    public getCheckedPaths(): string[] {
        return Array.from(this.checked);
    }

    /** 指定ディレクトリ以下のすべてのチェックを外す */
    public unmarkRecursively(dirPath: string): void {
        const prefix = dirPath.endsWith(path.sep)
            ? dirPath
            : dirPath + path.sep;

        for (const p of Array.from(this.checked)) {
            if (p === dirPath || p.startsWith(prefix)) {
                this.checked.delete(p);
            }
        }
        this.persist();
        this.refresh();
    }

    /** すべてのチェックを外す */
    public clearAllChecked(): void {
        if (this.checked.size === 0) return;
        this.checked.clear();
        this.persist();
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

    public getTreeItem(element: FileNode): vscode.TreeItem {
        element.syncCheckbox();
        if (element.isDirectory) {
            // チェック済みの子要素があれば展開状態に
            element.collapsibleState =
                this.hasCheckedDescendants(element.uri.fsPath)
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.Collapsed;
        }
        return element;
    }

    public async getChildren(element?: FileNode): Promise<FileNode[]> {
        if (!this.workspaceRoot) return [];

        /* 最上位：ワークスペースルートを 1 ノードだけ返す */
        if (!element) {
            let rootNode = this.nodeCache.get(this.workspaceRoot.fsPath);
            if (!rootNode) {
                rootNode = new FileNode(this.workspaceRoot, true, this, false);
                this.nodeCache.set(this.workspaceRoot.fsPath, rootNode);
            }
            return [rootNode];
        }

        /* 子要素列挙 */
        const entries = await vscode.workspace.fs.readDirectory(element.uri);

        /* Promise でバイナリ判定を同時進行 */
        const nodes = await Promise.all(
            entries.map(async ([name, fileType]) => {
                const uri = vscode.Uri.joinPath(element.uri, name);
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

    /**
     * ディレクトリもファイルも含めて再帰的にパスを収集
     */
    private async collectAllPaths(
        current: string,
        acc: string[],
    ): Promise<void> {
        // 自身も登録
        acc.push(current);

        // 子要素を列挙
        const entries = await vscode.workspace.fs.readDirectory(
            vscode.Uri.file(current),
        );
        for (const [name, type] of entries) {
            const child = path.join(current, name);
            if (type === vscode.FileType.Directory) {
                // サブディレクトリ → 再帰
                await this.collectAllPaths(child, acc);
            } else if (type === vscode.FileType.File) {
                // ファイル → そのまま登録
                acc.push(child);
            }
        }
    }

    /** 指定ノード配下にチェック済み要素があるか */
    private hasCheckedDescendants(dirPath: string): boolean {
        const prefix = dirPath.endsWith(path.sep)
            ? dirPath
            : dirPath + path.sep;
        for (const p of this.checked) {
            if (p === dirPath || p.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
