import * as assert from 'assert';
import * as vscode from 'vscode';
import { initializeTreeAndCommands } from '../controllers/extensionController';
import { FileNode } from '../views/FileNode';
import { UserDefaults } from '../config/userDefaults';

suite('Select Open Editors command', () => {
  let origTabGroups: any;

  setup(async () => {
    // save real tabGroups so tests can restore
    origTabGroups = (vscode.window as any).tabGroups;
    // ensure workspace config has a small default to avoid surprises in other tests
    await vscode.workspace.getConfiguration('dumpSource').update('revealFocus', false, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration('dumpSource').update('maxSelectOpenEditors', 20, vscode.ConfigurationTarget.Workspace);
  });

  teardown(async () => {
    // restore tabGroups
    (vscode.window as any).tabGroups = origTabGroups;
    // cleanup settings
    await vscode.workspace.getConfiguration('dumpSource').update('revealFocus', undefined, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration('dumpSource').update('maxSelectOpenEditors', undefined, vscode.ConfigurationTarget.Workspace);
  });

  test('selects open editor files inside workspace and clears previous selection', async () => {
    // prepare workspaceRoot and fake tree provider
    const workspaceRoot = vscode.Uri.file(process.cwd());

    const calls: string[] = [];

    const fakeProvider: any = {
      checked: new Set<string>(),
      isChecked(p: string) { return this.checked.has(p); },
      markChecked(p: string) { calls.push(`mark:${p}`); this.checked.add(p); },
      async markRecursively(p: string) { calls.push(`markRec:${p}`); this.checked.add(p); },
      clearAllChecked() { calls.push('clear'); this.checked.clear(); },
      async getNodeForPath(p: string) {
        // expose nodes only for files under workspaceRoot
        if (p.startsWith(workspaceRoot.fsPath)) {
          return new FileNode(vscode.Uri.file(p), false, fakeProvider, false);
        }
        return undefined;
      },
    };

    // fake treeView with reveal stub
    const fakeTreeView: any = { reveal: async () => {} };

    // initialize commands
    const context: any = { subscriptions: [] };
    initializeTreeAndCommands(workspaceRoot, fakeProvider, fakeTreeView, context);

    // create fake tabs
    const tabs = [
      { input: { uri: vscode.Uri.file(`${workspaceRoot.fsPath}/a.txt`) } },
      { input: { uri: vscode.Uri.file(`${workspaceRoot.fsPath}/sub/b.txt`) } },
      { input: { uri: vscode.Uri.parse('untitled:Untitled-1') } },
      { input: { uri: vscode.Uri.file('C:/outside/out.txt') } },
    ];

    (vscode.window as any).tabGroups = { all: [{ tabs }] };

    // pre-populate provider with something to ensure clear is used
    fakeProvider.checked.add('/will-be-cleared');

    // execute the command (replace = default)
    await vscode.commands.executeCommand('dump-sourcecode.selectOpenEditors');

    // must have cleared first
    assert.ok(calls.includes('clear'));

    // should have marked two files (a.txt and sub/b.txt)
    const marked = calls.filter((c) => c.startsWith('mark:') || c.startsWith('markRec:'));
    // exact two marks
    assert.strictEqual(marked.length, 2);
    assert.ok(marked.some((m) => m.includes('a.txt')));
    assert.ok(marked.some((m) => m.includes('sub/b.txt')));
  });

  test('aborts when open tab count exceeds configured maximum', async () => {
    const workspaceRoot = vscode.Uri.file(process.cwd());

    const calls: string[] = [];
    const fakeProvider: any = {
      checked: new Set<string>(),
      isChecked(p: string) { return this.checked.has(p); },
      markChecked(p: string) { calls.push(`mark:${p}`); this.checked.add(p); },
      async markRecursively(p: string) { calls.push(`markRec:${p}`); this.checked.add(p); },
      clearAllChecked() { calls.push('clear'); this.checked.clear(); },
      async getNodeForPath(p: string) {
        if (p.startsWith(workspaceRoot.fsPath)) {
          return new FileNode(vscode.Uri.file(p), false, fakeProvider, false);
        }
        return undefined;
      },
    };

    const fakeTreeView: any = { reveal: async () => {} };
    const context: any = { subscriptions: [] };
    initializeTreeAndCommands(workspaceRoot, fakeProvider, fakeTreeView, context);

    // adjust config to small maximum
    await vscode.workspace.getConfiguration('dumpSource').update('maxSelectOpenEditors', 2, vscode.ConfigurationTarget.Workspace);

    // create 3 tabs (more than allowed)
    const threeTabs = Array.from({ length: 3 }).map((_, i) => ({ input: { uri: vscode.Uri.file(`${workspaceRoot.fsPath}/f${i}.txt`) } }));
    (vscode.window as any).tabGroups = { all: [{ tabs: threeTabs }] };

    // execute command
    await vscode.commands.executeCommand('dump-sourcecode.selectOpenEditors');

    // nothing marked due to abort
    assert.strictEqual(calls.length, 0);
  });

  test('treats max = 0 as unlimited (processes all open tabs)', async () => {
    const workspaceRoot = vscode.Uri.file(process.cwd());

    const calls: string[] = [];
    const fakeProvider: any = {
      checked: new Set<string>(),
      isChecked(p: string) { return this.checked.has(p); },
      markChecked(p: string) { calls.push(`mark:${p}`); this.checked.add(p); },
      async markRecursively(p: string) { calls.push(`markRec:${p}`); this.checked.add(p); },
      clearAllChecked() { calls.push('clear'); this.checked.clear(); },
      async getNodeForPath(p: string) {
        if (p.startsWith(workspaceRoot.fsPath)) {
          return new FileNode(vscode.Uri.file(p), false, fakeProvider, false);
        }
        return undefined;
      },
    };

    const fakeTreeView: any = { reveal: async () => {} };
    const context: any = { subscriptions: [] };
    initializeTreeAndCommands(workspaceRoot, fakeProvider, fakeTreeView, context);

    // set to zero (meaning unlimited)
    await vscode.workspace.getConfiguration('dumpSource').update('maxSelectOpenEditors', 0, vscode.ConfigurationTarget.Workspace);

    // create 3 tabs which would exceed a small limit but should succeed when max==0
    const threeTabs = Array.from({ length: 3 }).map((_, i) => ({ input: { uri: vscode.Uri.file(`${workspaceRoot.fsPath}/g${i}.txt`) } }));
    (vscode.window as any).tabGroups = { all: [{ tabs: threeTabs }] };

    await vscode.commands.executeCommand('dump-sourcecode.selectOpenEditors');

    // should have performed at least one mark and not aborted
    const marked = calls.filter((c) => c.startsWith('mark:') || c.startsWith('markRec:'));
    assert.strictEqual(marked.length, 3);
  });
});
