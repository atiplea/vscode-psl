import * as vscode from 'vscode';
import { UploadCommand, getConnection, executeWithProgress } from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class RunPSL extends UploadCommand {

	icon: string;
	command: string;

	constructor() {
		super();
		this.icon = UploadCommand.icons.RUN;
		this.command = 'psl.runPSL';
	}

	async dirHandle(directory: string) {
		let options = {
			defaultUri: vscode.Uri.file(directory),
			canSelectMany: true,
			openLabel: 'Run PSL'
		};
		let uris = await vscode.window.showOpenDialog(options)
		if (!uris) return;
		return uris.map(uri => uri.fsPath);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await executeWithProgress(`${path.basename(file)} RUN`, async () => {
			await this.saveDocument(file);
			this.logWait(`${path.basename(file)} RUN in ${env.name}`);
			let connection = await getConnection(env);
			let output = await connection.run(file);
			connection.close();
			this.logSuccess(`${path.basename(file)} RUN in ${env.name} succeeded\n${output.trim()}`);
		});
	}
}