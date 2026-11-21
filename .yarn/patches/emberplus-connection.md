# emberplus-connection: local changes and upstream plan

The module pins `emberplus-connection@0.3.1` and carries a yarn patch
(`emberplus-connection-npm-0.3.1-a2439212e6.patch`, against `dist/`). This file
tracks every change and every known bug, and what has been sent upstream.

- Upstream: `Sofie-Automation/sofie-emberplus-connection`, branch `main`, head `f50624e` (2026-08-10), version 0.3.1.
  Line numbers below are at `f50624e`.
- Fork: `phillipivan/sofie-emberplus-connection`. Local clone: `~/Documents/development/sofie-emberplus-connection`,
  remotes `origin` (fork) and `sofie` (upstream). Each fix branch is made from `sofie/main`.
- Spec: Lawo's Ember+ Specification (Glow DTD 2.50). A copy, `Ember+ Documentation.docx`, is untracked in the fork's
  root; don't commit it. Its headings aren't numbered, so cite heading path + a quote.
- Upstream tests are jest (`__tests__/*.spec.ts`). The module's vitest tests are in `src/tests/emberplus-connection.test.ts`.
- PR descriptions, one per branch, with titles and compare links: fork `scratch/pr-descriptions/`.
  `scratch/` is git-ignored, but the fork's `yarn reset` script (`git clean -dfx`) deletes it.

## Status (2026-10-04)

| #   | Problem                                                                                                                                                                                                                                                                                                                      | Module carries                                                                                                                                                 | Upstream status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Matrix decoder fails on indefinite-length BER                                                                                                                                                                                                                                                                                | patch                                                                                                                                                          | sent: `fix/matrix-indefinite-length`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7   | Invocation arguments loop and end-of-contents                                                                                                                                                                                                                                                                                | nothing                                                                                                                                                        | sent with #1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | `minimum`/`maximum` encoded with the parameter's type                                                                                                                                                                                                                                                                        | nothing (#3 avoids it)                                                                                                                                         | sent: `fix/parameter-minmax-encoding`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2   | Partial matrix connection report replaces stored connections                                                                                                                                                                                                                                                                 | patch                                                                                                                                                          | sent: `fix/matrix-connection-updates`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 9   | GetDirectory on a matrix times out when the reply has no children                                                                                                                                                                                                                                                            | nothing (not affected)                                                                                                                                         | sent: `fix/matrix-replies-without-children-or-contents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 10  | Matrix decoder treats `contents` as required                                                                                                                                                                                                                                                                                 | nothing (not affected)                                                                                                                                         | sent with #9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3   | `setValue` sends the whole cached parameter                                                                                                                                                                                                                                                                                  | workaround                                                                                                                                                     | sent: `fix/setvalue-value-only`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8   | `Writer.writeEmberParameter` Octets branch inverted                                                                                                                                                                                                                                                                          | nothing                                                                                                                                                        | fixed by upstream PR #50 (inline asn1), if it merges                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5   | Extra `getDirectory` on parameters in `getElementByPath`                                                                                                                                                                                                                                                                     | patch (removed)                                                                                                                                                | sent: `fix/parameter-getdirectory-no-wait`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | Auto-reconnect gives up after 5 minutes                                                                                                                                                                                                                                                                                      | patch (limit removed)                                                                                                                                          | upstream #64 (ianshade, stacked on #61/#62), see §6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 11  | Runtime changes to other properties are dropped                                                                                                                                                                                                                                                                              | nothing                                                                                                                                                        | fixed on fork `master` (`90f47e3`), §11–13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 12  | GetDirectory on a function times out (same cause as #9)                                                                                                                                                                                                                                                                      | nothing                                                                                                                                                        | fixed on fork `master` (`7a6246e`), §11–13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 13  | Two-byte tags aren't decoded                                                                                                                                                                                                                                                                                                 | nothing                                                                                                                                                        | fixed on fork `master` (`7e11344`, `2ec528d`, `568bd74`), §11–13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 14  | S101 parser (0.3.0) mishandles a stray BOF and short frames                                                                                                                                                                                                                                                                  | nothing (consumer side)                                                                                                                                        | pushed: `fix/s101-frame-parsing`, draft PR text below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15  | REAL encoder never writes the exponent length                                                                                                                                                                                                                                                                                | nothing                                                                                                                                                        | fixed on fork `master` (`637d3ea`), §15–16                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 16  | REAL −0.0 sent as +0, and `43` throws on decode                                                                                                                                                                                                                                                                              | nothing                                                                                                                                                        | fixed on fork `master` (`149d96f`), §15–16                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 17  | A rejected S101 frame discards the rest of that TCP read                                                                                                                                                                                                                                                                     | nothing                                                                                                                                                        | fixed on fork `master` (`ea503f6`), §17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 18  | Matrix connect sends the whole matrix, wipes stored connections                                                                                                                                                                                                                                                              | nothing                                                                                                                                                        | sent: `fix/matrix-connect-connection-only`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 19  | Command requests carry the element's cached contents                                                                                                                                                                                                                                                                         | nothing                                                                                                                                                        | sent: #60 `fix/command-request-path-only`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 20  | `connect()` within 5 s of the last attempt never settles                                                                                                                                                                                                                                                                     | nothing (not affected)                                                                                                                                         | fixed on fork `master` (`00fb374`), §6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 21  | After a short drop, re-registration fails on a qualified-root provider                                                                                                                                                                                                                                                       | nothing (affected)                                                                                                                                             | fixed in the library on fork `master`, §21                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 22  | `EmberServer` (provider) duplicates subscriptions, half-removes them                                                                                                                                                                                                                                                         | nothing (consumer only)                                                                                                                                        | fixed on fork `master` (`6484393`); upstream report drafted, §22                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 23  | First reply to a parameter GetDirectory calls the callback twice                                                                                                                                                                                                                                                             | nothing                                                                                                                                                        | fixed on fork `master` (`e8f65c6`), §23                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 24  | A path's second spelling (textual vs numeric) never updates                                                                                                                                                                                                                                                                  | nothing (affected)                                                                                                                                             | library: upstream #51, unreleased, in fork; module: open, §24                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 25  | A numeric path segment can match a sibling labelled with that number                                                                                                                                                                                                                                                         | nothing (affected)                                                                                                                                             | fixed on fork `master` (`aef1116`); upstream open, §25                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 26  | Multi-frame messages sorted into stream/tree by byte 2                                                                                                                                                                                                                                                                       | nothing (can hit it)                                                                                                                                           | fixed on fork `master` (`e4532c4`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 27  | Stream identifier 0 can't be registered                                                                                                                                                                                                                                                                                      | nothing (no streams)                                                                                                                                           | fixed on fork `master` (`c77407a`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 28  | REAL stream values are dropped                                                                                                                                                                                                                                                                                               | nothing (no streams)                                                                                                                                           | fixed on fork `master` (`15a8018`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 29  | Octet streams always read as Float32LE, the format is ignored                                                                                                                                                                                                                                                                | nothing (no streams)                                                                                                                                           | fixed on fork `master` (`a1db48d`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 30  | `subscribe(node, cb)`: cb is never called with stream values                                                                                                                                                                                                                                                                 | nothing (no streams)                                                                                                                                           | fixed on fork `master` (`9faec4e`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 31  | Unsubscribe on a node keeps the subscriptions below it for restore                                                                                                                                                                                                                                                           | nothing                                                                                                                                                        | fixed on fork `master` (`6447c1a`), fork only, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 32  | Matrix decode throws on targets/sources with signal contents                                                                                                                                                                                                                                                                 | nothing (not today)                                                                                                                                            | fixed on fork `master` (`3032fdd`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 33  | A connect request resolves on any report: LOCKED, PENDING, other target                                                                                                                                                                                                                                                      | nothing (affected)                                                                                                                                             | fixed on fork `master` (`ebf013a`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 34  | First connection report stored wholesale; LOCKED's state ignored                                                                                                                                                                                                                                                             | nothing                                                                                                                                                        | fixed on fork `master` (`9f3eac4`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 35  | `parametersLocation` path of 1–2 parts encoded as an integer                                                                                                                                                                                                                                                                 | nothing (provider side)                                                                                                                                        | fixed on fork `master` (`48a4993`), §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 36  | `EmberServer.update(matrix, {connections})` replaces all connections                                                                                                                                                                                                                                                         | nothing (provider)                                                                                                                                             | fixed on fork `master` (`b8bd4b3`), §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 37  | `EmberServer` connect: source 0 duplicated, matrix type not enforced                                                                                                                                                                                                                                                         | nothing (provider)                                                                                                                                             | fixed on fork `master` (`804439f`), §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 38  | `EmberServer` answers a connect only to the matrix's subscribers                                                                                                                                                                                                                                                             | nothing (provider)                                                                                                                                             | fixed on fork `master` (`0e64509`), §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 39  | Merging a full matrix report is quadratic in the target count                                                                                                                                                                                                                                                                | nothing                                                                                                                                                        | fixed on fork `master` (`dc63b42`); upstream open, §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 40  | `EmberServer` ignores `maximumConnectsPerTarget`/`maximumTotalConnects`                                                                                                                                                                                                                                                      | nothing (provider)                                                                                                                                             | fixed on fork `master` (`7f9602b`), §26–39                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 41  | `EmberServer` answers an accepted setValue only to the parent's subscribers                                                                                                                                                                                                                                                  | nothing (provider)                                                                                                                                             | fixed on fork `master` (`e32a58c`), §41–44                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 42  | Qualified element below an unloaded node stored one level too high                                                                                                                                                                                                                                                           | nothing (not affected)                                                                                                                                         | fixed on fork `master` (`2010dc7`), §41–44                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 43  | `EmberServer.update()` skips consumers subscribed to the element itself                                                                                                                                                                                                                                                      | nothing (provider)                                                                                                                                             | fixed on fork `master` (`61af489`), §41–44                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 44  | setValue settled by the reply to the parameter GetDirectory sent before it                                                                                                                                                                                                                                                   | nothing (sets with `awaitResponse` false)                                                                                                                      | won't fix for now (user, 2026-11-15), §41–44                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 45  | Every Ember message BER-decoded twice; codec decode errors only logged                                                                                                                                                                                                                                                       | nothing                                                                                                                                                        | fixed on fork `master` (`0b1b65f`), §17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 46  | A message declaring more content than it holds makes the decoder loop until out of memory                                                                                                                                                                                                                                    | **affected** (any device)                                                                                                                                      | fixed on fork `master` (`6445212`, `e83ac6f`); upstream not checked, §46                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 47  | Parameter `templateReference` coded as UTF8String, not RELATIVE-OID: a libember parameter with one loses the whole message                                                                                                                                                                                                   | nothing (affected if a device uses templates)                                                                                                                  | fixed on fork `master` (`fff9f1f`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 48  | Integers beyond 32 bits written and read wrong (2^31 → −2^31, 2^32−1 → −1)                                                                                                                                                                                                                                                   | nothing (affected: Integer64 values past ±2^31)                                                                                                                | fixed on fork `master` (`dbcd286`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 49  | Null values (Glow 2.50): decoded type becomes Null; encoder writes 0 / "null" / throws                                                                                                                                                                                                                                       | nothing (affected: type checks in actions)                                                                                                                     | fixed on fork `master` (`6eeb078`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 50  | Invocation result without `success` read as undefined (libember: true)                                                                                                                                                                                                                                                       | nothing (affected: `result?.success` in the invoke action)                                                                                                     | fixed on fork `master` (`5027bf0`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 51  | Enum-typed invocation arguments/results written as ENUMERATED, not INTEGER                                                                                                                                                                                                                                                   | nothing (affected if a function declares an enum argument)                                                                                                     | fixed on fork `master` (`cde13e2`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 52  | Unknown or missing command number decoded as Subscribe                                                                                                                                                                                                                                                                       | nothing (provider)                                                                                                                                             | fixed on fork `master` (`3dd3bdb`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 53  | Unknown parameter access value decoded as readWrite                                                                                                                                                                                                                                                                          | nothing                                                                                                                                                        | fixed on fork `master` (`f9b4ff3`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 54  | S101 app bytes give Glow DTD 2.31, not 2.50                                                                                                                                                                                                                                                                                  | nothing                                                                                                                                                        | fixed on fork `master` (`1a118d9`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 55  | S101 non-escaping frames (variant 2) not read; one holding 0xFE/0xFF gives a CRC error                                                                                                                                                                                                                                       | nothing                                                                                                                                                        | added (`feat:`) on fork `master` (`a93e9e3`, `8e3358d`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 56  | S101: slot ≠ 0 rejected, DTD ≠ Glow decoded as Glow, command 0x03 reported as an error                                                                                                                                                                                                                                       | nothing                                                                                                                                                        | fixed on fork `master` (`22ef42f`, `f179a5c`, `ccb6b68`); message type ≠ 0x0E too (`ea737ad`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 57  | BER reader edge cases: empty INTEGER, multi-byte BOOLEAN, 5+ length bytes, unnamed enum map entry                                                                                                                                                                                                                            | nothing                                                                                                                                                        | fixed on fork `master` (`27622ac`, `e2a02a9`, `007b201`, `0de0308`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 58  | A RELATIVE-OID inside a value decoded as an absolute OID (`1.2.3` → `0.1.2.3`)                                                                                                                                                                                                                                               | nothing                                                                                                                                                        | fixed on fork `master` (`c786f67`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 59  | `S101Codec` emits single-packet payloads as views of its reused unescape buffer: a listener that keeps one sees it overwritten by the next escaping frame                                                                                                                                                                    | nothing (the library decodes in the event)                                                                                                                     | fixed on fork `master` (`cff740b`), §47–58                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 60  | `EmberServer` handed `onInvocation` whatever was at the Invoke's path as a function (a node, a parameter, or for the root the whole tree)                                                                                                                                                                                    | nothing (provider)                                                                                                                                             | fixed on fork `master` (`eccdf66`), found 2026-11-16 doing typing item 9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 61  | Decoded root collection keyed by number: elements numbered 1 then 0 (or 2, a qualified one, 1) decode as one; order lost                                                                                                                                                                                                     | nothing (rare: numbered 0 after another, or mixed)                                                                                                             | fixed on fork `master` (`4e103e6`), §Remaining casts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 62  | A qualified element among children kept under the key `undefined`; a template's element kept whatever it was                                                                                                                                                                                                                 | nothing (malformed input)                                                                                                                                      | fixed on fork `master` (`d7bd7b3`), §Remaining casts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 63  | GetDirectory/Subscribe on a template sent without the command (its encoding has no children), then timed out                                                                                                                                                                                                                 | nothing                                                                                                                                                        | fixed on fork `master` (`a1e16f5`), §Remaining casts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 64  | An Invoke resolved by a report on the function (matched by path) instead of by its invocation result                                                                                                                                                                                                                         | nothing (affected if a device reports on a function mid-invoke)                                                                                                | fixed on fork `master` (`9cbe73a`), §Remaining casts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 65  | `EmberServer.update(matrix, …)` merged whatever was given as connections, unchecked                                                                                                                                                                                                                                          | nothing (provider)                                                                                                                                             | fixed on fork `master` (`089e092`), §Remaining casts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 66  | `Writer.writeOID` accepted a single arc and wrote NaN                                                                                                                                                                                                                                                                        | nothing (unused by the library)                                                                                                                                | fixed on fork `master` (`3f09e85`), §Remaining casts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 67  | A reported qualified element put into the client's tree kept its `path`, and its children's `parent` was the reported element (`getInternalNodePath` gave `3` for 1.2.3)                                                                                                                                                     | nothing (affected: qualified-root providers)                                                                                                                   | fixed on fork `master` (`fa00b7b`), §Remaining casts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 68  | GetDirectory on an element the tree doesn't have, under a loaded parent, times out: the reply is put into the tree but reported at the parent's path, so the request (at the element's path) never matches                                                                                                                   | nothing yet (blocks: inline `parametersLocation`, which the spec says isn't listed; module-built paths such as `labelsLocation` or connection parameter nodes) | fixed on fork `master` (`af75640`, pushed): an inserted element also makes a change at its own path (`insertedChange`: the tree node, `emptyNode`, reported connections), at the top level too. Tests (GetDirectory below a loaded element with a callback called once, at the top level, a matrix connect on an unloaded matrix) fail without it (checked). Device check (192.168.3.71, module defaults): GetDirectory on a hand-built `1.4` with only the root loaded answered in 1.7 s, matrix in the tree                                                                                                                                       |
| 69  | A spec-compliant answer to a GetDirectory on a node without children (the node "without any properties set", _Glow › Commands › GetDirectory_) times out when the node's parent, or its whole device, isn't loaded: the changes for elements reported as they came carry no `emptyNode`, so the wait for children never ends | nothing yet (hits `getMatrixLabels` on an empty label set whose `basePath`'s parent isn't loaded)                                                              | fixed on fork `master` (`42664bd`, changelog `3c3b71c`), found 2026-11-16 with a temporary client test (timed out with nothing loaded and with only the device loaded; resolved with the node above loaded, where `insertedChange` set it): both changes now come from `reportedChange`, which sets `emptyNode` as `insertedChange` does. Tests: those cases, `getMatrixLabels` on an empty set with nothing of its `basePath` loaded (fail without it, checked), and a reply with properties still waiting. A reply with properties but no children (a non-compliant provider) still waits: the spec says it can't be told from an ordinary update |

"Sent" means pushed to the fork on 2026-10-03/04 with a description ready; open the PR from the compare link if
not done yet, check "About the Contributor" and the Status boxes, and cross-link PR numbers.

Merge notes:

- The #2 and #9 branches both add an import to the same line in `src/Ember/Client/__tests__/index.spec.ts`.
  Whichever merges second needs a one-line rebase. (Deliberate: a separate import line would merge silently and
  import `MatrixImpl` twice.)
- Once #10 lands, the comment in #1's "packets captured from a test device" tests about the missing-contents error
  is stale.

## Device evidence (2026-10-03)

Probe: `examples/matrix-connections-probe.js` on the fork's local branch `debug/matrix-probe` (not pushed; based on
the #1 branch so indefinite length decodes). Portable zip: fork `scratch/matrix-probe.zip` (Node 20+). Captures, one
hex packet per line: fork `scratch/dhd.txt` (10.249.56.13, matrix 0.5.2) and `scratch/xaci.txt` (10.249.56.11,
matrix 1.4). The PRs call the first one "test device", unnamed, and only use its small matrix packets.

- Both devices use indefinite length everywhere. Upstream's decoder throws `Expected 0xa0: got 0x0` on the matrix
  description (both), the targets and sources lists (test device) and the full reply (second device).
- The test device answers a GetDirectory on its matrix with: targets list, sources list, then one message per
  target, each `disposition=MODIFIED`. Upstream `EmberClient` holds only the last target.
- The second device sends all 1648 targets in one 75 KB reply, then one target per change (no disposition).
  Upstream `EmberClient` drops to 1 target at the first change.
- Neither sends contents in connection reports (#10) or children in GetDirectory replies (#9).
- Disconnect from the test device: `target 13 <- (none)` (empty sources).

2026-11-16, fork `master` at `bf60f5f` (built `dist`), read-only probes (GetDirectory and Subscribe only; scripts were
in the session scratchpad, `probe-once.js` the one-connection version):

- 192.168.3.71:9003, all over one connection: top level `0 System`, `1 Audio`, `2 Logic`; matrix at `1.4` (identifier
  `Matrix`; the textual path `Audio.Matrix` resolves to it too): one-to-N, non-linear, 2208 targets, 2696 sources,
  2208 connections in one report (19 with a source), `parametersLocation` `1.2`. Labels: one set, "Default Labels",
  `basePath` `1.0`: `1.0.1` 2208 string parameters (every target, e.g. `"    1   D/A   1"`), `1.0.2` 2696 (every
  source), numbered by signal as the spec says. 41 packets (422 KB), all with an indefinite-length root; no decode
  warnings, no keep-alive requests in 28 s. No reports in the seconds after subscribing (nothing changed).
- 192.168.3.73:9003 (a wrong address at first): no matrix; the same signals as nodes, `1 Targets`/`2 Sources`, each
  with `Label`, `Meter`, `Source` (targets: the connected source, READ_WRITE integer), `BoardType`, `Protect`.
- `System.ConnectedClients` (`0.5`: `Number`, then `Connection#1`… with `InUse`, `IPAddress`, `Port`, `Ident`) lists
  each consumer by address and port. The Mac reaches the devices over a VPN (`utun4`, 192.168.252.2). A cleanly closed
  connection leaves the list. Earlier probes (one connection per run, several runs in a row) were dropped twice
  mid-run ("Socket was disconnected"); afterwards .71 still listed a session (port 58203) that no longer existed on
  the Mac, and a socket to .73 (port 58204) sat in FIN_WAIT_1 with 34 bytes unsent: those connections died between
  the Mac and the devices without the devices seeing them close. Which program owned them isn't known (the user's Mac
  Ember+ Viewer, `emberview`, held its own connection to .71, port 58235, throughout). Not seen with one connection.
- Library behaviour seen: `getElementByPath` on a client whose tree isn't loaded returned undefined (it didn't fetch
  the root). Since `28f32d4` (on fork `master`) it sends a GetDirectory on the root itself when the
  top level doesn't have the path's first element and none has been sent (answered or on its way); lookups made
  together share it; a failed one rejects the lookup and the next sends another. Unit tests only: the device check
  couldn't be made (below).
- 192.168.3.71 is the XACI (user, 2026-11-16). Requests naming a target or source its matrix doesn't have (user
  approved: nonexistent targets, and target 1, which had no source, with a nonexistent source; one connection,
  module defaults; `probe-invalid-signals.js`): connect target 9964 <- source 9964, connect 9964 <- 2, absolute
  9964 <- 2, connect 1 <- 9964 (targets and sources go up to 8964, non-linear). The XACI answered none of them: no
  report, no disposition, no error, the connection kept; each request timed out (3 s). Target 1 still had no source
  afterwards (checked read-only), target 2 kept source 2, and the missing target was never reported. So: a request
  it can't carry out is ignored silently, even for a target that exists. Since `d00707b` (on fork `master`)
  the client refuses such a request before sending ("Matrix 1.4: target 9964 is not one of its targets"), when the
  matrix's lists or a linear matrix's counts tell (`Model.hasSignal`); the module only shows the rejection. For
  `EmberServer` (user's call): `047398a` drops a connection naming a missing target or source before
  `onMatrixOperation` (which gets the rest) and `updateMatrixConnection` refuses one, with a new `warn` event; a
  real target is answered with its current state, a missing target not at all (as the XACI). Changelog entries
  `be71394`, `6052d0e`.
- Later on 2026-11-16, 192.168.3.71:9003 reset every new connection (`read ECONNRESET`) about 0.3 s after it opened,
  as the first request (a root GetDirectory) went out, with the build before `28f32d4` too, so not that change. The
  user's Ember+ Viewer stayed connected (it had reconnected: port 64862). Possibly the device's client slots, filled
  with sessions it never saw close (see above); not checked, as `ConnectedClients` can't be read while it resets. By the next check it accepted connections again
  and listed 2 clients (the Viewer, port 50188, and the check itself); the stale session was gone.

## 1. Matrix decoder and indefinite-length BER (sent)

Labels, targets and sources loops read the `00 00` end-of-contents marker as a tag and threw; the connections loop
consumed it and `skipNext` dropped the next connection. Fix: skip end-of-contents in all four loops, as the
`EmberFunction` and `InvocationResult` decoders do.

Tests: 10 round-trips through `__tests__/indefiniteLength.ts`, plus 3 packets captured from the test device
(description with a label, targets, sources). The helper follows the spec's rule that both tags of an explicit
tagging use the same length form, so an explicit tag around a primitive stays definite.

Spec: _EmBER › Basics › Length forms_ ("both length forms … are allowed; … indefinite form … for containers only"),
_EmBER › Implementation recommendations › Encoder_ ("free to use the indefinite length form"), _EmBER › Basics ›
Overview_. X.690 8.1.3.6 and 8.1.5 define the form and the `00 00` marker.

## 7. Invocation arguments (sent with #1)

Same missing check as the connections loop. Corrected impact: with spec-conformant input it only adds one spurious
`Unexpected BER context tag '0'` error (the server ignores decode errors); arguments are lost only if the encoder
also makes the explicit `[0]` around each argument indefinite. Found by reading, no device sends invocations this way.

## 4. `minimum`/`maximum` (sent)

Corrected: only matters when a limit is set. A String parameter's numeric limit goes out as a UTF8String (main
case). A Boolean or Octets parameter throws only if it has a limit, which providers don't normally send (never
seen in practice). Fractional limits on Integer/Enum were truncated toward zero by `writeInt`.

