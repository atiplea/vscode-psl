import * as vscode from 'vscode';
import { HostCommand, CommandResult, getConnection, executeWithProgress, EnvType } from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as environment from '../common/environment';

export class Get extends HostCommand {

	static readonly COMMAND = 'psl.getElement';

	envType: EnvType;
	icon: string;

	constructor() {
		super();
		this.envType = EnvType.Single;
		this.icon = HostCommand.icons.GET;
	}

	async dirHandle(directory: string): Promise<string[]> | undefined {
		let options = {
			defaultUri: vscode.Uri.file(directory),
			canSelectMany: true,
			openLabel: 'Get'
		};
		let uris = await vscode.window.showOpenDialog(options)
		if (!uris) return;
		return uris.map(uri => uri.fsPath);
	}

	async execute(file: string, env: environment.EnvironmentConfig): Promise<CommandResult[]> {
		let results: CommandResult[];
		await executeWithProgress(`${path.basename(file)} GET`, async () => {
			this.logWait(`${path.basename(file)} GET from ${env.name}`);
			let connection = await getConnection(env);
			let output = await connection.get(file);
			await fs.writeFile(file, output);
			this.logSuccess(`${path.basename(file)} GET from ${env.name} succeeded`);
			connection.close();
			await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
		});
		return results;
	}
}