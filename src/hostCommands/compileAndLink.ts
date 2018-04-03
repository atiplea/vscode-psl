import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class CompileAndLink extends hc.UploadCommand {


	command: string;
	icon: string;
	dialogLabel: string;

	constructor() {
		super();
		this.command = 'psl.compileAndLink';
		this.icon = hc.icons.LINK;
		this.dialogLabel = 'Compile and Link';
	 }

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} COMPILE AND LINK`, async () => {
			await hc.saveDocument(file);
			this.logWait(`${path.basename(file)} COMPILE AND LINK in ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.complink(file);
			connection.close();
			this.logSuccess(`${path.basename(file)} COMPILE AND LINK in ${env.name} succeeded\n${output.trim()}`);
		});
	}
}