#!/usr/bin/env node
import * as commander from 'commander';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as process from 'process';
import { parseText } from '../../parser/parser';
import { getDiagnostics } from '../activate';
import { Diagnostic, DiagnosticSeverity, ProfileComponent } from '../api';
import { setConfig } from '../config';
import { MemberCamelCase } from '../elementsConventionChecker';

interface CodeClimateIssue {
	categories?: string[];
	check_name: string;
	description: string;
	location: CodeClimateLocation;
	fingerprint: string;
}

interface CodeClimateLocation {
	path: string;
	lines: CodeClimateLines;
}

interface CodeClimateLines {
	begin: number;
	end: number;
}

interface StoredDiagnostic {
	diagnostic: Diagnostic;
	fsPath: string;
}

type DiagnosticStore = Map<string, StoredDiagnostic[]>;

class Linter {
	diagnosticStore: DiagnosticStore;
	warnings: number = 0;
	errors: number = 0;

	private useConfig: boolean;

	constructor() {
		this.diagnosticStore = new Map();
	}

	async lint(fileString: string): Promise<void> {
		return this.processConfig().then(_ => this.readPath(fileString));
	}

	private async processConfig(): Promise<void> {
		const configPath = path.join(process.cwd(), 'psl-lint.json');
		await fs.lstat(configPath).then(async () => {
			await setConfig(configPath);
			this.useConfig = true;
		}).catch(() => {
			this.useConfig = false;
		});
	}

	private async readPath(fileString: string): Promise<void> {
		const files = fileString.split(';').filter(x => x);
		const promises: Array<Promise<any>> = [];
		for (const filePath of files) {
			const absolutePath = path.resolve(filePath);
			if (!absolutePath) continue;
			const stat = await fs.lstat(absolutePath);
			if (stat.isDirectory()) {
				const fileNames = await fs.readdir(absolutePath);
				promises.push(...fileNames.map(fileName => {
					const absolutePathInDir = path.resolve(path.join(absolutePath, fileName));
					return this.readPath(absolutePathInDir);
				}));
			}
			else if (stat.isFile()) {
				const promise = this.readFile(absolutePath).catch((e: Error) => {
					if (e.message) console.error(absolutePath, e.message, e.stack);
					else console.error(absolutePath, e);
				});
				promises.push(promise);
			}
		}
		await Promise.all(promises);
	}

	private async readFile(filename: string): Promise<void> {
		const fsPath = path.relative(process.cwd(), filename);
		if (!ProfileComponent.isProfileComponent(fsPath)) return;

		const textDocument = (await fs.readFile(fsPath)).toString();
		const parsedDocument = ProfileComponent.isPsl(fsPath) ? parseText(textDocument) : undefined;
		const profileComponent = new ProfileComponent(fsPath, textDocument);

		const diagnostics = getDiagnostics(profileComponent, parsedDocument, this.useConfig);

		diagnostics.forEach(diagnostic => {
			if (diagnostic.severity === DiagnosticSeverity.Warning) this.warnings += 1;
			if (diagnostic.severity === DiagnosticSeverity.Error) this.errors += 1;

			const mapDiagnostics = this.diagnosticStore.get(diagnostic.ruleName);
			if (!mapDiagnostics) this.diagnosticStore.set(diagnostic.ruleName, [{ diagnostic, fsPath }]);
			else mapDiagnostics.push({ diagnostic, fsPath });
		});
	}
}

async function generateCodeClimateIssues(diagnosticStore: DiagnosticStore): Promise<CodeClimateIssue[]> {
	const codeClimateIssues: CodeClimateIssue[] = [];
	for (const ruleDiagnostics of diagnosticStore.values()) {
		for (const storedDiagnostic of ruleDiagnostics) {
			const { diagnostic, fsPath } = storedDiagnostic;
			if (diagnostic.ruleName === MemberCamelCase.name) continue;
			const codeClimateIssue: CodeClimateIssue = {
				check_name: diagnostic.ruleName,
				description: `[${diagnostic.ruleName}] ${diagnostic.message.trim().replace(/\.$/, '')}`,
				fingerprint: hashObject(diagnostic),
				location: {
					lines: {
						begin: diagnostic.range.start.line + 1,
						end: diagnostic.range.end.line + 1,
					},
					path: fsPath,
				},
			};
			codeClimateIssues.push(codeClimateIssue);

		}
	}
	return codeClimateIssues;
}

function printDiagnostics(diagnosticStore: DiagnosticStore) {
	for (const ruleName of diagnosticStore.keys()) {
		const diagnostics = diagnosticStore.get(ruleName);
		const word = diagnostics.length === 1 ? 'diagnostic' : 'diagnostics';
		console.log(`[${ruleName}] ${diagnostics.length} ${word}:`);
		diagnostics.forEach(diagnostic => {
			console.log(getMessage(diagnostic));
		});
		console.log('');
	}
}

function getMessage(storedDiagnostic: StoredDiagnostic) {
	const { diagnostic, fsPath } = storedDiagnostic;
	const range = `${diagnostic.range.start.line + 1},${diagnostic.range.start.character + 1}`;
	const severity = `${DiagnosticSeverity[diagnostic.severity].substr(0, 4).toUpperCase()}`;
	return `${fsPath}(${range}) [${severity}][${diagnostic.ruleName}] ${diagnostic.message}`;
}

function hashObject(object: any) {
	const hash = crypto.createHash('md5')
		.update(JSON.stringify(object, (key, value) => {
			if (key[0] === '_') return undefined; // remove api stuff
			else if (typeof value === 'function') { // consider functions
				return value.toString();
			}
			else return value;
		}))
		.digest('hex');
	return hash;
}

function getCliArgs(): { fileString: string, codeClimateOutput: string } {
	commander
		.name('psl-lint')
		.usage('<fileString>')
		.option('-o, --output <output>', 'Name of output file in codeclimate format')
		.description('fileString    a ; delimited string of file paths')
		.parse(process.argv);
	return { fileString: commander.args[0], codeClimateOutput: commander.output };
}

export async function lint(fileString: string): Promise<DiagnosticStore> {
	const linter = new Linter();
	await linter.lint(fileString);
	return linter.diagnosticStore;
}

(async function main() {
	if (require.main !== module) return;

	const { fileString, codeClimateOutput } = getCliArgs();
	if (fileString) {
		const linter = new Linter();
		console.log('Starting lint.');
		await linter.lint(fileString);

		if (codeClimateOutput) {
			console.log('Generating report');
			const codeClimateIssues = generateCodeClimateIssues(linter.diagnosticStore);
			await fs.writeFile(codeClimateOutput, JSON.stringify(codeClimateIssues));
		}
		else {
			printDiagnostics(linter.diagnosticStore);
		}

		const summary: { [key: string]: number } = {};
		let total = 0;
		[...linter.diagnosticStore.keys()].sort().forEach(key => {
			const count = linter.diagnosticStore.get(key).length;
			summary[key] = count;
			total += count;
		});
		summary.Total = total;
		console.table(summary);
		console.log('Finished lint.');
		if (linter.warnings || linter.errors) process.exit(1);
	}
	else {
		console.log('Nothing to lint.');
	}
})();
