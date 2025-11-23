import * as vscode from "vscode";
import { FileNode, FileTreeProvider } from "../views/fileTree";
import { UserDefaults } from "../config/userDefaults";
import path from "path";
import { handleDumpFiles, copyFilesToClipboard } from "../services/dumpChildren";

/**
 * Encapsulates behavior and command handlers that were previously embedded
 * in `extension.ts`. Keeping this logic separate makes `activate()` lightweight
 * and easier to test/move.
 */
export function initializeTreeAndCommands(
    workspaceRoot: vscode.Uri | undefined,
    treeProvider: FileTreeProvider,
    treeView: vscode.TreeView<FileNode>,
    context: vscode.ExtensionContext
) {
    // Reveal / highlight currently active editor file in the Dump Sourcecode tree
    async function revealActiveEditorInTree(editor?: vscode.TextEditor | undefined) {
        try {
            const active = editor ?? vscode.window.activeTextEditor;
            if (!active) {
                return;
            }

            const uri = active.document.uri;
            // Only reveal file URIs from the workspace
            if (!workspaceRoot) {
                return;
            }

            // First attempt: get or create node for the path and reveal it.
            const node = await treeProvider.getNodeForPath(uri.fsPath);
            const cfg = new UserDefaults();
            const takeFocus = cfg.revealFocus; // true => focus the tree when revealing
            if (node) {
                try {
                    await vscode.commands.executeCommand("workbench.view.explorer");
                } catch {}

                await treeView.reveal(node, { select: true, focus: takeFocus, expand: 2 });
                return;
            }

            // fallback: refresh and retry once
            try {
                try {
                    await vscode.commands.executeCommand("workbench.view.explorer");
                } catch {}

                treeProvider.refresh();
                await new Promise((r) => setTimeout(r, 120));
                const node2 = await treeProvider.getNodeForPath(uri.fsPath);
                if (node2) {
                    await treeView.reveal(node2, { select: true, focus: takeFocus, expand: 2 });
                }
            } catch {
                // best-effort; ignore
            }
        } catch (err) {
            console.error("Failed to reveal active editor in Dump Sourcecode tree:", err);
        }
    }

    // reveal listeners
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => revealActiveEditorInTree(editor)),
        vscode.window.onDidChangeVisibleTextEditors((editors) => {
            const active = vscode.window.activeTextEditor ?? editors[0];
            revealActiveEditorInTree(active);
        }),
    );

    // initial reveal
    revealActiveEditorInTree();

    // DUMP SOURCECODE ツリービューでクリックした時にファイルを開く
    const openFileOnClick = vscode.commands.registerCommand(
        "dump-sourcecode.openFileOnClick",
        (node: FileNode) => {
            vscode.window.showTextDocument(node.uri);
        },
    );
    context.subscriptions.push(openFileOnClick);

    /* チェック状態の変化を捕捉して Provider に反映 */
    treeView.onDidChangeCheckboxState(async (e) => {
        for (const [node, state] of e.items) {
            const isChecked = state === vscode.TreeItemCheckboxState.Checked;
            if (isChecked) {
                node.isDirectory
                    ? await treeProvider.markRecursively(node.uri.fsPath)
                    : treeProvider.markChecked(node.uri.fsPath);
            } else {
                node.isDirectory
                    ? treeProvider.unmarkRecursively(node.uri.fsPath)
                    : treeProvider.unmarkChecked(node.uri.fsPath);
            }
        }
    });

    /* チェック済みアイテムをクリップボードへ */
    const copyDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.copySelected",
        async () => {
            const checkedPaths = treeProvider.getCheckedPaths();
            const filePaths: string[] = [];
            for (const p of checkedPaths) {
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));

                const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
                if (!isDirectory) {
                    filePaths.push(p);
                }
            }

            if (filePaths.length === 0) {
                vscode.window.showInformationMessage("No files selected. Please check some files first.");
                return;
            }

            // Delegate clipboard formatting + write to service layer so UI logic is thin
            await copyFilesToClipboard(filePaths);
        },
    );
    context.subscriptions.push(copyDisposable);

    /* ツリーをリフレッシュ */
    const refreshDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.refreshTree",
        () => treeProvider.refresh(),
    );
    context.subscriptions.push(refreshDisposable);

    /* すべてのチェックを解除 */
    const clearDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.clearSelection",
        () => treeProvider.clearAllChecked(),
    );
    context.subscriptions.push(clearDisposable);

    // Explorer context commands: file / clipboard
    const dumpToFileDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files_to_file",
        async (uri: vscode.Uri) => {
            handleDumpFiles(uri, "file");
        },
    );
    context.subscriptions.push(dumpToFileDisposable);

    const dumpToClipboardDisposable = vscode.commands.registerCommand(
        "dump-sourcecode.dump_files_to_clipboard",
        async (uri: vscode.Uri) => {
            handleDumpFiles(uri, "clipboard");
        },
    );
    context.subscriptions.push(dumpToClipboardDisposable);
}

export default initializeTreeAndCommands;
