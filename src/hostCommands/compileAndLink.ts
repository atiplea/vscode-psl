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

	async filesHandle(contextFiles: string[]): Promise<string[]> {
		let tableFiles: string[] = [];
		let rest = contextFiles.filter(file => {
			if (path.extname(file) === '.COL') {
				let tableName = path.basename(file).split('.COL')[0].split('-')[0];
				let tableFileName = path.join(path.dirname(file), tableName + '.TBL');
				if (tableFiles.indexOf(tableFileName) < 0) {
					tableFiles.push(tableFileName);
				}
				return undefined;
			}
			else if (path.extname(file) === '.TBL') {
				if (tableFiles.indexOf(file) < 0) {
					tableFiles.push(file);
				}
				return undefined;
			}
			return file;
		})
		return rest.concat(tableFiles);
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} COMPILE AND LINK`, async () => {
			await hc.saveDocument(file);
			this.logWait(`${path.basename(file)} COMPILE AND LINK in ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.complink(file);
			connection.close();
			this.logSuccess(`${path.basename(file)} COMPILE AND LINK in ${env.name} succeeded` + ('\n' + output).split('\n').join('\n' + ' '.repeat(20)))
		});
	}
}