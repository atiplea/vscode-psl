import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class RunPSL extends hc.UploadCommand {

	icon: string;
	command: string;
	dialogLabel: string;

	constructor() {
		super();
		this.icon = hc.icons.RUN;
		this.command = 'psl.runPSL';
		this.dialogLabel = 'Run PSL';
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