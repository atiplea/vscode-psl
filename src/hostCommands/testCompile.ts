import { PSLDiagnostic } from '../common/diagnostics';

import * as vscode from 'vscode';
import * as hc from './hostCommand';
import * as path from 'path';
import * as environment from '../common/environment';

export class TestCompile extends hc.UploadCommand {

	icon: string;
	command: string;
	dialogLabel: string;

	constructor() {
		super();
		this.icon = hc.icons.TEST;
		this.command = 'psl.testCompile';
		this.dialogLabel = 'Test Compile';
	}

	async execute(file: string, env: environment.EnvironmentConfig) {
		await hc.executeWithProgress(`${path.basename(file)} TEST COMPILE`, async () => {
			this.logWait(`${path.basename(file)} TEST COMPILE in ${env.name}`);
			let connection = await hc.getConnection(env);
			let output = await connection.test(file);
			connection.close();
			let textDocument = await vscode.workspace.openTextDocument(file);
			let pslDiagnostics = parseCompilerOutput(output, textDocument);
			let testCompileSucceeded = pslDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length === 0;
			let testCompileWarning = pslDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length > 0;
			if (!testCompileSucceeded) {
				this.logSuccess(`${path.basename(file)} TEST COMPILE in ${env.name} failed` + ('\n' + output).split('\n').join('\n' + ' '.repeat(20)))
			}
			else if (testCompileWarning) {
				this.logWarn(`${path.basename(file)} TEST COMPILE in ${env.name} succeeded with warning` + ('\n' + output).split('\n').join('\n' + ' '.repeat(20)))
			}
			else {
				this.logError(`${path.basename(file)} TEST COMPILE in ${env.name} succeeded` + ('\n' + output).split('\n').join('\n' + ' '.repeat(20)))
			}
			PSLDiagnostic.setDiagnostics(pslDiagnostics, env.name, file);
		});
	}
}


function parseCompilerOutput(compilerOutput: string, document: vscode.TextDocument): PSLDiagnostic[] {
	/*
	ZFeatureToggleUtilities.PROC compiled at 15:31 on 29-05-17
    Source: ZFeatureToggleUtilities.PROC

    %PSL-E-SYNTAX: Missing #PROPERTYDEF
    In module: ZFeatureToggleUtilities

    Source: ZFeatureToggleUtilities.PROC
    	#PROPEYDEF dummy class = String private node = "dummy"
    %PSL-E-SYNTAX: Unexpected compiler command: PROPEYDEF
    At source code line: 25 in subroutine:

    Source: ZFeatureToggleUtilities.PROC

    %PSL-I-LIST: 2 errors, 0 warnings, 0 informational messages ** failed **
    In module: ZFeatureToggleUtilities
	*/
	let outputArrays: Array<PSLCompilerMessage> = splitCompilerOutput(compilerOutput);
	let pslDiagnostics: PSLDiagnostic[] = [];
	outputArrays.slice(0, outputArrays.length - 1).forEach(pslCompilerMessage => {

		let lineNumber: number = pslCompilerMessage.getLineNumber();
		if (lineNumber - 1 > document.lineCount || lineNumber <= 0) {
			lineNumber = 1;
		}

		let codeLine: string = document.lineAt(lineNumber - 1).text;
		let startIndex: number = codeLine.search(/\S/); // returns the index of the first non-whitespace character
		if (startIndex === -1) startIndex = 0; // codeLine is only whitespace characters
		let range = new vscode.Range(lineNumber - 1, startIndex, lineNumber - 1, codeLine.length);
		let severity = pslCompilerMessage.getSeverity();
		if (severity >= 0) {
			pslDiagnostics.push(new PSLDiagnostic(`${pslCompilerMessage.message}`, severity, document.fileName, range));
		}
	});
	return pslDiagnostics;
}

class PSLCompilerMessage {
	source: string
	code: string
	message: string
	location: string

	constructor(source: string, code: string, message: string, location: string) {
		this.source = source;
		this.code = code;
		this.message = message;
		this.location = location;
	}

	isFilled(): boolean {
		return (this.source && this.message && this.location) !== '';
	}
	getLineNumber(): number {
		if (this.location.startsWith('In module:')) return -1;
		return parseInt(this.location.replace('At source code line: ', '').split(' ')[0]);
	}
	getSeverity(): vscode.DiagnosticSeverity {
		if (this.message.startsWith('%PSL-W-')) {
			return vscode.DiagnosticSeverity.Warning;
		}
		else if (this.message.startsWith('%PSL-E-')) {
			return vscode.DiagnosticSeverity.Error;
		}
		else if (this.message.startsWith('%PSL-I-')) {
			return vscode.DiagnosticSeverity.Information;
		}
		return -1;
	}
}

function splitCompilerOutput(compilerOutput: string): Array<PSLCompilerMessage> {
	/**
	 * breaks apart the psl compiler output string into an arrays of compiler messages
	 */
	let outputArrays: Array<PSLCompilerMessage> = [];
	let compilerMessage: PSLCompilerMessage;

	let splitCompilerOutput = compilerOutput.replace(/\r/g, '').trim().split('\n');
	for (let i = 1; i < splitCompilerOutput.length; i++) {
		compilerMessage = new PSLCompilerMessage(
			splitCompilerOutput[i],
			splitCompilerOutput[i + 1],
			splitCompilerOutput[i + 2],
			splitCompilerOutput[i + 3]
		)
		if (compilerMessage.isFilled()) outputArrays.push(compilerMessage);
		i = i + 4;
	}
	return outputArrays;
}