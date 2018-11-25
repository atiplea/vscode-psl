import * as path from 'path';
import * as vscode from 'vscode';
import * as hostEnvironment from './common/environment';
import * as terminal from './common/terminal';
import * as hostCommands from './hostCommands/activate';
import { getActiveDocument, onDidChangeActiveDocument } from './hostCommands/hostCommandUtils';
import * as languageFeatures from './language/activate';

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

	const commandProvider = new CommandProvider(context);
	const environmentProvider = new EnvironmentProvider(context);
	const commandTree = vscode.window.createTreeView<Node>('hostCommands', { treeDataProvider: commandProvider });
	const envTree = vscode.window.createTreeView<Node>('pslEnvironments', { treeDataProvider: environmentProvider });

	onDidChangeActiveDocument(_ => commandProvider.refresh());

	vscode.commands.registerCommand('psl.toggleEnvironment', () => {
		const envs = envTree.selection.filter(n => n.contextValue === 'env').map(n => n.id);
		console.log(`toggle ${envs}`);
	});
}

interface Node {
	id: string;
	command?: string;
	contextValue?: string;
	iconPath?: { light: string, dark: string };
	children?: Node[];
}

enum HostCommandCondition {
	always,
	isProfileElement,
	isPSL,
	isTable,
}

interface HostCommandNode extends Node {
	condition: HostCommandCondition;
}

class CommandProvider implements vscode.TreeDataProvider<Node> {

	readonly onDidChangeTreeData: vscode.Event<any>;
	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	private tree: Node[];

	private refreshNode: HostCommandNode = {
		command: 'psl.refreshElement',
		condition: HostCommandCondition.isProfileElement,
		iconPath: this.getIcons('sync.svg'),
		id: 'Refresh Element',
	};
	private testCompileNode: HostCommandNode = {
		command: 'psl.testCompile',
		condition: HostCommandCondition.isPSL,
		iconPath: this.getIcons('gear.svg'),
		id: 'Test Compile Element',
	};
	private sendNode: HostCommandNode = {
		command: 'psl.sendElement',
		condition: HostCommandCondition.isProfileElement,
		iconPath: this.getIcons('arrow-up.svg'),
		id: 'Send Element',
	};
	private compileAndLinkNode: HostCommandNode = {
		command: 'psl.compileAndLink',
		condition: HostCommandCondition.isPSL,
		iconPath: this.getIcons('link.svg'),
		id: 'Compile and Link Element',
	};
	private runNode: HostCommandNode = {
		command: 'psl.runPsl',
		condition: HostCommandCondition.isPSL,
		iconPath: this.getIcons('triangle-right.svg'),
		id: 'Run PSL',
	};
	private getNode: HostCommandNode = {
		command: 'psl.getElement',
		condition: HostCommandCondition.always,
		iconPath: this.getIcons('arrow-down.svg'),
		id: 'Get New Element',
	};
	private tableNodeChildren: HostCommandNode[] = [
		{
			command: 'psl.refreshTable',
			condition: HostCommandCondition.isTable,
			iconPath: this.getIcons('sync.svg'),
			id: 'Refresh Table',
		},
		{
			command: 'psl.sendTable',
			condition: HostCommandCondition.isTable,
			iconPath: this.getIcons('arrow-up.svg'),
			id: 'Send Table',
		},
		{
			command: 'psl.compileAndLink',
			condition: HostCommandCondition.isTable,
			iconPath: this.getIcons('link.svg'),
			id: 'Compile and Link Table',
		},
		{
			command: 'psl.getTable',
			condition: HostCommandCondition.always,
			iconPath: this.getIcons('arrow-down.svg'),
			id: 'Get New Table',
		},
	];
	private tableNode: HostCommandNode = {
		condition: HostCommandCondition.always,
		iconPath: this.getIcons('grabber.svg'),
		id: 'Table',
	};

	constructor(private context: vscode.ExtensionContext) {
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this.buildTree();
	}

	public refresh(): any {
		this.buildTree();
		this._onDidChangeTreeData.fire();
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
		if (!node) return this.tree;
		else if (node.children) return node.children;
		else return [];
	}

	private getIcons(iconFileName: string): { dark: string, light: string } {
		return {
			dark: this.context.asAbsolutePath(path.join('icons', 'dark', iconFileName)),
			light: this.context.asAbsolutePath(path.join('icons', 'light', iconFileName)),
		};

	}

	private buildTree() {
		this.tree = this.buildCommands();
	}

	private buildCommands() {
		return [
			this.refreshNode,
			this.testCompileNode,
			this.sendNode,
			this.compileAndLinkNode,
			this.runNode,
			this.getNode,
			this.buildTableNode(),
		].filter(filterByCondition);
	}

	private buildTableNode() {
		const tableNode = this.tableNode;
		tableNode.children = this.tableNodeChildren.filter(filterByCondition);
		return tableNode;
	}
}

class EnvironmentProvider implements vscode.TreeDataProvider<Node> {

	readonly onDidChangeTreeData: vscode.Event<any>;
	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	private tree: Node[];

	constructor(private context: vscode.ExtensionContext) {
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this.buildTree();
	}

	public refresh(): any {
		this.buildTree();
		this._onDidChangeTreeData.fire();
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

	getChildren(): Promise<Node[]> {
		return this.buildEnvironments();
	}

	private buildTree() {
		this.tree = [];
	}

	private getIcons(iconFileName: string): { dark: string, light: string } {
		return {
			dark: this.context.asAbsolutePath(path.join('icons', 'dark', iconFileName)),
			light: this.context.asAbsolutePath(path.join('icons', 'light', iconFileName)),
		};

	}
	private async buildEnvironments(): Promise<Node[]> {
		const globalConfig = await hostEnvironment.GlobalFile.read();
		// let localWorkspaceFile = new hostEnvironment.WorkspaceFile(vscode.window.activeTextEditor.document.fileName);
		return globalConfig.environments.map<Node>(env => ({
			command: 'psl.toggleEnvironment',
			contextValue: 'env',
			// iconPath: this.getIcons(''),
			id: env.name,
		}));
	}

}

function filterByCondition(node: HostCommandNode): boolean {
	if (node.condition === HostCommandCondition.always) return true;
	const document = getActiveDocument();
	if (!document) return;
	const fileName = document.fileName;

	const isProfileElement = hostCommands.isProfileElement(fileName);
	const isPSL = vscode.languages.match(PSL_MODE, document) > 0;
	const isTable = vscode.languages.match(TBL_MODE, document) > 0
		|| vscode.languages.match(COL_MODE, document) > 0;

	switch (node.condition) {
		case HostCommandCondition.isTable:
			return isTable;
		case HostCommandCondition.isPSL:
			return isPSL;
		case HostCommandCondition.isProfileElement:
			return isProfileElement;
		default:
			return false;
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }
