import * as vscode from 'vscode';
import { DownloadCommand, getConnection, executeWithProgress } from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as environment from '../common/environment';

export class Refresh extends DownloadCommand {

	icon: string;
	command: string;

	constructor() {
		super();
		this.icon = DownloadCommand.icons.REFRESH;
		this.command = 'psl.refreshElement';
	}

	async dirHandle(directory: string) {
		let options = {
			defaultUri: vscode.Uri.file(directory),
			canSelectMany: true,
			openLabel: 'Refresh'
		};
		let uris = await vscode.window.showOpenDialog(options)
		if (!uris) return;
		return uris.map(uri => uri.fsPath);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await executeWithProgress(`${path.basename(file)} REFRESH`, async () => {
			await this.saveDocument(file);
			this.logWait(`${path.basename(file)} REFRESH from ${env.name}`);
			let connection = await getConnection(env);
			let output = await connection.get(file);
			connection.close();
			await fs.writeFile(file, output);
			await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
			this.logSuccess(`${path.basename(file)} REFRESH from ${env.name} succeeded`);
		});
	}
}