import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class Send extends hc.UploadCommand {

	icon: string;
	command: string;
	dialogLabel: string;

	constructor() {
		super();
		this.icon = hc.icons.SEND;
		this.command = 'psl.sendElement';
		this.dialogLabel = 'Send';
	}

	async filesHandle(contextFiles: string[]) {
		return contextFiles.sort(this.tableFirst);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} SEND`, async () => {
			await hc.saveDocument(file);
			this.logWait(`${path.basename(file)} SEND to ${env.name}`);
			let connection = await hc.getConnection(env);
			await connection.send(file);
			connection.close();
			this.logSuccess(`${path.basename(file)} SEND to ${env.name} succeeded`);
		});
	}


	tableFirst(a: string, b: string) {
		let aIsTable = a.endsWith('.TBL');
		let bIsTable = b.endsWith('.TBL');
		if (aIsTable && !bIsTable) {
			return -1;
		}
		else if (bIsTable && !aIsTable) {
			return 1;
		}
		return a.localeCompare(b);
	}
}