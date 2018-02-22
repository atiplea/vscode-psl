import * as vscode from 'vscode';
import { HostCommand, CommandResult, getConnection, executeWithProgress, EnvType } from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class RunPSL extends HostCommand {

	icon: string;
	envType: EnvType;
	command: string;

	constructor() {
		super();
		this.envType = EnvType.Mutli;
		this.icon = HostCommand.icons.RUN;
		this.command = 'psl.runPSL';
	}

	async dirHandle(directory: string): Promise<string[]> | undefined {
		let options = {
			defaultUri: vscode.Uri.file(directory),
			canSelectMany: true,
			openLabel: 'Run PSL'
		};
		let uris = await vscode.window.showOpenDialog(options)
		if (!uris) return;
		return uris.map(uri => uri.fsPath);
	}

	async execute(file: string, env: environment.EnvironmentConfig): Promise<CommandResult[]> {
		let results: CommandResult[];
		await executeWithProgress(`${path.basename(file)} RUN`, async () => {
			this.logWait(`${path.basename(file)} RUN in ${env.name}`);
			let connection = await getConnection(env);
			let output = await connection.run(file);
			connection.close();
			this.logSuccess(`${path.basename(file)} RUN in ${env.name} succeeded\n${output.trim()}`);
		});
		return results;
	}
}