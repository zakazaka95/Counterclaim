import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {hashJson} from './canonical.mjs';

/** Resume the same known broadcast after a transport timeout; never silently sign twice. */
export async function trackedWrite({directory, identity, submit, wait}) {
  const identityHash = hashJson(identity);
  await mkdir(directory, {recursive: true});
  const filename = path.join(directory, identityHash + '.json');
  let saved;
  try {saved = JSON.parse(await readFile(filename, 'utf8'));}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  if (saved && (saved.identityHash !== identityHash || saved.chainId !== identity.chainId ||
      saved.contractAddress !== identity.contractAddress || !/^0x[0-9a-fA-F]{64}$/.test(saved.hash))) {
    throw new Error('Stored pending transaction does not match this exact operation');
  }
  if (!saved) {
    const hash = await submit();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Broadcast returned an invalid transaction hash');
    saved = {identityHash, hash, chainId: identity.chainId, contractAddress: identity.contractAddress,
      functionName: identity.functionName, submittedAt: new Date().toISOString()};
    await writeFile(filename, JSON.stringify(saved, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  }
  return {hash: saved.hash, transaction: await wait(saved.hash)};
}
