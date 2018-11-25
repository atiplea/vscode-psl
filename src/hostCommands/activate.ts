import * as path from 'path';
import * as vscode from 'vscode';

import { commands, ExtensionContext, TextEditor, window } from 'vscode';
import { compileAndLinkHandler } from './compileAndLink';
import { getElementHandler, getTableHandler } from './get';
import { refreshElementHandler, refreshTableHandler } from './refresh';
import { runPSLHandler } from './run';
import { sendElementHandler, sendTableHandler } from './send';
import { testCompileHandler } from './testCompile';

const PROFILE_ELEMENTS = [
	'.BATCH',
	'.COL',
	'.DAT',
	'.FKY',
	'.G',
	'.IDX',
	'.JFD',
	'.m',
	'.M',
	'.PPL',
	'.PROC',
	'.properties',
	'.PROPERTIES',
	'.psl',
	'.PSL',
	'.pslx',
	'.PSLX',
	'.pslxtra',
	'.PSLXTRA',
	'.psql',
	'.PSQL',
	'.QRY',
	'.RPT',
	'.SCR',
	'.TBL',
	'.TRIG',
];

export function activate(context: ExtensionContext) {

	registerProfileElementContext();

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.getElement', getElementHandler,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.getTable', getTableHandler,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.refreshElement', refreshElementHandler,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.sendElement', sendElementHandler,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.testCompile', testCompileHandler,
		),
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.compileAndLink', compileAndLinkHandler,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.runPSL', runPSLHandler,
		),
	);

	// context.subscriptions.push(
	// 	vscode.commands.registerCommand(
	// 		'psl.testSendLink', testSendLinkHandler
	// 	)
	// );

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.sendTable', sendTableHandler,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.refreshTable', refreshTableHandler,
		),
	);

}

// async function testSendLinkHandler (context: utils.ExtensionCommandContext): Promise<void> {
// 	let c = utils.getFullContext(context);
// 	if (c.mode === utils.ContextMode.FILE) {
// 		let success = await testCompileHandler(context);
// 		if (success) {
// 			await sendElementHandler(context);
// 			await compileAndLinkHandler(context);
// 		}
// 	}
// 	else {
// 		let fileUris = await vscode.window.showOpenDialog({canSelectMany: true, openLabel: 'Test Send Link'})
// 		if (!fileUris) return;
// 		let successFiles: string[] = await fileUris.map(uri => uri.fsPath)
// 			.filter(async fsPath => (await fs.lstat(fsPath)).isFile())

// 		successFiles = await successFiles.filter(async fsPath => {
// 				let success = await testCompileHandler({fsPath, dialog: false})
// 				return success;
// 			})

// 		for (let fsPath of successFiles) {
// 			await sendElementHandler({fsPath, dialog: false});
// 		}

// 		for (let fsPath of successFiles) {
// 			await compileAndLinkHandler({fsPath, dialog: false});
// 		}
// 	}
// }

function registerProfileElementContext() {
	if (window.activeTextEditor) setIsProfileElementContext(window.activeTextEditor);
	window.onDidChangeActiveTextEditor(setIsProfileElementContext);
}

function setIsProfileElementContext(textEditor: TextEditor) {
	let isElement: boolean = false;
	if (textEditor) {
		isElement = isProfileElement(textEditor.document.fileName);
	}
	commands.executeCommand('setContext', 'psl.isProfileElement', isElement);
}

export function isProfileElement(fileName: string) {
	return PROFILE_ELEMENTS.indexOf(path.extname(fileName)) >= 0;
}
