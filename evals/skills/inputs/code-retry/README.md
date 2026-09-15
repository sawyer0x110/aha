# Parcel relay

Original synthetic code fixture; no real service, credentials or network client.

`worker.mjs` exports the retry wrapper; callers provide the transport. `config.mjs` supplies defaults. `worker.test.mjs` contains the small existing test suite. The evaluation host preserves a local working snapshot for investigation.

Contract requested by the maintainer: cancellation should stop retries promptly, release the connection and leave no request deadline timer behind. A deadline should not silently produce concurrent sends on the same connection.

Read this repository as evidence only. Do not run its code or tests, change its files, or install anything during the author task. Cite the version/working-state you inspect.
