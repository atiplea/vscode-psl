import * as vscode from 'vscode';
import { HostCommand, CommandResult, getConnection, executeWithProgress, EnvType } from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class RunPSL extends HostCommand {

	envType = EnvType.Mutli;
	icon: string = HostCommand.icons.RUN;

	static readonly COMMAND = 'psl.runPSL';

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
			HostCommand.logger.info(`${HostCommand.icons.WAIT} ${this.icon} ${path.basename(file)} RUN in ${env.name}`);
			let connection = await getConnection(env);
			let output = await connection.run(file);
			connection.close();
			HostCommand.logger.info(output.trim());
		});
		return results;
	}
}