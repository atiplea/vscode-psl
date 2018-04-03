import * as vscode from 'vscode';
import * as hc from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as environment from '../common/environment';
import { extensionToDescription } from '../mtm/utils';

export class Get implements hc.HostCommand {

	icon: string;
	command: string;

	constructor() {
		this.icon = hc.icons.GET;
		this.command = 'psl.getElement';
	}

	async handle(context: hc.ExtensionCommandContext, args: any[]): Promise<void> {
		hc.init(this, context, args);
	}

	async filesHandle(contextFiles: string[]) {
		let workspace: vscode.WorkspaceFolder | undefined;
		if (contextFiles.length === 1) {
			workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(contextFiles[0]));
			if (!workspace) return;
		}
		else {
			return this.emptyHandle();
		}
		return this.getFileFromPrompt(workspace.uri.fsPath)
	}

	async directoryHandle(contextDirectory: string) {
		let input = await promptUserForComponent();
		if (!input) return;
		return [path.join(contextDirectory, input)];
	}

	async emptyHandle() {
		let chosenWorkspace = await environment.workspaceQuickPick();
		if (!chosenWorkspace) return;
		return this.getFileFromPrompt(chosenWorkspace.fsPath);
	}

	async initExecute(files: string[]): Promise<void> {
		hc.download(this, files);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} GET`, async () => {
			hc.logger.info(`${path.basename(file)} GET from ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.get(file);
			connection.close();
			await fs.ensureFile(file);
			await fs.writeFile(file, output);
			hc.logger.info(`${path.basename(file)} GET from ${env.name} succeeded`);
			await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
		});
	}

	async getFileFromPrompt(workspaceDirectory: string) {
		let input = await promptUserForComponent();
		if (!input) return;
		let extension = path.extname(input).replace('.', '');
		let description = extensionToDescription[extension]
		let filters: { [name: string]: string[] } = {}
		filters[description] = [extension]
		let target
		let defaultLocation: string | undefined = hc.DIR_MAPPINGS[extension];
		if (defaultLocation) {
			target = { fsPath: path.join(workspaceDirectory, defaultLocation, input) }
		}
		else {
			let defaultUri = vscode.Uri.file(path.join(workspaceDirectory, input))
			target = await vscode.window.showSaveDialog({ defaultUri, filters: filters });
		}
		if (!target) return;
		return [target.fsPath];

	}
}

async function promptUserForComponent() {
	let inputOptions: vscode.InputBoxOptions = {
		prompt: 'Name of Component (with extension)', validateInput: (input: string) => {
			if (!input) return;
			let extension = path.extname(input) ? path.extname(input).replace('.', '') : 'No extension'
			if (extension in extensionToDescription) return '';
			return `Invalid extension (${extension})`;
		}
	};
	return vscode.window.showInputBox(inputOptions);
}