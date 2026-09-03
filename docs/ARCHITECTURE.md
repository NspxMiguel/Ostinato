# Architecture — Ostinato

## Overview

A student planner that warns you **before** the deadline, and keeps insisting until you answer.

## Stack (extraído do repositório)

| Camada | Tecnologia | Versão / nota |
| --- | --- | --- |
| Runtime / package | Node (`ostinato`) | 0.1.0 |
| TypeScript | dependência | ~5.9 |

## Alvos / targets

_Sem `project.yml` com targets, ou projeto não-Xcode._

## Diagrama de pastas (topo)

```mermaid
flowchart TD
  Ostinato["Ostinato"]
  Ostinato --> n0["DESIGN.md"]
  Ostinato --> n1["IDEIAS.md"]
  Ostinato --> n2["LICENSE"]
  Ostinato --> n3["PEDIDOS.md"]
  Ostinato --> n4["PROMPT-CLAUDE-DESIGN.md"]
  Ostinato --> n5["README.md"]
  Ostinato --> n6["TRABALHO.md"]
  Ostinato --> n7["docs/"]
  Ostinato --> n8["ferramentas/"]
  Ostinato --> n9["mobile/"]
  Ostinato --> n10["nucleo/"]
  Ostinato --> n11["package-lock.json"]
  Ostinato --> n12["package.json"]
  Ostinato --> n13["scripts/"]
  Ostinato --> n14["tsconfig.json"]
  Ostinato --> n15["verificar.sh"]
```

## Fluxo de build (inferido)

```mermaid
flowchart LR
  start([código]) --> unknown[fluxo de build não inferido — ver SETUP.md]
```
