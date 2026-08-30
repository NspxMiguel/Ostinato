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

## Turning it on

1. Paid Apple Developer account (the iCloud entitlement is not issued to a
   personal team).
2. Enable iCloud + CloudKit for `dev.nspx.giz`, container `iCloud.dev.nspx.giz`.
3. Add `com.apple.developer.icloud-services` / `com.apple.developer.icloud-container-identifiers`
   to the entitlements — the `ios-assinatura` config plugin is where that goes,
   so it survives `expo prebuild`.
4. Create the six record types with the three fields above in the CloudKit
   dashboard, mark `tabela` and `atualizadoEm` queryable, then deploy the schema
   to production.
5. Flip the app's sync setting on. Nothing else changes: `PortaCloudKit` already
   implements the same interface the tests exercise.
