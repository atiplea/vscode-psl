import * as path from 'path';
import { ParsedDocument } from '../parser/parser';
import {
	DeclarationRule, Diagnostic, FileDefinitionRule, MemberRule, MethodRule, ParameterRule, ProfileComponent,
	ProfileComponentRule, PropertyRule, PslRule,
} from './api';
import { getConfig, matchConfig } from './config';

/**
 * Import rules here.
 */
import { RedundantDoBlock } from './doBlock';
import {
	MemberCamelCase, MemberLength, MemberLiteralCase, MemberStartsWithV, PropertyIsDummy, PropertyIsDuplicate,
	PublicDeclarationCamelCase,
} from './elementsConventionChecker';
import { MethodDocumentation, MethodSeparator, TwoEmptyLines } from './methodDoc';
import { MultiLineDeclare } from './multiLineDeclare';
import { MethodParametersOnNewLine } from './parameters';
import { RuntimeStart } from './runtime';
import { TblColDocumentation } from './tblcolDoc';
import { TodoInfo } from './todos';

type RuleCtor<T> = new (profileComponent: ProfileComponent) => T;
type PslRuleCtor<T> = new (profileComponent: ProfileComponent, parsedDocument: ParsedDocument) => T;

const componentRuleConstructors: RuleCtor<ProfileComponentRule>[] = [];
const fileDefinitionRuleConstructors: RuleCtor<FileDefinitionRule>[] = [
	TblColDocumentation,
];
const pslRuleConstructors: PslRuleCtor<PslRule>[] = [
	TodoInfo,
	RedundantDoBlock,
];
const memberRuleConstructors: PslRuleCtor<MemberRule>[] = [
	MemberCamelCase,
	MemberLength,
	MemberStartsWithV,
	MemberLiteralCase,
];
const methodRuleConstructors: PslRuleCtor<MethodRule>[] = [
	MethodDocumentation,
	MethodSeparator,
	MethodParametersOnNewLine,
	RuntimeStart,
	MultiLineDeclare,
	TwoEmptyLines,
];
const propertyRuleConstructors: PslRuleCtor<PropertyRule>[] = [
	PropertyIsDummy,
	PropertyIsDuplicate,
];
const declarationRuleConstructors: PslRuleCtor<DeclarationRule>[] = [
	PublicDeclarationCamelCase,
];
const parameterRuleConstructors: PslRuleCtor<ParameterRule>[] = [];

export function getDiagnostics(
	profileComponent: ProfileComponent,
	parsedDocument?: ParsedDocument,
	useConfig?: boolean,
): Diagnostic[] {
	const subscription = new RuleSubscription(profileComponent, parsedDocument, useConfig);
	return subscription.reportRules();
}

/**
 * Manages which rules need to be applied to a given component.
 */
class RuleSubscription {

	private componentRules: ProfileComponentRule[];
	private pslRules: PslRule[];
	private fileDefinitionRules: FileDefinitionRule[];
	private methodRules: MethodRule[];
	private memberRules: MemberRule[];
	private propertyRules: PropertyRule[];
	private declarationRules: DeclarationRule[];
	private parameterRules: ParameterRule[];

	constructor(private profileComponent: ProfileComponent, private parsedDocument?: ParsedDocument, useConfig?: boolean) {
		const config = useConfig ? getConfig(this.profileComponent.fsPath) : undefined;

		const filterByConfig = (ruleCtor: RuleCtor<ProfileComponentRule> | PslRuleCtor<PslRule>) => {
			if (!useConfig) return true;
			if (!config) return false;
			return matchConfig(path.basename(this.profileComponent.fsPath), ruleCtor.name, config);
		};
		const initializeRules = (ruleCtors: RuleCtor<ProfileComponentRule>[]) => {
			return ruleCtors.filter(filterByConfig).map(ruleCtor => {
				return new ruleCtor(this.profileComponent);
			});
		};
		const initializePslRules = (ruleCtors: PslRuleCtor<PslRule>[]) => {
			return ruleCtors.filter(filterByConfig).map(ruleCtor => {
				return new ruleCtor(this.profileComponent, this.parsedDocument as ParsedDocument);
			});
		};

		this.componentRules = initializeRules(componentRuleConstructors);
		this.fileDefinitionRules = initializeRules(fileDefinitionRuleConstructors);
		this.pslRules = initializePslRules(pslRuleConstructors);
		this.methodRules = initializePslRules(methodRuleConstructors);
		this.memberRules = initializePslRules(memberRuleConstructors);
		this.propertyRules = initializePslRules(propertyRuleConstructors);
		this.declarationRules = initializePslRules(declarationRuleConstructors);
		this.parameterRules = initializePslRules(parameterRuleConstructors);
	}

	reportRules(): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];

		const collectDiagnostics = (rules: ProfileComponentRule[], ...args: any[]) => {
			rules.forEach(rule => diagnostics.push(...rule.report(...args)));
		};

		collectDiagnostics(this.componentRules);

		if (ProfileComponent.isFileDefinition(this.profileComponent.fsPath)) {
			collectDiagnostics(this.fileDefinitionRules);
		}

		if (ProfileComponent.isPsl(this.profileComponent.fsPath)) {
			collectDiagnostics(this.pslRules);

			const parsedDocument = this.parsedDocument as ParsedDocument;

			for (const property of parsedDocument.properties) {
				collectDiagnostics(this.memberRules, property);
				collectDiagnostics(this.propertyRules, property);
			}

			for (const declaration of parsedDocument.declarations) {
				collectDiagnostics(this.memberRules, declaration);
				collectDiagnostics(this.declarationRules, declaration);
			}

			for (const method of parsedDocument.methods) {
				collectDiagnostics(this.memberRules, method);
				collectDiagnostics(this.methodRules, method);

				for (const parameter of method.parameters) {
					collectDiagnostics(this.memberRules, parameter);
					collectDiagnostics(this.parameterRules, parameter, method);
				}

				for (const declaration of method.declarations) {
					collectDiagnostics(this.memberRules, declaration);
					collectDiagnostics(this.declarationRules, declaration, method);
				}
			}

		}

		return diagnostics;
	}
}
