import * as vscode from 'vscode';

import * as terminal from './common/terminal';
import * as hostEnvironment from './common/environment';
import * as hostCommands from './hostCommands/activate';
import * as languageFeatures from './language/activate';
import * as path from 'path';

export const PSL_MODE: vscode.DocumentFilter = { language: 'psl', scheme: 'file' };
export const BATCH_MODE: vscode.DocumentFilter = { language: 'profileBatch', scheme: 'file' };
export const TRIG_MODE: vscode.DocumentFilter = { language: 'profileTrigger', scheme: 'file' };
export const DATA_MODE: vscode.DocumentFilter = { language: 'profileData', scheme: 'file' };
export const TBL_MODE: vscode.DocumentFilter = { language: 'profileTable', scheme: 'file' };
export const COL_MODE: vscode.DocumentFilter = { language: 'profileColumn', scheme: 'file' };

export function activate(context: vscode.ExtensionContext) {

	hostCommands.activate(context);

	hostEnvironment.activate(context);

	terminal.activate(context);

	languageFeatures.activate(context);

	vscode.window.registerTreeDataProvider("pslExplorer", new CommandProvider(context));

}

interface Node {
	id: string
	command?: string
	iconPath?: { light: string, dark: string };
	children?: Node[]
}

interface Tree {
	Host: Node[],
	Templates: Node[],
	Environments: Node[],
}

class CommandProvider implements vscode.TreeDataProvider<Node> {

	private tree: Tree;


	constructor(private context: vscode.ExtensionContext) {
		const getIcons = (fileName: string): { dark: string, light: string } => {
			return { dark: this.context.asAbsolutePath(path.join('icons', 'dark', fileName)), light: this.context.asAbsolutePath(path.join('icons', 'light', fileName)) }
		}
		this.tree = {
			Host: [
				{ id: 'Refresh Element', command: 'psl.refreshElement', iconPath: getIcons('sync.svg') },
				{ id: 'Test Compile Element', command: 'psl.testCompile', iconPath: getIcons('gear.svg') },
				{ id: 'Send Element', command: 'psl.sendElement', iconPath: getIcons('arrow-up.svg') },
				{ id: 'Compile and Link Element', command: 'psl.compileAndLink', iconPath: getIcons('link.svg') },
				{ id: 'Run PSL', command: 'psl.runPsl', iconPath: getIcons('triangle-right.svg') },
				{ id: 'Get New Element', command: 'psl.getElement', iconPath: getIcons('arrow-down.svg') },
				{
					id: 'Table', iconPath: getIcons('grabber.svg'), children: [
						{ id: 'Refresh Table', command: 'psl.refreshTable', iconPath: getIcons('sync.svg') },
						{ id: 'Send Table', command: 'psl.sendTable', iconPath: getIcons('arrow-up.svg') },
						{ id: 'Compile and Link Table', command: 'psl.compileAndLink', iconPath: getIcons('link.svg') },
						{ id: 'Get New Table', command: 'psl.getTable', iconPath: getIcons('arrow-down.svg') },
					]
				},
			],
			Templates: [
				{ id: 'Batch Definition' }
			],
			Environments: []
		}

	}

	getTreeItem(node: Node): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(node.id);
		if (this.tree[node.id] || node.children) {
			treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
		}
		if (node.command) treeItem.command = { command: node.command, title: node.id };
		if (node.iconPath) treeItem.iconPath = node.iconPath;
		return treeItem;
	}

	getChildren(node?: Node): Node[] | Promise<Node[]> {
		if (!node) return Object.getOwnPropertyNames(this.tree).map(id => { return { id } });
		else if (node.id === 'Environments') {
			return getEnvironments();
		}
		else if (node.children) return node.children;
		else return this.tree[node.id];
	}
}

async function getEnvironments(): Promise<Node[]> {
	let globalConfig = await hostEnvironment.GlobalFile.read();
	return globalConfig.environments.map(env => { return { id: env.name } });
}


// this method is called when your extension is deactivated
export function deactivate() {
}