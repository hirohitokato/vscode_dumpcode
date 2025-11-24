# Change Log

## 2.1.1 - 2025/11/25

- Added new command `Select Open Editors` (id: `dump-sourcecode.selectOpenEditors`).
  It marks all currently open editor tabs (workspace files only) in the Dump
  Codes tree view so they can be copied or dumped.
- Command is available from the Dump Codes view title bar and from the
  Command Palette. By default it replaces the current selection; an optional
  argument `{ "add": true }` will add to the selection instead.
- Added new configuration `dumpSource.maxSelectOpenEditors` (default: `20`,
  range: `0-100`, where `0` means no limit) which controls how many open tabs
  the command will process. When exceeded the command aborts to avoid
  accidental large selections.

## 2.1.0 - 2025/11/24

- Added a feature to synchronize the file content in the tree view with the
  editor.
- Improved package information.
- Updated dependencies.
- Minor bug fixes and performance improvements.
- Refactored codebase for better maintainability.

### 2.0.6

- Added the ability to open content when clicking on a file in the tree view.

### 2.0.5

- Discontinued ignoring files described in .vscodeignore

### 2.0.2

- Refined README with usage scenarios and settings clarity.

### 2.0.1

- Introduced tree view and flexible output modes. See settings for more
  details.

## 1.1.4 - 2024/12/28

- Fixed an issue where the contents of .gitignore in parent folders were
  ignored.
- Improved functionality to also reference .vscodeignore files.
- Improved package information

## 1.1.3 - 2024/12/09

- Improved package information

## 1.1.2 - 2024/12/09

- Improved UI

## 1.1.1 - 2024/12/09

- Bug fix

## 1.1.0 - 2024/12/09

- Changed user settings

## 1.0.0 - 2024/12/07

- Initial release
