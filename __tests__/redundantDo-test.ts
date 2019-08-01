import * as api from '../src/pslLint/api';
import { RedundantDoBlock } from '../src/pslLint/cli/lib/pslLint/doBlock';
import * as utils from './ruleUtils';

describe('Members tests', () => {
	let redundantDiagnostics: api.Diagnostic[] = [];

	beforeAll(async () => {
		redundantDiagnostics = await utils.getDiagnostics('ZTestRedundantDO.PROC', RedundantDoBlock.name);
	});

	test('Diagnostic count', () => {
		expect(redundantDiagnostics.length).toBe(9);
	});

	test('block as first statement', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(3, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(0);
	});

	test('if block with no quit', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(11, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "if"`);
	});
	test('if block with quit', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(16, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "if"`);
	});
	test('else if block', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(19, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "if"`);
	});
	test('else block ', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(22, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "else"`);
	});
	test('while block', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(26, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "while"`);
	});
	test('while block with post quit', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(30, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "while"`);
	});
	test('conventional for', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(36, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "for"`);
	});
	test('for order', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(41, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "quit"`);
	});
	test('complex while', () => {
		const diagnosticsOnLine = utils.diagnosticsOnLine(45, redundantDiagnostics);
		expect(diagnosticsOnLine.length).toBe(1);
		expect(diagnosticsOnLine[0].message).toBe(`Redundant "do" block on same line as "while"`);
	});

});
