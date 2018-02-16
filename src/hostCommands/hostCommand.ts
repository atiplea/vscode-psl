import * as vscode from 'vscode';
import * as fs from 'fs-extra';
export { extensionToDescription } from '../mtm/utils';
import { LaunchQuickPick, WorkspaceFile, workspaceQuickPick, EnvironmentConfig } from '../common/environment';
import { MtmConnection } from '../mtm/mtm';

export enum EnvType {
	Single = 1,
	Mutli = 2,
}

export abstract class HostCommand {

	static outputChannel = vscode.window.createOutputChannel('Profile Host');

	static logger = {
		info: (message: string) => {
			HostCommand.outputChannel.show();
			HostCommand.outputChannel.appendLine(`[INFO][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`)
		},
		error: (message: string) => {
			HostCommand.outputChannel.show();
			HostCommand.outputChannel.appendLine(`[ERR!][${new Date().toTimeString().split(' ')[0]}]    ${message.trim()}\n`)
		}
	}

	static icons = {
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

	abstract icon: string;

	abstract envType: EnvType;

	async abstract dirHandle(directory: string): Promise<string[]> | undefined;

	async abstract execute(file: string, env: EnvironmentConfig): Promise<CommandResult[]>;

	logError(message: string) {
		HostCommand.logger.error(`${HostCommand.icons.ERROR} ${this.icon} ${message}`);
	}

	logSuccess(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.SUCCESS} ${this.icon} ${message}`);
	}

	logWarn(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.WARN} ${this.icon} ${message}`);
	}

	async handle(context: ExtensionCommandContext, args: any[]) {
		const c = getFullContext(context, args);
		let files: string[];

		if (c.mode === ContextMode.FILE) {
			files = [c.fsPath];
		}
		else if (c.mode === ContextMode.DIRECTORY) {
			files = await this.dirHandle(c.fsPath);
			if (!files || files.length === 0) return;
		}
		else {
			let workspace = await workspaceQuickPick();
			if (!workspace) return;
			files = await this.dirHandle(workspace.fsPath)
		}

		for (let file of files) {
			if (!fs.statSync(file).isFile()) return;
			await vscode.workspace.openTextDocument(file).then(doc => doc.save());
			let workspaceFile = new WorkspaceFile(file);
			let envs: EnvironmentConfig[];
			try {
				envs = await workspaceFile.environmentObjects;
			}
			catch (error) {
				console.log(error);
			}
			if (this.envType = EnvType.Single) {
				let env = await getCommandenvConfigQuickPick(envs);
				if (!env) return;
				this.execute(file, env).catch(error => {
					this.logError(`${error} in ${env.name}`);
				})
			}
			else if (this.envType = EnvType.Mutli) {
				let promises = [];
				for (let env of envs) {
					promises.push(this.execute(file, env).catch(error => {
						this.logError(`${error} in ${env.name}`);
					}));
				}
				await Promise.all(promises);
			}
		}
	}

}

export interface CommandResult {
	environment: string,
	message: string,
	type: string
}


export const enum ContextMode {
	FILE = 1,
	DIRECTORY = 2,
	EMPTY = 3
}


export interface ExtensionCommandContext {
	fsPath: string;
	dialog: boolean
}


export interface HostCommandContext {
	fsPath: string;
	mode: ContextMode;
}


export function getFullContext(context: ExtensionCommandContext | undefined, args: any[]): HostCommandContext {
	let fsPath: string = '';
	let mode: ContextMode;
	let activeTextEditor = vscode.window.activeTextEditor;
	if (context && context.dialog) {
		mode = ContextMode.EMPTY;
		return { fsPath, mode };
	}
	if ((!context || !context.fsPath) && activeTextEditor) {
		fsPath = activeTextEditor.document.fileName;
		mode = ContextMode.FILE;
		return { fsPath, mode }
	}
	else if (!context) {
		mode = ContextMode.EMPTY;
		return { fsPath, mode };
	}
	else {
		fsPath = context.fsPath;
		mode = fs.lstatSync(fsPath).isFile() ? ContextMode.FILE : ContextMode.DIRECTORY;
		return { fsPath, mode };
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

export async function getCommandenvConfigQuickPick(envs: EnvironmentConfig[]): Promise<EnvironmentConfig | undefined> {
	let items: LaunchQuickPick[] = envs.map(env => {
		return { label: env.name, description: '', env: env };
	})
	if (items.length === 1) return items[0].env;
	let choice = await vscode.window.showQuickPick(items, { placeHolder: 'Select environment to get from.' });
	if (!choice) return undefined;
	return choice.env
}