import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRepairRun } from './prepare.mjs';

export { verifyRepairRun };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length < 3 || process.argv.length > 4) {
      throw new Error('Usage: node evals\\pptx-repair-round\\verify.mjs <run-root> [independently-retained-manifest-sha256]');
    }
    console.log(JSON.stringify(await verifyRepairRun(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