Fix: `writeMinMax(value, Ber.CONTEXT(3|4))`: `null` → NULL, Real parameter or fractional → REAL, else INTEGER. A
non-number limit is left out, not thrown on: decoded limits can be strings from a provider with this bug, and
`setValue` (#3) re-encodes them. `defaultValue` keeps the parameter's type (DTD `Value`).

Spec: DTD `MinMax ::= CHOICE { integer Integer64, real REAL, null NULL }`; _Parameter Contents › Minimum / Maximum_
("may either be a real or integer value"); _Requesting Connection Parameters_ example gives an Integer parameter
Real limits. NULL means "no longer present" (_EmBER › Types › Null_), so don't send NULL in place of a value.

## 2. Matrix connection updates (sent)

`_updateMatrix` copied `connections` with `updateProps` before merging. Fix: drop `'connections'` from that list.
Tests: a hand-built matrix, and six captured test-device reports (four one-target replies, a change, a disconnect)
into a hand-built copy of its matrix, so the PR doesn't depend on #1.

Spec: _Use Cases › Issuing Connects / Disconnects_ (replies list only changed targets), _Performance Characteristics_
("Reporting a single connection"), _Parameter_ ("notifications should only contain the properties that have
changed"), _ConnectionDisposition_ (sources are absolute per target). Counter-sentence, addressed in the PR:
_Type Definitions › Matrix › connections_: "The provider must report one Connection object for each target."

## 9. GetDirectory on a matrix (sent)

`getDirectory` on an element waits for a reply with children (`ExpectResponse.HasChildren`), exempting only
parameters (`Client/index.ts:578-586`). A matrix is a leaf, so the request times out though the reply arrived. Fix:
exempt matrices too. `EmberServer` adds an empty children collection to every reply, so it isn't affected.
`expand()` awaits a GetDirectory on every matrix, so it would reject at the first one with such providers (inferred,
not run on a device; the module doesn't use `expand()`). Split replies (test device) now resolve on the first message.

## 10. Matrix `contents` optional (sent with #9)

`decoder/Matrix.ts:79` used `check()`, which only acts when the value is missing: records an error (default) or
throws (`substituteForRequired: false`). Fix: create the empty contents without an error. Strict decoding now
accepts these messages too. `identifier` inside contents is still checked when contents are present.

## 3. `setValue` sends the whole cached parameter (sent)

`setValue` sends the cached node, so a set carries every property from discovery plus children, and writes the
value into the tree before the provider confirms. Module workaround: `makeSetValueRequest` in
`src/actions/parameter.ts`; test `set value string requests`. Suggested fix: build a fresh qualified parameter with
only path and value inside `setValue`, without the `type` field (see below); the early tree write is the
maintainers' call.

Spec: _Ember+ usage › Changing a parameter value_ ("the consumer only has to send the value"), _The EmBER library ›
Changing a parameter value_ (sample sets only the value), matrix use cases ("the standard procedure for changing a
parameter"), _When to use the element number or identifier_ ("never required to transmit the identifier"). Nothing
forbids extra properties; what a provider does with them is undefined. _Value change requests_: a provider replies
with the current value, so the early write gets corrected.

Evidence (2026-10-05), details in the fork's `scratch/setvalue-findings.md`: Ember+ Viewer (capture in `scratch/`,
decoded with `scratch/decode-stream.js`) and Lawo's libember_slim sample consumer both send path + value only, with
no `type` field, and libember_slim's reference provider ignores every field but the value. Open decision: the
library writes `type` whenever `parameterType` is set (that one property also picks how the value is encoded), and
`EmberServer` replies need it, so `setValue` needs an explicit value-only encoding path. The module's current
workaround still sends `type`.

Sent (2026-10-05): `fix/setvalue-value-only` (`bd579c3`), pushed to the fork. `setValue` builds a fresh
`QualifiedParameter` with the path and a parameter holding only the value (the type only selects the encoding) and no
longer writes into the tree before the reply. Rather than a separate encoding path, the encoder leaves out `type`
for any parameter that carries only a value: `EmberServer` always sends whole stored elements, so only a provider
tree parameter with nothing but a value would lose it (consumers still infer the type, except for an enum without an
enumeration, a trigger with a value or a `null` value). 8 tests (6 fail without the change). Encoded through the
library and converted to indefinite length, the requests are byte-identical to Ember+ Viewer's captured requests for
the gain, enum and boolean. Not run against a device, so the PR leaves "tested by the author" unticked. PR text: fork
`scratch/pr-descriptions/fix-setvalue-value-only.md`. Once merged, the module's workaround in
`src/actions/parameter.ts` can go (its request would also lose `type`, being value-only).

## 8. `Writer.writeEmberParameter` Octets branch (open)

Condition inverted; the method is unused (`encodeParameter` has its own switch). Delete it or fix it.

Upstream PR #50 (`feat/inline-asn1-lib`, Julusian, open) replaces the branch with a plain `writeBuffer` as part of
its port, so no separate PR is needed if #50 merges.

## 5. Extra `getDirectory` in `getElementByPath` (sent)

Removed in the module with the 0.2.1 → 0.3.1 upgrade (`a814c50`); **the reason was never recorded**. Spec is mixed:
for the request, _GetDirectory_ ("can also be applied to a parameter") and _Subscribe_ ("at the latest when a
parameter has been queried by GetDirectory"); against requiring it, _Notifications_ (only the parent's GetDirectory
is required) and _Remarks on the Behaviour of Embedded Devices_ (small providers may never answer a GetDirectory).
Proposal: keep the request, don't fail the lookup when it times out.

Evidence (2026-10-05), details in the fork's `scratch/setvalue-findings.md` ("GetDirectory on parameters"): Ember+
Viewer never sent a GetDirectory to a parameter in the capture; it queried the parent node (`dirFieldMask=ALL`)
before setting its parameters and relied on that subscription. Lawo's C sample consumer only sends GetDirectory on
an explicit `dir`. Also found: `EmberClient` keeps its tree across a reconnect, so after an S101Client auto-reconnect
cached lookups query nothing and updates stop; the extra parameter GetDirectory happens to paper over that (inferred,
not reproduced; the module makes a new client per connection).

Options:

1. **Query the parent instead.** Track which nodes have had a GetDirectory on the current connection (cleared on
   disconnect) and query the parameter's parent if it hasn't. Matches Viewer and _Notifications_, and fixes the
   reconnect gap for lookups. To also restore existing subscriptions after a reconnect, re-query the parents of all
   subscribed paths on `connected` (overlaps #6).
2. **Keep the parameter GetDirectory, but don't wait for it** or fail the lookup when it times out.
3. **Drop it**, as the module's patch does. Relies on the walk having queried the parent, which it doesn't for cached
   paths or after a reconnect.

Proposed direction (discussed 2026-10-05): 1 combined with 2's tolerance.

- Resolving a path: if the parameter's parent hasn't been queried on this connection, send it a GetDirectory and
  mark it as queried when sent (so a provider that never answers isn't asked again on every lookup).
- Wait for that reply only when it's needed to find the child, as the walk does today. If the child is already
  cached, don't block the lookup and don't fail it on a timeout: the query is only there to (re)subscribe.
- Don't query the parameter itself; neither Lawo consumer does. If a provider turns out to need it (_Subscribe_: "at
  the latest when a parameter has been queried by GetDirectory"), make it an opt-in, also non-blocking.
- On `connected` after a reconnect, re-query the parents of all subscribed paths, without blocking, through the
  same tracking. One request per distinct parent per connection, far fewer than one per parameter.
- The queried-node tracking must be cleared on disconnect, or the reconnect fix doesn't work.
- Why the two fit together: 1 decides _what_ to query (the parent, once per connection, as Lawo's consumers and
  _Notifications_ do); 2 decides _how_ to treat the reply (a cached lookup doesn't wait or fail, which protects
  against providers that answer slowly or never; _Remarks on the Behaviour of Embedded Devices_ lets small providers
  ignore GetDirectory entirely).
- Caveat: element numbers are only stable within a session, so subscriptions keyed by numeric path can go stale if a
  provider renumbers across a reconnect (rare: most providers number statically). Same concern as #6; the parent
  re-query after a reconnect is a natural place to detect it.
- Behaviour change to state in the PR (and raise in the issue first): `getElementByPath` on a cached path no longer
  waits for a fresh GetDirectory reply before returning.

Fixed (2026-10-05), with a different direction from the one above: branch `fix/parameter-getdirectory-no-wait`
(`e090b95`), pushed to the fork 2026-10-05, PR text in fork `scratch/pr-descriptions/fix-parameter-getdirectory-no-wait.md`. The parameter GetDirectory is **kept, but no longer awaited**: it goes out
with `ExpectResponse.None`, so there's no pending request, timeout or failure. This covers both kinds of provider: one
that needs the GetDirectory before it reports changes still gets it, and its reply updates the tree and calls the
lookup's callback (now registered before the request is sent); one that never answers costs one unanswered message.
Before, the lookup threw `Request timed out` after 3 s on such a provider. Why the change of direction: the user
understands some devices need the parameter GetDirectory to subscribe. Upstream added it in PR #40 (`c6f684c`, Mint
de Wit, 2024-09) citing the spec's "should vs shall", without naming a device. Rechecked the Viewer capture: Viewer
sent GetDirectory only to nodes and the matrix (mask ALL), plus Unsubscribe on collapse, never to a parameter.
Trade-off for the PR: `getElementByPath` returns the value it has (parent's reply or cache) rather than waiting for
the parameter's reply; the fresh value arrives through the callback. Left for later: the parent tracking and the
re-query after a reconnect (the module was thought unaffected because it makes a new client per connection, but it
keeps the same client after a drop shorter than 30 s, see §21). 2 tests, both fail without the
fix (the second with the real `Request timed out`). Once merged, the module can drop this hunk of its patch.

## 6. Auto-reconnect limit (open)

60 attempts × 5 s, no option. No spec basis (only _Keep-Alive mechanism_). PR: configurable count, 0/Infinity for
unlimited, rebased onto upstream #51. Check stale cached paths after a reconnect: element numbers are per session
(_Parameter properties › Number_, _Offline trees_).

Upstream stack by ianshade (TV 2 Norge), reviewed 2026-11-08, all open, each based on the previous:

- #61 `fix/connect-timeout-timer`: an attempt's connect timeout is only cleared on success, so a replaced or refused
  attempt's timer can destroy the live socket and `removeAllListeners()` on it, leaving the client "Connected" with
  no socket for good. Also makes a refused attempt resolve `connect()` at once with an `Error`.
- #62 `fix/stop-reconnecting-after-disconnect`: `disconnect()`/`discard()` don't stop the retry interval or a pending
  attempt, and the next retry sets `_shouldBeConnected` back to true. Hits the module: it `discard()`s and builds a new
  client on every throttled reconnect, so after a drop while the device is down each old client keeps redialling and
  holds its own idle session once the device is back.
- #64 `fix/keep-reconnecting`: removes the 60-attempt cap (no option) and adds a README section. Needs #62 first, or
  discarded clients would redial forever.

Fork (`master` at `05c2614`): #61 and #62 cherry-pick cleanly, 291 tests pass, `tsc` clean; 7 of the 8 new tests fail
on the fork's current `S101Client`. The new spec needs `.js` imports (`'../../../index.js'` for the barrel) and
`eslint --fix` for the fork's lint. #64 conflicts with the fork's `reconnectAttempts` option (`EmberClientOptions` and
the 4th `S101Client` constructor parameter, < 0 = unlimited): either drop the option as upstream does, or keep it and
default it to unlimited.

Done 2026-11-08 on fork branch `feat/reconnect-backoff` (off `master` `05c2614`; fast-forwarded into `master` the same day, not pushed): #61, #62,
#64 cherry-picked with `-x`, the option dropped (`BREAKING CHANGE` footer on the #64 commit), the spec's imports in the
fork's style, then the fork's own `d8673d0` "back off reconnect attempts from 5 s to a minute": linear, +5 s per retry,
capped at 60 s, reset on connect and on `disconnect()`. 295 tests. Real TCP against a closed port dialled at 0, 5, 15,
30 s. Upstream candidate on top of #64 if wanted. Still possible: a provider that accepts and then closes at once (a
connection limit, say) resets the backoff each time, so it's retried every 5 s, as before.

#20, found reviewing #61/#64: `connect()` called within `_autoReconnectDelay` of the last attempt only makes sure the
interval runs and returns a promise that never settles, even after the client connects. `EmberClient`'s constructor
already starts an attempt (`autoConnect` true), so `new EmberClient(); await client.connect()` never settles, whether
the attempt succeeds or is refused (checked with #61–#64 applied). #61 also adds a new way in: a caller that retries
`connect()` as soon as it resolves with an `Error` now lands inside the window (before, the `Error` came after 5 s).
#64's README promises "`connect()` resolves once connected" and its example awaits it right after the constructor.
The module only uses the `connected` event and `.catch`, so it isn't affected.

Fixed 2026-11-08 on the fork branch, `00fb374` "settle connect() when it doesn't start an attempt": every
`connect()` waits in a list that only the client's current attempt settles (void on connect, the `Error` on failure);
a call that doesn't start an attempt settles with the one under way or the next retry; `disconnect()` settles the
waiting calls with an `Error`. A replaced attempt's timeout and an abandoned attempt's close (after `disconnect()`)
don't settle the list. Real TCP: `new EmberClient(); await connect()` returns at once, connected or with the refusal
`Error`; without the fix it hung. 303 tests. For upstream it would have to sit on top of #61 (it reworks #61's
per-attempt settling) and be adapted to #64's fixed 5 s retry interval (no `retryDue` there).

## 21. Re-registration after a short drop (open, 2026-11-08)

The module re-registers on every `connected` (`handleConnected`: GetDirectory on the root, then `finalizeSetup()` ->
`registerParameters()` / `subscribeActions()` / `checkFeedbacks()`, each a `getElementByPath(path, cb)`). After a drop it
only rebuilds the client through `throttledReconnect` (trailing-only, 30 s), and `handleConnected` cancels that. So a
drop the library reconnects within 30 s keeps the same `EmberClient` and its cached tree, and `getElementByPath` on a
cached path sends nothing for the nodes along it. Whether the provider's subscriptions come back then depends on how
it answers the root GetDirectory:

- Numbered top-level nodes (XACI test device, the library's `EmberServer`): `_applyRootToTree` replaces a cached
  top-level node that comes without children (`this.tree[number] = rootElement`), dropping everything below it, so
  the walks re-query every parent. Subscriptions restored, by accident of the merge code.
- Qualified top-level nodes (DHD test device: `QualifiedNode` path `0` "Device"): merged into the cached node, no
  change, so nothing resolves the root request: `Request timed out` after 3 s. The module's catch sets a warning,
  `disconnect()`s and rebuilds after 30 s: no updates, and a warning status, for about 33 s.

Reproduced with the library's `EmberServer` (it subscribes per connection on GetDirectory, sends a parameter's changes to
its parent's subscribers, drops a connection's subscriptions on close), parameter at `1.1.1`, root reply overridden to
qualified for the DHD case. Same on module master (0.3.1 + patch) and the fork; the fork's parameter GetDirectory
changes neither case. Script: fork session scratchpad `resubscribe.cjs` (not kept). The DHD case is simulated from its
capture, not run against the device.

Also: each same-client re-registration adds another `_subscriptions` entry per path. 0.3.1 calls only the first
(`find`); the fork calls all (`filter`), so `handleChangedValue` runs once more per change after each short drop.

Decided 2026-11-08: the library restores subscriptions itself, the module shouldn't have to. Done on fork branch
`feat/reconnect-backoff`, now in `master` (not pushed):

- `e602fcb` fix: a root GetDirectory reply merges into cached top-level nodes (numbered ones no longer replace the node and
  drop what's below it) and resolves the root request (the qualified-root timeout).
- `4180483` feat: `EmberClient` remembers each GetDirectory and Subscribe that reached the provider (path + element type,
  `getDirectory`, `getElementByPath`'s parameter GetDirectory, `expand`, `subscribe`), forgets a path on Unsubscribe,
  and on every `connected` sends them again (root first, parents first, `ExpectResponse.None`) before emitting
  `connected`. Tree and callbacks are kept; replies refresh values and call the callbacks. README updated.
- Checked over TCP with `EmberServer`: a consumer doing nothing after the drop gets root/node/parent/parameter
  subscriptions back and the next change, numbered and qualified root alike. 309 tests.

Module to-do once it depends on this: stop re-registering on a same-client reconnect (in `handleConnected`, skip the
root GetDirectory + `finalizeSetup()` re-registration when it's a reconnect of the same client), or every short drop
adds another callback per path (the fork calls them all). Keep `finalizeSetup()` for the first connection and config
changes. The `ReconnectInterval` comment ("destroys socket after 5 minutes") is stale since #64. Not addressed: element renumbering across sessions. Provider-side subscription bugs found on the way: §22.

## 22. `EmberServer` duplicates subscriptions and only half-removes them (2026-11-08)

Provider side: the library's own `EmberServer` (`src/Ember/Server/index.ts`), same code in upstream `main` (`f50624e`).
Doesn't affect the module, which is a consumer; affects anything that uses the library as a provider (emulators, test
setups, the reproduction scripts used for #21).

How it keeps subscriptions: `_subscriptions[path]` is a list of connections. A GetDirectory or Subscribe from a
connection adds it to the path's list (`_subscribe`); Unsubscribe removes it (`_unsubscribe`); a connection closing
removes it from every list (`_clearSubscription`). `update()` sends a change once per entry in the list for the changed
element's path: its parent's path for a parameter (or other non-node element), its own path for a node; matrix
connection changes go to the matrix's own path.

Bugs:

1. `_subscribe` appends the connection every time, without checking whether it's already in the list. N GetDirectories
   on a node (or matrix) from one connection mean N entries, and every change to that node or its parameters is sent N
   times. GetDirectories on a parameter itself only pile up entries, since its changes go to its parent's list.
2. `_unsubscribe` calls `splice` inside `forEach`, so the entry after each one removed is skipped. Of N entries for one
   connection it removes ceil(N/2):
   - after an Unsubscribe, the consumer still gets floor(N/2) copies of every change, where it should get none;
   - when the connection closes, `_clearSubscription` leaves floor(N/2) entries per path for it. The closed connection
     object is kept alive and every later change loops over it (`sendBER` just returns false, so no crash). Grows with
     each connection that had duplicates.

Measured over TCP (fork build, script in the session scratchpad, not kept): 1, 2, 3, 4 GetDirectories on `1.1` -> 1, 2,
3, 4 messages per change to its parameter; 3 GetDirectories on the parameter `1.1.1` -> no change in that count; one
Unsubscribe on `1.1` with 4 entries -> still 2 messages per change; after the client disconnected `'1.1'x1 '1.1.1'x2`
were left for it.

When consumers send repeat GetDirectories: a consumer re-querying a node on the same connection (a refresh, or a
re-registration like the module's on a same-client reconnect). The fork's subscription restore (§21) sends one per path
per connection, so on its own it doesn't create duplicates.

Fixed in the fork 2026-11-08: `6484393`, made on `feat/reconnect-backoff` and fast-forwarded into `master` (not pushed).
`_subscribe` skips a connection already in the list; `_unsubscribe` uses `filter`. With the first, requests can't list a
connection twice, so a test sets up a duplicated list directly for the second. Tests: `src/Ember/Server/__tests__/
index.spec.ts` (the server had none), 5 tests, each fix fails its own test when reverted alone. No upstream PR (none
being sent for now); report below, to file later.

### Bug report, ready to file upstream

**Title:** EmberServer sends a change once per repeated GetDirectory/Subscribe, and Unsubscribe or a disconnect removes
only half of a consumer's subscriptions

**Affected:** `emberplus-connection` 0.3.1 (npm) and `main` at `f50624e`, `src/Ember/Server/index.ts`:
`_subscribe` L313-315, `_unsubscribe` L316-324, `_clearSubscription` L325-329 (run on disconnect, L71). `_subscribe` is
called for Subscribe (L262) and GetDirectory (L266); changes are sent once per list entry in `update()` (L133-139) and
`updateMatrixConnection()` (L176-182).

**Steps to reproduce** (public API, except reading `_subscriptions` at the end; save as `repro.js`, run
`node repro.js` with the package installed):

```js
const { EmberServer, EmberClient, Model } = require('emberplus-connection')
const { NumberedTreeNodeImpl, EmberNodeImpl, ParameterImpl, ParameterType } = Model
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
	// Provider: 1 device > 1.1 channel > 1.1.1 gain
	const gain = new NumberedTreeNodeImpl(1, new ParameterImpl(ParameterType.Integer, 'gain', undefined, 0))
	const channel = new NumberedTreeNodeImpl(1, new EmberNodeImpl('channel'), { 1: gain })
	const server = new EmberServer(9099)
	await server.init({ 1: new NumberedTreeNodeImpl(1, new EmberNodeImpl('device'), { 1: channel }) })

	// Consumer: look up the parameter, counting the reports of each change to it
	const client = new EmberClient('127.0.0.1', 9099)
	const connected = new Promise((resolve) => client.once('connected', resolve))
	client.connect().catch(() => null)
	await connected
	await (
		await client.getDirectory(client.tree)
	).response
	let reports = 0
	await client.getElementByPath('1.1.1', () => reports++)
	await sleep(200)
	const change = async (label) => {
		reports = 0
		server.update(gain, { value: Number(gain.contents.value) + 1 })
		await sleep(200)
		console.log(`${label}: ${reports} report(s) of one change`)
	}
	await change('after the lookup (one GetDirectory on 1.1)')

	const node = client.tree[1].children[1]
	for (let i = 0; i < 3; i++) await (await client.getDirectory(node)).response
	await change('after 3 more GetDirectories on 1.1')

	await client.unsubscribe(node)
	await sleep(200)
	await change('after an Unsubscribe on 1.1')

	client.discard()
	await sleep(300)
	const left = Object.entries(server._subscriptions).filter(([, c]) => c.length)
	console.log(
		'entries left after the consumer disconnected:',
		left.map(([p, c]) => `${p}: ${c.length}`).join(', ') || 'none',
	)
	server.discard()
	process.exit(0)
})()
```

**Expected:** 1, 1 and 0 reports; no entries left.

**Actual (0.3.1, 2026-11-08):**

```
after the lookup (one GetDirectory on 1.1): 1 report(s) of one change
after 3 more GetDirectories on 1.1: 4 report(s) of one change
after an Unsubscribe on 1.1: 2 report(s) of one change
entries left after the consumer disconnected: 1.1: 1
```

**Cause:** `_subscribe` appends the connection to the path's list every time; `update()` and
`updateMatrixConnection()` send once per entry. `_unsubscribe` calls `splice` inside `forEach`, so the entry after each
removed one is skipped: of N entries for a connection it removes ceil(N/2), on Unsubscribe and, through
`_clearSubscription`, when the connection closes. The closed connection then stays in the lists for good (`sendBER`
returns false, so no error), and every later change loops over it.

**Suggested fix:**

```ts
private _subscribe(path: string, client: S101Socket) {
	const clients = this._subscriptions[path] || []
	if (clients.includes(client)) return
	this._subscriptions[path] = [...clients, client]
}
private _unsubscribe(path: string, client: S101Socket) {
	if (!this._subscriptions[path]) return
	this._subscriptions[path] = this._subscriptions[path].filter((c) => c !== client)
}
```

Fixed this way, with tests, in the fork `phillipivan/sofie-emberplus-connection`, commit `6484393` on `master` (check
it's been pushed before linking it).

## 23. First reply to a GetDirectory on a parameter calls its callback twice (fixed in the fork, 2026-11-15)

Client side, fork and upstream. The library's `EmberServer` answers a GetDirectory on a parameter with the parameter and
an empty `children` set (`_handleGetDirectory`: `qualified.children = {}`). `EmberClient._updateTree` reports the contents
as one change and, because the cached parameter has no `children` yet, assigning the empty set as a second change for
the same path, so the path's callbacks run twice. Later replies run them once (the cached parameter now has
`children: {}`). Measured over TCP with the fork build: 2, 1, 1 callbacks for three replies. Seen with the library's
own provider; not known whether real devices send an empty children set. Fix candidate: in `_updateTree`, don't treat an
empty `children` set as children to insert (or don't add the second change when nothing was inserted).

**Fixed in the fork 2026-11-15** (`e8f65c6`, branch `fix/callback-once-per-reply` off `master` `637d3ea`,
fast-forwarded into `master` the same day, not pushed). Broader than the empty set: the first reply that brings real children to a node also made two changes
(contents + children, same path), so its callbacks ran twice too. `_updateTree` now adds the first-children change only
when the contents didn't already make one for that path and node (the same check the branch for adding to existing
children already had); the cache still takes the (possibly empty) set. Measured with one callback over TCP
(`scratch/review-callbacks/double.cjs` in the fork): before 2, 1, 1; after 1, 1, 1. Tests: parameter with empty
children (two replies → two calls), node whose first reply brings children (one call, children stored). The TCP
reproductions that walk trees with `getElementByPath` (matrix2, setvalue, properties) unchanged. 477 tests.

## 24. The second spelling of a path never updates (2026-11-08)

Reported in the module: an element used first by its numeric path (`1.1.1`) and then by its textual path
(`device.channel.gain`), or the other way round, only updates under the first spelling; the second keeps the value from
when it was registered.

Cause, library 0.3.1 (what the module ships): both spellings resolve to the same element (the same node object), and
`getElementByPath(path, cb)` registers each callback under the element's numeric path. `EmberClient._handleIncoming`
then calls only the first subscription for a path (`this._subscriptions.find(...)`), so only the first spelling's
callback runs. The module keys everything by the path string as typed (`state.parameters`, `emberElement`, the
feedback path map, variables via `sanitiseVariableId(path)`; `resolvePath` only turns `/` into `.` and takes a
`[1.2.3]` suffix), so only the first spelling's state, variables and feedbacks change. Reproduced with `EmberServer`:
0.3.1 calls 1 of the 2 callbacks per change (whichever was registered first); the fork calls both.

Fixed in the library by upstream #51 (`9e636a8`, 2026-08-10: `find` -> `filter`), after the last release (v0.3.1,
2025-10-14), so not in any release; the fork has it (`a20fc63`).

Module side, once on the fork: every callback for a path now runs, and the module stacks them: `finalizeSetup()` (each
connection and each config save) clears the element cache, so `registerParameters()`, `subscribeActions()` and
`checkFeedbacks()` call `getElementByPath` again with a new callback. After k config saves on one client a change runs
`handleChangedValue` k+1 times per spelling. (Recorded actions are deduplicated per path string by `recordAction(...,
path)`, but two spellings record two actions.)

Recommended fix (module): canonicalise. Resolve each typed path once to the element's numeric path
(`emberClient.getInternalNodePath(node)`, in 0.3.1 and the fork), keep the spellings as aliases (numeric path -> set of
typed paths), register one library callback per numeric path per client (skip it when already registered; reset when
the client is rebuilt), and have that callback update every alias's state, variables and feedbacks. Works on 0.3.1 and
the fork, ends the stacking, keeps both variable names users may reference. Needs #25 (fixed in the fork) for the
numeric spelling to resolve to the right element. Not started: only these notes for the module for now (2026-11-08).

## 25. A numeric path segment can match a sibling labelled with that number (2026-11-08)

Library, fork and upstream (0.3.1 and `main`): `getElementByPath`'s `getNodeInCollection` takes the first child whose
`number`, `identifier` or `description` equals the segment. A digit segment therefore matches an earlier sibling whose
identifier or description is that number: with child 1 described "2" and child 2 described "3", `getElementByPath('1.2')`
returns child 1 (checked over TCP with `EmberServer`, both builds). Devices often label strips or channels with numbers,
offset from their Ember+ numbers. Also, for a textual segment an earlier sibling's description beats a later sibling's
identifier. Fix: an all-digit segment matches `number` only; otherwise prefer an `identifier` match over a `description`
match among all siblings. (Trade-off: an element whose identifier is all digits could then only be reached by its
number in that segment; rare.)

Fixed in the fork 2026-11-08: `aef1116`, made on branch `fix/path-segment-matching` and fast-forwarded into `master`
(not pushed). The whole path decides the form: numbers only -> each segment by `number` alone; otherwise identifier, then
description, then number (mixed paths like `device.2` still resolve). 4 tests (3 failed before), README sentence on
path forms. Over TCP: `1.2` now returns child 2; `1.1.1` and `device.channel.gain` still give the same node and both
callbacks. Behaviour change: a numbered path no longer reaches an element through a digit identifier/description.
Upstream: same code in 0.3.1 and `main` (`getNodeInCollection` in `getElementByPath`), report not filed.

## 26–39. Matrix and stream review (2026-11-14)

Review of the stream code (`StreamManager`, the stream path through `S101Codec`/`S101Socket`, the stream codecs) and the
matrix code (matrix/connection/label codecs, `EmberClient._updateMatrix` and `_matrixMutation`, `EmberServer`), fork
`master` at `aef1116`. Every item was reproduced; scripts and how to run them: fork `scratch/review-matrix-streams/`
(git-ignored). All but #31 are also in upstream `main` (`f50624e`), so each is a candidate for a later bug report.
#26–#40 are fixed in the fork (below). The module uses no streams, looks matrices up with `getElementByPath` only (no GetDirectory on the
matrix) and awaits `matrixConnect`/`matrixDisconnect`/`matrixSetConnection`, so today it can meet #26 and #33.

Streams:

- **26. Multi-frame stream check reads byte 2** (`S101Codec.handleEmberFrame`, `completeData[0] === 0x60 &&
completeData[2] === 0x66`). Byte 2 is only the collection's tag when the root has a one-byte length field, i.e.
  indefinite length. With a definite long-form length it is a length byte. (a) A tree message whose root length is
  0x6600–0x66ff (26,112–26,367 bytes of content) is taken for a stream collection and dropped: over TCP with
  `EmberServer`, GetDirectory on a node with 549 children (reply 26,163 bytes) -> `Request timed out`, 540 and 556
  children fine. Deterministic for a given node. (b) A stream collection too big for one frame (200 entries, 3 frames)
  is taken for a tree, where `_applyRootToTree` skips the entries: no `streamUpdate`. Single-frame messages use
  `isEmberStreamPacket`, which reads the length properly. Fix: use `isEmberStreamPacket(completeData)` there too.
  Providers that use indefinite length (both test devices) aren't affected.
  **Fixed in the fork 2026-11-14**: `e4532c4`, made on branch `fix/stream-routing-and-connect-replies` (off `master`
  `aef1116`) and since fast-forwarded into `master`, exactly that one-line change. 4 tests in `S101Codec.spec.ts` (tree, tree with a
  0x66 length, stream definite, stream indefinite, each over several frames; the two middle ones failed before). Over
  TCP the 549-child GetDirectory now resolves and the 3-frame stream collection delivers its update.
- **27. Identifier 0** (`StreamManager.registerParameter`, `if (!parameter.streamIdentifier)`; same test in
  `unregisterParameter`). Spec, _StreamIdentifier_: "a globally unique identifier which must not be negative". Stream 0
  is never registered, its updates never arrive. The codecs handle 0. Fix: compare with `undefined`.
- **28. REAL values** (`StreamManager.updateStreamValues`): only `Integer`, and `Octets` as below, are handled. A
  `StreamEntry` value is a `Value` (DTD), and the spec wants stream parameters to be numeric, so REAL is ordinary.
  Dropped without an event. Fix: pass integer and real through as they are.
- **29. Octets** (same function): always `getFloat32(offset, true)`, needing 4 bytes. The descriptor's `format`
  (18 formats in the DTD) is ignored: Float32BE -20.5 -> 5.9e-41, Int32LE -70000 -> NaN, Float64LE -> 0, and UInt8,
  Int16 produce no update (under 4 bytes). Without a descriptor the blob is the value, but it's read as a float (or
  dropped under 4 bytes). Fix: decode by `streamDescriptor.format`; no descriptor -> hand over the buffer.
- **30. `subscribe(node, cb)`**: stream values only come out of the `streamUpdate` event; `cb` is registered for tree
  changes and never called with them (1 event, 0 callback calls). The README's "For streams, use subscribe" example
  passes a callback. Fix: call the path's subscriptions from the stream update too, or correct the README.
- **31. Unsubscribe on a node (fork only, from the #21 restore).** Spec, _Unsubscribe_: on a node "all parameter
  subscriptions for that consumer must be removed". `unsubscribe(node)` forgets only the node's own path in
  `_sentSubscribes`/`_sentGetDirectories`, and `StreamManager` keeps the registrations below it. After a reconnect the
  client sent `1.1.1:GetDirectory` and `1.1.1:Subscribe` again for a stream parameter whose node 1.1 had been
  unsubscribed. Fix: on a node, also forget the paths below it and unregister their streams.
- **#27–#31 fixed in the fork 2026-11-15**, one commit each, on branch `fix/stream-handling` (stacked on
  `fix/stream-routing-and-connect-replies`), all 7 commits fast-forwarded into `master` the same day (`6447c1a`, not
  pushed). 361 tests.
  New test file `src/Ember/Client/__tests__/StreamManager.spec.ts`; the mock socket got `mockStreamData()`.
  - #27 `c77407a`: `registerParameter` tests `=== undefined`, `unregisterParameter` no longer tests the identifier.
  - #28 `15a8018`: REAL values reported like INTEGER ones. Other types (string, boolean) still aren't: the spec rules
    them out for stream parameters.
  - #29 `a1db48d`: a table of all 18 formats (size + read); the descriptor is taken from the parameter when the value
    arrives (`StreamInfo.offset` is gone). 64-bit integers come out as numbers (exact to 2^53). A value outside the
    octets isn't reported. No descriptor -> the octets themselves are the value (before: read as a float).
  - #30 `9faec4e`: the client keeps the node given to `subscribe()` per stream path (`_streamNodes`) and, after
    emitting `streamUpdate`, calls every callback registered for the path with it (also ones from
    `getElementByPath`/`getDirectory`). README example fixed (it logged a misspelt variable).
  - #31 `6447c1a`: `unsubscribe()` on a node or the root also forgets `_sentSubscribes`/`_sentGetDirectories` entries
    of type Parameter directly below it and unregisters their streams. Decision: "below this node" = the node's own
    parameters (the spec's GetDirectory text uses it that way), not everything further down; `_subscriptions`
    callbacks of those parameters are left registered (they just go quiet).
- Not a bug, a gap: `EmberServer` has no stream support (no StreamCollection; a Subscribe on a parameter is stored
  under the parameter's path, which `update()` never sends to). `ConnectionOperation`, `ConnectionDisposition`,
  `ConnectionImpl`, `LabelImpl`, `StreamEntryImpl` and `StreamDescriptionImpl` aren't exported from the package.

Matrix, client side:

- **32. Signal contents** (`decodeTargets`/`decodeSources` in `decoder/Matrix.ts`). DTD: `Signal ::= SEQUENCE { number
[0], contents [1] SignalContents OPTIONAL }` with identifier, isOnline, labelsLocation (the "newer" labels mechanism).
  The decoders read the number and then expect the next signal: a target with contents throws `Expected 0xa0: got 0xa1`
  and the whole message is lost (targets, sources, connections). `S101Codec.handleEmberPacket` catches it and only
  calls `console.error`: no `error` or `warn` event, so a GetDirectory on such a matrix just times out. Fix: read to the
  end of each signal, skipping (or keeping) the contents. No device known to send them.
- **33. What resolves a connect request** (`_handleIncoming`: any change at the request's path). (a) LOCKED reply:
  the request resolves like a success, with the cached matrix node; the reply's disposition isn't kept anywhere, so
  the caller can't tell. (b) PENDING: resolves at once. (c) A report about another target of the same matrix that
  arrives first resolves it. Fix: resolve on a connection for the requested target, and give the caller its
  disposition (reject or flag LOCKED). The module awaits these promises.
  **Fixed in the fork 2026-11-14**: `ebf013a` on the same branch. A connect request carries its target
  (`Request.connectionTarget`) and a matrix change carries the reported connections (`Change.connections`); the
  request settles only on a report that includes its target: LOCKED rejects with `Matrix <path>: target <n> is
locked`, anything else resolves with the matrix. PENDING resolves by decision (the provider queued it; waiting
  could outlast the request timeout), so pending can't be told from done yet: that needs the stored disposition,
  i.e. #34. 5 new tests (4 failed before), README section "Changing Matrix Connections", `BREAKING CHANGE` footer.
  For the module: a locked target now makes the matrix action throw (Companion logs the error) where it passed
  silently; a provider that answers a connect without the target's connection now times out (none known).
- **34. Storing connections** (`_updateMatrix`). With connections cached, LOCKED and PENDING are skipped; PENDING is
  right ("sources contains future state"), but LOCKED carries the current state and is thrown away. With none cached,
  `matrix.connections = update.connections` takes the report whole: a PENDING reply's future state is stored as
  current (`{2: [1]}`), and a following LOCKED `[]` doesn't correct it. Only reachable when connects are sent before a
  GetDirectory on the matrix, which is what the module does (it never reads the connections, though).
- **39. Quadratic merge** (`_updateMatrix` scans all cached connections per reported connection). A second full report
  (now sent after every reconnect, #21): 1,648 targets 31 ms, 5,000 targets 272 ms, 20,000 targets 8 s of blocked
  event loop. Fix: look the target up by key (connections are keyed by target).
- **#32, #39, #34 fixed in the fork 2026-11-15**, one commit each, on branch `fix/client-matrix` (off `master`
  `6447c1a`), fast-forwarded into `master` the same day (`9f3eac4`, not pushed). 368 tests.
  - #32 `3032fdd`: `decodeTargets`/`decodeSources` share `decodeSignals`, which loops over each signal's fields to its
    end (number, contents skipped with `skipNext`, end-of-contents), definite or indefinite. The contents (identifier,
    isOnline, labelsLocation) still aren't in the model: exposing them would be a feature (and what a consumer needs
    for the newer `labelsLocation` labels).
  - #39 `dc63b42`: `matrix.connections[connection.target]` instead of the scan. Relies on connections being keyed by
    target (decoder and merge do; a hand-built tree keyed otherwise would no longer match). 20,000 targets, second
    full report: 8 s -> 2 ms. Test counts reads through a Proxy (2001 before, under 10 after), no timing.
  - #34 `9f3eac4`: every report applied by target (no more wholesale first report). Tally/modified/locked set the
    sources; pending leaves them and stores nothing for a target without a connection. The stored connection keeps the
    disposition last reported for its target, so with connections loaded a consumer can tell queued from done after a
    connect resolves (`connections[target].disposition === Pending`); without them loaded it still can't. Stored
    connections are plain `{ target, sources, disposition }` now (no `operation`, not the decoder's objects). `Model`
    exports `Connection`, `ConnectionDisposition`, `ConnectionOperation`, `ConnectionImpl`. README example added.
- Note: `matrixConnect()`/`matrixDisconnect()` send `connect`/`disconnect`, which the DTD marks "nToN only"; for 1:N
  and 1:1 the spec's way is `absolute`, i.e. `matrixSetConnection()`. Not checked against devices.

Matrix, provider side (`EmberServer`) and encoder:

- **35. `parametersLocation`** (`encoder/Matrix.ts`, `Number(matrix.parametersLocation)`): a base path of two parts is
  a valid number ("1.2" -> 1.2 -> `writeInt` -> 1) and of one part too ("5" -> 5), so both go out as the `inline`
  integer. "1.2.3" is fine. Fix: decide by `typeof`.
- **36. `update(matrix, { connections })`**: after applying each connection it copies the update's properties onto
  the contents, replacing the whole `connections` object: `{0:[1],1:[2],2:[],3:[]}` -> `{0:[3]}` after an update of
  target 0. (The client-side twin of this was #2.)
- **37. `updateMatrixConnection`**: `!connection.sources.find((v) => v === source)` is true for source 0 every time,
  so connect 0, connect 0, connect 3, connect 3 gives `[0, 0, 3]`. The matrix type isn't looked at: connect 3 on a 1:N
  target that had `[1]` gives `[1, 3]`. Fix: `includes`; for 1:N/1:1 a connect replaces.
- **38. Replies to connects**: the report goes to the connections subscribed to the matrix's path only. A consumer
  that hadn't sent GetDirectory to the matrix got `Request timed out` although the provider had made the connection.
  Without an `onMatrixOperation` handler nothing is applied and nothing is sent (a `setValue` without a handler gets the
  current value back). Fix: always answer the requester, with the current state when nothing changed.
- **#35, #36, #37 fixed in the fork 2026-11-15**, one commit each with tests, on branch `fix/server-matrix` (off
  `master` `21f66db`), fast-forwarded into `master` the same day (`804439f`, not pushed). 389 tests; `matrix1.cjs`/`matrix2.cjs` confirm over TCP.
  - #35 `48a4993`: the encoder decides by `typeof`: a string is always a base path (`"5"`, `"1.2"`, `""` included),
    a number the inline integer.
  - #36 `b8bd4b3`: `update()` no longer copies `connections` onto the matrix after merging them target by target.
  - #37 `804439f`: `updateMatrixConnection` keeps to the matrix type. 1:N (also when `matrixType` is unset, the DTD
    default) and 1:1: a target keeps one source, a connect or absolute replaces it, the last of several requested is
    kept. 1:1: the source is also taken off any other target, and those targets go into the same report. N:N: each
    source once (`Set`). Behaviour change for providers: one that left `matrixType` unset and relied on several sources
    per target must set `MatrixType.NToN`. Not treated as a breaking change (user's call, 2026-11-15): the provider's
    matrix handling was too broken before this for anyone to have relied on it.
- **40. Connect limits ignored** (found 2026-11-15 while fixing #37): `maximumConnectsPerTarget` and
  `maximumTotalConnects` ("for n-to-n matrices") are public fields of the `Matrix` model, set by the provider, encoded,
  decoded and sent in GetDirectory replies, but `EmberServer.updateMatrixConnection` never reads them. An N:N matrix
  with 1 per target and 2 in total accepts connect 0←[1,2] and 1←[0,3]: 2 per target, 4 in total
  (`scratch/review-matrix-streams/maxconnects.cjs`). In upstream `main` too. `EmberClient` doesn't check them before
  sending a connect either, which is fine (the provider decides; the client gets the provider's answer). Fix: in
  `updateMatrixConnection`, refuse (leave unchanged and report the current state) a connect or absolute that would
  exceed either limit.
- **#38, #40 fixed in the fork 2026-11-15**, one commit each with tests, on branch `fix/server-matrix-replies` (off
  `master` `804439f`), fast-forwarded into `master` the same day (`7f9602b`, not pushed). 401 tests; `matrix2.cjs` (both requests now resolve over TCP) and
  `maxconnects.cjs` confirm.
  - #38 `0e64509`: while `onMatrixOperation` runs, the server keeps the requester and the targets it named
    (`_pendingMatrixReplies`). A report from `updateMatrixConnection` covering one of them also goes to the requester,
    once (a subscribed requester isn't sent it twice). When the handler is done, fails (the error is still emitted) or
    there is none, the requester gets the current state of every named target not yet reported to it.
  - #40 `7f9602b`: N:N only (the DTD says the limits are "for n-to-n matrices"): a connect or absolute that adds sources
    beyond either limit is refused as a whole; the target stays as it was and its current state is reported (so the
    requester is answered via #38). A change that adds no sources is always applied. `updateMatrixConnection` now
    returns `false` on a refusal, and `onMatrixOperation`'s type is `Promise<unknown>` (was `Promise<void>`) so a
    handler returning that result still type checks. README server example comment updated.
  - Not fixed, same pattern as #38 (noticed while fixing it): a `setValue` the `onSetValue` handler accepts is
    reported by `update()` to the parameter's parent subscribers only, so a requester not subscribed there gets no
    answer and its `setValue` times out. Not reproduced yet.

## 41–44. setValue replies (2026-11-15)

Found while checking whether #38's gap also hits `setValue`. Reproductions: `scratch/review-setvalue/` in the fork
(git-ignored): `setvalue.cjs` (answers and changes over TCP, EmberClient against EmberServer), `race.cjs` (#44).

- **41. Answer to a setValue** (provider): with an `onSetValue` handler that returns true, the answer was left to the
  handler's `update()`, which went to the parent's subscribers only. A requester not subscribed there timed out
  although the value had been set. A handler that accepted without applying yet, or that threw, left everyone without
  an answer (only a refusal or no handler sent the current value back).
- **42. Qualified element below an unloaded node** (consumer, `_applyRootToTree`): `1.1.1` arriving with only `1`
  loaded was stored in the first gap, as node `1.1`, and reported as a change on `1.1`. Requests and subscriptions on
  `1.1.1` never heard of it and the cache was wrong after. Only reachable without a GetDirectory on the parent; the
  module always walks down with `getElementByPath`, so it isn't affected. It hid #41's fix end to end (the answer
  arrived but was dropped).
- **43. `update()` recipients** (provider): a GetDirectory or Subscribe on a parameter (or matrix, function)
  subscribes the consumer to that element's own path, but `update()` sent non-node changes to the parent's
  subscribers only. A consumer subscribed to the parameter alone saw nothing.
- **44. setValue settled by an earlier reply** (consumer, open): `getElementByPath` sends a GetDirectory on the
  parameter and doesn't wait (`getDirectoryOnParams`, default on). A `setValue` sent before its reply arrives is
  resolved by that reply, because requests are matched by path only: the provider applies 5, `setValue` resolves with
  the old 0 (`race.cjs`, on both the old and the fixed build). The tree catches up when the update arrives. With
  `getDirectoryOnParams: false` there is no race. It comes with the no-wait parameter GetDirectory (#5, upstream #59,
  in the fork); upstream `main` waits for that reply instead (#5), so probably has no race there; not checked. Possible fixes: let a set request only be settled by a message that
  arrives after it (not obviously decidable: replies carry no request id), or have `getElementByPath` keep the
  parameter GetDirectory pending and make `setValue` on that path wait for it, or match a set reply by value
  (unreliable: providers may clamp or refuse). Sketched in full 2026-11-15 (hold `setValue` until the client's own
  parameter GetDirectory is answered, ~500 ms grace); **not fixed, user's call**: only the request's resolved value is
  stale. The update still arrives, the tree takes it and subscription callbacks fire with the new value (checked:
  callback 0, 0 for the GetDirectory reply (#23), then 5; tree 5). The module calls `setValue(..., false)`
  (`src/actions/parameter.ts`), so there is no request to settle and it can't meet this at all.
- **#41, #42, #43 fixed in the fork 2026-11-15**, one commit each with tests, on branch
  `fix/server-setvalue-replies` (off `master` `7f9602b`), fast-forwarded into `master` the same day (`61af489`, not
  pushed). 415 tests; `setvalue.cjs` confirms.
  - #41 `e32a58c`: as #38: while `onSetValue` runs the server keeps the requester (`_pendingValueReplies`);
    `update()` of that parameter also goes to it, once; when the handler is done, throws or there is none, a requester
    not yet answered gets the current value. The handler's boolean no longer decides anything (type kept, documented).
  - #42 `2010dc7`: when a node above the element is missing, the tree is left alone and the element reported as it
    came (as already done when the device itself isn't loaded). An element whose parent is loaded is added as before.
  - #43 `61af489`: `update()` sends to the parent's (or a node's own) subscribers and the element's own, each once.

## 46. A message that declares more content than it holds kills the process (fixed in the fork, 2026-11-15)

Found while looking for a message `berDecode` throws on (for #45's test). **Severity: high.** A 4-byte payload in a
valid S101 frame, `60 03 6b 01` (root of 3 bytes, element collection of 1 byte, nothing after), makes `berDecode` loop
until Node runs out of memory and the process dies. Any peer can send it: a device with a bug (or a truncated
message) takes down Companion; any consumer takes down an `EmberServer`. `scratch/review-decoder/truncated.cjs` in the
fork runs each case in its own capped process: `60036b01`, `60026b05`, `60056b03a001ff` die; `6005` and an
indefinite-length empty collection return normally.

- Cause: at the end of the buffer `Reader.readSequence` returns `null` without moving on (`src/ASN1/ber/Reader.ts`,
  "not enough data"). The decoder loops are `while (reader.offset < endOffset)` with `endOffset` taken from the
  declared length, so when the declared length runs past the buffer the loop never ends. In `decodeRootElements`
  (`decoder/Tree.ts`) each pass also records an "unknown context" error (`null` isn't `CONTEXT(0)`) and `skipNext`
  doesn't advance either, so the error array grows until the heap is gone. The same loop shape: 28 `while` loops in 15
  decoder files.
- Not checked in upstream `main` (its decoders have the same loops; its Reader came from the `asn1` package, which also
  returns `null` for not enough data), nor in 0.3.1 as the module ships it. Likely in both.
- Fix candidates: (a) one guard in the shared places: clamp `endOffset` to the buffer length when a sequence is read,
  and make every loop stop (with a "truncated" error) when a read returns `null` / the offset doesn't advance; a small
  helper used by all 28 loops would keep it consistent. (b) Have `Reader` throw on a length that runs past the buffer
  (simplest and catches everything, but changes the "return null" contract the decoders rely on in places). Either
  way: tests per decoder with truncated input, plus a fuzz-style test (truncate a set of valid encoded trees at every
  length, and flip each byte) that asserts `berDecode` returns or throws within a time limit.
- **Fixed in the fork 2026-11-15**, branch `fix/decoder-truncated-input` (off `master` `0b1b65f`), fast-forwarded
  into `master` the same day (`e83ac6f`, not pushed). Went with a reader-level fix rather than a helper in all 28 loops: every loop goes through
  `Reader.readSequence`, the Reader is built only in `berDecode` and isn't exported, and no decoder relies on a `null`
  from `readSequence`. Two causes, one commit each:
  - `6445212`: `readSequence` throws when a sequence's length runs past the data, when its length bytes do, and when
    no data is left. Each loop pass then consumes bytes or throws; `berDecode` throws (as it already did for an
    unexpected tag) and `S101Socket` reports it as `error` / `clientError`.
  - `e83ac6f`, found by the fuzz test: four-byte lengths were built with `(len << 8) + byte`, signed 32-bit, so length
    bytes from `80 00 00 00` up gave a negative length; `readStringAsBuffer` then moved the offset back ~2 GB and the
    decoders crawled forward for billions of passes (a hang, same effect). Now `len * 0x100 + byte`, in `readLength`
    and `readBlock`.
  - Tests (`src/encodings/ber/__tests__/malformed.spec.ts`): six messages that between them use every decoder
    (numbered, qualified, indefinite length, streams, invocation result) cut short at every length, and every byte set
    to 00/01/7f/80/81/84/ff/flipped, each decode under a 1 s `vm` timeout (a synchronous loop ignores jest's timeout;
    the timeout error is from the vm's context, so it's matched by `code`, not `instanceof`). On the old code: the
    stream message alone hung at 45 cut lengths. 443 tests, ~9 s for the file.
  - Over TCP (`scratch/review-decoder/tcp.cjs`): `EmberClient` emits the error, stays connected and takes the next
    message; `EmberServer` emits `clientError` and still answers the client's next GetDirectory.
  - Behaviour change: a truncated message (e.g. `6005`) now throws from `berDecode` instead of returning a placeholder
    node with an error. Over the wire that only changes which `error` text is reported.

## 11–13. Other findings (open)

- 11: `_updateParameter` copies only `value`, `isOnline`, `access`; `_updateEmberNode` only `isOnline`
  (`Client/index.ts:740-746`). _Notifications_ says updates cover "all properties", so runtime description,
  enumeration or range changes are lost. Not reproduced; the probe could be adapted to check.
  **Reproduced and fixed in the fork 2026-11-15** (`90f47e3`, branch `fix/client-property-updates` off `master`
  `e83ac6f`, fast-forwarded into `master` the same day, not pushed). Over TCP (`scratch/review-properties/properties.cjs` in the fork): on `master`,
  `EmberServer.update()` of a parameter's description and range and of a node's description left the client's tree
  unchanged; with the fix the tree takes them. Functions and templates took nothing at all before. The client now
  takes every property an update holds, except: a parameter's `parameterType` (the decoder infers it from the value
  when the provider leaves it out, so a value-only report of an Enum parameter decodes as Integer; copying it would
  turn cached enums into integers), and a matrix's identifier when it is `''` (what the decoder gives a report without
  contents, e.g. connections only). Matrix connections still merge by target. A subscribed parameter whose
  `streamIdentifier` changes is re-registered in `StreamManager` (it maps identifiers to paths at registration; the
  descriptor was already read live). Tests: parameter (incl. enumMap, formula, step; absent fields kept), node,
  matrix (labels, description; connections still merged; identifier kept on a connection report), function (args),
  parameter type kept (decoded value-only update), stream identifier change. 449 tests.
- 12: same as #9 for functions; one more condition on the same line. `expand()` already skips functions.
  **Fixed in the fork 2026-11-15** (`7a6246e`, branch `fix/function-getdirectory` off `master` `568bd74`,
  fast-forwarded into `master` the same day, not pushed). Functions and templates join parameters and matrices as leaves in `_handleIncoming`'s HasChildren check
  (a function's children only hold an invocation; the Glow DTD gives a template no children, so a GetDirectory on one
  could never settle before). Tests: GetDirectory on a function and on a template, reply without children, resolves.
  Over TCP (`scratch/review-function/getdirectory.cjs` in the fork, a raw provider replying without children; the
  library's own EmberServer sends an empty set so doesn't show it): branch resolves, `master` times out. 530 tests.
- 13: _EmBER › Encoder_ allows two-byte tags; the asn1 reader assumes one byte. No known device.
  **Fixed in the fork 2026-11-15**, branch `fix/multibyte-tags` (off `master` `e8f65c6`, fast-forwarded into
  `master` the same day, not pushed), three commits. Wider than "numbers from 31 up": the Ember+ documentation (Implementation recommendations › Encoder, in the
  user's `Ember+ Documentation.docx`) lets an encoder write _any_ tag in two bytes, "with the second byte containing
  the actual tag number", as one with fixed-size tags does, and gives a tag's number "up to four bytes". libember
  (`ber/traits/Tag.hpp`) reads the multi-byte form for any number, so `bf 02` is context tag 2.
  - `7e11344` reader: tags read in either form (`src/ASN1/ber/tag.ts`: `readTagAt`, `makeTag`) in `peek`,
    `readSequence`, `readStringAsBuffer`, the integer reads and `readBlock` (indefinite contents). A tag stays one
    comparable number: below 31 the one-byte tag whichever form it came in (decoders unchanged), from 31 up a value
    above 0xff. Numbers up to 32 bits; longer, or cut off by the end of the data, rejected. NULL read by tag+length.
    Tests: every shared message with all tags in two bytes (and with four-byte lengths; the set includes indefinite
    lengths) decodes as the one-byte form does; a context-40 field skipped as unknown (definite and indefinite);
    malformed-message fuzz also over the two-byte form. The old "unknown root element" test used `APPLICATION(31)`,
    i.e. the byte 7f, which is the start of a multi-byte tag; now `APPLICATION(30)`.
  - `2ec528d` S101 codec: the root and collection tags were checked as bytes at fixed places (60, then 66), so a
    two-byte-tag device's messages (`7f 00`, `7f 06`) were dropped silently. Now read with the same tag rules.
  - `568bd74` writer: `APPLICATION/CONTEXT/UNIVERSAL(x)` gave `x | class` (wrong from 31 up); now `makeTag`. Every tag
    written through `writeTag` (multi-byte form above 0xff). `UnimplementedEmberTypeError` names such tags right.
  - Over TCP (`scratch/review-tags/two-byte-provider.cjs` in the fork): a raw provider writing every tag in two bytes;
    on the branch the client loads the tree, resolves `device.gain` by textual path, and gets a value report and a
    stream entry through its callback; on `master` the first request times out. 528 tests.
  - Process slip: the three commits were first made on `master` by mistake (no branch created); moved to
    `fix/multibyte-tags` and `master` reset to `e8f65c6` before reporting. Nothing was pushed.

## 14. S101 frame parser regressions from 0.3.0 (pushed)

Upstream issues #44 ("Invalid CRC when VSM connects", May 2025) and #47 ("v0.3 breaks Ember+ Provider/Server
compatibility with VSM"; 0.2.2 works, Ember+ Viewer works). This hits Companion core's Ember+ provider; the module
uses the same codec as a consumer, with no known problem.

- Between 0.2.2 and 0.3.0 the only change on the provider's path is PR #43's rewrite of `S101Codec.dataIn`. The
  server, the encoders and the sending side didn't change; the `util.ts` change is client-only.
- #44's stack trace matches a v0.3.0 build exactly: `S101Codec.js:110:18` is the new `dataIn` calling
  `handleFrame`, `:138:19` the invalid-CRC throw. So #44 was on 0.3.0.
- A side-by-side run of the 0.2.2 and 0.3.0 codecs over 47 inputs (valid traffic, every split across reads,
  multi-packet, byte by byte, non-escaping keep-alive probe) found two regressions, both still on `main`:
  - A BOF inside a frame was kept as data, so a stray BOF or an abandoned frame merged with the next frame, which
    was dropped with an invalid CRC (#44's error). Spec, _S101 › Variant 1 › Decoding a message_: "When a decoder
    reads a BOF byte, it always indicates the start of a new frame."
  - `frameEnd - frameStart < 4` (added in `1022745` with no explanation, probably a guard against fragments while
    debugging metering) buffered short frames as incomplete. Every later read found the same EOF again, so the
    parser stopped silently, keep-alives included. On `main` the 4 MB cap only ends that after 4 MB.
- Fix (`330472e`): start each frame at `buf.lastIndexOf(S101_BOF, frameEnd)`; a frame is incomplete only when
  `frameEnd === -1`, and short frames go to `handleFrame`, which rejects them as 0.2.2 did. Six tests in
  `src/S101/__tests__/S101Codec.spec.ts`. The fixed parser matches 0.2.2 on 46 of the 47 inputs and does better on
  the last (garbage containing FF between frames).
- Not confirmed which pattern VSM sends. A capture of what VSM sends to the provider (Wireshark on its port, or
  logging in `dataIn`) replayed through both codecs would settle it. The comparison script is in the fork's
  `scratch/codec-diff.js`; it expects `v0.2.2` and `v0.3.0` builds in `wt-v0.2.2` / `wt-v0.3.0` worktrees beside it.
- Workaround meanwhile: v0.2.4 on the `v0.2.x` branch keeps the old parser.
- Left out: in both versions, a rejected frame also discards the rest of that TCP read, including good frames.

Draft PR text, to revisit before opening the PR (title: `fix: restart S101 frames at every BOF and drop short
frames`; also in the fork's `scratch/pr-descriptions/fix-s101-frame-parsing.md`). The "tested by the author" box
is unticked because it hasn't been tested against VSM.

```markdown
## About the Contributor

This pull request is posted by @phillipivan, maintainer of the Bitfocus Companion generic Ember+ module (`companion-module-generic-emberplus`), which uses this library.

## Type of Contribution

This is a: Bug fix

## Current Behavior

Since 0.3.0, some consumers can't use a provider built on `EmberServer`. VSM fails with `dropping frame of length 16 with invalid CRC` (#44), and Companion users report that VSM won't connect to Companion's provider while 0.2.2 works (#47). Ember+ Viewer is unaffected.

Between 0.2.2 and 0.3.0, the only change on the provider's path is the rewrite of `S101Codec.dataIn` in #43; the server and the sending side are unchanged. The stack trace in #44 matches a 0.3.0 build: `S101Codec.js:110` is the new `dataIn` calling `handleFrame`, and `:138` is the CRC check.

Run side by side on the same input, the 0.2.2 and 0.3.0 codecs behave identically for valid traffic: keep-alives, GetDirectory requests, multi-packet messages, frames split at every position across reads, byte-by-byte delivery and the non-escaping keep-alive probe. Two cases differ:

- **A BOF inside a frame is kept as data.** The Ember+ Specification (_S101 › Variant 1 › Decoding a message_) says "When a decoder reads a BOF byte, it always indicates the start of a new frame. So the current data can be discarded if there is any." 0.2.2 does that. 0.3.0 joins everything from the first BOF to the EOF, so a stray BOF or an abandoned frame takes the next frame down with it, with the invalid-CRC error from #44.
- **A BOF and EOF fewer than 4 bytes apart stop the parser.** `frameEnd - frameStart < 4` treats such a frame as incomplete and keeps it for the next read, but the next read finds the same EOF, and so does every read after it. Nothing more is processed on that connection, keep-alives included, and nothing is logged. The 4 MB buffer cap only ends this once 4 MB has arrived. 0.2.2 drops such a frame with a CRC error and carries on.

I don't have a capture from VSM, so I can't say which of the two it triggers; the error in #44 matches the first.

## New Behavior

- Each frame starts at the last BOF before its EOF, so anything after an earlier BOF is discarded, as the specification requires.
- A frame is only treated as incomplete when there's no EOF yet. A short frame goes to `handleFrame`, which rejects it like any other invalid frame, as 0.2.2 did.

On the inputs above, the codec now behaves like 0.2.2 in every case but one: garbage containing `FF` between frames, where it still delivers the next frame and 0.2.2 didn't.

## Testing Instructions

Run `yarn unit`, or just `yarn jest src/S101/__tests__/S101Codec.spec.ts`.

The six new tests cover a stray BOF before a GetDirectory request, an abandoned frame followed by a new one (in the same read and across two reads), and three short frames, each followed by a keep-alive and a GetDirectory that must still arrive. All six fail without the change.

It hasn't been tested against VSM; it would be good if someone who can reproduce #44 or #47 could confirm.

## Other Information

- Related: #44, #47.
- In both 0.2.2 and 0.3.0, a rejected frame also discards the rest of that TCP read, including any good frames after it. I've left that alone, since changing it changes how errors are reported.

## Status

- [x] PR is ready to be reviewed.
- [ ] The functionality has been tested by the author.
- [x] Relevant unit tests has been added / updated.
- [x] Relevant documentation (code comments, [system documentation](https://Sofie-Automation.github.io/sofie-core/)) has been added / updated.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 15–16. REAL (float) encoding (undecided)

Checked 2026-10-04. Undecided whether to change anything.

Floats go through the library's own `ExtendedWriter.writeReal` and `ExtendedReader.readReal` (`src/Ber/Writer.ts`,
`src/Ber/Reader.ts`). Neither the old `asn1` package nor PR #50's inlined copy has REAL support. Both functions are
a line-by-line port of libember's `libember/Headers/ember/ber/traits/Real.hpp` (`Lawo/ember-plus`). PR #50 doesn't
touch them: 0.3.1 and PR #50 (`c4b7561`) gave byte-identical output for the 21 values checked.

**Keep the exponent convention.** libember writes the IEEE exponent of the mantissa's leading bit, where X.690 wants
the exponent for an integer mantissa. 0.15625 goes out as `80 FD 05`, where X.690 gives `80 FB 05`, and this library
reads `80 FB 05` as 0.0390625. Only powers of two (mantissa 1) agree. Lawo confirmed this is a bug that every Ember+
library shares, and that it can't be fixed without breaking every device: "Confusion about ember+ real value
encoding vs. asn.1", ember-plus-discuss, September 2024
(https://groups.google.com/g/ember-plus-discuss/c/TKeW9HxnDEU). The port matches libember, so it talks to devices
correctly; changing it to X.690 would break that. If a PR touches this code, add a comment saying so.

Items 15 and 16 are where the port differs from libember, not from X.690. Mantissa sizing matches libember exactly,
including the leading `00` it writes when the top bit is set (65535 is `80 0F 00 FF FF`). Both libember and the port
ignore the base bits; Ember+ requires base 2, so that needs nothing.

### 15. Exponent length never written

libember (`0x80 | (exponentLength - 1)`) and libember_slim (`libember_slim/Source/ber.c`, `ber_encodeReal`) both put
the exponent length in bits 2–1 of the first byte. `writeReal` always writes `0x80` or `0xC0`. A value whose IEEE
exponent is outside −128..127, meaning |v| ≥ 2¹²⁸ (about 3.4e38) or |v| < 2⁻¹²⁸ (about 2.9e-39), is encoded with a
two-byte exponent but marked as one byte. Even this library reads its own bytes back wrong. `readReal` does honour
the bits, so decoding what libember sends is fine; only sending is affected.

| value                   | library sends                   | libember sends                  | library reads its own bytes as |
| ----------------------- | ------------------------------- | ------------------------------- | ------------------------------ |
| 2¹²⁸                    | `80 00 80 01`                   | `81 00 80 01`                   | 1.000030517578125              |
| 1e300                   | `80 03 E4 05 F9 0F 22 00 1D 67` | `81 03 E4 05 F9 0F 22 00 1D 67` | 10.9864435792103               |
| `Number.MAX_VALUE`      | `80 03 FF 1F FF FF FF FF FF FF` | `81 03 FF 1F FF FF FF FF FF FF` | 15.999999999999998             |
| 1e-300                  | `80 FC 1B 15 6E 1F C2 F8 F3 59` | `81 FC 1B 15 6E 1F C2 F8 F3 59` | 0.08371160993642714            |
| 2.2250738585072014e-308 | `80 FC 02 01`                   | `81 FC 02 01`                   | 0.0626220703125                |

Impact is probably low, since device values rarely get that large or small. A `Number.MAX_VALUE` "no limit"
placeholder would be corrupted, though. Fix: `preamble |= shortExp.size - 1`.

**Fixed in the fork 2026-11-15** (`637d3ea`, branch `fix/real-exponent-length`, stacked on `fix/real-negative-zero`,
both fast-forwarded into `master` the same day, not pushed). Preamble now `0x80 | (negative ? 0x40 : 0) | (exponentLength - 1)` as `Real.hpp`; the
exponent's size was already libember's minimal two's complement length (`Integral.hpp`). Tests: the table above
(libember's bytes, worked out from `Real.hpp`/`Integral.hpp`, plus 2^127, 2^-128, 2^-129 at the 1-/2-byte boundary)
written and read back; a sweep of every normal exponent (−1022..1023) written and read back (without the fix 3,582 of
4,092 came back wrong). Subnormals: encoded with exponent −1023 and the implicit bit set in the mantissa, as
libember's encoder does (it ORs that bit in regardless); both decoders mask it off again, so they read back. 474 tests.

### 16. −0.0

C++ libember sends `43` for −0.0 and decodes it back (`Real.hpp`, both directions). libember_slim never sends it.
`writeReal` sends −0 as +0, because `switch (value) { case 0: … }` also matches −0. `readReal` throws on `43`:
`RangeError: The value of "offset" is out of range`. It misses the single-byte special values, falls through to the
general path with a four-byte exponent length, and reads past the one-byte contents. So a device built on C++
libember that reports −0.0, for example a gain, would fail to decode. Fix: handle `43` in both directions, as
`Real.hpp` does.

**Fixed in the fork 2026-11-15** (`149d96f`, branch `fix/real-negative-zero` off `master` `90f47e3`,
fast-forwarded into `master` the same day, not pushed). Checked against `Real.hpp` at Lawo/ember-plus `6bc294e` (read, not run: compiling and running the
downloaded libember for a byte-for-byte harness was refused by the permission check; the user can allow it). Now as
libember: −0.0 sent as `43` and read back; +0.0 as no contents; ±∞ `40`/`41`. Also: the "contents hold the exponent"
check now comes before the exponent's first byte is read, so any other single byte (e.g. `44`, `80`, `c0`) is
rejected with that error instead of a `RangeError` (libember throws too). NaN: we send `42` (libember reads it);
libember's own NaN check (`value == quiet_NaN()`) is never true in C++, so libember sends NaN in the general form
(`81 04 00 03`), which we already read as NaN (test added). Remaining differences from libember, deliberate: a
general-form REAL with a zero mantissa reads as ±0 here (the earlier DoS guard) where libember gives ±2^exponent; no
encoder produces it.

The comparison script (a port of `Real.hpp` and a plain X.690 codec) was only kept for that session. The tables
above are enough to write tests from.

## 17. A rejected S101 frame discards the rest of that TCP read (fixed in the fork)

Noted while fixing #14 and left out of that PR, since changing it changes how errors are reported. To circle back to.

- `S101Codec.dataIn` processes every complete frame in a read in a loop, and `handleFrame` reports a bad frame
  (invalid CRC, not an ember frame, unknown command) by throwing. The throw leaves the loop, so any good frames
  after the bad one in the same read are lost. `S101Socket` catches it and emits `error`.
- A frame split across reads after the bad one is lost as well: the partial tail is only saved to `frameBuffer` when
  the loop reaches it, which it doesn't after a throw, so the next read starts mid-frame and skips to the next BOF.
- 0.2.2's byte-by-byte parser behaved the same (the throw left its `for` loop), so it isn't a regression. The
  side-by-side comparison shows it in both: `FE FF` followed by a GetDirectory in the same read loses the request.
- It only matters when a bad frame is followed by more frames in the same TCP read.
- Possible fix: catch per frame inside the loop, keep going, save the trailing partial frame, then rethrow the first
  error (or report each one) after the loop. Decide how several bad frames in one read should be reported, since
  `S101Socket` emits one `error` per `dataIn` call. Tests: a bad frame then a good frame in one read must still
  deliver the good one, and a good frame split across reads after a bad one must still arrive.
- **Fixed in the fork 2026-11-15** (`ea503f6`, branch `fix/s101-frame-errors` off `master` `61af489`,
  fast-forwarded into `master` the same day, not pushed), with tests (codec: bad then good in one read, good split across reads after a bad one, several bad in
  one read; `S101Client`: one `error`, the message after it still emitted). 419 tests. `dataIn` catches per frame
  and carries on; it still throws once per read: the frame's own error for one (unchanged for anyone handling it),
  an `AggregateError` (`errors` holds each) for several. `S101OversizedFrameError` is still thrown straight away, so
  `S101Client` still drops the connection. (A throwing `emberPacket` listener never stopped the loop:
  `handleEmberPacket` already catches and `console.error`s it.)
- **45. Observation (open)**, seen while fixing #17: `handleEmberPacket` runs `berDecode` on every complete message
  only to check it, then emits the raw bytes, and `S101Socket` decodes them again: every Ember message is decoded
  twice. A throw from that first decode goes to `console.error` and the message is dropped without an `error` event.
  Not measured (the CPU cost matters for large trees / busy matrices); `berDecode` mostly collects errors rather than
  throwing, so the silent drop is probably rare. Fix candidate: check only the root tag in the codec and leave
  decoding (and error reporting) to `S101Socket`. Code: `S101Codec.handleEmberPacket` (decode #1) and the
  `emberPacket` listener in `S101Socket` (decode #2); stream messages are decoded once. The codec's
  `if (decoded.value)` filters nothing: `berDecode`'s value is always an object (a collection starting as `{}`, an
  InvocationResult, or a −1 placeholder node for an unknown root tag), so dropping decode #1 changes nothing but where
  a throw is reported.
  - **Fixed in the fork 2026-11-15** (`0b1b65f`, branch `fix/s101-single-decode` off `master` `ea503f6`,
    fast-forwarded into `master` the same day, not pushed), tests through `S101Client` with `berDecode` wrapped (one decode per message; a decode that throws reaches
    `error`, no `console.error`). 421 tests; TCP reproductions (streams, matrices, setValue) unchanged. The codec only
    checks the root tag; the `console.error`s around both emits are gone (a listener's throw now goes to `dataIn`'s
    per-frame catch, #17); the multi-frame buffer is reset in a `finally`.

## 18. Matrix connect sends the whole matrix and wipes the stored connections (sent)

Found 2026-10-05 while checking whether the #3 fix affects matrices (it doesn't). `_matrixMutation`, behind
`matrixConnect`, `matrixDisconnect` and `matrixSetConnection` (`src/Ember/Client/index.ts`), has the same pattern as
the old `setValue`: it wraps the cached matrix with `assertQualifiedEmberNode`, which shares its contents, then
assigns `qualifiedMatrix.contents.connections = [connection]`. Confirmed against a build:

- **The stored connections are wiped when the request is sent**, before any reply. A 100-target matrix went from 100
  stored connections to one entry, `[{"operation":"CONNECT","target":5,"sources":[3]}]`, keyed `0` instead of by
  target and storing the request's `CONNECT` operation in the tree. The provider's reply then merges into that
  one-entry state, so **the #2 fix alone doesn't keep the tree right for anyone who calls `matrixConnect`**; it stays
  wrong until a full GetDirectory reply.
- **The request carries the whole cached matrix**, plus the one connection. How big that is depends on what's cached.
  A matrix cached from its parent's GetDirectory reply has only its contents (identifier, type, mode, counts, labels
  and so on): 123 bytes on the device, against Viewer's 55 (see the capture below). The targets and sources lists are
  only cached after a GetDirectory on the matrix itself, which is how a consumer reads its connections. Then the
  request carries those lists too: 2110 bytes for a 100×120 matrix in a build test, and 37,779 bytes for one
  crosspoint change on a matrix the size of the 10.249.56.11 device (1648×2120). Viewer's GetDirectory reply for
  that matrix was 75,773 bytes.
- Spec, _Matrix Extensions › Use Cases › Issuing Connects / Issuing Disconnects_: a `QualifiedMatrix` with only the
  connections. Lawo's libember_slim sample consumer (`__sample_consumer.c` `issueConnect`) builds a fresh
  `GlowConnection` and writes a `QualifiedMatrix` with just the path and that connection
  (`glow_writeConnectionsPrefix` / `glow_writeConnection` / `glow_writeConnectionsSuffix`), without touching its
  local tree.
- Module impact: its matrix actions call `matrixConnect` on a matrix found with `getElementByPath`, which (patched or
  not) never sends a GetDirectory to a matrix. So the module's requests carry the contents but not the targets and
  sources lists: 123 bytes, not tens of kilobytes. The module doesn't read the cached connections either.

Device capture, 2026-10-05 (`scratch/xaci companion crosspoint set pcap.pcapng`, with
`xaci ember+ pcap.pcapng` for Viewer):

- **Viewer**: a `QualifiedMatrix` with path 1.4, no contents set, and one connection (target, sources, operation
  connect). 55 bytes, as the spec and libember send it.
- **The module**: 7 connects to target 3001 on 1.4, each a single S101 packet of 123 bytes, definite length. Besides
  the path and the connection, each carries identifier `Matrix`, matrixType one-to-N, addressingMode non-linear,
  targetCount 1648, sourceCount 2120, maximumTotalConnects 20352, maximumConnectsPerTarget 1, parametersLocation 1
  and a labels entry (basePath 1.0, `Default Labels`).
- **The device accepts the extra properties.** It replied to 6 of the 7 connects within 14–17 ms and sent the same
  report to Viewer's connection. The first (source 3002) got no reply on either connection, probably because 3002 was
  already routed. Each reply is 50 bytes: a `QualifiedMatrix` with no contents and only the changed target, without
  operation or disposition. That's the report shape #2 has to merge, from a real device.
- **What this means for the PR:** on this device the extra data does no harm, and the module sends about twice
  Viewer's size, not tens of kilobytes. The case for the fix is conformance (spec, libember and Viewer all send only
  the connection) and the stored connections being wiped. The size only becomes a real cost once the matrix has been
  fetched with its targets and sources, and it grows with the matrix: tens of kilobytes on a large one.

Suggested fix, same shape as #3: build a fresh `QualifiedMatrix` with the path and the single connection, leave the
tree alone, and let the provider's reply update it (merged correctly once #2 is in). Separate PR from #2, but its
description should mention the connection: #2 fixes merging reports, this stops requests corrupting the stored
state. Tests: the request holds only the path and the connection; the stored connections are unchanged until the
reply; after a one-target reply all other targets are still stored.

Sent (2026-10-05): branch `fix/matrix-connect-connection-only` (`292c3fb`), pushed to the fork. `_matrixMutation`
builds a fresh `QualifiedMatrix` with the path and the connection keyed by target, and leaves the tree alone (cast
`as Matrix`, since the model requires an identifier). The tree encoder also had to change: it counted targets,
sources and connections as contents, so a connections-only matrix went out with an empty contents set
(`a1 02 31 00`), which the DTD doesn't allow (identifier is required in `MatrixContents`). It now leaves the set out
when there's nothing to put in it. Matrices with an identifier, including everything `EmberServer` sends, encode as
before. A connect is now 39 bytes, and byte-identical to Viewer's once converted to indefinite length. 4 new tests
(the three methods, the encoder's exact bytes) fail without the fix; 1 guard test (tree updated from the reply). The
"after a one-target reply all other targets are still stored" test was left out: it needs #2, so the PR says so
instead. `EmberServer` accepts the contents-less request (its decoder substitutes empty contents and the server
ignores the error; #10, sent with #9, removes the error). "Tested by the author" unticked: the new code hasn't run
against a device. PR text: fork `scratch/pr-descriptions/fix-matrix-connect-connection-only.md`.

## 19. Command requests carry the element's cached contents (sent)

Found 2026-10-05 while writing the #5 tests. `insertCommand` (`src/Ember/Lib/util.ts`), used for every GetDirectory,
Subscribe and Unsubscribe, builds the request from the element's cached contents, so the command goes out wrapped in
everything the client knows about the element. A GetDirectory on a parameter carried `identifier`, `description`,
`value`, `minimum` and `maximum` (67 bytes for a small integer parameter). The spec's examples (_Matrix Extensions ›
Use Cases_ and others) send `<QualifiedNode path="1.2"><children><Command number="32" /></children></QualifiedNode>`,
with no contents, and Viewer's requests had none either.

Risks: a provider could read the cached `value` as a value change and set the parameter back to a possibly stale
value; the `minimum`/`maximum` go through the #4 encoding; and it may be why some providers never answer a GetDirectory
on a parameter (unconfirmed, no capture of the library's request). Same pattern as #3 and #18.

Suggested fix: `insertCommand` sends only the path, the element type and the command. Separate PR from #5. Worth a
capture of the module's GetDirectory on a parameter with the 0.2.x behaviour if a device that never answers is to hand.

Sent (2026-10-05): branch `fix/command-request-path-only` (`bc4f531`), pushed to the fork. `insertCommand` now builds
the request with `{ type: node.contents.type }` (cast to `EmberElement`), so the tree encoder leaves the contents set
out; covers GetDirectory, Subscribe, Unsubscribe and Invoke. 6 tests (GetDirectory on node/parameter/matrix,
Subscribe, Unsubscribe, Invoke), all fail without the fix. A node GetDirectory with mask ALL is byte-identical to
Viewer's (message #7 in the Viewer capture). Ran the library's `EmberServer` against `EmberClient` on localhost: all
requests answered, no warnings (the server's decoder fills in empty contents; a contents-less matrix request records
a decode error the server ignores, removed by #10). PR text: fork `scratch/pr-descriptions/fix-command-request-path-only.md`.

## Upstream PRs and test build (2026-10-05)

PR numbers: #52 `fix/matrix-indefinite-length` (#1, #7), #53 `fix/parameter-minmax-encoding` (#4), #54
`fix/matrix-connection-updates` (#2), #55 `fix/matrix-replies-without-children-or-contents` (#9, #10), #56
`fix/s101-frame-parsing` (#14), #57 `fix/setvalue-value-only` (#3), #58 `fix/matrix-connect-connection-only` (#18),
#59 `fix/parameter-getdirectory-no-wait` (#5). #60 `fix/command-request-path-only` (#19). Julusian's
#50 (`feat/inline-asn1-lib`, inline asn1) is the one that also fixes #8. The posted PR texts still have `#TBD`
placeholders to replace with these numbers.

Test build: library branch `test/companion-integration` (local, not pushed) = `sofie/main` + #50 + all ten fix
branches, version `0.3.1-companion-test.1`; 282 tests pass. Merge notes: only the client test file conflicted
(blocks added at the same spot, import lists). #50 changes `Ber.Reader.readString(tag, true)` to
`readStringAsBuffer(tag)`, which the test helpers in #57, #58 and #19 (and `Parameter.spec.ts` in #57) use;
whichever merges second needs that one-line change. Module: worktree
`companion-module-generic-emberplus-integration`, branch `test/emberplus-integration` (local), depends on
`file:./vendor/emberplus-connection-0.3.1-companion-test.1.tgz`, module patch removed (so #6's reconnect-limit removal
is not in it); 257 module tests pass; package `generic-emberplus-2.9.2.tgz` in that worktree. To watch while testing:
rapid relative/toggle presses within one round trip (the module's state now only changes on the provider's reply),
and auto-reconnect giving up after 5 minutes (#6, no longer patched).

## Module to-do: matrix actions wait for a report that may never come (2026-10-05)

A module change, not a library one. It doesn't depend on any of the library PRs, so it can go into a module release
on its own.

**Problem.** `doMatrixAction` and `doMatrixActionFunction` (`src/actions/matrix.ts`) send the connect and then
`await request.response` inside the action queue. `matrixConnect` resolves that response when the provider reports
the matrix, and rejects it with `Request timed out` after 3 s otherwise. Providers needn't report a connect that
changes nothing: the spec requires a reply to a parameter value change ("A provider must always respond to a value
change request") but says nothing like that for matrix connects. The test device (10.249.56.11) sends no report for
a connect to a source that's already routed, confirmed in Companion by setting the same crosspoint repeatedly. So
each such connect:

- logs `Error executing action: Request timed out`, although nothing went wrong
- holds the action queue (`PQueue`, concurrency 1) for 3 s, delaying every action behind it
- keeps the action shown as running in Companion until the timeout

The same happens with 2.9.2: in the morning capture, the first of seven connects got no report on any connection.

**Fix.** Send the request and don't wait for the report; the module never uses it. Attach a `.catch` to the response
so its rejection isn't reported as unhandled. Already done and tested in the test worktree
(`companion-module-generic-emberplus-integration`, branch `test/emberplus-integration`, commit `33bfeb8`): it adds
this helper to `src/actions/matrix.ts`, used by both actions as
`ignoreReport(self, path, await method(node, target, sources))`:

```ts
function ignoreReport(self: EmberPlusInstance, matrix: string | number, request: Awaited<ReturnType<MatrixMethod>>) {
	request.response?.catch((e) => self.logger.debug(`No report from the provider for matrix ${matrix}: ${e}`))
}
```

plus `src/actions/matrix.test.ts` (3 tests: both actions finish without a report, and a missing report is logged at
debug level instead of failing the action; all fail without the fix). That commit can be cherry-picked onto a branch
off `master`; the worktree branch's other commits are test-build only (library tgz, version `2.9.2-emberlibupdate`)
and must not be taken. Tested in Companion with the test build: connects work and no longer log errors.

**Still to change: the log wording.** The debug line still reads as an error:
`No report from the provider for matrix 1.4: Error: Request timed out`. It's the expected case, so drop the error
text and say what it most likely means, e.g. `Matrix 1.4: connect sent; the provider reported no change (the
crosspoint was probably already set)`. Update the test that matches on `Request timed out` to match the new wording.

## Fork: @phillipivan/emberplus-connection (2026-10-07)

The fork's `master` (phillipivan/sofie-emberplus-connection, published as `@phillipivan/emberplus-connection`) now
has, on top of its own 0.4.x changes (TS6, preset 4, `gdnet-asn1`, `EmberClientOptions`): the upstream fixes since
v0.3.0 (3722d65, eacdd5b, dbc6851, 0bdb4c8, a2dd77a, #51), and all of #52 to #60, each cherry-picked with `-x`. #59 is combined with the fork's `getDirectoryOnParams` option: the option decides whether the parameter
GetDirectory is sent (default on), and it's never waited for. Julian's #50 is ported too (`2a47353`): the asn1
library is inlined in place of `gdnet-asn1` (which was the EVS library plus a >16 MB indefinite-length fallback in
`endSequence`, not carried over), and it fixes #8 (Octets values were sent empty). 283 tests. Not pushed as of 2026-10-07; CI and trusted publishing
were also rewritten there (see the fork-publish to-do in Claude's memory for that repo).

2026-11-08: `master` (pushed up to `05c2614` by then) fast-forwarded to `6484393`, then to `aef1116` (#25), 10 commits
in all, not pushed: #61, #62,
#64 (the `reconnectAttempts` option removed: `BREAKING CHANGE`, mind the version bump on the next release), the spec
import style, the reconnect backoff (§6), #20, #21 (root merge + subscription restore) and #22. 314 tests.

2026-11-15: `origin/master` was at `aef1116` (so the 10 commits above had been pushed). `master` fast-forwarded to
`6447c1a`, 7 commits, not pushed: #26 and #33 (the latter a `BREAKING CHANGE`: connect requests reject on LOCKED),
then the stream fixes #27–#31. 361 tests.

Later on 2026-11-15: `origin/master` was at `6447c1a` (those 7 pushed). `master` fast-forwarded to `9f3eac4`, 3 commits,
not pushed: the client-side matrix fixes #32, #39, #34. 368 tests.

Later still on 2026-11-15: `origin/master` at `21f66db` (the above pushed, plus the user's dependency update).
`master` fast-forwarded to `804439f`, 3 commits, not pushed: the provider-side fixes #35, #36, #37 (#37 changes the
default for a matrix without `matrixType` to one-to-N, per the DTD; deliberately not marked breaking). 389 tests.

Later still on 2026-11-15: `origin/master` at `804439f` (those 3 pushed). `master` fast-forwarded to `7f9602b`,
2 commits, not pushed: the provider-side fixes #38 and #40. 401 tests.

Later still on 2026-11-15: `origin/master` still at `804439f`. `master` fast-forwarded to `61af489`, 3 more commits:
#41, #42, #43 (§41–44). 5 commits not pushed in all (#38, #40, #41, #42, #43). 415 tests.

Later still on 2026-11-15: `origin/master` at `61af489` (those 5 pushed). `master` fast-forwarded to `ea503f6`,
1 commit, not pushed: #17. 419 tests.

Later still on 2026-11-15: `master` fast-forwarded to `0b1b65f` (#45), 2 commits not pushed (#17, #45). 421 tests.
Then to `e83ac6f` (#46, 2 commits): 4 commits not pushed in all (#17, #45, #46 ×2). 443 tests.
Then to `90f47e3` (#11): 5 commits not pushed in all (#17, #45, #46 ×2, #11). 449 tests.
Then to `637d3ea` (#16, #15): 7 commits not pushed in all (#17, #45, #46 ×2, #11, #16, #15). 474 tests.
Then to `e8f65c6` (#23): 8 commits not pushed in all (#17, #45, #46 ×2, #11, #16, #15, #23). 477 tests.
Then to `568bd74` (#13, 3 commits): 11 commits not pushed in all (#17, #45, #46 ×2, #11, #16, #15, #23, #13 ×3).
528 tests.
Then to `7a6246e` (#12): 12 commits not pushed in all. 530 tests. With this, every library issue in the table is
fixed on the fork's `master` except #44 (won't fix, user's call); upstream bug reports not filed.

Later on 2026-11-15: `origin/master` at `7a6246e` (the 12 pushed). `master` fast-forwarded to `145a8fa`, 3 commits, not
pushed: tooling cleanup `cc6938b` (release no longer runs `reset`; husky set up by `postinstall`, which `publish.yaml`
now strips from the published package.json; dead caniuse-lite exception, alias and `cov` scripts removed; engines
`node >=26`; homepage/bugs without `.git`; workflows on Node 26 only), and the user's `21d56a7` (.yarnrc.yml:
`enableScripts: false`, `npmMinimalAgeGate: 3d`) and `145a8fa` (CONTRIBUTING.md and the Sofie PR template removed).
Release caveat: `sofie-version` stops at `yarn lint --write` (ESLint has no `--write`) before bumping, committing or
tagging, and only counts a `!` in the subject as breaking, not a `BREAKING CHANGE:` footer, so the next release
(breaking: `reconnectAttempts` removed, LOCKED rejects) needs a hand-written changelog section and a manual version
bump (0.5.0).

Later on 2026-11-15: libember comparison (§47–58) and typing review. Branch `test/libember-parity` off `145a8fa`, 2
commits (`a90d4a1` S101 tests, `3b141be` BER/Glow tests). 708 tests. #47–#58 open; the typing review changed
nothing. `master` fast-forwarded to `3b141be`: 5 commits not pushed (`cc6938b`, `21d56a7`, `145a8fa`, `a90d4a1`,
`3b141be`), `origin/master` still at `7a6246e`.
Then #47–#51 fixed on branch `fix/libember-divergences` (5 commits, `fff9f1f`..`cde13e2`), and `master`
fast-forwarded to `cde13e2`: 10 commits not pushed (`cc6938b`, `21d56a7`, `145a8fa`, `a90d4a1`, `3b141be`, `fff9f1f`,
`dbcd286`, `6eeb078`, `5027bf0`, `cde13e2`), `origin/master` still at `7a6246e`. 722 tests. Branches
`chore/tooling-cleanup`, `test/libember-parity` and `fix/libember-divergences` are fully in `master` and can be
deleted. Where to pick up: "Next session" below.

2026-11-16: `origin/master` at `cde13e2` (the 10 commits above pushed). #52 fixed on branch `fix/unknown-command`
(`3dd3bdb`) and `master` fast-forwarded to it: 1 commit not pushed. 732 tests. `fix/unknown-command` can be deleted.
Then #53 fixed on branch `fix/unknown-access` (`f9b4ff3`) and `master` fast-forwarded to it: 2 commits not pushed
(`3dd3bdb`, `f9b4ff3`). 734 tests. `fix/unknown-access` can be deleted.
Then #54 fixed on branch `fix/dtd-version` (`1a118d9`) and `master` fast-forwarded to it: 3 commits not pushed
(`3dd3bdb`, `f9b4ff3`, `1a118d9`). 734 tests. `fix/dtd-version` can be deleted.
Then #56 fixed on branch `fix/s101-header` (3 commits, `22ef42f`, `f179a5c`, `ccb6b68`) and `master` fast-forwarded to
`ccb6b68`: 6 commits not pushed (`3dd3bdb`, `f9b4ff3`, `1a118d9`, `22ef42f`, `f179a5c`, `ccb6b68`). 739 tests.
`fix/s101-header` can be deleted.
Then the #56 follow-up (message type ≠ 0x0E passed over) on branch `fix/s101-message-type` (`ea737ad`) and `master`
fast-forwarded to it: 7 commits not pushed (`3dd3bdb`, `f9b4ff3`, `1a118d9`, `22ef42f`, `f179a5c`, `ccb6b68`,
`ea737ad`). 742 tests. `fix/s101-message-type` can be deleted.
Then #55 added on branch `feat/s101-non-escaping` off `ea737ad` (2 `feat:` commits, `a93e9e3`, `8e3358d`), not merged
into `master` (ask), not pushed. 758 tests. #59 found (open).
Then #59 fixed on branch `fix/s101-packet-copies`, stacked on `feat/s101-non-escaping` (it touches the same codec and
removes that branch's test workaround): 1 commit, `cff740b`. Fast-forwarding `master` to `cff740b` brings #55 (2) and
#59. Not merged, not pushed. 761 tests.
Later on 2026-11-16: `origin/master` at `ea737ad` (the 7 commits up to the message-type change pushed). `master`
fast-forwarded to `cff740b`: 3 commits not pushed (`a93e9e3`, `8e3358d`, `cff740b`). 761 tests. Branches
`feat/s101-non-escaping` and `fix/s101-packet-copies` (and the earlier `fix/*` ones) can be deleted.
Then #58 fixed on branch `fix/relative-oid-value` (`c786f67`). By then `origin/master` was at `cff740b` (the 3 commits
above pushed); `master` fast-forwarded to `c786f67`: 1 commit not pushed. 765 tests. `fix/relative-oid-value` can be
deleted.
Then #57 fixed on branch `fix/ber-reader-edges` off `c786f67`, one commit per part (4: `27622ac`, `e2a02a9`, `007b201`,
`0de0308`), and `master` fast-forwarded to `0de0308`: 5 commits not pushed (`c786f67`, `27622ac`, `e2a02a9`,
`007b201`, `0de0308`), `origin/master` at `cff740b`. 777 tests. No `it.failing` tests remain: every divergence from the
comparison is dealt with. `fix/ber-reader-edges` can be deleted.
Then typing-review item 1 on branch `refactor/connections-type` (1 `refactor:` commit, `e2bb1de`). By then
`origin/master` was at `0de0308` (the 5 commits above pushed); `master` fast-forwarded to `e2bb1de`: 1 commit not
pushed. 777 tests. `refactor/connections-type` can be deleted.
Then typing-review item 7 (dead code) on branch `refactor/remove-dead-parameter-code` (1 `refactor:` commit,
`cc609f5`), and `master` fast-forwarded to it: 2 commits not pushed (`e2bb1de`, `cc609f5`), `origin/master` at
`0de0308`. 777 tests (the deleted test file never ran). `refactor/remove-dead-parameter-code` can be deleted.
Then `EmberElement.test.ts` renamed to `.spec.ts` on branch `test/run-ember-element-tests` off `cc609f5` (1 `test:`
commit, `74fb694`), then the dead `src/Ember/Client/__tests__/index.test.ts_` draft deleted on the same branch
(`e31ed23`, `test:`). By then `origin/master` was at `cc609f5` (the 2 commits above pushed); `master` fast-forwarded to
`e31ed23`: 2 commits not pushed (`74fb694`, `e31ed23`). 788 tests (its 11 now run). `test/run-ember-element-tests` can
be deleted.
Then typing-review item 2 (exports) on branch `feat/export-public-types` (1 `feat:` commit, `ed46c21`). By then
`origin/master` was at `e31ed23` (the 2 commits above pushed); `master` fast-forwarded to `ed46c21`: 1 commit not
pushed. 792 tests. `feat/export-public-types` can be deleted.
Then `isEmberElement` exported as a public type guard on branch `feat/export-is-ember-element` off `ed46c21` (2
commits: `0eddce4` `feat:` export from `Model` with a doc comment; `6763712` `refactor:` its `any` cast dropped), and
`master` fast-forwarded to `6763712`: 3 commits not pushed (`ed46c21`, `0eddce4`, `6763712`), `origin/master` at
`e31ed23`. 793 tests. `feat/export-is-ember-element` can be deleted.
Then typing-review item 6 (the remaining `any`s) on branch `refactor/remove-anys` (1 `refactor:` commit, `310c99f`),
and `master` fast-forwarded to it: 4 commits not pushed (`ed46c21`, `0eddce4`, `6763712`, `310c99f`), `origin/master`
at `e31ed23`. 793 tests. `refactor/remove-anys` can be deleted.
Then typing-review item 9 on branch `refactor/element-type-guards` off `310c99f`: `68d1d43` (`refactor:`, element type
guards) and `eccdf66` (`fix:`, #60: `onInvocation` only for a function), and `master` fast-forwarded to `eccdf66`: 6
commits not pushed (`ed46c21`, `0eddce4`, `6763712`, `310c99f`, `68d1d43`, `eccdf66`), `origin/master` at `e31ed23`.
803 tests. `refactor/element-type-guards` can be deleted.
Then typing-review item 4 on branch `fix/decoded-limits` (1 `fix:` commit, `ec88e60`), and `master` fast-forwarded to
`ec88e60`: 7 commits not pushed, `origin/master` at `e31ed23`. 805 tests. `fix/decoded-limits` can be deleted.
Then typing-review item 5 on branch `refactor/root-types` (1 commit, `513b56c`, `feat!:` with a BREAKING CHANGE footer),
and `master` fast-forwarded to it: 8 commits not pushed, `origin/master` at `e31ed23`. 812 tests.
`refactor/root-types` can be deleted.
Then typing-review item 3 on branch `refactor/typed-value-union` off `513b56c`: `0ccd539` (`refactor!:`, EmberTypedValue
union, BREAKING CHANGE footer) and `811fd7e` (`fix:`, typed values written by their type), not merged into `master`.
Then the Parameter split (user's call, 2026-11-16: "do the full split"; compatibility doesn't matter, the fork exists for
the module), stacked: branch `refactor/parameter-union` (`36b8fab`, `refactor!:`) and on it `fix/parameter-value-checks`
(`6ab189d` decoder, `ddc6e70` client merge + streams, `f48ad51` setValue, `89c0b14` encoder), and `master` fast-forwarded to
`89c0b14`: 15 commits not pushed, `origin/master` at `e31ed23`. 844 tests. `refactor/typed-value-union`,
`refactor/parameter-union` and `fix/parameter-value-checks` can be deleted.
Then typing-review item 10 on branch `refactor/small-typing` off `89c0b14`: `dd78d20` (`refactor!:` DecodeResult.errors
required), `60818cf` (`refactor!:` literal() → annotations/satisfies), `e49f638` (`chore:` misspelt ESLint rule), and `1bec0a3` (`chore:`
`no-explicit-any` an error for library code), and `master` fast-forwarded to `1bec0a3`: 19 commits not pushed,
`origin/master` at `e31ed23`. 844 tests. `refactor/small-typing` can be deleted.
Then typing-review item 8 (all of it, user's call: "complete all of the proposed stronger typings") on branch
`refactor/narrow-types` off `1bec0a3`: `0881698`, `723ffe2`, `baaee92` (`refactor:`) and `f89c775` (`refactor!:`, RelativeOID), and
`master` fast-forwarded to `f89c775`: 23 commits not pushed, `origin/master` at `e31ed23`. 863 tests.
`refactor/narrow-types` can be deleted.

## 47–58. Compared with libember (2026-11-15)

The whole library was read against Lawo's reference code (github.com/Lawo/ember-plus at `6bc294e`, sparse checkout in
the session scratchpad): libember (BER traits, Glow tags/types/enumerations, accessors and their defaults, DomReader),
libs101 (S101 StreamEncoder/StreamDecoder, CommandType) and libember_slim (emberframing.c, glowrx.c, glowtx.c, the
sample consumer/provider). Building and running libember was not done (refused by the permission classifier on
2026-11-15, not worked around); behaviour is taken from the source. libember is a codec: it has no consumer or
provider logic, so `EmberClient`/`EmberServer` are compared only where libember defines a value (defaults, enum
values, field types); their protocol behaviour was reviewed against the spec in earlier sections.

Tests: fork branch `test/libember-parity` (off `master` at `145a8fa`), two commits, on `master` since 2026-11-15:
`a90d4a1` `src/S101/__tests__/libember.spec.ts` (ports of libs101's encoder/decoder as the reference) and `3b141be`
`src/encodings/ber/__tests__/libember.spec.ts` (ports of libember's `long long` integer coder; GlowType, enum values,
accessor defaults, `effectiveType()`). Matches are ordinary tests. Each divergence is an `it.failing` test stating
libember's behaviour: it passes while the difference remains and fails once fixed (then make it `it`). Each failing
test was checked to fail for the stated reason. 708 tests in all.

Matches (ordinary tests): S101 escaping (every byte ≥ 0xF8), CRC, keep-alive request/response bytes, multi-packet
flags, bytes between frames ignored, BOF within a frame restarts it, bad CRC dropped; integers within 32 bits
(shortest two's complement), BOOLEAN 0xFF/any non-zero, libember's length form (`82 00 80` for 128: its Length uses
the unsigned integer coder, leading zero byte included), every APPLICATION tag (GlowType 0–25), every enumeration
(ParameterType, Access, MatrixType, AddressingMode, ConnectionOperation, Disposition, CommandType, DirFieldMask,
StreamFormat), and the parameter's effective type (trigger > enumeration/enumMap → enum > value's type > type field).
Earlier: REAL (#15, #16) and multi-byte tags (#13) already follow libember. The client's `isOnline !== false` and the
server's `matrixType ?? OneToN` match libember's defaults.

Divergences:

- **#47 templateReference.** The DTD has `templateReference [18] RELATIVE-OID` on a parameter (spec ASN.1, and
  `GlowParameterBase::setTemplateReference(ber::ObjectIdentifier)`). The library writes and reads the parameter's as a
  UTF8String (`encoder/Parameter.ts` `writeString(…, STRING)`, `decoder/Parameter.ts` `readString(STRING)`); the node,
  matrix and function ones are RELATIVE-OIDs, correctly. Decoding a libember parameter with one throws `Expected 0xc:
got 0xd`, and `berDecode` has no per-element catch, so the whole message is lost and the request it answers times
  out. A libember consumer reading the library's gets no template reference. Fix: RELATIVE-OID both ways.
- **#48 Integer64.** The DTD's values and limits are Integer64; `Integral.hpp` codes a `long long` in up to 8 bytes.
  `ASN1/ber/writer.ts` `writeInt` works on 32-bit ints: 2^31 is written `02 04 80 00 00 00` (−2^31), 2^32−1 as `02 01
ff` (−1), 2^32 as `02 01 00`. `reader.ts` `_readTag` shifts in 32 bits: `00 ff ff ff ff` reads −1, `01 00 00 00 00`
  reads 0, `ff 00 00 00 00` reads −256. Note: libember's `glow::Value` itself stores an `int` (VariantImpl<long> has
  `typedef int value_type`), so libember's own accessor truncates too; its BER layer and setValue(long) on LP64 don't.
  Fix: code numbers within ±2^53 exactly (bigint or two 32-bit halves); decide what to do past 2^53.
- **#49 Null values.** Glow 2.50 made a value nullable. libember's Value takes NULL as no type (`ParameterType::None`),
  so `effectiveType()` falls back to the type field; the library's decoder takes the value's type, Null, over the type
  field. The encoder writes the value by the parameter's type: `Number(null)` = 0 for integer/real, `'null'` for a
  string, and throws for boolean, enum, octets. libember's `setValue(ber::Null)` writes `05 00`.
- **#50 InvocationResult.success.** `GlowInvocationResult::success()` is true when the field is absent; the library
  leaves it undefined, which the module's invoke action reads as a failure.
- **#51 Enum values.** `Ber/Writer.ts` `writeValue({type, value})` maps `ParameterType.Enum` to the tag ENUMERATED
  (10) and Trigger to UTF8String ("TODO: this is a guess"). The DTD's Value has no ENUMERATED; libember reads it as no
  known type, and the library's own `readValue` throws `UnimplementedEmberTypeError` on it. Write enums as INTEGER.
- **#52 Command number.** `GlowCommand::number()` is `CommandType::None` when absent and keeps an unknown number; the
  library's `decodeCommand` substitutes Subscribe for both (`check(…, CommandType.Subscribe)`, `unexpected(…, new
SubscribeImpl())`), so `EmberServer` subscribes the client on a malformed or future command.
- **#53 Access.** libember keeps an unknown access value, and `isWriteable()` is false for it; the library substitutes
  readWrite. (Absent access: libember ReadOnly, the spec's default "read"; the library leaves it undefined, which is
  the model's design and harmless since `EmberServer` doesn't enforce access.)
- **#54 DTD version.** libember's GlowDtd is 2.50, libember_slim's `GLOW_SCHEMA_VERSION` 0x0232; the codec writes
  minor 0x1F (2.31) in every EmBER packet's app bytes. Receivers skip the app bytes, so no effect seen.
- **#55 Variant 2.** The spec: "All libraries mentioned in this document support both variants"; libs101 and
  emberframing.c read frames starting 0xF8 (length-of-length byte, big-endian length, unescaped payload, no CRC). The
  codec ignores them; one whose payload holds 0xFE/0xFF yields a spurious "invalid CRC" error. A consumer probes with
  a variant-2 keep-alive and falls back when unanswered, which the spec allows, so the impact is low.
- **#56 S101 header.** glowrx.c checks message, command and DTD but not the slot; the codec rejects slot ≠ 0 as "not
  an ember frame". glowrx.c doesn't decode a non-Glow DTD as Glow; the codec warns and decodes it. libs101 defines
  command 0x03 (ProviderState, not in the spec); glowrx.c passes unknown commands to `onOtherPackageReceived`, the
  codec reports them as errors. All low; whether to follow libember on the DTD is a judgement call (stricter).
- **#57 Reader edge cases.** An empty INTEGER (`02 00`) reads 0 in libember; the library reads the next byte for the
  sign and gives −1 when its top bit is set. libember reads a BOOLEAN's first byte only; the library reads all bytes as
  an integer (`01 02 00 01` → true). libember reads any number of length bytes; the library refuses more than four.
  `GlowStringIntegerPair::name()` is "" when absent; the library makes up `key<random>`.
- **#58 RELATIVE-OID values.** `Ber/Reader.ts` `readValue` decodes a RELATIVE-OID with `readOID` (absolute: the first
  arc split by 40), so `1.2.3` reads `0.1.2.3`. Not a DTD Value type; libember's Value reads any such type as integer 0. The bug is `readOID` for `readRelativeOID`; no libember test, as matching libember would mean returning 0.
  Fixed 2026-11-16, `c786f67` (on `master`): `readValue` uses `readRelativeOID`; type stays String
  (follows the encoding, not libember's integer 0). Plain tests in `src/Ber/__tests__/reader.spec.ts`: `1.2.3`,
  `1.200.3` (multi-byte arc), `0` and `''` (the last two read `0.0` before); all four fail against the old reader.

**#57 (2026-11-16)**, fork branch `fix/ber-reader-edges` off `master` at `c786f67`, one commit per part,
fast-forwarded into `master`, not pushed. Each part's tests fail against the reader before it (checked).

- `27622ac` lengths (user's call after discussion: no byte-count limit). `readLength` and `readBlock` take 1–126 length
  bytes (X.690 8.1.3.5; libember reads any count) and refuse the reserved first byte 0xFF; the old cap of 4 ("encoding
  too long") is gone. Safety comes from the existing "length past the data" checks; accumulating in doubles keeps 126
  bytes finite (< 2^1008), and anything past 2^53 is far beyond any buffer. Why not 8 (the first suggestion): that was
  libember's `size_t` (it silently overflows past 8 bytes), but what matters is the value, not the byte count; any
  encoding of 5+ bytes is valid only with leading zeros. Tests: libember.spec "lengths in any number of bytes" (5, 8,
  9, 126 bytes; a 9-byte sequence length; a 9-byte length inside an indefinite container); ASN1 reader.spec
  "long-form lengths" (0xFF refused, direct and inside an indefinite container; 5- and 9-byte lengths past the data
  refused by `readSequence`/`readStringAsBuffer`/`readBlock`).
- `e2a02a9` empty INTEGER → 0 (`_readTag` returns 0 for length 0; the sign was taken from the next element's byte).
- `007b201` BOOLEAN from its first contents byte (`readBoolean` via `readStringAsBuffer`; empty → false as before;
  more than 8 bytes no longer throws "Integer too long").
- `0de0308` unnamed enum-map entry → `''` (was `key<random>`), error kept. Two unnamed entries now collide in the Map
  (last wins), as two entries of one name already did. The libember.spec headers now say no `failing` tests remain.

**Fixes for #47–#51 (2026-11-15)**, fork branch `fix/libember-divergences` off `master` at `3b141be`, one commit
each, fast-forwarded into `master` (`cde13e2`), not pushed. Each fix turned its `it.failing` tests into ordinary ones
in the "as libember does" block. 722 tests.

- `fff9f1f` #47: `templateReference` [18] written as a RELATIVE-OID. The decoder also still reads the UTF8String form
  earlier versions wrote (peeks the tag). Side effect: `writeRelativeOID` validates, so encoding a parameter whose
  `templateReference` isn't a dotted number path now throws (any string was written before).
- `dbcd286` #48: `writeInt` writes past ±2^31 with BigInt (libember's SignedEncodedLength, up to 8 bytes); `_readTag`
  reads 5–8 bytes with BigInt (exact within ±2^53). The int32 paths are unchanged (so #57's empty INTEGER is
  untouched). Side effect: `writeInt` now throws on NaN/±Infinity (written as 0 before) and past 64 bits.
- `6eeb078` #49: effective type ignores a Null value's type (type field decides; Null only without one, no error);
  the encoder writes `05 00` for a null value or default whatever the type.
- `5027bf0` #50: decoded `success` is `?? true`; model doc says so.
- `cde13e2` #51: `parameterTypetoBERTAG` maps Enum to INTEGER and Trigger to none (the value's JS type decides);
  `writeValue` writes an untyped Buffer as OCTET STRING (was a UTF8 string); `readValue` reads ENUMERATED as an
  integer, for values from earlier versions.

**Fix for #52 (2026-11-16)**, fork branch `fix/unknown-command` off `master` at `cde13e2`, fast-forwarded into
`master`, not pushed.

- `3dd3bdb` #52: new `CommandType.Unknown = 0` (user's choice of name and approach, over keeping the raw number as
  libember does: nothing in the library needs the number, and the decoding error keeps it), with `UnknownCommand` /
  `UnknownCommandImpl` in `model/Command.ts` (not exported from `Model`, like the rest of Command). `decodeCommand`
  reads the number into a plain `number` and maps 30–33 explicitly (the numeric enum took any number before);
  missing → `check()` error ("required property 'number'") + Unknown; anything else, 0 included → `unexpected()`
  error ("command type 'N' is not recognized") + Unknown (throws with `skipUnexpected: false`, as before).
  `EmberServer._handleCommand` returns early on Unknown: no reply, no subscription. Only the provider acts on decoded
  commands; `EmberClient` never does, so the module was not affected. Tests: libember.spec (34, 0, −1, missing) and
  Server spec "commands it does not know" (root and node, through `berDecode` of a hand-built message; a GetDirectory
  sent the same way as a control). The new tests fail against the old decoder/server (10 failures, checked).

**Fix for #53 (2026-11-16)**, fork branch `fix/unknown-access` off `master` at `3dd3bdb`, fast-forwarded into
`master`, not pushed.

- `f9b4ff3` #53: `readParameterAccess` substitutes `ParameterAccess.Read` (was ReadWrite) for a value the DTD doesn't
  define, keeping the "unexpected parameter access 'N'" error (user's choice of Read over None: libember's `access()`
  keeps the raw value, `isWriteable()` is false for it and there's no `isReadable()`, so a libember consumer shows it
  read-only; None would also hide it). Read is the DTD default for an absent field too (the library still leaves an
  absent access undefined). Tests: libember.spec, 7, 4 and −1 decode as Read with that error; fail against the old
  decoder (checked).

**Fix for #54 (2026-11-16)**, fork branch `fix/dtd-version` off `master` at `f9b4ff3`, fast-forwarded into `master`,
not pushed.

- `1a118d9` #54: `DTD_VERSION_MINOR` in `S101Codec.ts` is 0x32 (Glow 2.50), was 0x1F. The S101 libember spec now
  compares a whole frame with libember_slim's header (`header(0xc0)`, app bytes 0x32 0x02) instead of taking the minor
  byte from the codec's own frame; the version test is an ordinary one. `S101Codec.spec.ts`'s `makeEmberFrame` input
  updated to 0x32 (cosmetic: the codec skips the app bytes). Both tests fail against the old constant (checked).

**Fix for #56 (2026-11-16)**, fork branch `fix/s101-header` off `master` at `1a118d9`, one commit per part (so the DTD
change can be reverted alone), fast-forwarded into `master`, not pushed. Each part's tests fail against the codec before it (checked).

- `22ef42f` slot: `handleFrame` reads frames whatever their slot (debug log when not 0); a message type other than
  0x0E is still an error. Keep-alive responses still go out with slot 0 (not echoed). Tests: EmBER packet and
  keep-alive with another slot.
- `f179a5c` DTD (user's call, 2026-11-16: drop, as libember_slim does): `handleEmberFrame` returns, with a debug log
  and no error, for a DTD byte other than 1. Multi-packet state isn't touched (as libember_slim). A provider writing
  the wrong DTD byte now stops working; revert this commit alone if one turns up. Tests: DTD 0 and 2 dropped without
  an error; Glow packets around one are still read.
- `ccb6b68` commands: a command other than 0x00–0x02 (libs101's ProviderState 0x03 among them) is passed over with a
  debug log instead of an error. Tests: 0x03 and 0x7F, and packets around one still read.

- `ea737ad` (follow-up, 2026-11-16, on `master`): a message type other than 0x0E (EmBER, the only
  one the spec lists) is passed over with a debug log instead of the "not an ember frame" error, as glowrx.c passes it
  to `onOtherPackageReceived`. Side effect in `S101Codec.spec.ts`'s short-frame test: `fe 00 00 ff` is an empty
  message with a good CRC (0x0000 = CRC of no bytes); the codec reads the CRC bytes as slot 0 / message type 0, so it
  was reported as not Ember and is now passed over quietly (libember_slim does the same). The test now expects "no
  error" for it and "invalid CRC" for the other two short frames; later frames still arrive in all three. Tests:
  message types 0x0F and 0x00 (EmBER-shaped and keep-alive-shaped) passed over; Glow packets around one still read.
  All fail against the old codec (checked). Not changed: a message too short to hold slot, message type and command
  is still parsed from its CRC bytes (harmless now that the outcome is a quiet drop; an explicit length check would be
  tidier). (Done with #55 below: `handleMessage` passes over a message shorter than 3 bytes.)

**#55, non-escaping frames (2026-11-16)**, fork branch `feat/s101-non-escaping` off `master` at `ea737ad`, marked
`feat:` (user's call: a feature, not a fix), fast-forwarded into `master`, not pushed.

- Reference caveats found: libs101's `StreamDecoder.hpp:294` computes the length shift from `m_payloadLength` (still 0) instead of `m_payloadLengthLength`, so libs101 misreads any variant-2 length (undefined behaviour); libember_slim's
  reader (`emberframing.c:420`) is correct and is the reference. libember_slim's
  `emberFraming_writeKeepAlive{Request,Response}WithoutEscaping` call the escaping writer and then `finish()` writes a
  length over bytes 2–5, so they emit garbage; the unused `writeKeepAlivePackageWithoutEscaping` also lacks the length
  bytes. Its EmBER-packet writer (`glowOutput_initWithoutEscaping`) is correct. The samples never use variant 2.
- `a93e9e3` feat: read variant 2. `dataIn` treats 0xF8 outside an escaping frame as a variant-2 start
  (`readNonEscapingFrame`: length-of-length `& 0x07` as libember_slim, up to 7 big-endian length bytes); a declared
  length over `MAX_FRAME_BUFFER_SIZE` throws `S101OversizedFrameError` at once (`dropOversized`, shared with variant
  1); an incomplete frame is kept for the next read. An unescaped 0xF8 inside an escaping frame means that frame was
  cut short: it's dropped (debug) and the variant-2 frame read. The next 0xF8 is found once per stretch
  (`nonEscapingFrom`), not per frame. Both forms go through `handleMessage` (slot/type/command; < 3 bytes passed
  over); only variant 1 checks and strips the CRC. Public `handleFrame` / `handleEmberFrame` keep their contracts (CRC
  at the end); the body moved to private `handleEmberPayload`. Behaviour change: a stray 0xF8 between escaping frames
  (was ignored) now starts a variant-2 read, as in libember_slim/libs101; garbage like that could swallow following
  frames up to its declared length. Tests (libember.spec "non-escaping frames, as libember_slim reads them"): EmBER
  packet with 0xFE/0xFF in it, keep-alive, 1/2/3/7 length bytes, empty message, byte-at-a-time, multi-packet, mixed
  with escaping frames, an escaping frame cut short; S101Codec.spec: declared 2^31−1 and 2^56−1 dropped as oversized.
  All but the empty-message one fail against the old codec (checked).
- `8e3358d` feat: answer a variant-2 keep-alive request in kind. The codec's `keepaliveReq` event carries
  `nonEscaping`; `keepAliveResponse(nonEscaping = false)` writes `f8 04 00000004 00 0e 02 01` (4 length bytes, as
  libember_slim's EmBER writer); `S101Socket` replies in the request's form (server and client sockets alike).
  EmBER packets are still only sent escaping. Tests: the event's flag; the response's bytes and that a codec reads it
  as a keep-alive response; default still escaping; S101Socket.spec answers each form in kind. Against the previous
  code the suites don't compile (new signature), so they fail.

**#59 (found 2026-11-16, open).** `S101Codec` reuses `inbuf` (a SmartBuffer) to unescape each escaping frame, and
`toBuffer()`/`readBuffer()`/`SmartBuffer.fromBuffer()` all share memory, so the `emberPacket`/`emberStreamPacket`
payload of a single-packet escaping frame is a view of `inbuf`: the next escaping frame (same read or later) overwrites
it. Present before #55 (checked against the committed codec with two different frames in one read). The library is
not affected (`S101Socket` decodes inside the event, synchronously; multi-packet messages are copied into
`multiPacketBuffer`), but `S101Codec` is exported, so an outside listener that keeps or defers the buffer gets
corrupted data. Non-escaping payloads are views of the read's buffer, which the codec doesn't reuse. Fix: copy the
payload before emitting (`Buffer.from(payload)` in `handleEmberPacket`/`handleEmberStreamPacket`, or when
unescaping), plus a test with two different frames in one read. The libember.spec `received` helper copies packets
meanwhile.

Fixed 2026-11-16, `cff740b` (branch `fix/s101-packet-copies`, stacked on `feat/s101-non-escaping`; on `master`): `handleEmberPayload`
copies a single-packet payload (`Buffer.from`) before the stream/tree split and emit, for both frame forms (a
non-escaping payload is a view of the caller's read, which the caller may reuse). Multi-packet messages aren't copied
again: `multiPacketBuffer` is dropped after the message is handed on. The libember.spec helper's copy is removed, so
its "mixed" test guards this too. Tests (S101Codec.spec "packets a listener keeps"): three different packets (trees
and a stream) in one read, two in successive reads, and a non-escaping frame whose read buffer the caller zeroes
afterwards; all fail against the old codec (checked).

Not divergences worth a change (no test): libember's DomReader is stricter than the library on input (rejects a zero
outer length, mixed definite/indefinite outer/inner lengths, indefinite primitives); the library writes nothing it
rejects. libember omits `dirFieldMask` when Default; the library writes 0 (same meaning). libember validates
identifiers on `setIdentifier` (non-empty, first char letter or `_`, no `/`); the library doesn't validate a
provider's tree (no API point to test). libember's accessors give defaults (factor 1, step 1, streamIdentifier −1,
gainParameterNumber −1, targetCount 0); the library leaves absent fields undefined by design. libember splits
`formula` at the first `\n` (one term for both directions when there is none) and `enumeration` on `\n`; the library
exposes the raw strings. libs101 treats `CE CE x` as `x ^ 0x20`, the codec as `0xDD x` (malformed input only).

## Typing review (2026-11-15)

Report only, nothing changed. Settings: `strict` is on; `noUncheckedIndexedAccess` is off (hence casts like
`connections[t] as Connection | undefined`); the preset turns off `no-explicit-any` and all `no-unsafe-*` rules. The
local `eslint.config.mjs` also disables `'@typescript-eslint/no-explict-any'` (misspelt; a no-op).

Most value for the least churn first:

1. ~~**`Connections` as a type alias.**~~ Done 2026-11-16, `e2bb1de` (on `master`, marked `refactor:`): `type Connections = { [target: number]: Connection }` (same shape; published typings go from interface
   to type alias, nothing merges into it). Removed the 7 library casts (Server ×4, Client ×2, encoder/Tree ×1) with
   their eslint-disables and comments, and 4 in the tests (two of those now `?? {}` where the cast hid an undefined).
   Left alone: index reads like `connections[t] as Connection | undefined`, which exist because
   `noUncheckedIndexedAccess` is off (a separate question), and two test annotations spelling out the type.
2. ~~**Public signatures use types the package root doesn't export.**~~ Done 2026-11-16, `ed46c21` (on `master`,
   marked `feat:`: additions to the public API). Found from the built declarations
   (`tsc -p tsconfig.build.json --outDir <scratch>`). `Model` now also exports the command family: `Command`,
   `CommandType`, `FieldFlags`, `GetDirectory`, `Invoke`, `Subscribe`, `Unsubscribe`, `UnknownCommand`. The root
   exports `EmberClientOptions`, `RequestPromise`, `RequestPromiseArguments`, `ConnectionStatus`, `S101Socket`
   (class), `S101SocketEvents`, `S101CodecEvents`, `DecodeResult`, `DecodeOptions`. Not exported (not in any public
   signature): the client's internal `Request`/`Subscription`/`Change`/`ExpectResponse`, the command `*Impl` classes,
   `LabelImpl`, `StreamDescriptionImpl`, `InvocationImpl`/`InvocationResultImpl`, `StreamEntryImpl` (callers can use
   object literals of the exported interfaces). New `src/__tests__/index.spec.ts` imports everything from `../index.js`
   and uses it in signatures; it doesn't compile without the exports (checked).
3. ~~**`EmberTypedValue` ... don't tie the value to the type.**~~ `EmberTypedValue` done 2026-11-16 on branch
   `refactor/typed-value-union`: `0ccd539` (`refactor!:` + BREAKING CHANGE footer) makes it a union, one member per
   ParameterType (Integer/Real/Enum number, String string, Boolean boolean, Octets Buffer, each `| null`; Null only
   null; Trigger any EmberValue). The library already built only matching values; one client test built an Octets
   stream value from a number (now a Real). `811fd7e` (`fix:`): `Writer.writeValue` writes a typed value by its declared
   type (`writeTypedValue`: Integer/Enum `writeInt` (fraction dropped; was REAL contents under INTEGER), Real
   `writeReal`, String, Boolean, Octets incl. empty, null `05 00`, Trigger by its JS type); a mismatched value from an
   unchecked caller throws the writer's TypeError instead of writing corrupt bytes; `parameterTypetoBERTAG` removed.
   Tests in `src/Ber/__tests__/writer.spec.ts` ("Writer.writeValue, a typed value"): the fraction and mismatch cases
   fail against the old writer. Then the Parameter split, done 2026-11-16 (user's call, after a detailed write-up; the
   "smaller job", the encoder's runtime check, kept alongside it as a runtime guard):
   - `36b8fab` `refactor!:` (BREAKING CHANGE footer): `Parameter` = union over `TypedParameter<T>` (shared fields on
     `ParameterBase`, the DTD allowing each on any type; only `value`/`defaultValue` tied, as `ParameterValue<T>`:
     number for Integer/Real/Enum, string, boolean, Buffer, each `| null`; Null only null; Trigger any EmberValue).
     `ParameterImpl<T extends ParameterType = ParameterType>`, same positional constructor (literal T inferred). New
     `isValueOfType(type, value)` (null fits all, anything fits Trigger). Exported: `ParameterValue`, `TypedParameter`,
     `isValueOfType`. Decoder and `setValue` got a commented cast here, replaced by checks below. Tests: spread a
     `{ type }` base instead of a typed `prm`; type loops use plain objects (a union-typed `parameterType` with no or a
     null value fits the union; a `ParameterImpl<ParameterType>` instance doesn't).
   - `6ab189d` `fix:` decoder: value/default that doesn't fit the effective type left out with an `unexpected()` error
     (enum by enumeration with a non-number value; a default of another type, e.g. a string parameter's integer 0);
     numbers fit every numeric type; throws with `skipUnexpected: false`.
   - `ddc6e70` `fix:` client: `_updateTree` doesn't apply an update's value/default that doesn't fit the cached type
     (`warn` event naming path, value, type), still applies the rest and null; StreamManager stores a stream value only
     if it fits (raw octets without a descriptor on a numeric parameter: still emitted in `streamUpdate`, not stored).
   - `f48ad51` `fix:` `setValue<P extends Parameter>(node: TreeElement<P>, value: Exclude<P['value'], undefined>)`; refuses
     a misfit at runtime before sending (was coerced/garbled by the encoder). Compile-time test with `@ts-expect-error`.
   - `89c0b14` `fix:` encoder: value/default via `Writer.writeValue(typedValue(parameter, key))`, built per narrowed type
     (no casts left); runtime `isValueOfType` check first, `InvalidEmberNode` on a misfit (was coerced with
     Number()/+'', NaN for a real's string, writer TypeErrors, or NULL for a Null parameter whatever its value). Module impact (API 2 migration):
     the module's `castToEmberTypedValue(item, expected.type)` / `parseFunctionArguments` build `{ type, value }` from a
     ParameterType variable, which won't compile against the union; it needs a switch per type. Likewise
     `makeSetValueRequest` (`new EmberModel.ParameterImpl(node.contents.parameterType)` is a `ParameterImpl<ParameterType>`,
     not a `Parameter`, so `setValue` won't take it) and the module's state maps of `Parameter`. Original note: `{ type: ParameterType; value: EmberValue }`
     lets `{type: Boolean, value: 'x'}` through, and forces casts where the value is written (`encoder/Parameter.ts`
     `value as boolean`/`as number`/`as Buffer`; `Ber/Writer.ts` 161–179). A discriminated union (`{type: Integer | Real
| Enum; value: number} | {type: String; value: string} | {type: Boolean; value: boolean} | {type: Octets; value:
Buffer} | {type: Null; value: null}`, each also allowing `null` per #49) makes the encoder's switch type-safe and
     would have caught #49. `Parameter` itself has a "TODO break down further by ParameterType?"; doing that is a bigger
     API change (`Partial<Parameter>` updates, `ParameterImpl`'s positional constructor), so do `EmberTypedValue` first.
4. ~~**Decoded limits typed by cast.**~~ Done 2026-11-16, `ec88e60` (on `master`, `fix:`: decoding behaviour
   changes). New `readMinMax` in `decoder/Parameter.ts`: integer, real or null kept; any other type (string,
   boolean, octets…) left out with an `unexpected()` error ("minimum of the type STRING is not an integer, real or
   null; left out"), throwing when `skipUnexpected` is off. Deliberately not libember's behaviour (its MinMax reads
   another type as integer 0, which would invent a limit). Tests in Parameter.spec "minimum and maximum" (string and
   boolean limits dropped with errors; throws with `skipUnexpected: false`); both fail against the old decoder.
   Original note: `decoder/Parameter.ts` 63/66: `minimum = reader.readValue().value as number |
null`. A provider that sends a string limit (seen: #4) gets a string typed as `MinMax`. Check `typeof` and record an
   error instead of casting.
5. ~~**`berEncode`/`berDecode` don't tie the root type to the value.**~~ Done 2026-11-16, `513b56c` (on
   `master`, `feat!:` + BREAKING CHANGE footer: stricter public signature). `berEncode(...[el, rootType]:
EncodableRoot)` — a tuple-union rest parameter, not overloads (overloads can't take a union-typed root passed on by
   a generic caller; the tuple can be spread: `berEncode(...root)`); the body narrows by `rootType` with no casts.
   `berDecode` returns `DecodedRoot` = `DecodeResult<X> & { rootType }` per kind (still assignable to
   `DecodeResult<Root>`; an unreadable message stays elements with an error). `S101SocketEvents.emberTree` /
   `emberStreamTree` carry `DecodedRoot`. Server: handles `emberTree` only for `RootType.Elements` (a stream
   collection or invocation result from a consumer was walked as elements and threw; now passed over). Client: stream
   path checks `RootType.Streams`; `_applyRootToTree` takes the `DecodedRoot` and switches on `rootType` (no more
   `'id' in node` or the Collection cast; a stream collection there is ignored). `EncodableRoot` and `DecodedRoot`
   exported from the root. Test changes: the mock socket fills in `rootType` from the value (74 client injections
   unchanged); the server spec's 4 hand-made emits got `rootType`; a client test calling the private
   `_applyRootToTree` passes the decoded root; `guarded(berDecode(...))` in tests needs `guarded<Root>(…)` (generic
   inference over the union). New tests: rootType per kind and for an unreadable message; `@ts-expect-error` for
   mismatched `berEncode` pairs; server passes over a stream collection / invocation result (fail against the old
   server); exports test uses `EncodableRoot`/`DecodedRoot`. Original note: `berEncode(el: Root, rootType: RootType)` casts
   `el` per case (`encodings/ber/index.ts` 25, 34, 42); overloads (`(el: Collection<RootElement>, rootType:
RootType.Elements)` …) remove them. `berDecode` returns `DecodeResult<Root>`, so callers cast (`Server` 88 `tree as
DecodeResult<Collection<RootElement>>`, `Client` 171 `tree.value as Collection<StreamEntry>`); returning a
   discriminated `{ rootType, value }` (or typing `S101Socket`'s `emberTree`/`emberStreamTree` events per root type)
   removes those.
6. ~~**`any` in non-test code**~~ Done 2026-11-16, `310c99f` (on `master`, `refactor:`): none left
   in library code (only the enum value `ExpectResponse.Any = 'any'`). `S101Socket`'s unused `Request = any` deleted
   and its listeners' `packet: any` dropped (inferred `Buffer`); `Request.resolve` typed `(res: RootElement |
InvocationResult) => void`, bridged to the caller's `T` where the request is stored (`(res) => resolve(res as T)`,
   one documented cast); `Server.update` copies the update, `Reflect.deleteProperty(changes, 'connections')` for a
   matrix, then `Object.assign`; tree encoder `Object.values<unknown>` over a spread copy (interfaces lack the implicit
   index signature); `normalizeError` uses `String(e)` (a thrown null/undefined now reads "null"/"undefined", was an
   empty message). Original list, for reference: `S101Socket.ts` `export type Request = any` (used nowhere, not exported from the
   root: delete) and
   `(packet: any)` on both codec listeners (the codec's events already type it `Buffer`); `Client` `Request.resolve:
(res: any) => void` (make `Request` generic or `unknown`), which is why `req.response` is cast at 458 and 507;
   `Server.update` `Object.entries<any>(update)` + `element.contents[key as keyof T] = value`; `encoder/Tree.ts` 66
   `Object.values<any>(contents)` (`unknown` suffices); `Lib/util.ts` 80 `(e as any)?.toString()` (`String(e)`);
   `model/EmberElement.ts` 35 `includes(type as any)`; `model/Parameter.ts` 91 `obj as any`.
7. ~~**Dead and wrong:**~~ Done 2026-11-16, `cc609f5` (on `master`, `refactor:`):
   `Writer.writeEmberParameter` and `isParameter` removed, with `src/model/__tests__/Parameter.test.ts`. The two
   octets round-trip tests in `src/Ber/__tests__/index.spec.ts` that used `writeEmberParameter` now use `writeValue`
   with type Octets (same coverage, on the path the library uses). Found doing it: jest's `testMatch` is
   `**/__tests__/**/*.spec.(ts|js)`, so `src/model/__tests__/*.test.ts` never ran (tsc and ESLint do check them). The
   remaining one, `EmberElement.test.ts` (11 tests of `isEmberElement`), passes when run explicitly; renamed to
   `.spec.ts` on 2026-11-16 (user's call; `74fb694`, `test:`), so jest runs it now (788 tests). No other test file is
   missed: the other non-`.spec` files under `__tests__` are helpers, plus `src/Ember/Client/__tests__/index.test.ts_`,
   a deliberately disabled draft from the TypeScript rewrite (`417c653`) that imports a `Qualified` model which no
   longer exists; deleted 2026-11-16 (user's call, `e31ed23`). `isEmberElement` now has no user in the library
   (only that test); it isn't exported from `Model` either, so it could go too (user's call). User's call
   (2026-11-16): keep it and export it from `Model` as a public type guard (`0eddce4`, `feat:`, doc comment: checks
   the `type` field only); its `type as any` cast dropped in `6763712` (`refactor:`; `typeof type === 'string'`, then
   `Object.values<string>(ElementType).includes(type)`, as the preset's typed-Object.values rule wants).
8. ~~**`string`/`number` where a narrower type exists:**~~ Done 2026-11-16 (on `master`):
   `0881698` `CommandImpl.number: CommandType`; `723ffe2` the server's directory replies keyed by `child.number` / `rootEl.number`
   (no `i as unknown as number`; the root reply starts from `{}`, not a copy of the tree it overwrote; root vs node told
   by `'contents' in tree`, dropping a cast); `baaee92` `LabelImpl.basePath: RelativeOID`; `f89c775` (`refactor!:` + BREAKING
   CHANGE footer) `RelativeOID = '' | \`${number}\` | \`${number}.${string}\``(checks the first part only; TS can't
repeat a pattern) with`Types.isRelativeOID(s)`(whole string, runtime), and in`Lib/util.ts` `childPath(parent, n)`and`parentPath(path)`; `Ber.Reader.readRelativeOID`returns`RelativeOID | null`(confirmed by`isRelativeOID`, no
cast); `getPath`returns`RelativeOID`; client's sent-GetDirectory/Subscribe maps keyed by `RelativeOID`; decoder path
variables typed; `getElementByPath`keeps`string`(identifier paths too). The old UTF8String`templateReference`is
read only when it's a numeric path, else left out with an error. Tests: isRelativeOID cases, childPath/parentPath,`@ts-expect-error`for`'Ruby.Sums'`as a RelativeOID, the non-path templateReference string. Original note:`CommandImpl.number: number`(abstract) →`CommandType`;
`Server` `response[i as unknown as number]`(×3, from`Object.entries`string keys) → iterate with the element's`number`; `LabelImpl.basePath: string`vs the interface's`RelativeOID`(cosmetic while`RelativeOID = string`).
`RelativeOID` could become a template literal type (`'' | \`${number}\` | \`${number}.${string}\``) to catch
identifier paths passed where numeric paths are needed; optional, it spreads into every path-taking signature.
Matrix `targets`/`sources`are`Array<number>`and`Connection.target` `number` — fine (Integer32).
9. ~~**Element-kind casts in the client/server**~~ Done 2026-11-16, `68d1d43` (on `master`, `refactor:`). About 22 casts gone: new `isElementOfType(el, type)` (narrows a tree element by its contents' type)
   and `isInvokeElement(el)` in `Lib/util.ts`, plus `isNumbered` hoisted from `getPath`; the existing
   `isGetDirectory`/`isInvoke`; `'identifier' in` / `'description' in` for the getElementByPath lookups; the client's
   isOnline needed no cast (contents already narrowed); `_updateTree`'s Parameter/Matrix cases check
   `update.contents.type` (same as the tree's, checked above) to narrow it. Unit tests in
   `src/Ember/Lib/__tests__/util.spec.ts`. Kept: `update()`'s `update as Partial<Matrix>` (T can't tie the two
   values; commented). Not element-kind, still there: `berDecode`-result and request-response casts (item 5), index
   reads (`noUncheckedIndexedAccess` off), `toQualifiedEmberNode(...) as QualifiedElement<Matrix>` and
   `tree as NumberedTreeNode<EmberElement>` in `_handleGetDirectory` (toQualifiedEmberNode's return type; item 8),
   the path-only request contents (`{ type } as EmberElement`, `{…} as Matrix`, deliberate), the documented `resolve`
   bridge, `Object.keys(...) as Array<keyof T>`. Found doing it: #60, fixed in `eccdf66` (`fix:`): the server cast the
   element at an Invoke's path to a function for `onInvocation` (a node, parameter, or the root collection could
   arrive); now only a function reaches the handler, anything else gets a failed InvocationResult with the
   invocation's id (as without a handler). Tests: Server spec "EmberServer invocations" (function → handler; node and
   root → failure, handler not called; both fail against the old server). Original note: (`r.contents as EmberNode` for `.identifier`/`.description`,
   `children[0] as NumberedTreeNode<Command>`, `el as QualifiedElement<Matrix> | …`): a few small type guards
   (`isNode(el)`, `isCommandNode(el)`, `isMatrixElement(el)`) next to the existing `isInvoke`/`isGetDirectory` would
   replace about 20 casts. `contents as EmberNode` for `identifier` is unnecessary where every element type but
   Command has `identifier`: a `'identifier' in r.contents` check narrows it.
10. ~~**Smaller:**~~ Done 2026-11-16 on branch `refactor/small-typing`: `dd78d20` `DecodeResult.errors` required (helpers
    simplified; an error added to a decoding _result_ now goes into a new list, while one added to a caller's list is
    pushed, so results sharing a list, e.g. `Object.assign` copies, aren't changed under each other; the mock socket
    fills in `errors: []` like `rootType`; DecodeResult tests expect `[]` where they expected undefined), BREAKING
    CHANGE footer; `60818cf` `literal<T>()` removed (32 uses → `const x: T = …` or `… satisfies T`; `Types.literal` export
    gone), BREAKING CHANGE footer; `e49f638` the misspelt `'@typescript-eslint/no-explict-any': 'off'` line removed (a
    no-op: the preset turns the real rule off). Then (user's call) `1bec0a3` `chore:` `no-explicit-any` set to error in
    `eslint.config.mjs` for `src/**/*.ts`, ignoring `src/**/__tests__/**`, `src/**/__mocks__/**`, `src/**/*.spec.ts`
    (checked with a probe `any`: reported in `Lib/util.ts`, not in its spec). Original note: `DecodeResult.errors?` is always set by `makeResult` (make it required, drop `?? []` at call sites);
    `literal<T>(x)` predates `satisfies` (TS 4.9) and could go; `Template.element` excludes Template/Command already
    (good); `QualifiedElement.parent: undefined` (good).

## Remaining casts (2026-11-16)

User's call: remove the casts left after the typing review, "so that any potential unexpected behaviours are surfaced
or prevented". Branch `refactor/remaining-casts` off `master` at `f89c775`, one change per commit, fast-forwarded into
`master` (`bf60f5f`), pushed. 931 tests. New tests fail against the code before each fix (checked, except where
the old code no longer compiles under the flag: then the expected bytes are worked out from the spec, and for
`writeRelativeOID` also run against the old writer, which gives the same bytes).

- `4e103e6` `fix:` #61: `decodeRootElements` keys root elements by place (`y[Object.keys(y).length]`); each element
  carries its own number or path, and every consumer reads with `Object.values`. Found reading the decoder.
- `df56db5` `refactor:` `isNumbered`/`isQualified` (generic) in `model/Tree.ts`, exported from `Model` (util, getPath
  and the encoder each had a copy). `RootElement` = `NumberedTreeNode<EmberElement> | QualifiedElement<Exclude<EmberElement,
Command>>` (was one QualifiedElement per kind: same values, same contents union when read, but an element built
  from contents known only as the union now is one without a cast).
- `d7bd7b3` `fix:` #62: `decodeGenericElement` returns a `RootElement`; the matrix and template decoders a qualified or
  numbered element of their kind. A qualified element in an ElementCollection, or a template element that isn't a
  numbered parameter/node/matrix/function, is left out with an `unexpected()` error (throws with `skipUnexpected:
false`). The 4 decoder casts are gone.
- `6457c24` `refactor:` `toQualifiedEmberNode<T>(node: NumberedTreeNode<T>): QualifiedElement<Exclude<T, Command>>`
  (positive guard `isNotCommand`; a negated guard doesn't narrow a generic), so the server's
  `as QualifiedElement<Matrix>` is gone.
- `53c0e4b` `refactor!:` `Matrix.identifier` optional (and `MatrixImpl`'s first argument): the DTD makes the contents
  optional. The decoder no longer makes up `''` for a matrix without contents; contents without an identifier are
  reported missing without a substitute; the client's `identifier === ''` exclusion and the connection request's
  `as Matrix` are gone.
- `a1e16f5` `fix:` #63 plus typing: a command request is a `QualifiedCommand` (`Types`: path, `elementType:
CommandableElementType` = Node/Parameter/Matrix/Function, `command`), built by `toQualifiedCommand` (replaces
  `insertCommand` and `assertQualifiedEmberNode`) and encoded by `encodeQualifiedCommand` (same bytes); `EncodableRoot`'s
  elements may include it. The client sends, records for a reconnect (`elementType`) and matches invocation results
  against it. A template takes no command (its encoding has no children): refused before sending, and before a
  callback or stream registration is kept. The old client test "resolves for a template" is now "refuses a template".
- `9cbe73a` `fix:` #64: requests are matched to changes by path, so an Invoke is now skipped there; only its
  invocation's result (by id) answers it.
- `2e818c2` `refactor!:` `_sendRequest<T extends Response>(…, isResponse: (res) => res is T)`; a reply that isn't one
  rejects ("Unexpected reply to the request to 1.1: a node at 1.1"). Response types are what resolves them:
  getDirectory/subscribe/unsubscribe `RootElement` (were `Root | RootElement`, `Root | void`: a root request resolves
  with a top-level element), invoke `InvocationResult`, setValue `ElementOf<Parameter>` (was `TreeElement<P>`: not
  checked against P, since a reported parameter that isn't loaded has the decoder's guessed type), matrix calls
  `ElementOf<Matrix>`. New `Types.ElementOf<T>` = numbered or qualified element of a kind, also used for the methods'
  element parameters. expand/getElementByPath response casts gone.
- `375cef1` `refactor:` `fitsItsType(parameter): parameter is Parameter` (value and default fit the type) replaces both
  `<Parameter>` casts: setValue checks the parameter it sends with it; the decoder asserts it (unreachable unless the
  misfit check is wrong).
- `8ca2a63` `feat:` `Model` exports `TypedParameter`, `ParameterValue`, `isValueOfType`, `fitsItsType`, `isInvoke`,
  `isGetDirectory` (they were module exports only, so the package couldn't name them).
- `089e092` `fix:` #65: `EmberServer.update` checks a matrix update's connections with `isConnections` (new, with
  `isConnection`, exported from `Model`) before applying anything; refuses the whole update otherwise.
- `3f09e85` `fix:` #66: `writeOID` requires two arcs; its test now asserts the bytes (it only logged them).
- `27063dd` `refactor:` `noUncheckedIndexedAccess` on (`tsconfig.build.json`; 125 sites, 47 in library code): loops by
  index → `for...of`; enum maps typed `Record<Enum, number>` (a missing member doesn't compile); the client's
  qualified walk reads each child once; reads already bounds-checked (BER reader, tag reader, codec frames and CRC
  table) go through new `src/lib/at.ts` `at(collection, index)`, which throws a RangeError for nothing there (was
  undefined, or 0 once masked); the 3 `as X | undefined` index casts gone; tests read what they expect through
  `at()`. `writeRelativeOID` builds each arc's bytes in order (same bytes). `at` is internal (not exported).
- `fa00b7b` `fix:` #67: an element put into the tree from a qualified report is a `NumberedTreeNodeImpl` that its
  children have as parent (`toTreeElement` in the client); was a spread copy keeping `path`, children's parent the
  reported element. Found while rewriting the walk for the flag.
- `d312fe4` `refactor:` the one cast left, `Object.keys(...) as Array<keyof T>`, is `propertiesOf` in `Lib/util.ts`
  (documented; `updateProps` uses it).
- `bf60f5f` `refactor:` the client's `'identifier' in rootElement` (stream entry) check removed: dead, since the root's
  kind is known. One client test had sent a stream collection to the mock socket as elements; it now uses
  `mockStreamData`.

Casts left in library code: only `propertiesOf`. Not touched: the tests' casts to reach private members or to feed
deliberately wrong input; `elementTypeToInt` in `encoder/Matrix.ts` was unused (only a commented-out import): removed in `94a40f3`
(on fork `master`; it mapped element kinds to 0–5, which the Glow DTD encodes nowhere;
not exported), changelog entry `0105ae4`.

Noticed, not changed (open, for the user to decide):

- Pending connections lose their future sources (user: note to come back to, 2026-11-16). A report with the
  disposition `pending` gives, per the spec, the sources the target will have once the queued change is made
  ("sources contains future state"). `EmberClient._updateMatrix` keeps the target's current sources and only sets
  `disposition: pending`, dropping the reported ones; the request resolves, and the tree changes when the provider
  reports the change as made. So a consumer sees that a change is queued, not what it will be. To keep them, store
  them apart from the current sources (e.g. a `pendingSources` on the stored connection, cleared by the next report
  that isn't pending), so that `sources` stays the current state. Nothing needs it yet; the module could show
  "pending: source 5" with it. (The other dispositions: tally, modified and locked replace the sources with the
  reported ones and keep the disposition; locked rejects a connection request, pending and the rest resolve it,
  only a report on the requested target settling it.)

- Matrix functionality not implemented (checked against the spec's "Ember+ 1.1: Matrix Extensions" use cases,
  2026-11-16). Consumer: the helpers for labels and parameters were added in `c764376` (on fork
  `master`, see the module plan's labels paragraph); a linear matrix sends no target/source lists, so the module numbers its signals
  0 to count−1. Provider (`EmberServer`): targets and sources are checked since `047398a` (see Device evidence);
  dispositions done 2026-11-20 (`4f84fa8`, changelog `bbc52da`, on fork `master`, pushed): modified for a
  change (as Lawo's EmberPlusRouter and TinyEmberPlusRouter), tally (left out) for no change or a refusal,
  `setMatrixTargetLocked`/`isMatrixTargetLocked` (a request on a locked target answered `locked` without the
  handler; a handler can lock a target for the same answer), `queueMatrixConnection` for pending.
  The requesting consumer (the last item of that set, from comparing node-emberplus `version3`) done 2026-11-20
  (`a1d023d`, changelog `76c0af1`, pushed): its `S101Socket` is the added last argument of `onSetValue`,
  `onMatrixOperation` and `onInvocation`, and the optional second argument of the `warn` and `error` events a
  consumer's request causes; `S101Socket.remoteAddress`/`remotePort`, kept after a server socket closes.

- The client's root forms differ by method: `subscribe` and `unsubscribe` take the root as an `Array<RootElement>`
  (told by `Array.isArray`), `getDirectory` and `expand` as a `Collection<RootElement>` (told by having no `number` or
  `path`). `client.tree` is a Collection, so unsubscribing from the root with it needs a cast (one client test:
  `client.tree as unknown as Array<RootElement>`). Taking one form, or both, in all four would fix it; changing a
  method's parameter type is breaking.
  **Resolved (2026-11-20):** since `6fc453d` (2026-11-18) all four take `client.tree`, a Map, as the root (told by
  `instanceof Map`, or for getDirectory by having no `number` or `path`), and the test's cast is gone. `8ab3eb1` let
  `unsubscribe` and `expand` take a qualified element too, as `getDirectory` and `subscribe` do.
- `decodeGenericElement` makes up contents for an element that has none: a node gets `new EmberNodeImpl()`, a
  function `new EmberFunctionImpl()`, and a parameter `new ParameterImpl(ParameterType.Null)`, with no error (a
  matrix gets no identifier since `53c0e4b`). The DTD makes contents optional, and a consumer's path-only request has
  none, so such a parameter decodes as one of the type Null, which it isn't. Harmless today: the server uses only the
  path and kind of a request, and the client ignores the type in an update (it guesses nothing from it), but a
  contents-less parameter report on an element that isn't loaded reaches callbacks and setValue's response as a Null
  parameter. The faithful model is optional contents with the kind kept elsewhere (as `QualifiedCommand` does for
  requests); that spreads through every reader of `contents`, so it's a bigger change.
  **Decided (2026-11-20, user's call):** the made-up contents stay: harmless in the tree, and an empty node's made-up
  contents are how the client recognises the reply to a GetDirectory on a node without children. The narrow fix
  `082cf0f`: a parameter with neither a type nor a value (legal: the DTD makes the type optional; TinyEmberPlusRouter
  never sends it) decodes as Null, "no type known", without the "missing parameterType" error, its client warning,
  or strict decoding's refusal. The faithful model only if a consumer trips over a Null type.

## Next session (left off 2026-11-20, after the 0.5.0 release)

State (2026-11-20, end of day): **0.5.0 released** and published to npm as `@phillipivan/emberplus-connection@0.5.0`
(`latest`, with provenance) by `publish.yaml` with npm trusted publishing. Release commit `3c06bf3` ("v0.5.0": the
user's version bump and changelog date); the tag `v0.5.0` was then moved to `267793a`, two commits later, so the
release run had: `82cd10a` (the exhaustive decoding tests given 60 s: under coverage on GitHub's runners they passed
Vitest's 5 s default, failing the publish workflow's test job; each decode keeps its own 1 s hang limit) and
`267793a` (`license-validate` allows MPL-2.0: Vitest's Vite 8 brought in lightningcss, MPL-2.0, which
sofie-licensecheck, checking dev dependencies too, refused). Neither changes the package; no changelog entries (0.5.0
already tagged). Fork `master` at `267793a`, level with `origin/master`. 1347 tests, lint, tsc and prettier clean. The
untracked `Ember+ Documentation.docx` is the Ember+ specification, read for the spec audit. Local branches besides
`master`: `main`, `pr-50`, `debug/matrix-probe`, `test/companion-integration`, and the upstream PR branches (`fix/*`).
Lawo/ember-plus sources were in the session scratchpad, which may be gone: re-clone sparsely (`libember/Headers`,
`libember/Source`, `libs101/Headers`, `libember_slim/Source`, `tinyember/TinyEmberPlusRouter`,
`EmberLib.net/EmberPlusRouter`, and for formulas `EmberLib.net/EmberLib.Glow.Formula` (with the "Ember+ Formulas"
document) and `libformula`) if needed.

Conventions: work on the fork's `master` (no new upstream PRs or bug reports for now); one fix per commit, then its
changelog entry (in the unreleased section, to be started after 0.5.0, under the right heading, linking the fix's
hash) in a `docs:` commit straight after; README-only changes need none. Tests: `yarn test` (lint, then `vitest run`), `yarn test:coverage`,
`npx tsc --noEmit --pretty false -p .` (grep "error TS"), `npx eslint src`, prettier. Check new tests fail on the
code before the fix. Don't push unless asked.

Done 2026-11-17 to 2026-11-19 (on `origin/master`): from upstream PRs #50 and #65, BER truncation and writer growth,
client and server keep-alives (`d304bbc`, `d4849c0`), server limits (`b42a2b1` maxClients, `5806b5f` send buffer),
nesting depth limits (`b7c108a`); the client's and server's collections as Maps (`da3e52f`, `0caaa61`, `6fc453d`,
`cfee702`, `02c1264`); the package as an ES module with an exports map (`7f262ac`); native bigint for `long`
(`05874f5`); REALs with significands over 53 bits (`9d94551`); Vitest for Jest (`ed4e2d5`); tslib removed
(`6a364bc`).

Done 2026-11-20 (from reviewing Lawo/ember-plus's PRs, node-emberplus `version3`, the specification, and malformed
messages): OIDs' first two arcs (`360519b`) and arcs exact to 2^53 (`39b8aad`); Ember+ path numbers capped at 2^31 - 1
(`57820af`); a qualified element without a path, or a numbered one without a number, skipped (`630d6ff`, `f161aac`,
`efca493`); provider: setValue only on writeable parameters (`75fae26`) and with fitting values (`10e716a`), matrix
connection dispositions with locked and pending targets (`4f84fa8`), the requesting consumer passed to handlers and
events (`a1d023d`), a matrix's directory reply as Lawo's routers give it (`b38499b`), GetDirectory field masks as
TinyEmberPlusRouter (`852b44b`), a node's change to the consumers that listed it (`5858fea`), Unsubscribe below a node
(`481415b`), invocation id 0 kept (`739a7c6`) and arguments checked (`de03394`), identifiers corrected (`4e0a6f1`,
`7784aa0`, BREAKING), templates kept constant and reported whole (`11699b3`, `6443122`), streams (`414d004`), a
consumer's path looked up by number and `getElementByPath` matching as the client (`406d408`); S101: a cut-short
EmBER header rejected with a clear error (`a1f8bd4`); README examples corrected (`67ee7ec`); `test:coverage` fixed
(`545e965`); client: `unsubscribe` and `expand` take a qualified element (`8ab3eb1`); a parameter without a type or a
value decoded without an error (`082cf0f`).

Done later on 2026-11-20 (parameters' display, and invalid values on the provider): `Model.parseFormula` (`2c071a2`),
following the document "Ember+ Formulas" and EmberLib.net (`EmberLib.Glow.Formula`): its grammar and precedence, its
integer and real types, `round` to the closest integer, a half to the even one; Lawo's C++ libformula differs (round
is floor, `^` always real, `-2^2` = 4, `%` at `+`'s level), not followed; the legacy RPN form not read (user's call:
the document). `Model.displayValue`/`deviceValue`/`enumEntries` (`422bc88`): formula or factor, then the format
(`%d`/`%f`/`%x`; with a factor, `%d` shows the factor's decimals, user's call), the `°` dropped from the text and what
follows it given as the unit (user's call), an enumeration's entries from `enumMap` before `enumeration`, `~` entries
hidden (taken for `enumMap` too); `enumMap` stays a `Map` by name (user's call: a helper only). Provider: `update()`
refuses a value or default its type doesn't fit, or a type the value doesn't fit (`ac5a2ed`); a consumer's setValue
outside the range, or none of an enumeration's entries, refused (`29726b5`; an inverted range isn't checked, a null
limit is none); the provider's own out-of-range values, defaults and inverted ranges only warned about, at `init()`
and `update()`, once until allowed again (`33886d7`); a factor given with a formula dropped, keeping the formula
(`dba187a`, the spec's "must not"); a matrix's connections to targets or sources it doesn't have dropped, at `init()`
and when an update changes its signals (`c6261da`); stream warnings at `init()` and `update()`: a descriptor's format
against the type, a negative offset, a shared stream's layout (some or no descriptors, overlapping values), and the
identifier and type rules on update too (`4f7cb38`); a stream value not fitting its format warned about once
(`cdfc897`). A fraction in an integer stream format is rounded without its own warning: the format check covers it
(user's call). Neither Lawo reference provider checks ranges; the spec calls such values not allowed.

Open items:

- Publishing, how it works now: pushing a `vX.Y.Z` tag runs `publish.yaml` (tests, build, `npm publish --provenance`
  as `latest`, or `hotfix` for a version not newer than npm's). The npm trusted publisher (package Settings ›
  Trusted Publisher: GitHub Actions, `phillipivan` / `sofie-emberplus-connection`, workflow `publish.yaml`, no
  environment) needs **Allow npm publish** ticked: without it only `npm stage publish` is allowed, and `npm publish`
  fails with "E403 OIDC permission denied for this action". A re-run of a tag's run tests the tagged commit: a fix
  needs the tag moved (or a new version). Still the user's, by hand: delete the `NPM_TOKEN` repository secret
  (unused now); optionally disallow token publishing on npm, and add `CODECOV_TOKEN`. Offered, not done: switch the
  workflow to `npm stage publish` (each release then approved on npmjs.com with 2FA).
- Manual runs of `publish.yaml` (nightly/experimental) are broken: they bump to `<version>-nightly-…`, which semver
  orders below the released version, and Yarn 4's `yarn version` refuses ("Cannot bump … to a lower version").
  Offered fix: bump the patch first (`0.5.1-nightly-…`). Not done.
- Next release: start a new unreleased section in `CHANGELOG.md`; `sofie-version` is still broken (see the Fork log's
  release caveat), so bump the version by hand.
- The module's matrix actions still wait for a report that may never come (§Module to-do, 2026-10-05): the fix is
  only in the test worktree (`33bfeb8`), not on the module's `master`; reword its debug line when taking it.
- Left as they are, by the user's decision: a path arc above 2^53 fails the whole message (the ASN.1 reader throws);
  a parameter's type goes out under narrow field masks (TinyEmberPlusRouter never sends it); node-emberplus's
  connection statistics and JSON trees not taken up.
- Module migration per the plan below, which needs refreshing first: it predates 2026-11-17 to 20 (Maps for
  children, connections and targets/sources, `targetContents`/`sourceContents` gone, `berDecode` giving arrays, the
  ES module, `reconnectAttempts` removed). `Model.displayValue`, `deviceValue` and `enumEntries` can replace the
  module's own enumeration splitting (`state.ts`, `actions/parameter.ts`) and factor division (`util.ts`,
  `actions/parameter.ts`), and add what it doesn't handle (`~` entries, `enumMap`, the format, the formula).

History: everything from the libember comparison (§47–58, #52–#59) and the typing review (ten items, then the
remaining casts) is done; the details are in those sections.

## Release notes draft (3.0, saved 2026-11-21)

To go in the release notes of the module's 3.0 release, the user's decision on the Set Value Integer Factor:

> Set Value Integer and Set Value Real now take the value as displayed, converted to the device's value by the
> parameter's own formula or factor. Set Value Integer actions whose Factor was 1 change behaviour on parameters that
> have a factor or formula: check them, and use Learn to fill in the displayed value. Actions with any other Factor keep
> it, marked Device Units, and send what they did before.

## Module update plan (2026-11-15)

API 2.2 step done on 2026-11-21, not yet committed then, with the library left at 0.3.1 and its patch. The
'Use Variable?' and 'Path from String' pairs were folded into single fields that can be expressions (upgrade script
`v300` in `src/upgrades.ts`). So the library work below lands on option types already in place: `path` is one
dropdown, the numbers are `number` fields, `factor` is a number. `makeSetValueRequest` and its `dist/` `getPath`
import are unchanged.

Library step done on 2026-11-21, not yet committed then: `@phillipivan/emberplus-connection@~0.5.0`, preapproved
by name in `.yarnrc.yml` (`npmPreapprovedPackages`, past the 3-day `npmMinimalAgeGate`); `emberplus-connection` and
its yarn patch removed. What the module does now, against the plan above:

- Imports from the package root only; `discoverFunctionsFromTree` walks `Children` Maps; the logger turns Maps into
  objects before `JSON.stringify`.
- #21: the module no longer rebuilds the client on a drop or connection error, and dropped its write to the library's
  private reconnect fields. The library reconnects, sending again the GetDirectories and Subscribes that reached the
  provider; on a `connected` for a client already set up (`clientSetUp`) the module registers every path in use again
  (`registerAgain`: `registerParameters`, `subscribeActions`, `checkAllFeedbacks`, then a stream sync), so that what
  failed while the connection was down is done. A path already registered gets no second callback (`pathCallbacks`).
  The top level is loaded again if the first connection couldn't (`treeLoaded`). The module's own reconnect (`scheduleReconnect`, `nextReconnectDelay`) is gone: a client whose first
  root GetDirectory fails is kept and set up anyway, as `getElementByPath` loads the top level itself. A host or port
  change is the only thing that builds a new client. Work under way on the old client when it changes caches nothing
  (`isCurrentClient`), and the actions are defined again with the new client as soon as it is built.
- #24: not canonicalised. `getElementByPath` in `index.ts` registers one callback per typed path per client
  (`pathCallbacks`, cleared with the client), which ends the stacking; each spelling keeps its own callback, and 0.5.0
  calls them all, so each spelling's state follows the element.
- #33 and the 2026-10-05 matrix to-do: `handleMatrixReport` in `src/actions/matrix.ts`; the action doesn't wait for
  the report, logs a locked target as a warning and no report at debug level.
- `makeSetValueRequest` removed; `setValue` is handed the node, and no longer writes into the client's tree.
- Typed values and parameters per type (`parseFunctionArguments`, `parseParameterValue`, `fitsItsType` in
  `state.updateParameterMap`); #49 null values kept as null through variables, enum lookup, feedbacks, the recorder.
- `setDebugLogging` on with the Verbose Logs config option (which replaced the log level dropdown, converted by `v300`),
  to `createModuleLogger('ember plus')` at debug level. Module code outside `index.ts` logs through its own
  `createModuleLogger`, unfiltered; `src/logger.ts` is gone.
- Also asked for: a relative action's `min`/`max` are number options over the range Ember+ allows the type
  (`src/ranges.ts`), as are the Set Value value fields, converted by `v300`.

- Connection Variables config option (`variables`, a multi-dropdown: parameter values, matrix source names, target
  names, connections; parameter values by default and for upgraded connections, in `v300`). Parameter values on: every
  registered parameter (configured, or used by an action or feedback, value feedback included) is monitored and gets
  variables; off: none. The actions' Auto Create Variable (`variable`) is gone, removed from saved actions by `v300`,
  and `registerNewParameter` lost its `createVar` flag. The matrix choices do nothing yet: the matrix actions and
  feedbacks are to be reworked.

- Parameter Value became Parameter Property (`parameter_property`, renamed by `v300`), with a property dropdown
  (`src/feedbacks/property.ts`): Value (integers by factor, as before), Value with Units (`Model.displayValue`), Value
  by Formula (`Model.parseFormula`), Value as Enumeration Entry (`Model.enumEntries`: enumMap, then enumeration; it
  replaced Return ENUM, which `v300` maps to it), and the parameter's own fields. The other four parameter feedbacks
  are marked deprecated, to be removed in a future release.
- The Set Value actions use the library for enumerations and factors: Integer and Real take the displayed value,
  converted by `Model.deviceValue` (the parameter's formula, or else factor, which only an integer has in practice; integers rounded), a relative change added
  to the displayed value (`displayedNumber` in `src/util.ts`, `Model.displayValue`); Integer's Factor option is gone
  (removed by `v300`), and Learn and the recorder give the displayed value. `state.getCurrentEnumValue` and
  `getEnumValue` (was `getEnumIndex`) use `Model.enumEntries` (through `src/enums.ts`), so enumMaps are read, by the ENUM
  action, its Learn, the recorder, the `_ENUM` variables and the deprecated ENUM feedback alike; a relative ENUM steps
  through the entries. The variables use `displayValue` too (`parameterVariableValue`), and `parseParameterValue`,
  left feeding only the recorder, no longer divides by the factor. Parameter Property's Value still divides integers by
  the factor itself, deliberately: it is what Parameter Value returned, and Value by Formula is beside it.

- Streams (2026-11-21): a stream parameter (`streamIdentifier`) is subscribed (`client.subscribe(node)`, no callback:
  the path's registered one gets the values) while a feedback reads it or it has a variable, and unsubscribed once
  neither holds (`updateStreamSubscription` in `index.ts`; feedbacks register and release through
  `useParameterForFeedback` / `releaseParameterFeedback`; a debounced sweep after `finalizeSetup` ends streams a config
  change left unused). The library's `unsubscribe` drops every callback at the path and its remembered GetDirectory, so
  the module then forgets the path (`pathCallbacks`, the element cache) and registers it afresh on its next use.
  Variables for streams are a Connection Variables choice of their own, Parameter - Streams (default off). Parameter
  variables apply the formula or factor (`parameterVariableValue`, the library's `displayValue`) under the relabelled
  `factor` option. Feedback rechecks and variables are throttled at 10 ms (was 30). The per-value debug line is
  Verbose Logs only; stream values aren't recorded; a parameter of a type with no action (octets) now rechecks its
  feedbacks and sets its variables. `src/tests/streams.test.ts` runs the module against the library's `EmberServer`
  over TCP. Not checked against a device's streams; reconnecting with a stream not tested end to end (the library
  restores Subscribes that were sent; one that wasn't, while the connection was down, isn't held as subscribed, and
  the stream sync after `registerAgain` subscribes again). Unsubscribing one spelling of an element (1.2.3,
  device.meters.meter) leaves the stream while another spelling is subscribed, as the library holds one subscription
  per element; the last forgets every spelling, whose callbacks the library drops.
- Hidden entries ("~", which "shall not be displayed in a user interface"): not treated specially, by the user's call
  (2026-11-21). No device in use is known to have one, and a generic module can't know why a device hides an entry,
  its actions and feedbacks working on any enumeration. `src/enums.ts` wraps the library's `enumEntries`, putting the
  "~" back on the name it drops, so names read as the device gives them, as before 3.0 (the `_ENUM` variables, Parameter
  Property, Learn, the recorder); a relative ENUM steps through every entry; a name is found with or without a "~".
- Review fixes (2026-11-21): a parameter feedback's check carries a generation (`feedbackGenerations`), so one
  overtaken by a release or a later check is dropped rather than putting a removed feedback back; the host and port
  variables are set as each client is built; the feedback and Set Value callbacks pass their abort signal into the
  queue; a relative Set Value reads the parameter once out of the queue; Learn keeps the device value when a formula
  can't be computed; a relative ENUM steps from the entry the parameter is on, out of range included; the deprecated
  ENUM feedback compares by entry, finding the name with or without a "~"; Parameter Compare Number's Learn gives the
  device value with factor 1 (it applied the factor twice, before 3.0 too); `src/tests` is out of the build; the
  feedback id is `parameter_property`.
- Set Value Integer's Factor, review finding: `v300` drops a Factor of 1 (upgraded actions then take the displayed
  value: release note) and keeps any other, ticking Device Units (`deviceUnits`), under which the action sends value x
  Factor as before (`parseDeviceUnitsValue`); Learn unticks it. Set Host's port is a number field (the user's change):
  `v300` converts saved text, an empty port becoming the connection's port at upgrade.

Not done: matrix labels, element renumbering across sessions.

The module moves from `emberplus-connection` 0.3.1 (+ this yarn patch) to `@phillipivan/emberplus-connection` once
the library work is complete, in the same update as the module's move to the Companion module API 2. Until then the
module keeps 0.3.1 with its known exposures (notably #46). Module-side to-dos for that update: drop the
re-registration after a reconnect (#21: the library restores subscriptions), handle the LOCKED rejection in the matrix
actions (#33), the canonical path work (#24), remove the yarn patch. Also: `castToEmberTypedValue` /
`parseFunctionArguments` must build each `EmberTypedValue` per type (the union, typing item 3), `makeSetValueRequest`
and the `setValue` callbacks must build/narrow a `Parameter` per type (the split; `Model.TypedParameter`,
`fitsItsType` and `isValueOfType` are exported for it), and recheck the invoke action against #50 (`success`
defaults to true) and the parameter type checks against #49 (null keeps the type). From the remaining-casts work:
a matrix's `identifier` may be undefined; the request methods' responses are typed as what resolves them
(`RootElement`, `ElementOf<Parameter>`, `ElementOf<Matrix>`), and a reply of another kind rejects; a GetDirectory or
Subscribe on a template rejects.

Library debug logging (2026-11-16): the module's `39cd6aa` set `process.env.DEBUG` in `init()`/`configUpdated()`,
which never worked: `debug` reads `DEBUG` once, as it loads (when the module imports the library), so a later
assignment does nothing (checked with debug 4.4.3); `= undefined` also stores the string `"undefined"`. It was
removed in `a814c50` ("v280 wip"), so nothing enables it now. And the library's `b985110` (debug to `console.log`)
is only in the fork (tag `v0.4.5`), not in npm 0.3.1, where enabled output went to stderr. In the fork, use
`setDebugLogging(enabled, log?)` (`761e0e0`, on fork `master`), exported from the package root: turns
`emberplus-connection:*` on/off at any time, keeping other namespaces, off holding even under `*`; messages go to
`log` (type `DebugLog`, `(message: string) => void`) or else `console.log`. Module: call it in `init()` and
`configUpdated()`, e.g. `setDebugLogging(config.logging === LoggerLevel.Console, (message) =>
this.logger.console(message))` (or `this.log('debug', message)`). Each message is `debug`'s formatted string: an ISO
timestamp (not a terminal) and the namespace first; an object in it (e.g. received data) spans several lines. Checked
on 192.168.3.71 with a capturing `log`.

Matrix labels (checked against 192.168.3.71:9003, 2026-11-16, see Device evidence): use
`client.getMatrixLabels(matrix)` (`c764376`, user's request; the user wanted every set fetched): an array of
`Model.LabelSet` (`basePath`, `description`, `targets`/`sources` as `{ [signal]: string }`) in the matrix's order;
pick by description, else the first (`sets.find((s) => s.description === chosen) ?? sets[0]`); labels raw (trim
them); non-string labels left out; rejects if a request fails (e.g. a set's node missing: timeout). Needs the
matrix's contents loaded (see below). On the device: 1 set, 2208 + 2696 labels in 2.0 s. Parameter paths:
`client.matrixParametersPath(matrix)` (basePath, or matrix path + inline number), `matrixTargetParametersPath`,
`matrixSourceParametersPath`, `matrixConnectionParametersPath`, `matrixConnectionGainPath`; request one with
`client.getDirectory(new Model.QualifiedElementImpl(path, new Model.EmberNodeImpl()))`. The device's `parametersLocation`
`1.2` has only `1` Targets and `2` Sources (each `BoardType`, and `Protect`, READ_WRITE on targets), no `3`
Connections and no `gainParameterNumber`; a GetDirectory on a path that doesn't exist (`1.2.3.2.2`) is never
answered (timed out). What follows is how the helper does it, for reference: the library gives only where they are
(`matrix.contents.labels`: `basePath` and `description` per set). GetDirectory on
`basePath`, then on `basePath.1` (targets) and `basePath.2` (sources): string parameters numbered by signal, the value
the label. `getElementByPath` loads the root itself when needed (`28f32d4`). Several sets are allowed. Spec (_Matrix › Type Definitions_): `labels`
"may contain multiple references to Nodes which contain signal label parameters"; a Label's `description` "may be
used by consumers to let the user choose the label to display"; no set is marked default (the collection's order is
the only order; the example lists "Primary", then "Internal"); a set holds a parameter "for each target associated
with a label", so it may not cover every signal. Plan: default to the first set; let the user choose one by
description (a setting, or an option on actions/feedbacks), stored by description and falling back to the first;
fetch only the sets in use; fall back (next set, or the signal number) for a signal without a label. The spec's
label change example reports the changed label as a QualifiedParameter at its own path (`1.2.3.1.1.3`). Labels come padded (`"    1   D/A   1"`): trim. With the default 3 s timeout each
request took ≤ 1.6 s over the VPN (2208 + 2696 labels); raise `timeout` if a device or link is slower. A label
change reported as the label parameter calls only a callback on that label's path, not one on `basePath.1`/`.2`
(callbacks match the reported path); the tree updates either way. Not tested: whether the device reports label
changes. Reconnects re-send the GetDirectories (library). On 192.168.3.71 a GetDirectory on the matrix itself
gives targets, sources and connections but not the matrix's contents (identifier, type, `labels`): those came from
the parent's listing (`Audio`'s children), so load the parent, or use `getElementByPath`, to learn where the labels
are. Per-signal `labelsLocation` (signal contents): kept since
`e3d8a6d` (`feat:`, on fork `master`, pushed), as `matrix.contents.targetContents` / `sourceContents`, the
contents (`identifier`, `isOnline`, `labelsLocation`, each optional; `Model.SignalContents`) of the signals that have
any, keyed by signal number (targets/sources stay number lists; user's choice over `Array<{ number, contents }>`).
Decoder keeps them (an unknown field: error, rest kept), encoder writes them (not as matrix contents), client merges
a report of them per signal and property. A provider "should not use both" ways; the spec says only that a GetDirectory
on a signal's `labelsLocation` gives "the content of the labels node of the Signal", not how several label sets are laid
out there, so the module's support waits for a device that uses it. 192.168.3.71 sends no signal contents (checked
with the new build). 937 tests; the 7 new ones fail against the old decoder/encoder/client (checked).

## When upstream releases fixes

- Bump `emberplus-connection` and drop the matching patch hunks (`yarn patch` / `yarn patch-commit`): #1 and #2
  once merged. #5 and #6 stay patched until resolved upstream.
- The #6 hunk (`S101Client.js`) doesn't apply to builds of upstream `main` after #51: the compiled import alias
  changed from `Client_1.ConnectionStatus` to `ConnectionStatus_1.ConnectionStatus`, so the hunk's context no longer
  matches. The function is otherwise unchanged; redo the hunk by hand. The client and matrix decoder hunks still
  apply. Found building the PR #50 device test package (`generic-emberplus-2.9.2-pr50.1.tgz`, 2026-10-04).
- Keep `src/tests/emberplus-connection.test.ts` as regression tests and update its header comment.
- The #3 workaround is harmless once fixed upstream; remove it or keep it.
