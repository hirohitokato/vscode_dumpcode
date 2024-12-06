import * as vscode from "vscode";

export class UserDefaults {
    private config = vscode.workspace.getConfiguration("dumpSource");

    // 出力ファイル名を取得
    get outputFileName(): string {
        return this.config.get<string>("outputFileName", "dump.txt");
    }

    // 拡張子一覧を取得（カンマ区切りを分解して配列化）
    get extensions(): string[] {
        const exts = this.config.get<string>("extensions", ".txt,.ts,.js,.c");
        return exts
            .split(",")
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
    }
}
