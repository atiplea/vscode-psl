import * as vscode from 'vscode';
import {Send} from './send';
import { UploadCommand } from './hostCommand';
import * as path from 'path';
import * as fs from 'fs-extra';

export class SendTable extends Send {

	icon: string;
	command: string;

	constructor() {
		super();
		this.icon = UploadCommand.icons.SEND;
		this.command = 'psl.sendTable';
	}

	async filesHandle(files: string[]) {
		let returnFiles: string[] = [];
		let directories = new Set(files.map(f => path.dirname(f)));
		for (let tableDirectory of directories) {
			let tableName = path.basename(tableDirectory);
			let tableFiles = await fs.readdir(tableDirectory)
			let sortedFiles = tableFiles.filter(f => f.startsWith(tableName)).sort(tableFirst);
			let resp = await vscode.window.showInformationMessage(`Send ${sortedFiles.length} elements of ${tableName}?`, { modal: true }, 'Yes');
			if (resp !== 'Yes') continue;
			returnFiles = returnFiles.concat(sortedFiles);
		}
		return returnFiles;
	}

	async dirHandle(): Promise<string[]> | undefined {
		return;
	}

	async emptyHandle(): Promise<string[]> | undefined {
		return;
	}
}

function tableFirst(a: string, b: string) {
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