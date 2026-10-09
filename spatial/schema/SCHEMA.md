# Spatial proteomics bundle, schema 1.0

One bundle is one experiment in one JSON file. The structural rules are in
`spatial-proteomics-1.0.schema.json`. This page covers what a structural schema
cannot say. `python -m spatialprot validate FILE` enforces both.

## Versioning

`schema_version` is `MAJOR.MINOR.PATCH`. Readers accept any `1.x.y`. A minor
version may add optional fields. Removing or redefining a field needs a new
major version and a new schema file.

## Top level

| Key | Required | Meaning |
|---|---|---|
| `dataset` | yes | Title, organism, citation, license, attribution, provenance, id namespaces, mapping statistics, distribution status |
| `compartments` | yes | The vocabulary every layer assigns into. `ontology_id` is optional |
| `entities` | yes | Protein groups |
| `layers` | yes | Assignment layers. May be empty |
| `fractions` | no | Ordered fraction list. Needed when `profiles` is present |
| `profiles` | no | Measured abundance per entity per fraction |
| `embeddings` | no | Two dimensional coordinates per entity |

## Protein groups

An entity is a protein group exactly as the source reported it. `members` lists
every protein accession in the group. Each member carries its own `gene`, or
`null` when it could not be mapped.

- A group may span several genes. It is never reduced to one.
- A gene may sit in several groups.
- Unmapped groups stay in the bundle and keep their results.
- `detected: false` marks a group that a layer lists but the experiment did not
  measure. Such groups are left out of the detected background.

`dataset.mapping` holds the counts and the full lists of unmapped and multi-gene
groups. The validator recomputes every number from the entities and rejects a
bundle whose stated statistics differ.

## Evidence types

Four kinds of evidence exist. They live in different places and are never merged.

| Evidence type | Where | What it is |
|---|---|---|
| `measured_profile` | `profiles` only | Abundance across fractions, from the experiment |
| `computational_assignment` | a layer | A classifier or clustering run on measured profiles |
| `sequence_prediction` | a layer | Predicted from sequence alone |
| `curated_annotation` | a layer | Asserted by curators, or chosen by the authors as reference |

Every layer and embedding also states its `source`: `author` (from the
publication), `computed` (produced by this software) or `external` (another
resource). A computed embedding or layer is only valid when the measured
profiles are in the same bundle. A curated layer cannot be `computed`.

## Assignments

Each assignment has an `entity`, a `compartment` and a `status`.

- `assigned`: the layer stands behind this compartment.
- `below_threshold`: the method named this compartment but the score did not
  pass the layer's threshold. The compartment is kept for reference only.
- `unassigned`: no compartment.

One entity appears at most once per layer. An annotation layer that places an
entity in several compartments lists the rest in `others`; their order implies
no ranking.

## Optional layer fields

| Field | Meaning |
|---|---|
| `status_labels` | The source's own words for a status, for example `"below_threshold": "unknown"`. Viewers show these instead of the generic terms |
| `trained_on` | Ids of layers that were inputs to this layer's method. Their entities are flagged as training inputs, are left out when this layer is compared with any other layer, and a direct comparison with a training layer is marked as not independent |
| `compartment_scope` | The compartments this layer is able to name. Comparisons between two layers are confined to the overlap of their scopes, so neither is marked wrong about a compartment the other cannot name |

A compartment may carry `ontology_id` and `ontology_note`. Give an id only when
one ontology term names the same structure, and use the note for the rationale.
A compartment without an id takes no part in ontology-based comparisons.

`dataset.notices` holds short statements shown prominently with the data, such
as what is still pending.

## Scores

`score` on an assignment is the value exactly as the source gave it. The layer's
`score` block names it and states its `interpretation`.

- Use `unspecified` unless the method defines the scale.
- `probability` is only accepted together with `interpretation_basis`, a
  sentence citing where the method defines it.
- A `threshold` records the value, the rule, and whether it was
  `stated_by_source` or `observed_in_data`. The validator checks every scored
  assignment against it. Do not add one that the source did not give: a status
  taken from the source's own final call needs no threshold at all.

## Licensing and distribution

`license.redistribution` is `permitted`, `restricted` or `unknown`.
`distribution.status` is `public` or `local-only`. A bundle cannot be `public`
unless redistribution is `permitted`. Anything that publishes a bundle must
call the validator with `--require-public`.

## What a bundle must never contain

Profiles or coordinates that were not measured or supplied. If the source did
not publish them, the keys are absent and the viewer hides those views.
