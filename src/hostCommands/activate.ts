import * as vscode from 'vscode';
import * as path from 'path';

import { commands, ExtensionContext, TextEditor, window } from 'vscode';
import { getTableHandler } from './get';
import { refreshTableHandler } from './refresh';
import { CompileAndLink } from './compileAndLink2';
import { sendTableHandler } from './send';
import { RunPSL } from './run2';
import { Refresh } from './refresh2';
import { Send } from './send2';
import { TestCompile } from './testCompile2';
import { Get } from './get2';

const PROFILE_ELEMENTS = [
	'.FKY',
	'.G',
	'.IDX',
	'.JFD',
	'.M',
	'.m',
	'.PPL',
	'.properties',
	'.PROPERTIES',
	'.PSLX',
	'.pslx',
	'.PSLXTRA',
	'.pslxtra',
	'.PSQL',
	'.psql',
	'.QRY',
	'.RPT',
	'.SCR'
]

export function activate(context: ExtensionContext) {

	registerProfileElementContext();

	const COMMANDS_CLASSES = [RunPSL, Refresh, Send, TestCompile, Get, CompileAndLink];

	for (let Command of COMMANDS_CLASSES) {
		let commandInstance = new Command();
		context.subscriptions.push(
			vscode.commands.registerCommand(
				commandInstance.command, commandInstance.handle, commandInstance
			)
		);
	}

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.getTable', getTableHandler
		)
	);

	// context.subscriptions.push(
	// 	vscode.commands.registerCommand(
	// 		'psl.testSendLink', testSendLinkHandler
	// 	)
	// );

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.sendTable', sendTableHandler
		)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'psl.refreshTable', refreshTableHandler
		)
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
	if (window.activeTextEditor) setIsProfileElementContext(window.activeTextEditor)
	window.onDidChangeActiveTextEditor(setIsProfileElementContext)
}

function setIsProfileElementContext(textEditor: TextEditor) {
	let isElement: boolean = false;
	if (textEditor) {
		isElement = PROFILE_ELEMENTS.indexOf(path.extname(textEditor.document.fileName)) >= 0;
	}
	commands.executeCommand('setContext', 'psl.isProfileElement', isElement)
}