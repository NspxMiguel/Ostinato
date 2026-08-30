# CloudKit schema for Giz

Written before the container exists, so the day the paid Apple Developer account
arrives the setup is mechanical rather than archaeological.

## Container

`iCloud.dev.nspx.giz`, **private database only**. Nothing about a student's
schedule belongs in a public or shared database.

## Zone

A single custom zone named `giz`.

The default zone cannot hand out a per-zone change token, and without a token
every app launch would download the whole database instead of a delta. The zone
is created lazily on first sync (`CKModifyRecordZonesOperation`).

## Record types

Six types, one per table: `Periodos`, `Materias`, `Aulas`, `Compromissos`,
`Notas`, `Faltas`.

Every type has the same three fields:

| Field | Type | Indexed | Why |
| --- | --- | --- | --- |
| `tabela` | String | queryable | which table the blob belongs to |
| `json` | String | — | the whole record, serialized |
| `atualizadoEm` | Int64 | queryable, sortable | last-write-wins timestamp |

`recordName` is `<tabela>\|<id>`, so a record's identity is stable across devices
and derivable without a lookup.

### Why one JSON blob instead of a column per field

A CloudKit schema is immutable once deployed to production: fields can be added
but never removed or retyped. Mapping every model field to a CloudKit field would
mean a container migration every time `Compromisso` grows a property — and the
model is going to grow.

With a single blob, the data format is the app's own, and the only thing that
understands it is the TypeScript that already has tests. CloudKit is reduced to
what it is good at: moving bytes and telling you what changed.

The cost is that no server-side query can filter by content. The app doesn't need
one — it syncs everything, and everything is a few hundred records.

## Deletions

There are none at the CloudKit level. A deleted record is a live record with
`removido: true` inside the blob (a tombstone), so the deletion propagates like
any other edit and cannot be lost by a device that was offline when it happened.

## Conflict resolution

Not here. The server does not arbitrate — `savePolicy` is `.allKeys`, because by
the time a record is pushed, `nucleo/sync/mesclar.ts` has already merged it
against what the server had. That logic is pure TypeScript with a test battery
that runs without CloudKit, including a hundred-round randomized convergence
check between two simulated devices.

## Why the code is compiled out, not just disabled

`CKContainer(identifier:)` does not return an error when the app lacks the iCloud
entitlement — it **kills the process** with `EXC_BREAKPOINT` from inside CloudKit,
before any `try` of ours runs. No `do/catch` catches it, and the JavaScript
`catch` even less so, because the process is already gone. Measured on 2026-08-29
on a free Apple account: opening Settings closed the app back to the home screen,
with nothing in the console and nothing in Metro — only an `.ips` in
`~/Library/Logs/DiagnosticReports/`.

Checking the entitlement at runtime is not an option either: `SecTaskCreateFromSelf`
is macOS-only.

So the switch is a compile-time one. `plugins/icloud.js` adds the entitlement
**and** defines `GIZ_ICLOUD`; the module's CloudKit half lives inside
`#if GIZ_ICLOUD`. Entitlement and code are turned on by the same line and cannot
disagree — without a paid account, the binary does not even mention `CKContainer`.

## Turning it on

1. Buy the Apple Developer account (the iCloud entitlement is not issued to a
   personal team).
2. Create the container `iCloud.dev.nspx.giz` in the Apple developer portal.
3. Create the six record types above in the CloudKit dashboard, mark `tabela` and
   `atualizadoEm` queryable, then deploy the schema to production.
4. Set `extra.icloud` to `true` in `mobile/app.json` and run `expo prebuild`.
   That single flag adds the entitlement and compiles the CloudKit half in.
5. Turn the app's sync setting on. Nothing else changes: `PortaCloudKit` already
   implements the same interface the tests exercise.
