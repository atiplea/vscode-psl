import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
export { extensionToDescription } from '../mtm/utils';
import { LaunchQuickPick, WorkspaceFile, workspaceQuickPick, EnvironmentConfig } from '../common/environment';
import { MtmConnection } from '../mtm/mtm';

const outputChannel = vscode.window.createOutputChannel('Profile Host');

const logger = {
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

export abstract class HostCommand {

	abstract command: string;
	abstract icon: string;
	abstract dialogLabel: string;


	protected logWait(message: string) {
		logger.info(`${icons.WAIT} ${this.icon} ${message}`);
	}

	protected logSuccess(message: string) {
		logger.info(`${icons.SUCCESS} ${this.icon} ${message}`);
	}

	protected logWarn(message: string) {
		logger.info(`${icons.WARN} ${this.icon} ${message}`);
	}

	protected logError(message: string) {
		logger.error(`${icons.ERROR} ${this.icon} ${message}`);
	}

	async handle(context: ExtensionCommandContext, args: any[]): Promise<string[] | undefined> {
		const c = getFullContext(context, args);
		let files: string[] | undefined;

		if (c.mode === ContextMode.FILES) {
			files = await this.filesHandle(c.files);
		}
		else if (c.mode === ContextMode.DIRECTORY) {
			files = await this.directoryHandle(c.files[0]);
		}
		else {
			files = await this.emptyHandle();
		}
		if (!files || files.length === 0) return;

		this.initExecute(files);
	}

	/**
	 * A handle to determine which files from the context will get passed to execute.
	 * @param contextFiles The files from the context
	 */
	async filesHandle(contextFiles: string[]): Promise<string[] | undefined> {
		return contextFiles;
	}

	/**
	 * A handle to determine which files from a given context directory will get passed to execute.
	 * @param contextDirectory A directory from the context
	 */
	async directoryHandle(contextDirectory: string): Promise<string[] | undefined> {
		let files = await promptOpenDialog(contextDirectory, this.dialogLabel);
		if (!files) return;
		if (files.length > 0) return this.filesHandle(files);
	}

	/**
	 * A handle to determine which files from no context will get passed to execute.
	 */
	async emptyHandle(): Promise<string[] | undefined> {
		return chooseWorkspaceThenPrompt(this);
	}

	/**
	 * The main engine for the excecute method that will collect environment information.
	 * @param files
	 */
	abstract initExecute(files: string[]): Promise<void>;

	/**
	 * The execution that occurs for every individual HostCommand.
	 * @param file The file being executed
	 * @param env The target environment
	 */
	abstract execute(file: string, env: EnvironmentConfig): Promise<void>;
}

export abstract class UploadCommand extends HostCommand {

	async initExecute(files: string[]): Promise<void> {
		for (let file of files) {
			let workspaceFile = new WorkspaceFile(file);
			let envs: EnvironmentConfig[];
			try {
				envs = await workspaceFile.environmentObjects;
			}
			catch (error) {
				this.logError(error);
				return;
			}

			let env = await getCommandenvConfigQuickPick(envs, file);
			if (!env) return;
			let chosenEnv = env;
			await this.execute(file, env).catch(error => {
				logger.error(`${error} in ${chosenEnv.name}`);
			})
		}
	}

	abstract execute(file: string, env: EnvironmentConfig): Promise<void>;
}

export abstract class DownloadCommand extends HostCommand {

	async initExecute(files: string[]): Promise<void> {
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
			await this.execute(file, env).catch(error => {
				logger.error(`${error} in ${chosenEnv.name}`);
			})
		}
	}

	abstract execute(file: string, env: EnvironmentConfig): Promise<void>;
}


export abstract class TableCommand extends DownloadCommand {

	abstract tableName: string;
	abstract commandVerb: string;

	abstract filesHandle(contextFiles: string[]): Promise<string[] | undefined>;

	abstract directoryHandle(contextDirectory: string): Promise<string[] | undefined>;

	async emptyHandle() {
		let chosenWorkspace = await workspaceQuickPick();
		if (!chosenWorkspace) return;
		let tableName = await this.promptUserForTable();
		if (!tableName) return;
		this.tableName = tableName;
		let target: string;
		let tableDir = DIR_MAPPINGS['TABLE'];
		if (tableDir) {
			target = path.join(chosenWorkspace.fsPath, tableDir, tableName.toLowerCase());
		}
		else {
			let uris = await vscode.window.showOpenDialog({ defaultUri: vscode.Uri.file(chosenWorkspace.fsPath), canSelectFiles: false, canSelectFolders: true, canSelectMany: false, filters: { 'Table Directory': [] } });
			if (!uris) return;
			target = path.join(uris[0].fsPath, tableDir.toLowerCase());
		}
		return [target];
	}

	async promptUserForTable() {
		let inputOptions: vscode.InputBoxOptions = {
			prompt: 'Name of Table (no extension)',
			validateInput: (value: string) => {
				if (!value) return;
				if (value.includes('.')) return 'Do not include the extension';
			}
		};
		return vscode.window.showInputBox(inputOptions);
	}

	async execute(targetDirectory: string, env: EnvironmentConfig) {
		await executeWithProgress(`${this.tableName} ${this.commandVerb}`, async () => {
			logger.info(`${this.tableName} TABLE ${this.commandVerb} from ${env.name}`);
			let connection = await getConnection(env);
			let output = await connection.getTable(this.tableName.toUpperCase() + '.TBL');
			connection.close();
			await fs.ensureDir(targetDirectory);
			let tableFiles = (await fs.readdir(targetDirectory)).filter(f => f.startsWith(this.tableName)).map(f => path.join(targetDirectory, f));
			await Promise.all(tableFiles.map(f => fs.remove(f)));
			output.split(String.fromCharCode(0)).forEach((content: string) => {
				let contentArray = content.split(String.fromCharCode(1))
				let fileName = contentArray[0];
				let fileContent = contentArray[1];
				fs.writeFile(path.join(targetDirectory, fileName), fileContent);
			})
			logger.info(`${this.tableName} TABLE ${this.commandVerb} from ${env.name} succeeded`);
		});
	}
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
