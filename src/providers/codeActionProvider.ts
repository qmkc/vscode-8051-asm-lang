import * as vscode from 'vscode';

import { DIAGNOSTIC_RULES, RULE_SLUGS, SeverityOverride } from './diagnostics';
import { DIRECTIVES, INSTRUCTIONS } from '../language/instructionSet';
import { splitCodeAndComment } from '../language/parsing';

const RULE_CODES: ReadonlySet<string> = new Set(
  Object.values(DIAGNOSTIC_RULES),
);

export const DISABLE_RULE_COMMAND = 'a51.disableDiagnosticRule';

/** Appends an `a51-disable-line <code>` directive to `lineText`'s trailing comment, adding a `;` first if the line has no comment yet. */
function appendDisableLineDirective(lineText: string, code: string): string {
  const { comment } = splitCodeAndComment(lineText);
  if (comment.length === 0) {
    return `${lineText.replace(/\s+$/, '')} ; a51-disable-line ${code}`;
  }
  return `${lineText} a51-disable-line ${code}`;
}

const KNOWN_WORDS: readonly string[] = [
  ...INSTRUCTIONS.map((i) => i.mnemonic),
  ...DIRECTIVES,
];
const MAX_SUGGESTIONS = 3;
const MAX_EDIT_DISTANCE = 2;

/** Standard Levenshtein edit distance (insert/delete/substitute, unit cost). */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = new Array<number>(b.length + 1);
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Known instructions/directives within edit distance `MAX_EDIT_DISTANCE` of `token`, closest first. */
function suggestionsFor(token: string): string[] {
  const upper = token.toUpperCase();
  return KNOWN_WORDS.map((word) => ({
    word,
    distance: editDistance(upper, word),
  }))
    .filter(({ distance }) => distance > 0 && distance <= MAX_EDIT_DISTANCE)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ word }) => word);
}

/** Keeps an all-lowercase token's replacement lowercase too; anything else gets the canonical upper-case spelling. */
function matchCase(original: string, replacement: string): string {
  return original === original.toLowerCase()
    ? replacement.toLowerCase()
    : replacement;
}

export class A51CodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      const code = diagnostic.code;
      if (typeof code !== 'string' || !RULE_CODES.has(code)) {
        continue;
      }

      if (code === DIAGNOSTIC_RULES.UnknownInstruction) {
        actions.push(...this.suggestionActions(document, diagnostic));
      }

      actions.push(this.skipLineAction(document, diagnostic, code));
      actions.push(
        this.disableRuleAction(
          diagnostic,
          code,
          vscode.ConfigurationTarget.Global,
        ),
      );
      if (vscode.workspace.workspaceFolders?.length) {
        actions.push(
          this.disableRuleAction(
            diagnostic,
            code,
            vscode.ConfigurationTarget.Workspace,
          ),
        );
      }
    }

    return actions;
  }

  private suggestionActions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const token = document.getText(diagnostic.range);
    return suggestionsFor(token).map((suggestion, i) => {
      const replacement = matchCase(token, suggestion);
      const action = new vscode.CodeAction(
        vscode.l10n.t("Change to '{0}'", replacement),
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diagnostic];
      action.isPreferred = i === 0;
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, diagnostic.range, replacement);
      action.edit = edit;
      return action;
    });
  }

  private skipLineAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    code: string,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      vscode.l10n.t('Skip this line ({0})', this.label(code)),
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diagnostic];
    const line = diagnostic.range.start.line;
    const lineText = document.lineAt(line).text;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(line, 0, line, lineText.length),
      appendDisableLineDirective(lineText, code),
    );
    action.edit = edit;
    return action;
  }

  private disableRuleAction(
    diagnostic: vscode.Diagnostic,
    code: string,
    target:
      | vscode.ConfigurationTarget.Global
      | vscode.ConfigurationTarget.Workspace,
  ): vscode.CodeAction {
    const title =
      target === vscode.ConfigurationTarget.Workspace
        ? vscode.l10n.t(
            'Disable this rule for this workspace ({0})',
            this.label(code),
          )
        : vscode.l10n.t('Disable this rule ({0})', this.label(code));
    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    action.command = {
      command: DISABLE_RULE_COMMAND,
      title,
      arguments: [code, target],
    };
    return action;
  }

  private label(code: string): string {
    return `${RULE_SLUGS[code]} (${code})`;
  }
}

/** Sets `code` to `value` in a `severity` map, or returns the same object if it's already set that way. */
export function mergeSeverityOverride(
  current: Readonly<Record<string, SeverityOverride>>,
  code: string,
  value: SeverityOverride,
): Record<string, SeverityOverride> {
  return current[code] === value ? current : { ...current, [code]: value };
}

/** Sets `code` to `off` in `a51.diagnostics.severity` at `target`, merging with whatever is already set there (not clobbering the other scope's value). */
export async function disableDiagnosticRule(
  code: string,
  target: vscode.ConfigurationTarget,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('a51');
  const inspected = cfg.inspect<Record<string, SeverityOverride>>(
    'diagnostics.severity',
  );
  const current =
    (target === vscode.ConfigurationTarget.Workspace
      ? inspected?.workspaceValue
      : inspected?.globalValue) ?? {};
  const next = mergeSeverityOverride(current, code, 'off');
  if (next !== current) {
    await cfg.update('diagnostics.severity', next, target);
  }
}
