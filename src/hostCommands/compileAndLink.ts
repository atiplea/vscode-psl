import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class CompileAndLink extends hc.UploadCommand {

	icon: string;
	command: string;
	dialogLabel: string;

	constructor() {
		super();
		this.icon = hc.icons.LINK;
		this.command = 'psl.compileAndLink';
		this.dialogLabel = 'Compile and Link';
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