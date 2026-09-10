---
name: coos-business-diagrams
description: Create, redraw, simplify, or review COOS business-process Mermaid diagrams from requirements, journeys, operating procedures, and lifecycle rules for non-technical and delivery stakeholders.
---

# COOS Business Diagrams

Create diagrams that explain COOS business behavior, not implementation internals. Make every actor, action, decision, state, business object, exception, and handoff explicit enough to follow without a presenter.

Read [references/visual-language.md](references/visual-language.md) before drawing or revising a diagram. Apply its visual grammar and Mermaid template consistently.

## Establish context

1. Read the request and all referenced COOS materials.
2. Identify the business scope, trigger, outcome, actors, product surfaces, objects, states, rules, decisions, exceptions, integrations, and scheduled events.
3. Use the terminology confirmed by the source. Expand uncommon abbreviations on first use.
4. Do not assume COOS has the same roles, platforms, workflows, or business rules as another project.
5. Preserve material ambiguity. Add a concise yellow note beginning with `Assumption:` only when needed to understand the diagram; otherwise list the open question outside the diagram.

## Build the visual model

- Assign a unique color to every actor or role.
- Assign a unique color to every business entity whose status appears.
- Never reuse a color for different roles or different status-bearing entities in one diagram.
- Use shape for semantic type and color for subject identity.
- Put one meaningful fact in each node. Separate actions, decisions, status changes, and outcomes.
- Arrange the happy path first, then attach alternatives, failures, retries, cancellations, and authorized overrides near their trigger.

## Labels

- Write all diagram content in English unless the user explicitly requests another language.
- Use plain, specific words and active voice.
- Start actions with actor and verb: `Operator: Submit request`.
- Name states as object plus state: `Request status: Under Review`.
- Phrase decisions as answerable questions and label every outgoing path with a complete outcome.
- State timing explicitly, such as `Every 4 hours` or `After 3 failed attempts`.
- Avoid code identifiers and architecture terms unless stakeholders need them; explain retained technical terms in a note.

## Structure and delivery

- Use `flowchart TB` for approvals, lifecycles, and end-to-end flows.
- Use `flowchart LR` for short journeys with clear handoffs.
- Use named phases for lifecycle stages and role-named swimlane-like subgraphs when ownership is central.
- For more than about 25–30 nodes, create an overview plus one or more detail diagrams, keeping color identity consistent.
- Begin every diagram with a title comment and a compact legend containing only used categories.
- Use semantic node IDs, solid arrows for process flow, and dashed connectors only for notes or non-flow relationships.
- Return Mermaid source in a fenced `mermaid` block unless another supported format is requested.

## Quality gate

Confirm that:

- A non-technical reader can identify the start, sequence, ownership, decisions, exceptions, and ending.
- Each node represents exactly one action, decision, state, object, note, or terminal.
- Every action names its actor and every state names its owning entity.
- Every role and status-bearing entity has one distinct, stable color.
- Every decision has labeled, complete outcomes.
- The legend matches the visual categories used.
- No role, platform, example, or rule from another project was carried over unless the COOS source explicitly confirms it.
- There are no orphan nodes, hidden rules, ambiguous pronouns, or unsupported assumptions.
- Mermaid syntax uses broadly supported constructs.

If the source is internally inconsistent, explain the inconsistency instead of drawing a misleading flow.
