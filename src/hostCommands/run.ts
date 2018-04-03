import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class RunPSL implements hc.HostCommand {

	icon: string;
	command: string;

	constructor() {
		this.icon = hc.icons.RUN;
		this.command = 'psl.runPSL';
	}

	async handle(context: hc.ExtensionCommandContext, args: any[]): Promise<void> {
		hc.init(this, context, args);
	}

	async filesHandle(contextFiles: string[]): Promise<string[]> {
		return contextFiles;
	}

	async directoryHandle(contextDirectory: string): Promise<string[] | undefined> {
		return hc.promptOpenDialog(contextDirectory, 'Run PSL');
	}

	async emptyHandle(): Promise<string[] | undefined> {
		return hc.chooseWorkspaceThenPrompt(this);
	}

	async initExecute(files: string[]): Promise<void> {
		hc.upload(this, files);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} RUN`, async () => {
			await hc.saveDocument(file);
			hc.logger.info(`${path.basename(file)} RUN in ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.run(file);
			connection.close();
			hc.logger.info(`${path.basename(file)} RUN in ${env.name} succeeded\n${output.trim()}`);
		});
	}
}