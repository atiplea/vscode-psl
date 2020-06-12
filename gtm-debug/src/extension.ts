import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { GtmDebugSession } from './session';
import { extname, parse as pathParse } from 'path';

export function activate(context: vscode.ExtensionContext) {
	const provider = new GtmConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('gtm', provider));

	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('gtm', {
		createDebugAdapterDescriptor: _session => {
			return new vscode.DebugAdapterInlineImplementation(new GtmDebugSession());
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('gtm.pickRoutine', () => chooseMumpsRoutine(context)));
}

export function deactivate() {
	// nothing to do
}

async function chooseMumpsRoutine(context: vscode.ExtensionContext) {
	const isRoutine = (fileName: string) => ['.m', '.psl', '.proc', '.batch'].includes(extname(fileName).toLowerCase());
	const uniqueAndDefined = (v: string, i: number, a: string[]) => v && a.indexOf(v) === i;

	const storageKey = 'gtm.recentlyChosen';
	const activeFilePath = vscode.window.activeTextEditor?.document.fileName;

	const activeRoutine = isRoutine(activeFilePath || '') ? pathParse(activeFilePath as string).name : '';
	const recentlyChosen = context.globalState.get<string[]>(storageKey, []);
	const openRoutines = vscode.workspace.textDocuments.filter(t => isRoutine(t.fileName)).map(t => pathParse(t.fileName).name);

	const choice = await vscode.window.showQuickPick(
		[
			{
				label: activeRoutine,
				description: '*',
				detail: 'Active routine'
			},
			...recentlyChosen.map(t => {
				return {
					label: t,
					detail: 'Recently chosen',
				}
			}),
			...openRoutines.map(t => {
				return {
					label: t,
					detail: 'Open routine',
				}
			})
		].filter((v, i, a) => uniqueAndDefined(v.label, i, a.map(x => x.label))),
		{
			placeHolder: 'Choose a routine',
		}
	);
	if (!choice) { return; }
	recentlyChosen.push(choice.label);
	const lastThreeChoices: string[] = recentlyChosen.reverse().filter(uniqueAndDefined).slice(0, 3);
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
