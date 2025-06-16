# Dump Sources Extension

> The extension gathers all source files in the specified folder and concatenates their contents into a single text file or copies them to the clipboard.

![Extension Icon](assets/screenshot1.png)

## Features

* **Tree View** in the Explorer to browse and select text-based source files
* **Copy Selected**: Copy the contents of selected files to the clipboard
* **Dump to File**: Concatenate selected files into one output file
* **Dump to Clipboard**: Copy concatenated content directly to the clipboard

## Usage

1. In the Explorer sidebar, open the **Dump Sourcecode** view.
2. Click the **Refresh** icon to load files.
3. Expand folders and click on files to select them.
4. Right-click on the view or in the Explorer context menu and choose one of the following commands:
   * **Dump files to single file**: Creates a file containing all selected contents.
   * **Dump files to Clipboard**: Copies all selected contents to the clipboard.
5. The output file will be named according to your configuration (default: `aggregated_sources.txt`).

### Output example

```ts
########## src/fileTree.ts ##########
import * as vscode from "vscode";
import * as path from "path";
...

########## src/userDefaults.ts ##########
import * as vscode from "vscode";

export class UserDefaults {
...

########## src/services/dumpChildren.ts ##########
import * as vscode from "vscode";
...
```

## Commands

| Command | Title | Description |
| --- | --- | --- |
| `dump-sourcecode.refreshTree` | Refresh Tree | Reloads the target folder structure |
| `dump-sourcecode.copySelected` | Dump Selections to Clipboard | Copies selected file contents to clipboard |
| `dump-sourcecode.clearSelection` | Clear Selection | Deselects all files |
| `dump-sourcecode.dump_files_to_file` | Dump files to single file | Concatenates selected files into one output file |
| `dump-sourcecode.dump_files_to_clipboard` | Dump files to Clipboard | Copies concatenated contents to clipboard |

## Configuration

The extension contributes the following settings under **Dump Sourcecode Settings**:

| Setting | Default | Description |
| --- | --- | --- |
| `dumpSource.outputFileName` | `aggregated_sources.txt` | Name of the output file when using **Dump to File** command. |
| `dumpSource.userIgnorePatterns` | `["*.md",".vscode","package-lock.json"]` | Glob patterns to ignore files and directories (similar to `.gitignore`). Applies when dumping. |
| `dumpSource.defaultDumpTarget` | `clipboard` | Default target for the **Dump to...** commands (`file` or `clipboard`). |

To modify these settings, open **Preferences › Settings**, search for **Dump Sourcecode**, and adjust as needed.

## Extension Settings Sample

```json
{
    "dumpSource.outputFileName": "all_sources.txt",
    "dumpSource.userIgnorePatterns": ["*.test.ts", "node_modules"],
    "dumpSource.defaultDumpTarget": "file"
}
```

## How to Contribute

1. Clone or download this repository:

   ```bash
   git clone https://github.com/hirohitokato/vscode_dumpcode.git
   ```
2. Open the folder in VS Code.
3. Run the **Extension** debug session (press `F5`).
4. Your extension is now running in a new Extension Development Host window.

## Release Notes

### 2.0.2

* Updated README

### 2.0.1

* Fixed some issues with file selection and tree view

### 2.0.0

* Introduced **Tree View** for file selection
* Added **Copy Selected** and **Clear Selection** commands
* Support for dumping either to file or clipboard

---

*Published by [hkato193](https://github.com/hirohitokato), version 2.0.1*
