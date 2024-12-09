import * as vscode from "vscode";

export class UserDefaults {
    private config = vscode.workspace.getConfiguration("dumpSource");

    // 出力ファイル名を取得
    get outputFileName(): string {
        return this.config.get<string>(
            "outputFileName",
            "aggregated_sources.txt"
        );
    }

    // 拡張子一覧を取得（配列を整形）
    get ignorePatterns(): string[] {
        const patterns = this.config.get<string[]>("userIgnorePatterns", [
            "*.md",
            ".vscode",
            "package-lock.json",
        ]);
        return patterns;
    }
}
