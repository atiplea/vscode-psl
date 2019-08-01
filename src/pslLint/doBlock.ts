import { Statement, SyntaxKind } from "../parser";
import { Diagnostic, DiagnosticSeverity, PslRule } from "./api";

// if x do {
// }

// if x do y

export class RedundantDoBlock extends PslRule {

	report(): Diagnostic[] {
		// for (const statement of this.parsedDocument.statements) {}
		const diagnostics: Diagnostic[] = [];
		for (const method of this.parsedDocument.methods) {
			// const validStatementKinds = [SyntaxKind.FOR_STATEMENT, SyntaxKind.IF_STATEMENT, SyntaxKind.WHILE_STATEMENT];
			let previousStatement: Statement;
			for (const currentStatement of method.statements) {
				if (currentStatement.kind === SyntaxKind.DO_STATEMENT && currentStatement.expressions.length === 0) {
					const currentStatementLine = currentStatement.action.position.line;
					if (!previousStatement) continue;
					const previousStatementLine = previousStatement.action.position.line;
					if (currentStatementLine === previousStatementLine) {
						const diagnostic = new Diagnostic(currentStatement.action.getRange(), `Redundant "do" block on same line as "${previousStatement.action.value}"`, this.ruleName, DiagnosticSeverity.Warning);
						diagnostic.source = 'lint';
						diagnostics.push(diagnostic);
					}
				}
				previousStatement = currentStatement;
			}
		}

		return diagnostics;
	}
}
