import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
export { extensionToDescription } from '../mtm/utils';
import { LaunchQuickPick, WorkspaceFile, workspaceQuickPick, EnvironmentConfig } from '../common/environment';
import { MtmConnection } from '../mtm/mtm';

export abstract class HostCommand {

	protected static outputChannel = vscode.window.createOutputChannel('Profile Host');

	private static logger = {
		info: (message: string) => {
			HostCommand.outputChannel.show();
			HostCommand.outputChannel.appendLine(`[INFO][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`)
		},
		error: (message: string) => {
			HostCommand.outputChannel.show();
			HostCommand.outputChannel.appendLine(`[ERR!][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`)
		}
	}

	protected static icons = {
		ERROR: '✖',
		GET: '⇩',
		LINK: '🔗',
		REFRESH: '🔃',
		RUN: '▶',
		SEND: '⇧',
		SUCCESS: '✔',
		TEST: '⚙',
		WAIT: '…',
		WARN: '⚠',
	}

	protected abstract icon: string;
	protected abstract command: string;

	protected async abstract execute(file: string, env: EnvironmentConfig): Promise<CommandResult[]>;

	protected logWait(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.WAIT} ${this.icon} ${message}`);
	}

	protected logSuccess(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.SUCCESS} ${this.icon} ${message}`);
	}

	protected logWarn(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.WARN} ${this.icon} ${message}`);
	}

	protected logError(message: string) {
		HostCommand.logger.error(`${HostCommand.icons.ERROR} ${this.icon} ${message}`);
	}

	protected async saveDocument(file: string) {
		await vscode.workspace.openTextDocument(file).then(doc => doc.save());
	}

	protected async filesHandle(files: string[]): Promise<string[] | undefined> {
		return files;
	}

	protected async abstract dirHandle(directory: string): Promise<string[]> | undefined;

	protected async emptyHandle(): Promise<string[]> | undefined {
		let workspace = await workspaceQuickPick();
		if (!workspace) return;
		return this.dirHandle(workspace.fsPath);
	}

	abstract passToExecute(files: string[]);

	public async handle(context: ExtensionCommandContext, args: any[]) {
		const c = getFullContext(context, args);
		let files: string[];

		if (c.mode === ContextMode.FILES) {
			files = await this.filesHandle(c.files);
		}
		else if (c.mode === ContextMode.DIRECTORY) {
			files = await this.dirHandle(c.files[0]);
		}
		else {
			files = await this.emptyHandle();
		}
		if (!files || files.length === 0) return;

		this.passToExecute(files);
	}

}

export abstract class DownloadCommand extends HostCommand {

	async passToExecute(files: string[]) {
		for (let file of files) {
			let workspaceFile = new WorkspaceFile(file);
			let envs: EnvironmentConfig[];
			try {
				envs = await workspaceFile.environmentObjects;
			}
			catch (error) {
				console.log(error);
			}

			let env = await getCommandenvConfigQuickPick(envs, file);
			if (!env) return;
			this.execute(file, env).catch(error => {
				this.logError(`${error} in ${env.name}`);
			})
		}
	}
}



export abstract class UploadCommand extends HostCommand {

	async passToExecute(files: string[]) {
		let envMap: Map<EnvironmentConfig, string[]> = new Map();
		for (let file of files) {
			let workspaceFile = new WorkspaceFile(file);
			let envs: EnvironmentConfig[];
			try {
				envs = await workspaceFile.environmentObjects;
			}
			catch (error) {
				this.logError(error);
			}

			for (let env of envs) {
				let envFiles = envMap.get(env);
				if (!envFiles) envFiles = []
				envMap.set(env, envFiles.concat(file));
			}
		}

		envMap.forEach(async (files, env) => {
			for (let file of files) {
				await this.execute(file, env).catch(error => {
					this.logError(`${error} in ${env.name}`);
				})
			}
		})
	}
}

export interface CommandResult {
	environment: string,
	message: string,
	type: string
}


export const enum ContextMode {
	FILES = 1,
	DIRECTORY = 2,
	EMPTY = 3
}


export interface ExtensionCommandContext {
	fsPath: string;
	dialog: boolean
}


export interface HostCommandContext {
	files: string[];
	mode: ContextMode;
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

export const DIR_MAPPINGS = {
	'BATCH': 'dataqwik/batch',
	'COL': '',
	'DAT': 'data',
	'FKY': 'dataqwik/foreign_key',
	// 'G': 'Global',
	'IDX': 'dataqwik/index',
	'JFD': 'dataqwik/journal',
	'm': 'routine',
	'PPL': '',
	'PROC': 'dataqwik/procedure',
	'properties': 'property',
	'PSL': '',
	'psl': '',
	'pslx': '',
	'pslxtra': '',
	'psql': '',
	'QRY': 'dataqwik/query',
	'RPT': 'dataqwik/report',
	'SCR': 'dataqwik/screen',
	'TABLE': 'dataqwik/table',
	'TBL': '',
	'TRIG': 'dataqwik/trigger',
}
