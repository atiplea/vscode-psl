import * as vscode from 'vscode';
import { UploadCommand, CommandResult, getConnection, executeWithProgress } from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class Send extends UploadCommand {

	icon: string;
	command: string;

	constructor() {
		super();
		this.icon = UploadCommand.icons.SEND;
		this.command = 'psl.sendElement';
	}

	async dirHandle(directory: string): Promise<string[]> | undefined {
		let options = {
			defaultUri: vscode.Uri.file(directory),
			canSelectMany: true,
			openLabel: 'Send'
		};
		let uris = await vscode.window.showOpenDialog(options)
		if (!uris) return;
		return uris.map(uri => uri.fsPath);
	}

	async execute(file: string, env: environment.EnvironmentConfig): Promise<CommandResult[]> {
		let results: CommandResult[];
		await executeWithProgress(`${path.basename(file)} SEND`, async () => {
			await this.saveDocument(file);
			this.logWait(`${path.basename(file)} SEND to ${env.name}`);
			let connection = await getConnection(env);
			await connection.send(file);
			connection.close();
			this.logSuccess(`${path.basename(file)} SEND to ${env.name} succeeded`);
		});
		return results;
	}
}