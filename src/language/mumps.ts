import * as path from 'path';
import {
	DecorationOptions, EventEmitter, MarkdownString, Range, TextDocumentContentProvider, TextEditor,
	Uri, window, workspace, CancellationToken, CancellationTokenSource, env, TextDocumentShowOptions, TextEditorRevealType,
} from 'vscode';
import { ParsedDocument, parseText } from '../parser';
import { getCompiledCode, getCompiledCodeHandler } from '../hostCommands/get';

export class MumpsVirtualDocument {

	static readonly schemes = {
		compiled: 'compiledMumps',
		coverage: 'coverageMumps',
	};

	readonly parsedDocument: ParsedDocument;

	constructor(
		readonly routineName: string,
		readonly sourceCode: string,
		/**
		 * Uri with scheme in `mumpsSchemes`
		 */
		readonly uri: Uri,
	) {
		this.parsedDocument = parseText(sourceCode);
		virtualDocuments.set(uri.toString(), this);
	}
}

export class MumpsDocumentProvider implements TextDocumentContentProvider {
	provideTextDocumentContent(uri: Uri): string {
		return getVirtualDocument(uri).sourceCode;
	}
}

export function getVirtualDocument(uri: Uri) {
	if (!uri) return;
	return virtualDocuments.get(uri.toString());
}

function isScheme(uri: Uri) {
	return Object.values(MumpsVirtualDocument.schemes).indexOf(uri.scheme) > -1;
}

/**
 * Virtual Documents keyed by the string the string representation of their `Uri`s
 */
const virtualDocuments = new Map<string, MumpsVirtualDocument>();

const _onDidDeleteVirtualMumps = new EventEmitter<Uri>();
export const onDidDeleteVirtualMumps = _onDidDeleteVirtualMumps.event;

workspace.onDidCloseTextDocument(textDocument => {
	const uri = textDocument.uri;
	if (isScheme(uri)) {
		virtualDocuments.delete(uri.toString());
		_onDidDeleteVirtualMumps.fire(uri);
	}
});

window.onDidChangeActiveTextEditor(textEditor => {
	if (textEditor) {
		if (textEditor.document.languageId === 'mumps') {
			new MumpsVirtualDocument(`${path.basename(textEditor.document.fileName).split('.')[0]}`, textEditor.document.getText(), textEditor.document.uri);
		}
		else if (!isScheme(textEditor.document.uri)) {
			return;
		}
		setLineNumberDecorations(textEditor);
	}
});

let activeSource: CancellationTokenSource = new CancellationTokenSource();

function newToken() {
	activeSource.cancel();
	activeSource = new CancellationTokenSource();
	return activeSource.token;
}

// workspace.onDidChangeTextDocument(e => {
// 	if (!window.activeTextEditor) return;
// 	const textDocument = e.document;
// 	if (window.activeTextEditor.document.uri.toString() !== textDocument.uri.toString()) return;
// 	if (textDocument.languageId === 'mumps') {
// 		new MumpsVirtualDocument(`${path.basename(textDocument.fileName).split('.')[0]}`, textDocument.getText(), textDocument.uri);
// 		setLineNumberDecorations(window.activeTextEditor, newToken());
// 	}
// });

const relativeLineNumberDecoration = window.createTextEditorDecorationType({
	before: {
		height: '100%',
		margin: '0 5px -1px 0',
	},
});

function setLineNumberDecorations(textEditor: TextEditor, token?: CancellationToken) {
	const virtualMumps = getVirtualDocument(textEditor.document.uri);
	if (!virtualMumps) return;
	const documentDecorations: DecorationOptions[] = [];
	const tokens = virtualMumps.parsedDocument.tokens;
	const maxDigits = tokens[tokens.length - 1].position.line.toString().length;

	virtualMumps.parsedDocument.methods.forEach(method => {
		let relative = 1;
		for (let absolute = method.id.position.line + 1; absolute <= method.endLine; absolute++) {
			const shift = relative ? `+${relative}` : '';
			const location = `${method.id.value}${shift}^${virtualMumps.routineName}`;
			if (textEditor.document.lineAt(absolute).text) {
				documentDecorations.push({
					hoverMessage: new MarkdownString().appendCodeblock(location, 'mumps'),
					range: new Range(absolute, 0, absolute, 0),
					renderOptions: {
						before: { contentText: `${shift}`.padEnd(maxDigits, '\u00a0') },
					},
				});
			}
			relative++;
		}
	});
	textEditor.setDecorations(relativeLineNumberDecoration, documentDecorations);
}
let lastGoTo: string = '';
export async function goToMumps() {
	const regex = /(^%?[A-Za-z0-9]+)?(\+(\d+))?(\^)?(%?[A-Za-z0-9]+)?/;
	const validate = (str: string) => {
		const match = regex.exec(str);
		if (!match || match[0] !== str) return undefined;
		return {
			label: match[1],
			line: Number.parseInt(match[3], 10) || 0,
			routine: match[5],
		};
	}
	const goTo = await window.showInputBox({
		prompt: 'mumps label reference ( i.e. LABEL+n^ROUTINE, ^ROUTINE, LABEL+n )',
		validateInput: (str) => validate(str) ? '' : 'invalid',
		value: lastGoTo,
	});
	if (!goTo) return;
	lastGoTo = goTo;
	const reference = validate(goTo);
	if (!reference) return;
	let routineName = '';

	if (reference.routine) routineName = `${reference.routine}.m`;
	else if (window.activeTextEditor) {
		routineName = `${path.basename(window.activeTextEditor.document.fileName).split('.')[0]}.m`;
	}

	const uris = [];
	virtualDocuments.forEach((_, uri) => {
		if (routineName === path.basename(Uri.parse(uri).path)) {
			uris.push(uri);
		}
	});
	let document: MumpsVirtualDocument;
	if (uris[0]) {
		document = getVirtualDocument(uris[0]);
	}
	else {
		await getCompiledCode(routineName);
		virtualDocuments.forEach((_, uri) => {
			if (routineName === path.basename(Uri.parse(uri).path)) {
				uris.push(uri);
			}
		});
		document = getVirtualDocument(uris[0]);
		if (!document) return;
	}
	let revealLine = 0;
	if (reference.label) {
		const labelLine = document.parsedDocument.methods.find(m => m.id.value === reference.label).line;
		revealLine = labelLine + reference.line;
	}
	const options: TextDocumentShowOptions = {
		preserveFocus: true,
		preview: false,
		selection: new Range(revealLine, 0, revealLine, Number.MAX_VALUE),
	};
	const textDocument = await workspace.openTextDocument(document.uri);
	await window.showTextDocument(textDocument, options);
}
