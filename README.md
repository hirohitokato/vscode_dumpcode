# Dump Sources

"Dump Sources" is a Visual Studio Code extension designed to help you quickly aggregate text-based source files from a specific directory into a single output file. This is particularly useful when preparing code for large language models (LLMs) or when you need a consolidated view of certain files for review, documentation, or analysis.

## Key Features

-   **Bulk Code Input for AI**: Easily combine source code files from a chosen directory into one output file, perfect for providing a single large input to AI models.
-   **Directory-Scoped Collection**: Simply right-click on a target folder in the Explorer to gather only the files under that directory.
-   **.gitignore Support**: Automatically skip files and directories that match `.gitignore` rules, ensuring that only relevant files are included.
-   **Flexible Configuration**:
    -   Customize the output filename
    -   Specify a list of file extensions to include  
        Tailor these settings to fit your project’s unique requirements.

## How to Use

1. Open your target project in VS Code.
2. In the Explorer, right-click the folder you want to dump sources from.
3. Select **"Dump Sources"** from the context menu.
4. The extension will find all files matching the configured extensions (excluding those ignored by `.gitignore`).
5. While processing, a progress indicator will animate at the bottom of the VS Code window.
6. Once complete, the generated file opens automatically in the editor, allowing you to review the combined content immediately.

## Configuration

-   `dumpSource.outputFileName` (default: `dump.txt`)  
    Specifies the name of the output file.

-   `dumpSource.extensions` (default: `["txt", "ts", "js", "c"]`)  
    An array of file extensions to include (no leading dot required).  
    For example, `["md", "py"]` includes `.md` and `.py` files in the output.

## Use Cases

-   Provide large sections of code to AI models for analysis or suggestions.
-   Extract and consolidate specific parts of a project for focused reviews.
-   Create a single reference document from multiple source files for documentation or archiving.

With the Dump Sources Extension, you can streamline your code aggregation process, making it easier to work with AI tools or gain insights from a defined subset of files. Try it out and speed up your code management workflow!

# dump-sourcecode README

This is the README for your extension "dump-sourcecode". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

-   `myExtension.enable`: Enable/disable this extension.
-   `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

-   [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

-   Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
-   Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
-   Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

-   [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
-   [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
