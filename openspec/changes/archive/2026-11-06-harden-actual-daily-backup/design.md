## Context

The reconciliation runtime already contains the compatible API. Existing local transaction backups are referenced by reconciliation records and their retention cannot be inferred from age alone.

## Goals / Non-Goals

**Goals:** Restore daily exports without changing installed versions or scheduler configuration, and prevent automatic loss of backups and evidence.

**Non-Goals:** Automatically prune transaction or remote archives, prove remote Drive integrity from a local write, or alter budget data.

## Decisions

Resolve the default API from the project's existing runtime while preserving the explicit test override. Abort after a busy wait rather than proceeding. Scheduled commit creates missing daily and monthly artifacts but does not delete older backups, clients, snapshots or Drive archives. Reject force-overwriting existing destinations until a separate safe replacement workflow exists. Clean only this invocation's temporary client directories in a finally block, even on failure.

## Risks / Trade-offs

Disk use can grow until a separately verified, reference-aware retention workflow is available. A successful local export does not itself prove remote Drive readback; that remains an independent check.
