import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class CompileAndLink implements hc.HostCommand {

	icon: string;
	command: string;

	constructor() {
		this.icon = hc.icons.LINK;
		this.command = 'psl.compileAndLink';
	 }

	async handle(context: hc.ExtensionCommandContext, args: any[]): Promise<void> {
		hc.init(this, context, args);
	}

	async filesHandle(contextFiles: string[]): Promise<string[]> {
		return contextFiles;
	}

	async directoryHandle(contextDirectory: string): Promise<string[] | undefined> {
		return hc.promptOpenDialog(contextDirectory, 'Compile and Link');
	}

	async emptyHandle(): Promise<string[] | undefined> {
		return hc.chooseWorkspaceThenPrompt(this);
	}

	async initExecute(files: string[]): Promise<void> {
		hc.upload(this, files);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} COMPILE AND LINK`, async () => {
			await hc.saveDocument(file);
			hc.logger.info(`${path.basename(file)} COMPILE AND LINK in ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.complink(file);
			connection.close();
			hc.logger.info(`${path.basename(file)} COMPILE AND LINK in ${env.name} succeeded\n${output.trim()}`);
		});
	}
}