---
target: full forms section
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/teddyburtonburger/Desktop/Code-hub/TWC-Natasa/src/routes/_authenticated/_admin/admin_.forms.index.tsx"
target_fingerprint: "sha256:b8fe37898f205f09be46b3abb2814080a858382ef05ef6b9596adba0abe2f9ab"
target_path: /Users/teddyburtonburger/Desktop/Code-hub/TWC-Natasa/src/routes/_authenticated/_admin/admin_.forms.index.tsx
timestamp: 2026-11-10T06-36-07Z
slug: authenticated-admin-admin-forms-index-tsx-b9158d04
---
# Critique: admin Forms section (/admin/forms and /admin/forms/<id>)

DEGRADED: design review only. Assessment B (detector + browser overlay) was stopped by Anthropic safeguards; no detector findings.

## Design health: 16/40 (Poor)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | Save form gives no "Saved" confirmation |
| 2 | Match real world | 1 | Key, Slug, value\|Label, v1; "3 answers" (people) vs "(6 answers)" (fields) |
| 3 | User control | 2 | No unsaved-changes guard, no undo on Remove question |
| 4 | Consistency | 1 | Two closed-message fields and two open/close controls on one page |
| 5 | Error prevention | 1 | Stale editor reopens a closed form; new forms publish live by default |
| 6 | Recognition vs recall | 2 | No preview of the public form |
| 7 | Flexibility | 1 | No question reorder; Save wording ~8,600px down |
| 8 | Minimalism | 2 | Form name shown three times; cards nested three deep |
| 9 | Error recovery | 2 | Errors not tied to the field that failed |
| 10 | Help | 2 | Developer hints ("a–z, 0–9, _") |

## Priority issues
1. [P0] Stale editor reopens a closed form (verified in source: setFormOpen does not bump version; FormEditor keyed on version keeps open:true; Save sends it). Fix: one open/close control and one closed message, outside the editor. harden → distill.
2. [P1] Custom edit page stacks run / build / read in one scroll; answers ~3,800px down, labelled by date. Fix: overview first (status, link, Close/Open, CSV, newest answers by name), editing on its own view. layout.
3. [P1] Editor speaks developer (Key, Slug, value|Label, no reorder). Fix: auto keys, "Web address" with live preview, one choice per row, move up/down. clarify → shape.
4. [P1] Built-in wording is a 75-field wall with Save at the bottom. Fix: collapsible groups, changed markers, sticky save bar. distill.
5. [P2] List leads with rarely-changed built-ins; Newsletter card opens an empty page. Fix: Your forms first; Newsletter as a note. layout.
