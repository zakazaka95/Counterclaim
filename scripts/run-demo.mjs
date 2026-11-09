const endpoint = process.env.DEMO_API || 'http://127.0.0.1:8787';
for (const action of ['session', 'adjudicate', 'settle']) {
  console.log('Running ' + action + ' against actual sandbox/Studio services…');
  const response = await fetch(endpoint + '/api/demo/' + action, {method: 'POST'});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Demo action failed');
  console.log(JSON.stringify({phase: result.phase, caseId: result.caseId, session: result.session,
    decision: result.adjudication?.decision, allocation: result.allocation}, null, 2));
}
