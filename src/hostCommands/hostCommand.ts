import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
export { extensionToDescription } from '../mtm/utils';
import { LaunchQuickPick, WorkspaceFile, workspaceQuickPick, EnvironmentConfig } from '../common/environment';
import { MtmConnection } from '../mtm/mtm';

const outputChannel = vscode.window.createOutputChannel('Profile Host');

export const logger = {
	info: (message: string) => {
		outputChannel.show();
		outputChannel.appendLine(`[INFO][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`)
	},
	error: (message: string) => {
		outputChannel.show();
		outputChannel.appendLine(`[ERR!][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`)
	}
}

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


export interface HostCommand {
	icon: string;
	command: string;

	/**
	 * The main handler called by registerCommand
	 * @param context Context passed by vscode
	 * @param args Additional args, usually containing files from multiselect
	 */
	handle(context: ExtensionCommandContext, args: any[]): Promise<void>;

	/**
	 * A handle to determine which files from the context will get passed to execute.
	 * @param contextFiles The files from the context
	 */
	filesHandle(contextFiles: string[]): Promise<string[] | undefined>
	
	/**
	 * A handle to determine which files from a given context directory will get passed to execute.
	 * @param contextDirectory A directory from the context
	 */
	directoryHandle(contextDirectory: string): Promise<string[] | undefined>;
	
	emptyHandle(): Promise<string[] | undefined>;
	
	initExecute(files: string[]): Promise<void>;

	execute(file: string, env: EnvironmentConfig): Promise<void>;
}

export async function init(hostCommand: HostCommand, context: ExtensionCommandContext, args: any[]): Promise<string[] | undefined> {
	const c = getFullContext(context, args);
	let files: string[] | undefined;

	if (c.mode === ContextMode.FILES) {
		files = await hostCommand.filesHandle(c.files);
	}
	else if (c.mode === ContextMode.DIRECTORY) {
		files = await hostCommand.directoryHandle(c.files[0]);
	}
	else {
		files = await hostCommand.emptyHandle();
	}
	if (!files || files.length === 0) return;

	hostCommand.initExecute(files);
}

export async function chooseWorkspaceThenPrompt(hostCommand: HostCommand): Promise<string[] | undefined> {
	let workspace = await workspaceQuickPick();
	if (!workspace) return;
	return hostCommand.directoryHandle(workspace.fsPath);
}

export async function promptOpenDialog(directory: string, openLabel: string) {
	let options = {
		defaultUri: vscode.Uri.file(directory),
		canSelectMany: true,
		openLabel: openLabel
	};
	let uris = await vscode.window.showOpenDialog(options)
	if (!uris) return;
	return uris.map(uri => uri.fsPath);
}

export async function upload(hostCommand: HostCommand, files: string[]) {
	for (let file of files) {
		let workspaceFile = new WorkspaceFile(file);
		let envs: EnvironmentConfig[];
		try {
			envs = await workspaceFile.environmentObjects;
		}
		catch (error) {
			console.log(error);
			return;
		}

		let env = await getCommandenvConfigQuickPick(envs, file);
		if (!env) return;
		let chosenEnv = env;
		await hostCommand.execute(file, env).catch(error => {
			logger.error(`${error} in ${chosenEnv.name}`);
		})
	}
}

export async function download(hostCommand: HostCommand, files: string[]) {
	let envMap: Map<EnvironmentConfig, string[]> = new Map();
	for (let file of files) {
		let workspaceFile = new WorkspaceFile(file);
		let envs: EnvironmentConfig[];
		try {
			envs = await workspaceFile.environmentObjects;
		}
		catch (error) {
			logger.error(error);
			return;
		}

		for (let env of envs) {
			let envFiles = envMap.get(env);
			if (!envFiles) envFiles = []
			envMap.set(env, envFiles.concat(file));
		}
	}

	envMap.forEach(async (files, env) => {
		for (let file of files) {
			await hostCommand.execute(file, env).catch(error => {
				logger.error(`${error} in ${env.name}`);
			})
		}
	})
}

export const enum ContextMode {
	FILES,
	DIRECTORY,
	EMPTY,
}


export interface ExtensionCommandContext {
	fsPath: string;
	dialog: boolean
}


export interface HostCommandContext {
	files: string[];
	mode: ContextMode;
}

export async function saveDocument(file: string) {
	await vscode.workspace.openTextDocument(file).then(doc => doc.save());
}

export function getFullContext(context: ExtensionCommandContext | undefined, args: ExtensionCommandContext[]): HostCommandContext {
	let files: string[] = [];
	let mode: ContextMode;
	let activeTextEditor = vscode.window.activeTextEditor;
	if (args && args.length > 1) {
		files = args.filter(a => fs.lstatSync(a.fsPath).isFile()).map(a => a.fsPath);
		let mode = ContextMode.FILES;
		return { files, mode };
	}
	if (context && context.dialog) {
		mode = ContextMode.EMPTY;
		return { files, mode };
	}
	if ((!context || !context.fsPath) && activeTextEditor) {
		files = [activeTextEditor.document.fileName];
		mode = ContextMode.FILES;
		return { files, mode }
	}
	else if (!context) {
		mode = ContextMode.EMPTY;
		return { files, mode };
	}
	else {
		files = [context.fsPath];
		mode = fs.lstatSync(context.fsPath).isFile() ? ContextMode.FILES : ContextMode.DIRECTORY;
		return { files, mode };
	}
}

export async function executeWithProgress(message: string, task: () => Promise<any>) {
	return vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: message }, async () => {
		await task();
		return;
	})
}

export async function getConnection(env: EnvironmentConfig): Promise<MtmConnection> {
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

export async function getCommandenvConfigQuickPick(envs: EnvironmentConfig[], file: string): Promise<EnvironmentConfig | undefined> {
	let items: LaunchQuickPick[] = envs.map(env => {
		return { label: env.name, description: '', env: env };
	})
	if (items.length === 1) return items[0].env;
	let choice = await vscode.window.showQuickPick(items, { placeHolder: `Select environment to get ${path.basename(file)} from.`, ignoreFocusOut: true });
	if (!choice) return undefined;
	return choice.env
}

export async function promptUserForTable() {
	let inputOptions: vscode.InputBoxOptions = {
		prompt: 'Name of Table (no extension)',
		validateInput: (value: string) => {
			if (!value) return;
			if (value.includes('.')) return 'Do not include the extension';
		}
	};
	return vscode.window.showInputBox(inputOptions);
}

export const DIR_MAPPINGS: { [extension: string]: string } = {
	'BATCH': 'dataqwik/batch',
	'DAT': 'data',
	'FKY': 'dataqwik/foreign_key',
	'IDX': 'dataqwik/index',
	'JFD': 'dataqwik/journal',
	'm': 'routine',
	'PROC': 'dataqwik/procedure',
	'properties': 'property',
	'QRY': 'dataqwik/query',
	'RPT': 'dataqwik/report',
	'SCR': 'dataqwik/screen',
	'TABLE': 'dataqwik/table',
	'TRIG': 'dataqwik/trigger',
	'COL': '',
	'PPL': '',
	'PSL': '',
	'psl': '',
	'pslx': '',
	'pslxtra': '',
	'psql': '',
	'TBL': '',
}
