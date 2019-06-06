import * as mocha from 'mocha';
import * as vscode from 'vscode';

mocha.test('extension', async () => {
	const commands = await vscode.commands.getCommands();
	console.log(commands);
});
