let expect: any;
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import { handleDumpFiles, copyFilesToClipboard } from "../services/dumpChildren";

suite("dumpChildren integration tests", () => {
  let root: string;

  setup(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "dumpchild-test-"));
    const chai = await import("chai");
    expect = chai.expect;
    // ensure default workspace config for our extension is set
    await vscode.workspace.getConfiguration("dumpSource").update("outputFileName", "dump-out.txt", vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration("dumpSource").update("userIgnorePatterns", [], vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration("dumpSource").update("revealFocus", false, vscode.ConfigurationTarget.Workspace);
  });

  teardown(async () => {
    // cleanup - best-effort remove temp directory
    async function rimraf(p: string) {
      try {
        const stat = await fs.stat(p);
        if (stat.isDirectory()) {
          const items = await fs.readdir(p);
          await Promise.all(items.map((it) => rimraf(path.join(p, it))));
          await fs.rmdir(p);
        } else {
          await fs.unlink(p);
        }
      } catch {
        // ignore
      }
    }

    await rimraf(root);

    // revert settings (best-effort)
    await vscode.workspace.getConfiguration("dumpSource").update("outputFileName", undefined, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration("dumpSource").update("userIgnorePatterns", undefined, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration("dumpSource").update("revealFocus", undefined, vscode.ConfigurationTarget.Workspace);
  });

  test("handleDumpFiles writes aggregated file and opens it (file mode)", async () => {
    const f1 = path.join(root, "one.txt");
    const dir = path.join(root, "dir");
    await fs.mkdir(dir);
    const f2 = path.join(dir, "two.txt");

    await fs.writeFile(f1, "alpha", "utf8");
    await fs.writeFile(f2, "beta line\nmore", "utf8");

    // call the handler - file mode
    await handleDumpFiles(vscode.Uri.file(root), "file");

    const dumpPath = path.join(root, "dump-out.txt");
    const exists = await fs.stat(dumpPath).catch(() => undefined);
    expect(exists).to.not.equal(undefined);

    const content = await fs.readFile(dumpPath, "utf8");
    expect(content).to.include("########## one.txt ##########");
    expect(content).to.include("########## dir/two.txt ##########");
    expect(content).to.include("alpha");
    expect(content).to.include("beta line");
  }).timeout(10_000);

  test("handleDumpFiles copies aggregated content to clipboard (clipboard mode)", async () => {
    const a = path.join(root, "a.txt");
    const b = path.join(root, "b.txt");
    await fs.writeFile(a, "aaa", "utf8");
    await fs.writeFile(b, "bbb", "utf8");

    // run in clipboard mode
    await handleDumpFiles(vscode.Uri.file(root), "clipboard");
    const text = await vscode.env.clipboard.readText();
    expect(text).to.include("########## a.txt ##########");
    expect(text).to.include("aaa");
    expect(text).to.include("########## b.txt ##########");
  }).timeout(10_000);

  test("copyFilesToClipboard copies specific selected files to clipboard", async () => {
    const x = path.join(root, "x.txt");
    const y = path.join(root, "y.txt");
    await fs.writeFile(x, "xxx", "utf8");
    await fs.writeFile(y, "yyy", "utf8");

    await copyFilesToClipboard([x, y], root);
    const txt = await vscode.env.clipboard.readText();
    expect(txt).to.include("########## x.txt ##########");
    expect(txt).to.include("xxx");
    expect(txt).to.include("########## y.txt ##########");
  }).timeout(10_000);
});
