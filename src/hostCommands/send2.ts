import * as vscode from 'vscode';
import { HostCommand, CommandResult, getConnection, executeWithProgress, EnvType } from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class Send extends HostCommand {
	
	static readonly COMMAND = 'psl.sendElement';

	envType: EnvType;
	icon: string;

	constructor() {
		super();
		this.envType = EnvType.Mutli;
		this.icon = HostCommand.icons.SEND;
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
			this.logWait(`${path.basename(file)} SEND to ${env.name}`);
			let connection = await getConnection(env);
			await connection.send(file);
			connection.close();
			this.logSuccess(`${path.basename(file)} SEND to ${env.name} succeeded`);
		});
		return results;
	}
}