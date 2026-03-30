# OpenClaw Operator Console Knowledge Index

Purpose:  
This document defines the authoritative documentation set for the OpenClaw operator console project.  
All architecture, behaviour, UI design, and implementation decisions must align with the documents listed here.

All project documentation lives in:

/docs

These documents act as the **source of truth** for the system.

If code behaviour conflicts with documentation, the documentation must be reviewed before changing the system design.

---

# Core Documents

These documents define the structure, design, and implementation contract of the operator console.

## Design Direction

/docs/DESIGN_DIRECTION.md

Defines the visual and UX direction for the operator console.

Covers:
- visual style
- layout rules
- navigation model
- interaction patterns
- UI components
- V1 scope discipline

This document governs **how the interface should feel and behave for non-technical operators.**

---

## Frontend Contract Summary

/docs/FE_CONTRACT_SUMMARY.md

Defines the **product surface and operational truth** that the frontend must expose.

Covers:
- which sections exist in the V1 console
- which tasks are runnable
- which features are admin-only
- what must not be exposed
- required UI status labels
- agent display model
- governance truth

This document prevents the frontend from exposing **internal system capabilities that are not user-ready.**

---

## V1 API Contract

/docs/V1_API_CONTRACT.md

Defines the API routes the frontend uses, including the protected operator
surfaces and the separate public proof routes.

Covers:
- dashboard overview and governance data
- task catalog, trigger, runs, and run detail
- approvals workflow
- agents overview
- skills policy, registry, telemetry, and audit
- system health (basic and extended)
- persistence health, summary, historical, and export
- knowledge summary, query, and export
- memory recall
- auth session verification
- optional public proof routes (command-center, milestones)

This document defines the **official contract between frontend and orchestrator APIs.**

---

# Product Surfaces

The system contains two distinct surfaces.

## Private Operator Console

The primary product surface.

Characteristics:

- authenticated
- orchestrator-backed
- operational control interface
- safe curated task execution
- governance visibility
- approvals workflow
- agent visibility
- system health monitoring

Sections exposed in V1:

Overview  
Tasks  
Approvals  
Agents  
Governance  
System Health  
Diagnostics  
Public Proof  

---

## Diagnostics

Route: /diagnostics

The Diagnostics section is an operator-only surface that probes all contract endpoints sequentially with rate-limit awareness. Results are shared to the Overview page via DiagnosticsContext. This section is not in the original PRD but was implemented as a runtime verification tool.

Truth-bearing source files:
- `src/pages/DiagnosticsPage.tsx` (probe list and runner)
- `src/contexts/DiagnosticsContext.tsx` (shared summary state)

---

## Public Proof Surface

The community-facing visibility layer.

Examples:

openclawdbot

This surface provides:

- milestone proof
- demand signals
- public trust layer
- non-sensitive system visibility

Important constraint:

Public proof routes are **not the private operator control plane.**

---

# Implementation Rules

When generating or modifying code, the AI must follow these rules.

1. Always consult the documents in `/docs` before implementing features.

2. Do not invent architecture that contradicts existing documentation.

3. If behaviour is unclear, extend documentation rather than guessing system behaviour.

4. Maintain separation between:

- operator console frontend
- orchestrator API layer
- agent execution system
- public proof surface

5. Do not expose internal tasks or routes that the frontend contract marks as hidden.

6. Do not expose raw JSON task payload editors by default.

7. Any task, agent, or service not confirmed operational must be labeled honestly.

---

# Canonical Source Files

These source files are the ground truth for system behaviour. Documentation must stay aligned with them.

- `src/App.tsx` — route registration and provider tree
- `src/lib/api.ts` — API endpoint bindings (22 operator endpoints + 6 public proof endpoints; 1 more in AuthContext.tsx = 29 total wired)
- `src/lib/api-client.ts` — auth model, env config, rate-limit handling
- `src/types/console.ts` — TypeScript API contract shapes
- `src/contexts/AuthContext.tsx` — auth flow, role model (viewer/operator/admin)
- `src/components/console/ConsoleLayout.tsx` — desktop navigation items
- `src/components/console/MobileChassisFrame.tsx` — mobile/tablet navigation items
- `src/pages/DiagnosticsPage.tsx` — endpoint probe list


# Documentation Priority Order

When conflicts appear between sources, resolve them using this order.

1. Frontend Contract Summary
2. V1 API Contract
3. Design Direction
4. Implementation code (canonical source files above)

When documentation has not been updated to reflect implemented changes, the canonical source files listed above represent the implementation truth.

---

# Expected AI Behaviour

The AI should treat `/docs` as the canonical system knowledge base.

The documents define:

- system architecture
- operator console behaviour
- UI rules
- API contracts
- governance visibility
- safe V1 scope

The AI must **not expand the product scope beyond what is documented for V1** unless explicitly instructed.
