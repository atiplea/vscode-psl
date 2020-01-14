import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { GtmDebugSession } from './session';
import * as Net from 'net';
import { extname, parse as pathParse } from 'path';

export function activate(context: vscode.ExtensionContext) {
	const provider = new GtmConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('gtm', provider));

	// The following use of a DebugAdapter factory shows how to run the debug adapter inside the extension host (and not as a separate process).
	const factory = new GtmDebugAdapterDescriptorFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('gtm', factory));
	context.subscriptions.push(factory);

	context.subscriptions.push(vscode.commands.registerCommand('gtm.pickRoutine', () => chooseMumpsRoutine(context)));
}

export function deactivate() {
	// nothing to do
}

async function chooseMumpsRoutine(context: vscode.ExtensionContext) {
	const storageKey = 'gtm.chosenRoutines';
	const currentRoutine = pathParse(vscode.window.activeTextEditor?.document.fileName || '').name;
	const chosenRoutines = context.globalState.get<string[]>(storageKey, []);
	const activeRoutines = vscode.workspace.textDocuments.filter(t => ['.m', '.psl', '.proc', '.batch'].includes(extname(t.fileName).toLowerCase())).map(t => pathParse(t.fileName).name).filter(t => t !== currentRoutine && !chosenRoutines.includes(t));
	const choice = await vscode.window.showQuickPick(
		[
			{
				label: currentRoutine,
				description: '*',
				detail: 'Active routine'
			},
			...chosenRoutines.map(t => {
				return {
					label: t,
					detail: 'Recently chosen',
				}
			}),
			...activeRoutines.map(t => {
				return {
					label: t,
					detail: 'Open routine',
				}
			})
		],
		{
			placeHolder: 'Choose a routine',
		}
	);
	if (!choice) { return; }
	chosenRoutines.push(choice.label);
	const unique = (array: string[]) => [...new Set(array)];
	const lastThreeChoices: string[] = unique(chosenRoutines.reverse()).slice(0, 3);
	context.globalState.update(storageKey, lastThreeChoices);
	return choice.label;
}

class GtmConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		// for now do nothing
		return config;
	}
}

class GtmDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(): vscode.ProviderResult<vscode.DebugAdapterServer> {

		if (!this.server) {
			// start listening on a random port
			this.server = Net.createServer(socket => {
				const session = new GtmDebugSession();
				session.setRunAsServer(true);
				session.start(<NodeJS.ReadableStream>socket, socket);
			}).listen(0);
		}

		// make VS Code connect to debug server
		return new vscode.DebugAdapterServer((<Net.AddressInfo>this.server.address()).port);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}
