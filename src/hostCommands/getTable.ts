import * as vscode from 'vscode';
import * as hc from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as environment from '../common/environment';

export class GetTable implements hc.HostCommand {

	icon: string;
	command: string;

	tableName: string;
	commandVerb: string;

	constructor() {
		this.icon = hc.icons.GET;
		this.command = 'psl.getTable';
		this.commandVerb = 'GET';
		// TODO this is problematic
		this.tableName = '';
	}

	async handle(context: hc.ExtensionCommandContext, args: any[]): Promise<void> {
		this.tableName = '';
		hc.init(this, context, args);
	}

	async filesHandle(_contextFiles: string[]) {
		/**
		 * This file handle should always act like the emptyHandle, and thus ignores contextFiles (as denoted by the _)
		 */
		return this.emptyHandle();
	}


	async directoryHandle(contextDirectory: string) {
		let tableName = await this.promptUserForTable();
		if (!tableName) return;
		this.tableName = tableName;
		return [path.join(contextDirectory, tableName.toLowerCase())];
	}

	async emptyHandle() {
		let chosenWorkspace = await environment.workspaceQuickPick();
		if (!chosenWorkspace) return;
		return this.getFileFromPrompt(chosenWorkspace.fsPath);
	}

	async initExecute(files: string[]) {
		hc.download(this, files);
	}

	async execute(targetDirectory: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${this.tableName} ${this.commandVerb}`, async () => {
			hc.logger.info(`${this.tableName} TABLE ${this.commandVerb} from ${env.name}`);
			let connection = await hc.getConnection(env);
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
			hc.logger.info(`${this.tableName} TABLE ${this.commandVerb} from ${env.name} succeeded`);
		});
	}

	async getFileFromPrompt(workspaceDirectory: string) {
		let tableName = await this.promptUserForTable();
		if (!tableName) return;
		this.tableName = tableName;
		let target: string;
		let tableDir = hc.DIR_MAPPINGS['TABLE'];
		if (tableDir) {
			target = path.join(workspaceDirectory, tableDir, tableName.toLowerCase());
		}
		else {
			let uris = await vscode.window.showOpenDialog({ defaultUri: vscode.Uri.file(workspaceDirectory), canSelectFiles: false, canSelectFolders: true, canSelectMany: false, filters: { 'Table Directory': [] } });
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
}