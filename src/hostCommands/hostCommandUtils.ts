import * as fsExtra from 'fs-extra';
import * as vscode from 'vscode';
export { extensionToDescription } from '../mtm/utils';
import * as environment from '../common/environment';
import { MtmConnection } from '../mtm/mtm';

const outputChannel = vscode.window.createOutputChannel('Profile Host');

export const logger = {
	error: (message: string) => {
		outputChannel.show();
		outputChannel.appendLine(`[ERR!][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`);
	},
	info: (message: string) => {
		outputChannel.show();
		outputChannel.appendLine(`[INFO][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`);
	},
};

export const enum icons {
	ERROR = '✖',
	GET = '⇩',
	LINK = '🔗',
	REFRESH = '🔃',
	RUN = '▶',
	SEND = '⇧',
	SUCCESS = '✔',
	TEST = '⚙',
	WAIT = '…',
	WARN = '⚠',
}

export const enum ContextMode {
	FILE = 1,
	DIRECTORY = 2,
	EMPTY = 3,
}

export interface ExtensionCommandContext {
	fsPath: string;
	dialog: boolean;
}

export interface HostCommandContext {
	fsPath: string;
	mode: ContextMode;
}

export function getFullContext(context: ExtensionCommandContext | undefined): HostCommandContext {
	let fsPath: string = '';
	let mode: ContextMode;
	const document: vscode.TextDocument = getActiveDocument();
	if (context && context.dialog) {
		mode = ContextMode.EMPTY;
		return { fsPath, mode };
	}
	if ((!context || !context.fsPath) && document) {
		fsPath = document.fileName;
		mode = ContextMode.FILE;
		return { fsPath, mode };
	}
	else if (!context) {
		mode = ContextMode.EMPTY;
		return { fsPath, mode };
	}
	else {
		fsPath = context.fsPath;
		mode = fsExtra.lstatSync(fsPath).isFile() ? ContextMode.FILE : ContextMode.DIRECTORY;
		return { fsPath, mode };
	}
}

export async function executeWithProgress(message: string, task: () => Promise<any>) {
	return vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: message }, async () => {
		await task();
		return;
	});
}

export async function getConnection(env: environment.EnvironmentConfig): Promise<MtmConnection> {
	let connection: MtmConnection;
	try {
		connection = MtmConnection.getSocket('121', 3);
		await connection.open(env.host, env.port, env.user, env.password);
	}
	catch (err) {
		throw err;
	}
	return connection;
}

export async function getEnvironment(fsPath: string): Promise<environment.EnvironmentConfig[]> {
	const workspaceFile = new environment.WorkspaceFile(fsPath);
	try {
		const envs = await workspaceFile.environmentObjects;
		envs.forEach(env => {
			if (!env.host || !env.port || !env.user || !env.password) {
				throw new Error();
			}
		});
		return envs;
	}
	catch (e) {
		const workspaceFolder = workspaceFile.workspaceFolder;
		if (workspaceFolder) {
			throw new Error(`Invalid configuration for Workspace Folder ${workspaceFolder.name}`);
		}
		throw new Error(`File ${fsPath} is not a member of the Workspace.`);
	}
}

export async function getCommandenvConfigQuickPick(envs: environment.EnvironmentConfig[]): Promise<environment.EnvironmentConfig | undefined> {
	const items: environment.LaunchQuickPick[] = envs.map(env => {
		return { label: env.name, description: '', env };
	});
	if (items.length === 1) return items[0].env;
	const choice = await vscode.window.showQuickPick(items, { placeHolder: 'Select environment to get from.' });
	if (!choice) return undefined;
	return choice.env;
}

let activeDocument: vscode.TextDocument | undefined;
const _onDidChangeActiveDocument = new vscode.EventEmitter<vscode.TextDocument>();
export const onDidChangeActiveDocument = _onDidChangeActiveDocument.event;

updateDocument(vscode.window.activeTextEditor);
vscode.window.onDidChangeActiveTextEditor(updateDocument);

function updateDocument(textEditor: vscode.TextEditor) {
	let document: vscode.TextDocument;
	if (textEditor) {
		document = textEditor.document;
		if (document.uri.scheme === 'output') return;
	}
	activeDocument = document;
	_onDidChangeActiveDocument.fire(activeDocument);
}

export function getActiveDocument(): vscode.TextDocument | undefined {
	return activeDocument;
}
