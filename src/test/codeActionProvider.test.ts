import * as assert from 'assert';
import * as vscode from 'vscode';

import {
  A51CodeActionProvider,
  DISABLE_RULE_COMMAND,
  mergeSeverityOverride,
} from '../providers/codeActionProvider';
import { DIAGNOSTIC_RULES } from '../providers/diagnostics';

/** A minimal fake TextDocument - the provider only ever touches uri, lineAt(line).text, and getText(range) for a single-line range. */
function fakeDocument(text: string): vscode.TextDocument {
  const lines = text.split('\n');
  return {
    uri: vscode.Uri.file('/fake/test.a51'),
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] }) as vscode.TextLine,
    getText: (range?: vscode.Range) =>
      range
        ? lines[range.start.line].slice(
            range.start.character,
            range.end.character,
          )
        : lines.join('\n'),
  } as unknown as vscode.TextDocument;
}

function fakeDiagnostic(line: number, code: string): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(line, 0, line, 6),
    'message',
    vscode.DiagnosticSeverity.Warning,
  );
  diagnostic.code = code;
  return diagnostic;
}

function fakeContext(
  diagnostics: vscode.Diagnostic[],
): vscode.CodeActionContext {
  return {
    diagnostics,
    only: undefined,
    triggerKind: vscode.CodeActionTriggerKind.Invoke,
  };
}

suite('A51CodeActionProvider', () => {
  test('offers no actions for a diagnostic without a known rule code', () => {
    const doc = fakeDocument('        FOOBAR  A,#1');
    const diagnostic = fakeDiagnostic(0, 'not-a-rule');
    const actions = new A51CodeActionProvider().provideCodeActions(
      doc,
      diagnostic.range,
      fakeContext([diagnostic]),
    );
    assert.deepStrictEqual(actions, []);
  });

  test('the skip-this-line action adds a new trailing comment on a bare line', () => {
    const doc = fakeDocument('        FOOBAR  A,#1');
    const diagnostic = fakeDiagnostic(0, DIAGNOSTIC_RULES.UnknownInstruction);
    const actions = new A51CodeActionProvider().provideCodeActions(
      doc,
      diagnostic.range,
      fakeContext([diagnostic]),
    );
    const skip = actions.find((a) => a.edit);
    assert.ok(skip?.edit);
    const [edit] = skip.edit.get(doc.uri);
    assert.strictEqual(
      edit.newText,
      `        FOOBAR  A,#1 ; a51-disable-line ${DIAGNOSTIC_RULES.UnknownInstruction}`,
    );
  });

  test('the skip-this-line action appends to an existing trailing comment', () => {
    const doc = fakeDocument('        FOOBAR  A,#1 ; keep this');
    const diagnostic = fakeDiagnostic(0, DIAGNOSTIC_RULES.UnknownInstruction);
    const [skip] = new A51CodeActionProvider()
      .provideCodeActions(doc, diagnostic.range, fakeContext([diagnostic]))
      .filter((a) => a.edit);
    const [edit] = skip.edit!.get(doc.uri);
    assert.strictEqual(
      edit.newText,
      `        FOOBAR  A,#1 ; keep this a51-disable-line ${DIAGNOSTIC_RULES.UnknownInstruction}`,
    );
  });

  test('always offers a "disable for user" action targeting the shared command', () => {
    const doc = fakeDocument('        FOOBAR  A,#1');
    const diagnostic = fakeDiagnostic(0, DIAGNOSTIC_RULES.UnknownInstruction);
    const actions = new A51CodeActionProvider().provideCodeActions(
      doc,
      diagnostic.range,
      fakeContext([diagnostic]),
    );
    const userAction = actions.find(
      (a) => a.command?.arguments?.[1] === vscode.ConfigurationTarget.Global,
    );
    assert.ok(userAction);
    assert.strictEqual(userAction.command!.command, DISABLE_RULE_COMMAND);
    assert.strictEqual(
      userAction.command!.arguments![0],
      DIAGNOSTIC_RULES.UnknownInstruction,
    );
  });
});

suite('A51CodeActionProvider: did-you-mean suggestions', () => {
  test('offers close instruction names for a typo, closest first and preferred', () => {
    const doc = fakeDocument('        ALCALL  DELAY');
    const diagnostic = fakeDiagnostic(0, DIAGNOSTIC_RULES.UnknownInstruction);
    diagnostic.range = new vscode.Range(0, 8, 0, 14); // "ALCALL"
    const actions = new A51CodeActionProvider().provideCodeActions(
      doc,
      diagnostic.range,
      fakeContext([diagnostic]),
    );
    const suggestions = actions.filter((a) =>
      a.title.startsWith("Change to '"),
    );
    assert.deepStrictEqual(
      suggestions.map((a) => a.title),
      ["Change to 'ACALL'", "Change to 'LCALL'"],
    );
    assert.strictEqual(suggestions[0].isPreferred, true);
    const [edit] = suggestions[0].edit!.get(doc.uri);
    assert.strictEqual(edit.newText, 'ACALL');
  });

  test('a lower-case typo gets a lower-case suggestion', () => {
    const doc = fakeDocument('        alcall  delay');
    const diagnostic = fakeDiagnostic(0, DIAGNOSTIC_RULES.UnknownInstruction);
    diagnostic.range = new vscode.Range(0, 8, 0, 14); // "alcall"
    const [suggestion] = new A51CodeActionProvider()
      .provideCodeActions(doc, diagnostic.range, fakeContext([diagnostic]))
      .filter((a) => a.title.startsWith("Change to '"));
    const [edit] = suggestion.edit!.get(doc.uri);
    assert.strictEqual(edit.newText, 'acall');
  });

  test('offers no suggestions when nothing known is close enough', () => {
    const doc = fakeDocument('        FOOBAR  A,#1');
    const diagnostic = fakeDiagnostic(0, DIAGNOSTIC_RULES.UnknownInstruction);
    diagnostic.range = new vscode.Range(0, 8, 0, 14); // "FOOBAR"
    const actions = new A51CodeActionProvider().provideCodeActions(
      doc,
      diagnostic.range,
      fakeContext([diagnostic]),
    );
    assert.deepStrictEqual(
      actions.filter((a) => a.title.startsWith("Change to '")),
      [],
    );
  });
});

suite('mergeSeverityOverride', () => {
  test('sets a code that is not already set', () => {
    assert.deepStrictEqual(
      mergeSeverityOverride({ AS002: 'off' }, 'AS001', 'off'),
      { AS002: 'off', AS001: 'off' },
    );
  });

  test('is a no-op (same object reference) if already set to that value', () => {
    const current = { AS001: 'off' } as const;
    assert.strictEqual(mergeSeverityOverride(current, 'AS001', 'off'), current);
  });
});
