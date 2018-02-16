import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
export { extensionToDescription } from '../mtm/utils';
import { LaunchQuickPick, WorkspaceFile, workspaceQuickPick, EnvironmentConfig } from '../common/environment';
import { MtmConnection } from '../mtm/mtm';

export enum EnvType {
	Single = 1,
	Mutli = 2,
}

export abstract class HostCommand {

	static outputChannel = vscode.window.createOutputChannel('Profile Host');

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

	logWait(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.WAIT} ${this.icon} ${message}`);
	}

	logSuccess(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.SUCCESS} ${this.icon} ${message}`);
	}

	logWarn(message: string) {
		HostCommand.logger.info(`${HostCommand.icons.WARN} ${this.icon} ${message}`);
	}

	logError(message: string) {
		HostCommand.logger.error(`${HostCommand.icons.ERROR} ${this.icon} ${message}`);
	}


	async handle(context: ExtensionCommandContext, args: any[]) {
		const c = getFullContext(context, args);
		let files: string[];

		if (c.mode === ContextMode.FILES) {
			files = c.files;
		}
		else if (c.mode === ContextMode.DIRECTORY) {
			files = await this.dirHandle(c.files[0]);
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

			if (this.envType === EnvType.Single) {
				let env = await getCommandenvConfigQuickPick(envs, file);
				if (!env) return;
				this.execute(file, env).catch(error => {
					this.logError(`${error} in ${env.name}`);
				})
			}
			else if (this.envType === EnvType.Mutli) {
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
	if (args) {
		files = args.filter(a => fs.lstatSync(a.fsPath).isFile()).map(a => a.fsPath);
		let mode = ContextMode.FILES;
		return {files, mode};
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
	let choice = await vscode.window.showQuickPick(items, { placeHolder: `Select environment to get ${path.basename(file)} from.`, ignoreFocusOut: true});
	if (!choice) return undefined;
	return choice.env
}