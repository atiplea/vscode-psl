import * as vscode from 'vscode';
import * as hc from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as environment from '../common/environment';

export class Refresh extends hc.DownloadCommand {

	icon: string;
	command: string;
	dialogLabel: string;

	constructor() {
		super();
		this.icon = hc.icons.REFRESH;
		this.command = 'psl.refreshElement';
		this.dialogLabel = 'Refresh';
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} REFRESH`, async () => {
			await hc.saveDocument(file);
			this.logWait(`${path.basename(file)} REFRESH from ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.get(file);
			connection.close();
			await fs.writeFile(file, output);
			await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
			this.logSuccess(`${path.basename(file)} REFRESH from ${env.name} succeeded`);
		});
	}
}