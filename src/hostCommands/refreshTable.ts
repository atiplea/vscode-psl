import * as vscode from 'vscode';
import { DIR_MAPPINGS } from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';
import { GetTable } from './getTable';

export class RefreshTable extends GetTable {

	icon: string;
	command: string;

	constructor() {
		super();
		this.icon = GetTable.icons.REFRESH;
		this.command = 'psl.refreshTable';
		this.commandVerb = 'REFRESH';
	}

	async filesHandle(files: string[]) {
		let fsPath = files[0];
		if (path.extname(fsPath) === '.TBL') {
			this.tableName = path.basename(fsPath).split('.TBL')[0];
		}
		else if (path.extname(fsPath) === '.COL') {
			this.tableName = path.basename(fsPath).split('.COL')[0].split('-')[0];
		}
		else {
			return;
		}
		let chosenWorkspace = await environment.workspaceQuickPick();
		if (!chosenWorkspace) return;
		let workspaceDirectory = chosenWorkspace.fsPath;
		let target: string;
		let tableDir = DIR_MAPPINGS['TABLE'];
		if (tableDir) {
			target = path.join(workspaceDirectory, tableDir, this.tableName.toLowerCase());
		}
		else {
			let uris = await vscode.window.showOpenDialog({ defaultUri: vscode.Uri.file(workspaceDirectory), canSelectFiles: false, canSelectFolders: true, canSelectMany: false, filters: { 'Table Directory': [] } });
			if (!uris) return;
			target = path.join(uris[0].fsPath, tableDir.toLowerCase());
		}
		return [target];
	}

	async dirHandle(): Promise<undefined> {
		return;
	}

}