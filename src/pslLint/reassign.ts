import { BinaryOperator, forEachChild, Identifier, Node, Statement, SyntaxKind } from '../parser';
import { Diagnostic, DiagnosticSeverity, PslRule } from './api';

export class ObjectArgument extends PslRule {

	report(): Diagnostic[] {
		// for (const statement of this.parsedDocument.statements) {}
		const diagnostics: Diagnostic[] = [];
		for (const topLevelStatement of this.parsedDocument.statements) {
			this.check(topLevelStatement, diagnostics);
		}
		for (const method of this.parsedDocument.methods) {
			for (const statement of method.statements) {
				if (statement.kind === SyntaxKind.SET_STATEMENT) {
					this.check(statement, diagnostics);
				}
			}
		}
		return diagnostics;
	}

	check(statement: Statement, diagnostics: Diagnostic[]) {
		const equal = statement.expressions[0] as BinaryOperator;
		if (!equal) return;

		const left = equal.left as BinaryOperator;
		if (!left) return;

		if (!this.isPropertySet(left)) return;
		const obj = left.left as Identifier;

		const check = (node: Node) => {
			if (!node) return;
			const possibleCall = node as Identifier;
			if (possibleCall.kind === SyntaxKind.IDENTIFIER && possibleCall.args) {
				this.checkArgs(possibleCall, obj, diagnostics);
			}
		};

		check(obj);

		const right: Node = equal.right;

		forEachChild(right, node => {
			if (!node) return false;
			check(node);
			return true;
		});

	}

	checkArgs(identifier: Identifier, obj: Identifier, diagnostics: Diagnostic[]) {
		for (const arg of identifier.args) {
			if (!arg) continue;
			if (arg.kind !== SyntaxKind.IDENTIFIER) continue;
			const identifierArg = arg as Identifier;
			if (identifierArg.id.value === obj.id.value) {
				const diagnostic = new Diagnostic(
					identifierArg.id.getRange(),
					`Argument "${identifierArg.id.value}" passed in self-referential SET.`,
					this.ruleName,
					DiagnosticSeverity.Warning,
				);
				diagnostic.source = 'lint';
				diagnostics.push(diagnostic);
			}
		}

	}

	isPropertySet(left: Node) {
		if (left.kind === SyntaxKind.BINARY_OPERATOR) {
			const operator = left as BinaryOperator;
			return operator.operator[0].isPeriod() &&
				(operator.left && operator.left.kind === SyntaxKind.IDENTIFIER) &&
				(operator.right && operator.right.kind === SyntaxKind.IDENTIFIER) &&
				!(operator.right as Identifier).args;
		}
		return false;
	}
}
