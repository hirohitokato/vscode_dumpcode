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

    // reveal focus setting used by the tree view (true = tree takes focus on reveal)
    get revealFocus(): boolean {
        return this.config.get<boolean>("revealFocus", true);
    }

    // maximum number of open editors that Select Open Editors will process
    get maxSelectOpenEditors(): number {
        const raw = this.config.get<number>("maxSelectOpenEditors", 20);
        // Ensure an integer in the supported range 0..100 (0 == unlimited)
        const n = Number.isFinite(raw) ? Math.floor(raw as number) : 20;
        if (n < 0) {
            return 0;
        }
        if (n > 100) {
            return 100;
        }
        return n;
    }
}
