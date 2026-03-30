# Design Direction

Purpose: Set the visual and UX direction for a serious operator console that feels trustworthy, clear, and product-grade for non-technical users.

## Visual style

Dark, premium operator-console aesthetic with strong legibility and restrained motion.

Use a clean grid layout with roomy spacing, clear section hierarchy, and low visual clutter.

Favor cards, panels, tables, and guided forms over flashy dashboards.

Use subtle status color only for meaning: healthy, warning, approval-needed, degraded.

## Navigation model

Primary left navigation: Overview, Tasks, Approvals, Agents, Governance, System Health.

Optional top switch or header link for Public Proof if both surfaces live in one product family.

Keep public proof visually distinct from the private operator console.

## Core UX patterns

Overview should lead with high-signal summary cards and a recent activity table.

Tasks should be a curated catalog with plain-language descriptions, badges, and guided forms.

Approvals should feel like an inbox with clear review context and one-click approve or reject actions.

Agents should be an informational directory with separate badges for worker and service truth.

Governance should use cards plus compact backlog tables.

## Status language

Use Ready, Needs Approval, Partially Available, Needs External Setup, Internal Only, Not Yet Verified, Service Available, Service Not Available.

Avoid backend jargon like allowlisted, manifest-backed, or degraded path unless translated into plain language.

## Interaction rules

No raw JSON editor by default.

Advanced or admin-only affordances should be progressively disclosed.

Show explicit warnings when persistence is degraded or external configuration is missing.

Every risky or partial action must explain why it is limited.

## Empty and degraded states

No approvals are waiting right now.

No retry recovery items are waiting.

No governed skills are registered yet.

This action is available, but depends on external services or configuration.

The system is running in a reduced mode. Routing works, but some persistence features are degraded.

## Component guidance

Use summary cards for health and governance.

Use tables for tasks, approvals, agents, and recent activity.

Use slide-over panels or modals for task details and approval decisions.

Use filter chips and badges sparingly to reduce cognitive load.

## V1 scope discipline

Design only for the curated V1 operator console first.

Do not design full governed skill management yet; summary cards are enough.

Do not design service controls, deployment screens, or a broad automation builder in V1.

## Reference mood

Think product-grade control panel: calm, high-trust, dark theme, practical over flashy, with obvious hierarchy and status clarity.
