import * as vscode from 'vscode';
import { HostCommand, CommandResult, getConnection, executeWithProgress, EnvType } from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as environment from '../common/environment';

export class Refresh extends HostCommand {

	static readonly COMMAND = 'psl.refreshElement';

	envType = EnvType.Single;
	icon: string = HostCommand.icons.REFRESH;

	async dirHandle(directory: string): Promise<string[]> | undefined {
		let options = {
			defaultUri: vscode.Uri.file(directory),
			canSelectMany: true,
			openLabel: 'Refresh'
		};
		let uris = await vscode.window.showOpenDialog(options)
		if (!uris) return;
		return uris.map(uri => uri.fsPath);
	}

	async execute(file: string, env: environment.EnvironmentConfig): Promise<CommandResult[]> {
		let results: CommandResult[];
		await executeWithProgress(`${path.basename(file)} RUN`, async () => {
			HostCommand.logger.info(`${HostCommand.icons.WAIT} ${this.icon} ${path.basename(file)} REFRESH from ${env.name}`);
			let connection = await getConnection(env);
			let output = await connection.get(file);
			await fs.writeFile(file, output);
			HostCommand.logger.info(`${HostCommand.icons.WAIT} ${this.icon} ${path.basename(file)} REFRESH from ${env.name} succeeded`);
			connection.close();
			let doc = await vscode.workspace.openTextDocument(file);
			await vscode.window.showTextDocument(doc);
		});
		return results;
	}
}