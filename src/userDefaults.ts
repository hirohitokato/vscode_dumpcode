import * as vscode from "vscode";

export class UserDefaults {
    private config = vscode.workspace.getConfiguration("dumpSource");

    // 出力ファイル名を取得
    get outputFileName(): string {
        return this.config.get<string>("outputFileName", "dump.txt");
    }

    // 拡張子一覧を取得（配列を整形）
    get extensions(): string[] {
        const exts = this.config.get<string[]>("extensions", [
            "txt",
            "ts",
            "js",
            "c",
            "cpp",
            "h",
            "hpp",
            "cs",
            "swift",
            "go",
            "rs",
        ]);
        return exts
            .map((e) => e.trim())
            .filter((e) => e.length > 0)
            .map((e) => (e.startsWith(".") ? e : "." + e));
    }
}
