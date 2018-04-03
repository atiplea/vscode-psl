import * as vscode from 'vscode';
import * as hc from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as environment from '../common/environment';

export class Refresh implements hc.HostCommand {

	icon: string;
	command: string;

	constructor() {
		this.icon = hc.icons.REFRESH;
		this.command = 'psl.refreshElement';
	}
	
	async handle(context: hc.ExtensionCommandContext, args: any[]): Promise<void> {
		hc.init(this, context, args);
	}

	async filesHandle(contextFiles: string[]): Promise<string[]> {
		return contextFiles;
	}

	async directoryHandle(contextDirectory: string) {
		return hc.promptOpenDialog(contextDirectory, 'Refresh');
	}

	async emptyHandle(): Promise<string[] | undefined> {
		return hc.chooseWorkspaceThenPrompt(this);
	}

	async initExecute(files: string[]): Promise<void> {
		hc.download(this, files);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} REFRESH`, async () => {
			await hc.saveDocument(file);
			hc.logger.info(`${path.basename(file)} REFRESH from ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.get(file);
			connection.close();
			await fs.writeFile(file, output);
			await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
			hc.logger.info(`${path.basename(file)} REFRESH from ${env.name} succeeded`);
		});
	}
}