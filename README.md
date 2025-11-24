# Dump Codes Extension

> A VS Code extension to collect and export source files from a folder — either as a single text file or copied to the clipboard.

![screenshot](./assets/screenshot.png)

## Key Features

- **Two Modes of Operation**:

    1. **Explorer Context Menu**: Quickly dump all source files in a folder via
       right-click, and output them to a file or to the clipboard.
    2. **Dump Codes Tree View**: A fine-grained selection UI. Expand folders,
       check files and folders, then copy or export just the selected items.
    3. **Select Open Editors**: Mark all currently open editor tabs directly in
       the Dump Codes tree. This is a fast way to include the files you're
       actively editing in an export. The command is available on the tree
       title bar and from the Command Palette.

**Commands**:

- Dump files to a single file.
- Dump files to the clipboard.
- Refresh or clear selections in the tree view.
- Select all currently open editor tabs (in-tree) so they can be dumped or copied: `Select Open Editors` (available in the view title and Command Palette).

## Usage

### 1. Explorer Context Menu

1. In the **Explorer**, right-click on a folder.
2. Choose **Dump files to single file** or **Dump files to Clipboard**.
3. (File mode only) The output file is created at the workspace root with the name set by `dumpSource.outputFileName`.

![Explorer Context Menu](./assets/screenshot2.png)

### 2. Dump Codes Tree View

1. Open the **Dump Codes** view from the Explorer sidebar.
2. Click the **Refresh** icon to scan for text-based source files.
3. Expand folders and click the checkbox next to files (or folders) to select them.
4. Click a file in the tree to open it in the editor.
5. Use the **Copy Selected** command (via the view title or item context menu)
   to copy the contents of all selected files to the clipboard.

### Select Open Editors

The `Select Open Editors` command marks all currently open editor tabs that
exist inside the workspace in the `Dump Codes` tree view. It is intended as a
fast way to collect exactly the files you are working on and include them in
an export or clipboard operation.

- Location: available from the **Dump Codes** tree title bar (alongside Refresh
    / Clear / Copy) and from the Command Palette for discoverability and shortcut
    binding.
- Action: by default the command replaces the current selection in the tree
    with workspace files corresponding to all open editor tabs. An optional
    argument `{ "add": true }` will add to the existing selection instead of
    replacing it.
- Filtering: files outside the workspace, ignored by `.gitignore` or
    `dumpSource.userIgnorePatterns`, or detected as binary are omitted; a brief
    information message shows counts for selected vs skipped items.

Usage examples:

- Use View Title button: click the `Select Open Editors` button on the
    **Dump Codes** view title bar to replace the current selection with all open
    editor tabs from the workspace.
- Use Command Palette: run `> Dump Codes: Select Open Editors` — optionally
    pass an argument `{ "add": true }` to add to the selection instead of
    replacing it.

> **Note**: In tree view you can open files by clicking them and copy
> selected files to the clipboard using the `Copy Selected` command.

![Tree View Selection](./assets/screenshot1.png)

## Commands Reference

| Command                                   | Title                     | Context                                    |
| ----------------------------------------- | ------------------------- | ------------------------------------------ |
| `dump-sourcecode.dump_files_to_file`      | Dump files to single file | Explorer context (folder only)             |
| `dump-sourcecode.dump_files_to_clipboard` | Dump files to Clipboard   | Explorer context (folder only) + Tree view |
| `dump-sourcecode.openFileOnClick`         | Open file on click        | Tree view (opens the clicked file)         |
| `dump-sourcecode.refreshTree`             | Refresh Tree              | Tree view                                  |
| `dump-sourcecode.clearSelection`          | Clear Selection           | Tree view                                  |
| `dump-sourcecode.copySelected`            | Copy Selected             | Tree view                                  |
| `dump-sourcecode.selectOpenEditors`       | Select Open Editors       | Tree view title + Command Palette          |

## Configuration

Under **Preferences › Settings › Dump Codes**, configure:

| Setting | Default | Applies When |
| --- | --- | --- |
| `dumpSource.outputFileName` | `aggregated_sources.txt` | Explorer context **file** mode |
| `dumpSource.userIgnorePatterns` | `["*.md", ".vscode", "package-lock.json"]` | Both modes — patterns apply on top of .gitignore rules. |
| `dumpSource.defaultDumpTarget` | `clipboard` | Explorer context (sets default action) |
| `dumpSource.revealFocus` | `true` | Whether the Dump Codes tree takes focus when revealing the active file; set to `false` to keep focus in the editor |
| `dumpSource.maxSelectOpenEditors` | `20` | Max open tabs (0 = unlimited) |

### Sample Configuration

```json
{
    "dumpSource.outputFileName": "all_sources.txt",
    "dumpSource.userIgnorePatterns": ["*.test.ts", "node_modules"],
    "dumpSource.defaultDumpTarget": "file",
    "dumpSource.revealFocus": true
}
```

## Getting Started

1. Clone the repository:

    ```bash
    git clone https://github.com/hirohitokato/vscode_dumpcode.git
    ```

2. Open in VS Code.
3. Press `F5` to launch the Extension Development Host.
4. Use the commands as described above.

## Change Logs

See [CHANGELOG.md](./CHANGELOG.md) for details.

*Published by [hkato193](https://github.com/hirohitokato)*
