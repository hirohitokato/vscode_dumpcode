import * as vscode from "vscode";
import * as path from "path";
import { isBinaryFile } from "isbinaryfile";
import ignore, { Ignore } from "ignore";

/* ---------- FileNode ---------- */
export class FileNode extends vscode.TreeItem {
    constructor(
        public readonly uri: vscode.Uri,
        public readonly isDirectory: boolean,
        private readonly provider: FileTreeProvider,
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

    private ig: Ignore;
    private workspaceRootPath: string;

    private _onDidChangeTreeData = new vscode.EventEmitter<FileNode | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private readonly workspaceRoot: vscode.Uri | undefined,
        private readonly context: vscode.ExtensionContext
    ) {
        if (workspaceRoot) {
            this.workspaceRootPath = workspaceRoot.fsPath;
            this.stateKey = `checkedPaths:${workspaceRoot.fsPath}`;

            // 保存済みチェック状態を復元
            const saved = context.workspaceState.get<string[]>(
                this.stateKey,
                []
            );
            saved.forEach((p) => this.checked.add(p));

            // ignoreライブラリ初期化 & .gitignore 読み込み
            this.ig = ignore();
            this.loadIgnorePatterns().catch((err) =>
                console.error("Ignore load error:", err)
            );
        } else {
            this.workspaceRootPath = "";
            this.stateKey = "checkedPaths:<no-workspace>";
            this.ig = ignore();
        }
    }

    /** .gitignore とユーザー設定パターンを読み込む */
    private async loadIgnorePatterns(): Promise<void> {
        // 1) .git ディレクトリ丸ごと除外
        this.ig.add(".git/");

        // 2) ワークスペース直下の .gitignore があれば行ごとに追加
        if (this.workspaceRootPath) {
            const gitignoreUri = vscode.Uri.joinPath(
                vscode.Uri.file(this.workspaceRootPath),
                ".gitignore"
            );
            try {
                const data = await vscode.workspace.fs.readFile(gitignoreUri);
                const content = Buffer.from(data).toString("utf8");
                this.ig.add(
                    content
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter((line) => line && !line.startsWith("#"))
                );
            } catch {
                // .gitignore がない場合は無視
            }
        }

        // 3) ユーザー設定 dumpSource.userIgnorePatterns の取り込み
        const cfg = vscode.workspace.getConfiguration("dumpSource");
        const patterns = cfg.get<string[]>("userIgnorePatterns") || [];
        this.ig.add(patterns);
    }

    /** チェック状態を永続化 */
    private persist(): void {
        this.context.workspaceState.update(
            this.stateKey,
            Array.from(this.checked)
        );
    }
    public isChecked(p: string) {
        return this.checked.has(p);
    }
    public markChecked(p: string) {
        if (this.checked.has(p)) {
            return;
        }
        this.checked.add(p);
        this.persist();
        this.refresh();
    }
    public unmarkChecked(p: string) {
        if (!this.checked.has(p)) {
            return;
        }
        this.checked.delete(p);
        this.persist();
        this.refresh();
    }

    public async markRecursively(dirPath: string): Promise<void> {
        const paths: string[] = [];
        await this.collectAllPaths(dirPath, paths);
        paths.forEach((p) => this.checked.add(p));
        this.persist();
        this.refresh();
    }

    public getCheckedPaths(): string[] {
        return Array.from(this.checked);
    }

    public unmarkRecursively(dirPath: string): void {
        const prefix = dirPath.endsWith(path.sep)
            ? dirPath
            : dirPath + path.sep;
        Array.from(this.checked).forEach((p) => {
            if (p === dirPath || p.startsWith(prefix)) {
                this.checked.delete(p);
            }
        });
        this.persist();
        this.refresh();
    }

    public clearAllChecked(): void {
        if (this.checked.size === 0) {
            return;
        }
        this.checked.clear();
        this.persist();
        this.refresh();
    }

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
            element.collapsibleState = this.hasCheckedDescendants(
                element.uri.fsPath
            )
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;
        }
        return element;
    }

    public async getChildren(element?: FileNode): Promise<FileNode[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        // ルートノードだけ返す
        if (!element) {
            let rootNode = this.nodeCache.get(this.workspaceRoot.fsPath);
            if (!rootNode) {
                rootNode = new FileNode(this.workspaceRoot, true, this, false);
                this.nodeCache.set(this.workspaceRoot.fsPath, rootNode);
            }
            return [rootNode];
        }

        const entries = await vscode.workspace.fs.readDirectory(element.uri);

        // ignoreルールでフィルタリング
        const filtered = entries.filter(([name, fileType]) => {
            const fullPath = path.join(element.uri.fsPath, name);
            let relPath = path.relative(this.workspaceRootPath, fullPath);
            // パス区切りを posix スタイルに
            relPath = relPath.split(path.sep).join("/");
            // ディレクトリは末尾にスラッシュを付与
            if (fileType === vscode.FileType.Directory) {
                relPath = relPath.endsWith("/") ? relPath : relPath + "/";
            }
            return !this.ig.ignores(relPath);
        });

        const nodes = await Promise.all(
            filtered.map(async ([name, fileType]) => {
                const uri = vscode.Uri.joinPath(element.uri, name);
                const isDir = fileType === vscode.FileType.Directory;
                const isBin =
                    !isDir &&
                    (await isBinaryFile(uri.fsPath).catch(() => false));

                let node = this.nodeCache.get(uri.fsPath);
                if (!node) {
                    node = new FileNode(uri, isDir, this, isBin);
                    this.nodeCache.set(uri.fsPath, node);
                }
                return node;
            })
        );

        return nodes;
    }

    private async collectAllPaths(
        current: string,
        acc: string[]
    ): Promise<void> {
        acc.push(current);
        const entries = await vscode.workspace.fs.readDirectory(
            vscode.Uri.file(current)
        );
        for (const [name, type] of entries) {
            const child = path.join(current, name);
            if (type === vscode.FileType.Directory) {
                await this.collectAllPaths(child, acc);
            } else if (type === vscode.FileType.File) {
                acc.push(child);
            }
        }
    }

    private hasCheckedDescendants(dirPath: string): boolean {
        const prefix = dirPath.endsWith(path.sep)
            ? dirPath
            : dirPath + path.sep;
        return Array.from(this.checked).some(
            (p) => p === dirPath || p.startsWith(prefix)
        );
    }
}
