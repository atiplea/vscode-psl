import {Send} from './send';
import { icons } from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';

export class SendTable extends Send {

	icon: string;
	command: string;
	dialogLabel: string;

	constructor() {
		super();
		this.icon = icons.SEND;
		this.command = 'psl.sendTable';
		this.dialogLabel = 'Send Table';
	}

	async filesHandle(files: string[]) {
		let returnFiles: string[] = [];
		let directories = new Set(files.map(f => path.dirname(f)));
		for (let tableDirectory of directories) {
			let tableName = path.basename(tableDirectory);
			let tableFiles = await fs.readdir(tableDirectory)
			let sortedFiles = tableFiles.filter(f => f.startsWith(tableName.toUpperCase())).sort(this.tableFirst).map(f => path.join(tableDirectory, f));
			returnFiles = returnFiles.concat(sortedFiles);
		}
		return returnFiles;
	}
}