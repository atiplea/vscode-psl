import * as hc from './hostCommand';
import * as path from 'path';

export class GetTable extends hc.TableCommand {

	icon: string;
	command: string;
	dialogLabel: string;
	tableName: string;
	commandVerb: string;

	constructor() {
		super();
		this.icon = hc.icons.GET;
		this.command = 'psl.getTable';
		this.dialogLabel = 'Save Table';
		this.tableName = '';
		this.commandVerb = 'GET';

	}

	async filesHandle(_contextFiles: string[]) {
		/**
		 * This file handle should always act like the emptyHandle, and thus ignores contextFiles (as denoted by the _)
		 */
		return this.emptyHandle();
	}

	async directoryHandle(contextDirectory: string) {
		let tableName = await this.promptUserForTable();
		if (!tableName) return;
		this.tableName = tableName;
		return [path.join(contextDirectory, tableName.toLowerCase())];
	}

}