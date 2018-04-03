import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class Send implements hc.HostCommand {

	icon: string;
	command: string;

	constructor() {
		this.icon = hc.icons.SEND;
		this.command = 'psl.sendElement';
	}

	async handle(context: hc.ExtensionCommandContext, args: any[]): Promise<void> {
		hc.init(this, context, args);
	}

	async filesHandle(contextFiles: string[]): Promise<string[]> {
		return contextFiles;
	}
	async directoryHandle(contextDirectory: string) {
		return hc.promptOpenDialog(contextDirectory, 'Send');
	}
	async emptyHandle(): Promise<string[] | undefined> {
		return hc.chooseWorkspaceThenPrompt(this);
	}

	async initExecute(files: string[]): Promise<void> {
		hc.upload(this, files);
	}
	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} SEND`, async () => {
			await hc.saveDocument(file);
			hc.logger.info(`${path.basename(file)} SEND to ${env.name}`);
			let connection = await hc.getConnection(env);
			await connection.send(file);
			connection.close();
			hc.logger.info(`${path.basename(file)} SEND to ${env.name} succeeded`);
		});
	}
}