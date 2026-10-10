/* Spatial proteomics explorer.
 *
 * A dependency-free viewer for one "spatial-proteomics-bundle" (schema 1.x).
 * It knows nothing about any organism or host site: everything site-specific
 * arrives through the adapter passed to mount().
 *
 *   SpatialExplorer.mount(element, { bundleUrl | bundle, adapter, initial })
 *     -> Promise<instance>
 *
 * Adapter (every member optional):
 *   geneUrl(geneId)      -> href for a gene, or null
 *   geneLabel(geneId)    -> display text for a gene id
 *   memberUrl(memberId)  -> href for a protein accession, or null
 *   searchText(entity)   -> extra text the search box should match
 *   extraLayers(bundle)  -> Promise<layer[]>: host annotations in the bundle's
 *                           layer shape. They are shown as their own layers and
 *                           are never merged into the bundle's layers.
 *   actions              -> [{ id, label, run(context) }] buttons; context has
 *                           genes, backgroundGenes, entities, layer, compartment
 *
 * Views appear only when the bundle carries the data they need. Without
 * measured profiles there is no profile plot; without coordinates, no map.
 */
(function (root) {
  "use strict";

  var VERSION = "0.1.0";
  var SCHEMA = "spatial-proteomics-bundle";
  var SVGNS = "http://www.w3.org/2000/svg";

  var EVIDENCE = {
    measured_profile: {
      label: "Measured profile", badge: "Measured",
      text: "Abundance across fractions, measured in the experiment."
    },
    computational_assignment: {
      label: "Computational assignment", badge: "Computed from profiles",
      text: "A classifier or clustering method applied to the measured profiles."
    },
    sequence_prediction: {
      label: "Sequence-based prediction", badge: "Sequence prediction",
      text: "Predicted from the protein sequence alone."
    },
    curated_annotation: {
      label: "Curated annotation", badge: "Curated",
      text: "Asserted by curators or chosen by the authors as reference."
    }
  };
  var EVIDENCE_ORDER = ["measured_profile", "computational_assignment", "sequence_prediction", "curated_annotation"];
  var LAYER_EVIDENCE = EVIDENCE_ORDER.slice(1);
  var SOURCE = { author: "from the publication", computed: "computed by this software", external: "from an external resource" };
  var INTERPRETATION = {
    unspecified: "The source does not define the scale of this score.",
    probability: "Defined by the method as a probability.",
    distance: "A distance: smaller means closer.",
    similarity: "A similarity: larger means closer.",
    other: "See the method description for the scale of this score."
  };

  /* ---------- pure helpers (also exported as SpatialExplorer.core) ---------- */

  function entityGenes(entity) {
    var out = [];
    entity.members.forEach(function (m) {
      if (m.gene != null && out.indexOf(m.gene) < 0) out.push(m.gene);
    });
    return out;
  }

  function mappingStatus(entity) {
    var mapped = entity.members.filter(function (m) { return m.gene != null; }).length;
    if (!mapped) return "unmapped";
    return mapped === entity.members.length ? "mapped" : "partial";
  }

  function finalCall(a) {
    return a && a.status === "assigned" ? a.compartment : null;
  }

  // Every compartment a layer stands behind for one entity. Most layers give
  // one; annotation layers may give several ("others").
  function calls(a) {
    if (!a || a.status !== "assigned" || a.compartment == null) return [];
    return [a.compartment].concat(a.others || []);
  }

  var STATUS_DEFAULT = { assigned: "assigned", below_threshold: "below threshold", unassigned: "unassigned" };
  function statusLabel(layer, status) {
    return (layer && layer.status_labels && layer.status_labels[status]) || STATUS_DEFAULT[status] || status;
  }

  // Scores are shown exactly as supplied: the shortest text that round-trips.
  function formatScore(x) {
    return x == null ? "" : String(x);
  }

  function checkBundle(b) {
    var problems = [];
    if (!b || typeof b !== "object") return ["bundle is not an object"];
    if (b.schema !== SCHEMA) problems.push("not a " + SCHEMA);
    if (!/^1\.\d+\.\d+$/.test(String(b.schema_version))) problems.push("unsupported schema_version " + b.schema_version);
    ["compartments", "entities", "layers"].forEach(function (k) {
      if (!Array.isArray(b[k])) problems.push("missing " + k);
    });
    if (!b.dataset || !b.dataset.license || !b.dataset.citation || !b.dataset.provenance) {
      problems.push("dataset must carry license, citation and provenance");
    }
    return problems;
  }

  function validLayer(layer, model) {
    if (!layer || typeof layer.id !== "string" || !Array.isArray(layer.assignments)) return "malformed layer";
    if (LAYER_EVIDENCE.indexOf(layer.evidence_type) < 0) return "layer " + layer.id + " has no valid evidence_type";
    if (!SOURCE[layer.source]) return "layer " + layer.id + " has no valid source";
    if (model.layerById[layer.id]) return "layer id " + layer.id + " is already in use";
    return null;
  }

  function capabilities(b) {
    var cap = { profiles: false, embeddings: [], reasons: {} };
    var nf = Array.isArray(b.fractions) ? b.fractions.length : 0;
    var values = b.profiles && b.profiles.evidence_type === "measured_profile" && b.profiles.values;
    if (!values) cap.reasons.profiles = "No measured profiles were supplied with this dataset.";
    else if (!nf) cap.reasons.profiles = "Profiles were supplied without a fraction list.";
    else {
      var ok = Object.keys(values).some(function (k) { return Array.isArray(values[k]) && values[k].length === nf; });
      if (ok) cap.profiles = true;
      else cap.reasons.profiles = "No profile matches the declared fractions.";
    }
    (b.embeddings || []).forEach(function (e) {
      if (e && e.coordinates && Object.keys(e.coordinates).length && e.method && SOURCE[e.source]) cap.embeddings.push(e.id);
    });
    if (!cap.embeddings.length) cap.reasons.embeddings = "No map coordinates were supplied with this dataset.";
    return cap;
  }

  function indexLayer(model, layer) {
    var map = {};
    var dropped = 0;
    layer.assignments.forEach(function (a) {
      if (!model.entityById[a.entity] || (a.compartment != null && !model.compById[a.compartment])) { dropped++; return; }
      map[a.entity] = a;
    });
    model.layers.push(layer);
    model.layerById[layer.id] = layer;
    model.byLayer[layer.id] = map;
    return dropped;
  }

  function indexBundle(b) {
    var model = {
      bundle: b, entities: b.entities, entityById: {}, compById: {}, compartments: b.compartments,
      layers: [], layerById: {}, byLayer: {}, geneIndex: {}, capabilities: capabilities(b), colors: {}, blobs: {}
    };
    b.entities.forEach(function (e) {
      model.entityById[e.id] = e;
      entityGenes(e).forEach(function (g) { (model.geneIndex[g] = model.geneIndex[g] || []).push(e.id); });
    });
    b.compartments.forEach(function (c) { model.compById[c.id] = c; });
    b.layers.forEach(function (l) { indexLayer(model, l); });
    model.embeddingById = {};
    (b.embeddings || []).forEach(function (e) { model.embeddingById[e.id] = e; });
    assignColors(model);
    return model;
  }

  function layerCounts(model, layerId) {
    var out = {};
    model.compartments.forEach(function (c) { out[c.id] = { assigned: 0, below_threshold: 0 }; });
    var map = model.byLayer[layerId] || {};
    Object.keys(map).forEach(function (eid) {
      var a = map[eid];
      if (a.status === "assigned") calls(a).forEach(function (c) { if (out[c]) out[c].assigned++; });
      else if (a.status === "below_threshold" && a.compartment != null && out[a.compartment]) out[a.compartment].below_threshold++;
    });
    return out;
  }

  // Compartments both layers are able to name, or null when neither is limited.
  function sharedScope(model, layerA, layerB) {
    var scope = null;
    [layerA, layerB].forEach(function (id) {
      var sc = model.layerById[id] && model.layerById[id].compartment_scope;
      if (!sc) return;
      scope = scope ? scope.filter(function (c) { return sc.indexOf(c) >= 0; }) : sc.slice();
    });
    return scope;
  }

  // Entities that were inputs to the method behind a layer (its trained_on layers).
  function trainingSet(model, layerId) {
    var out = {}, layer = model.layerById[layerId];
    ((layer && layer.trained_on) || []).forEach(function (id) {
      Object.keys(model.byLayer[id] || {}).forEach(function (eid) { out[eid] = id; });
    });
    return out;
  }

  // Colour belongs to the compartment for the whole session: slot n for the
  // nth compartment in the dataset, whatever is filtered or selected. Names are
  // always shown beside the colour, so colour is never the only cue.
  var COLOR_SLOTS = 20;
  function assignColors(model) {
    model.compartments.forEach(function (c, i) { if (i < COLOR_SLOTS) model.colors[c.id] = i + 1; });
  }

  // Agreement means the two layers' compartment sets share a member. Calls
  // outside the layers' shared compartment scope are ignored, so a layer is
  // never marked wrong about a compartment the other cannot name. `skip` is an
  // optional map of entity ids to leave out (for example a training set).
  function concordance(model, layerA, layerB, skip) {
    var a = model.byLayer[layerA] || {}, b = model.byLayer[layerB] || {};
    var scope = sharedScope(model, layerA, layerB);
    var keep = function (c) { return !scope || scope.indexOf(c) >= 0; };
    var out = { shared: 0, both: 0, agree: 0, table: {}, scope: scope, skipped: 0 };
    Object.keys(a).forEach(function (eid) {
      if (!b[eid]) return;
      if (skip && skip[eid]) { out.skipped++; return; }
      out.shared++;
      var ca = calls(a[eid]).filter(keep), cb = calls(b[eid]).filter(keep);
      if (!ca.length || !cb.length) return;
      out.both++;
      if (ca.some(function (c) { return cb.indexOf(c) >= 0; })) out.agree++;
      ca.forEach(function (x) {
        var row = out.table[x] = out.table[x] || {};
        cb.forEach(function (y) { row[y] = (row[y] || 0) + 1; });
      });
    });
    return out;
  }

  function histogram(values, bins) {
    if (!values.length) return { lo: 0, hi: 1, counts: [] };
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (lo >= 0 && hi <= 1) { lo = 0; hi = 1; }
    if (hi === lo) hi = lo + 1;
    var counts = new Array(bins).fill(0);
    values.forEach(function (v) {
      counts[Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins))]++;
    });
    return { lo: lo, hi: hi, counts: counts };
  }

  function detectedGenes(model, singleGeneOnly) {
    var seen = {};
    model.entities.forEach(function (e) {
      if (e.detected === false) return;
      var g = entityGenes(e);
      if (!singleGeneOnly || g.length === 1) g.forEach(function (x) { seen[x] = true; });
    });
    return Object.keys(seen).sort();
  }

  // Genes for an enrichment test of some protein groups. Only detected groups
  // that resolve to exactly one gene contribute; everything left out is counted.
  function studyGenes(model, entityIds) {
    var out = { genes: [], used: 0, multi_gene: 0, unmapped: 0, undetected: 0 }, seen = {};
    entityIds.forEach(function (id) {
      var e = model.entityById[id];
      if (!e) return;
      var g = entityGenes(e);
      if (e.detected === false) out.undetected++;
      else if (!g.length) out.unmapped++;
      else if (g.length > 1) out.multi_gene++;
      else { out.used++; seen[g[0]] = true; }
    });
    out.genes = Object.keys(seen).sort();
    return out;
  }

  // Everything known about one gene: every protein group it belongs to, each
  // with every layer's assignment kept separate. For host gene pages.
  function geneSummary(model, geneId) {
    return (model.geneIndex[geneId] || []).map(function (eid) {
      var e = model.entityById[eid];
      return {
        entity: eid, members: e.members, detected: e.detected !== false,
        sharedWithGenes: entityGenes(e).filter(function (g) { return g !== geneId; }),
        assignments: model.layers.filter(function (l) { return model.byLayer[l.id][eid]; }).map(function (l) {
          var a = model.byLayer[l.id][eid];
          return { layer: l.id, label: l.label, evidence_type: l.evidence_type, source: l.source,
                   compartment: a.compartment, others: a.others || [], status: a.status, statusLabel: statusLabel(l, a.status),
                   trainingInput: trainingSet(model, l.id)[eid] || null, score: a.score == null ? null : a.score,
                   scoreName: l.score ? l.score.name : null, attributes: a.attributes || {} };
        })
      };
    });
  }

  function searchBlob(entity, adapter) {
    var parts = [entity.id, entity.label || ""];
    entity.members.forEach(function (m) {
      parts.push(m.id, m.gene || "", m.description || "");
      if (m.gene != null && adapter.geneLabel) parts.push(adapter.geneLabel(m.gene) || "");
    });
    if (adapter.searchText) parts.push(adapter.searchText(entity) || "");
    return parts.join(" ").toLowerCase();
  }

  function filterEntities(model, state, adapter) {
    var map = model.byLayer[state.layer] || {};
    var q = (state.query || "").trim().toLowerCase();
    var unassignedView = state.view === "unassigned";
    var list = model.entities.filter(function (e) {
      var a = map[e.id];
      if (unassignedView && (!a || a.status === "assigned")) return false;
      if (state.compartment && (!a || (a.compartment !== state.compartment && calls(a).indexOf(state.compartment) < 0))) return false;
      if (!unassignedView && state.status && state.status !== "all" && (!a || a.status !== state.status)) return false;
      if (state.gene && entityGenes(e).indexOf(state.gene) < 0) return false;
      if (q) {
        var blob = model.blobs[e.id] || (model.blobs[e.id] = searchBlob(e, adapter || {}));
        if (blob.indexOf(q) < 0) return false;
      }
      return true;
    });
    return sortEntities(model, list, state.sort, adapter || {});
  }

  // sort = { key, dir }. Keys: "group", "genes", "c:<layer id>" (compartment
  // label) and "s:<layer id>" (score). Entities with no value always sort last.
  function sortEntities(model, list, sort, adapter) {
    if (!sort || !sort.key) return list;
    var dir = sort.dir === "desc" ? -1 : 1, kind = sort.key.slice(0, 2), layerId = sort.key.slice(2), value;
    if (sort.key === "group") value = function (e) { return e.members[0].id.toLowerCase(); };
    else if (sort.key === "genes") value = function (e) {
      var g = entityGenes(e)[0];
      return g == null ? null : String((adapter.geneLabel && adapter.geneLabel(g)) || g).toLowerCase();
    };
    else if (kind === "c:") value = function (e) {
      var a = (model.byLayer[layerId] || {})[e.id];
      return a && a.compartment != null ? model.compById[a.compartment].label.toLowerCase() : null;
    };
    else if (kind === "s:") value = function (e) {
      var a = (model.byLayer[layerId] || {})[e.id];
      return a && a.score != null ? a.score : null;
    };
    else return list;
    return list.map(function (e, i) { return { e: e, v: value(e), i: i }; }).sort(function (x, y) {
      if (x.v == null || y.v == null) return (x.v == null) - (y.v == null) || x.i - y.i;
      return (x.v < y.v ? -1 : x.v > y.v ? 1 : 0) * dir || x.i - y.i;
    }).map(function (x) { return x.e; });
  }

  function toTSV(model, entities, adapter) {
    adapter = adapter || {};
    var head = ["protein_group", "members", "genes", "mapping_status", "detected"];
    model.layers.forEach(function (l) {
      head.push(l.id + ".compartment", l.id + ".status");
      if (l.score) head.push(l.id + "." + l.score.name);
    });
    var clean = function (v) { return String(v == null ? "" : v).replace(/[\t\r\n]+/g, " "); };
    var lines = [
      "# " + model.bundle.dataset.title,
      "# " + model.bundle.dataset.citation.text,
      "# License: " + model.bundle.dataset.license.id + ". " + model.bundle.dataset.attribution,
      "# Layers: " + model.layers.map(function (l) { return l.id + " = " + EVIDENCE[l.evidence_type].label + ", " + SOURCE[l.source]; }).join("; "),
      head.join("\t")
    ];
    entities.forEach(function (e) {
      var row = [e.id, e.members.map(function (m) { return m.id; }).join(";"), entityGenes(e).join(";"),
                 mappingStatus(e), e.detected === false ? "no" : "yes"];
      model.layers.forEach(function (l) {
        var a = model.byLayer[l.id][e.id];
        var names = a && a.compartment != null ? [a.compartment].concat(a.others || []).map(function (c) { return model.compById[c].label; }).join("; ") : "";
        row.push(names, a ? statusLabel(l, a.status) : "");
        if (l.score) row.push(a ? formatScore(a.score) : "");
      });
      lines.push(row.map(clean).join("\t"));
    });
    return lines.join("\n") + "\n";
  }

  function medianProfile(model, entityIds) {
    var values = model.bundle.profiles.values, nf = model.bundle.fractions.length, out = [];
    for (var i = 0; i < nf; i++) {
      var col = [];
      entityIds.forEach(function (id) { var v = values[id]; if (v && v[i] != null) col.push(v[i]); });
      col.sort(function (a, b) { return a - b; });
      out.push(col.length ? (col.length % 2 ? col[(col.length - 1) / 2] : (col[col.length / 2 - 1] + col[col.length / 2]) / 2) : null);
    }
    return out;
  }

  /* ---------- DOM helpers ---------- */

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;   // CSSOM, so a strict style CSP still allows it
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return el;
  }

  function s(tag, attrs, kids) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (kid) { if (kid) el.appendChild(kid); });
    return el;
  }

  function svgText(x, y, text, cls, anchor) {
    var t = s("text", { x: x, y: y, class: cls || "sx-axis-text", "text-anchor": anchor || "middle" });
    t.textContent = text;
    return t;
  }

  function badge(evidenceType) {
    return h("span", { class: "sx-badge sx-ev-" + evidenceType, text: EVIDENCE[evidenceType].badge, title: EVIDENCE[evidenceType].text });
  }

  function safeHref(url) {
    return typeof url === "string" && /^(https?:\/\/|\/|\.\/|\.\.\/|#)/.test(url) ? url : null;
  }

  function link(text, url) {
    var href = safeHref(url);
    return href ? h("a", { href: href, text: text }) : h("span", { text: text });
  }

  function cssVar(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ---------- the explorer: a dashboard ----------
   *
   *  title bar     name, status, About / Help / Download / Cite
   *  sidebar       Explore navigation, quick search, compartment filter, display options
   *  top row       central panel (map, or a list / table for the other sections) | protein details
   *  bottom row    compartments | score distribution | functional enrichment
   *
   * Panels whose data are absent keep their place and say so. Nothing is drawn
   * that was not measured or supplied.
   */

  var PAGE = 50;
  var MODES = [
    { id: "map", label: "Spatial map", icon: "M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm9 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" },
    { id: "proteins", label: "Protein search", icon: "M8 2a6 6 0 1 0 3.7 10.7l3.3 3.3 1.4-1.4-3.3-3.3A6 6 0 0 0 8 2zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" },
    { id: "compartments", label: "Compartments", icon: "M3 4c0-1.1 2.7-2 6-2s6 .9 6 2v2c0 1.1-2.7 2-6 2s-6-.9-6-2V4zm0 5c0 1.1 2.7 2 6 2s6-.9 6-2v2c0 1.1-2.7 2-6 2s-6-.9-6-2V9zm0 5c0 1.1 2.7 2 6 2s6-.9 6-2v-1c0 1.1-2.7 2-6 2s-6-.9-6-2v1z" },
    { id: "markers", label: "Marker proteins", icon: "M9 1.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2L9 13.3l-4.6 2.5.9-5.2L1.500 7l5.2-.8L9 1.5z" },
    { id: "enrichment", label: "Enrichment analysis", icon: "M2 16V9h3v7H2zm5.500 0V3h3v13h-3zM13 16V7h3v9h-3z" },
    { id: "methods", label: "Data and methods", icon: "M4 1h7l4 4v12H4V1zm6 1.500V6h3.500L10 2.500zM6 9v1.500h6V9H6zm0 3v1.500h6V12H6z" }
  ];
  var SHOW = [["all", "All proteins"], ["assigned", "Assigned only"], ["markers", "Markers only"], ["unknown", "Unknown only"]];

  function shortLabel(layer) { return layer.short_label || layer.label; }
  function plural(n, word) { return n.toLocaleString() + " " + word + (n === 1 ? "" : "s"); }
  function icon(path) {
    return s("svg", { viewBox: "0 0 18 18", width: "16", height: "16", class: "sx-icon", "aria-hidden": "true" }, [s("path", { d: path.replace(/500/g, "5"), fill: "currentColor" })]);
  }

  function Explorer(el, model, adapter, options) {
    this.el = el;
    this.model = model;
    this.adapter = adapter;
    this.options = options;
    this.enrichCache = {};
    var first = model.layers.filter(function (l) { return l.evidence_type === "computational_assignment"; })[0] || model.layers[0];
    var init = options.initial || {};
    var st = this.state = {
      layer: model.layerById[init.layer] ? init.layer : (first ? first.id : null),
      mode: MODES.some(function (m) { return m.id === init.mode; }) ? init.mode : "map",
      compartment: model.compById[init.compartment] ? init.compartment : null,
      show: SHOW.some(function (x) { return x[0] === init.show; }) ? init.show : "all",
      entity: null, query: "", gene: null, sort: null, shown: PAGE,
      embedding: model.capabilities.embeddings[0] || null, mapTab: 0, pointSize: "default",
      detailTab: "overview", enrichTab: null, compare: null
    };
    if (init.mode === "markers") { st.mode = "proteins"; st.show = "markers"; }
    if (init.view === "unassigned") { st.mode = "proteins"; st.show = "unknown"; }
    if (model.compById[init.compartment] && !init.mode) st.mode = "proteins";
    if (model.entityById[init.entity]) st.entity = init.entity;
    else if (init.gene && model.geneIndex[init.gene]) {
      st.entity = model.geneIndex[init.gene][0];
      if (model.geneIndex[init.gene].length > 1) { st.mode = "proteins"; st.gene = init.gene; }
    }
    this.build();
  }

  Explorer.prototype.set = function (patch) {
    var st = this.state, keys = Object.keys(patch);
    keys.forEach(function (k) { st[k] = patch[k]; });
    if (keys.every(function (k) { return k === "entity" || k === "detailTab"; })) {
      this.markSelected();
      this.renderDetails();
      this.renderEnrichment();
      this.drawMap();
    } else this.render();
    if (keys.indexOf("entity") >= 0 && this.options.onSelect) this.options.onSelect(st.entity, this);
    if (this.options.onState) this.options.onState({ mode: st.mode, compartment: st.compartment, show: st.show, entity: st.entity, gene: st.gene, query: st.query, layer: st.layer }, this);
  };

  // Change what is listed, starting again from the top of the list.
  Explorer.prototype.go = function (patch) {
    var full = { shown: PAGE, sort: null, gene: null }, k;
    for (k in patch) full[k] = patch[k];
    this.set(full);
  };

  Explorer.prototype.home = function () { this.go({ mode: "map", compartment: null, show: "all", query: "" }); };
  Explorer.prototype.showCompartment = function (id) { if (this.model.compById[id]) this.go({ mode: "proteins", compartment: id, show: "assigned", query: "" }); };
  Explorer.prototype.showUnassigned = function () { this.go({ mode: "proteins", compartment: null, show: "unknown", query: "" }); };
  Explorer.prototype.showResults = function () {
    var q = this.search.value.trim();
    this.closeSuggestions();
    this.go({ mode: "proteins", query: q, compartment: null, show: "all" });
  };

  Explorer.prototype.destroy = function () {
    root.removeEventListener("resize", this.onResize);
    this.el.textContent = "";
    this.el.classList.remove("sx-root");
    this.el.removeAttribute("data-sx-theme");
  };

  Explorer.prototype.showGene = function (geneId) {
    var ids = this.model.geneIndex[geneId] || [];
    if (ids.length > 1) this.go({ mode: "proteins", gene: geneId, query: "", compartment: null, show: "all", entity: ids[0] });
    else if (ids.length) this.set({ entity: ids[0] });
    return ids.length;
  };

  Explorer.prototype.select = function (entityId) {
    if (entityId == null || this.model.entityById[entityId]) this.set({ entity: entityId });
  };

  /* ----- skeleton ----- */

  Explorer.prototype.build = function () {
    var self = this, ds = this.model.bundle.dataset, el = this.el, o = this.options;
    el.textContent = "";
    el.classList.add("sx-root");
    el.setAttribute("data-sx-theme", { dark: "dark", auto: "auto" }[o.theme] || "light");
    var pending = null;
    this.onResize = function () {
      if (!self.el.isConnected) { root.removeEventListener("resize", self.onResize); return; }
      clearTimeout(pending); pending = setTimeout(function () { self.drawMap(); }, 120);
    };
    root.addEventListener("resize", this.onResize);

    var status = o.statusLabel || (ds.synthetic ? "Synthetic" : (ds.distribution && ds.distribution.status !== "public" ? "Preview" : null));
    var action = function (name, label, path, run) {
      return h("button", { type: "button", class: "sx-action", "data-action": name, onclick: run }, [icon(path), label]);
    };
    // A host with its own page header passes header: false and wires its
    // buttons to go({ mode: "methods" }) and exportTSV().
    if (o.header !== false) el.appendChild(h("header", { class: "sx-titlebar" }, [
      h("div", { class: "sx-titles" }, [
        h("h1", { class: "sx-title" }, [document.createTextNode(o.title || ds.title), status ? h("span", { class: "sx-pill sx-pill-status", "data-sx": "status", text: status }) : null]),
        h("p", { class: "sx-sub", "data-sx": "subtitle", text: o.subtitle || ds.description || "" })
      ]),
      h("div", { class: "sx-actions" }, [
        action("about", "About", "M9 1a8 8 0 1 0 0 16A8 8 0 0 0 9 1zm0 1.500a6.500 6.500 0 1 1 0 13 6.500 6.500 0 0 1 0-13zM8.200 8h1.600v5H8.200V8zm0-3h1.600v1.600H8.200V5z", function () { self.go({ mode: "methods" }); }),
        action("help", "Help", "M9 1a8 8 0 1 0 0 16A8 8 0 0 0 9 1zm-.800 11h1.600v1.600H8.200V12zM9 4.400c1.700 0 3 1.100 3 2.700 0 1.200-.700 1.800-1.400 2.300-.600.400-.800.700-.800 1.300H8.200c0-1.200.500-1.800 1.300-2.400.600-.400.900-.700.900-1.200 0-.600-.500-1.100-1.400-1.100-.800 0-1.400.500-1.500 1.300H6c.100-1.700 1.300-2.900 3-2.900z", function () { self.go({ mode: "methods" }); var t = self.el.querySelector("[data-sx=help]"); if (t && t.scrollIntoView) t.scrollIntoView({ block: "nearest" }); }),
        action("export", "Download", "M8.200 2h1.600v7l2.400-2.400 1.100 1.100L9 12 4.700 7.700l1.100-1.100L8.200 9V2zM3 13.500h12V15H3v-1.500z", function () { self.exportTSV(); }),
        action("cite", "Cite", "M9 1a8 8 0 1 0 0 16A8 8 0 0 0 9 1zm0 1.500a6.500 6.500 0 1 1 0 13 6.500 6.500 0 0 1 0-13zm.300 3.300c-2 0-3.300 1.400-3.300 3.200s1.300 3.200 3.300 3.200c1.300 0 2.300-.600 2.800-1.600l-1.300-.700c-.300.500-.800.800-1.500.800-1 0-1.700-.700-1.700-1.700s.700-1.700 1.700-1.700c.700 0 1.200.300 1.500.800l1.300-.700c-.500-1-1.500-1.600-2.800-1.600z", function () { self.go({ mode: "methods" }); var t = self.el.querySelector("[data-sx=citation]"); if (t && t.scrollIntoView) t.scrollIntoView({ block: "nearest" }); })
      ])
    ]));

    // sidebar
    this.navList = h("ul", { class: "sx-nav", "data-sx": "nav" });
    this.search = h("input", { type: "search", class: "sx-search-input", "data-sx": "search", role: "combobox", autocomplete: "off", spellcheck: "false",
      "aria-label": "Search for a gene or protein", "aria-expanded": "false", "aria-controls": "sx-suggestions", "aria-autocomplete": "list",
      placeholder: o.searchPlaceholder || "Search gene, protein or accession…",
      oninput: function () { self.renderSuggestions(); }, onkeydown: function (ev) { self.searchKey(ev); },
      onfocus: function () { if (this.value.trim().length >= 2) self.renderSuggestions(); },
      onblur: function () { setTimeout(function () { self.closeSuggestions(); }, 120); } });
    this.suggestBox = h("ul", { id: "sx-suggestions", class: "sx-suggestions", role: "listbox", "data-sx": "suggestions", hidden: true });
    this.compSelect = h("select", { "data-sx": "compartment-filter", "aria-label": "Filter by compartment", onchange: function () { self.go({ compartment: this.value || null }); } });
    this.showBox = h("div", { class: "sx-radios", role: "radiogroup", "aria-label": "Show in map", "data-sx": "show" }, SHOW.map(function (x) {
      return h("label", {}, [h("input", { type: "radio", name: "sx-show", value: x[0], onchange: function () { if (this.checked) self.go({ show: x[0] }); } }), h("span", { text: x[1] })]);
    }));
    var group = "sx-show-" + Math.random().toString(36).slice(2);
    Array.prototype.forEach.call(this.showBox.querySelectorAll("input"), function (i) { i.name = group; });
    var sidebar = h("aside", { class: "sx-sidebar", "aria-label": "Explore" }, [
      h("h2", { text: "Explore" }), h("nav", {}, [this.navList]),
      h("h2", { text: "Quick search" }), h("div", { class: "sx-search" }, [this.search, this.suggestBox]),
      h("p", { class: "sx-hint", text: o.searchHint || "Gene name, gene identifier or protein accession" }),
      h("h2", { text: "Filter by compartment" }), this.compSelect,
      h("h2", { text: "Show in map" }), this.showBox
    ]);

    this.central = h("section", { class: "sx-panel sx-central", "data-sx": "central" });
    this.details = h("section", { class: "sx-panel sx-details", "data-sx": "details", "aria-label": "Protein details" });
    this.compPanel = h("section", { class: "sx-panel", "data-sx": "compartments" });
    this.scoresPanel = h("section", { class: "sx-panel", "data-sx": "scores" });
    this.enrichPanel = h("section", { class: "sx-panel", "data-sx": "enrichment" });
    this.main = h("div", { class: "sx-content", "data-sx": "main" }, [
      h("div", { class: "sx-row sx-row-top" }, [this.central, this.details]),
      h("div", { class: "sx-row sx-row-bottom" }, [this.compPanel, this.scoresPanel, this.enrichPanel])
    ]);
    el.appendChild(h("div", { class: "sx-shell" }, [sidebar, this.main]));

    var notes = [];
    if (ds.synthetic) notes.push(h("span", { "data-sx": "synthetic", text: "Synthetic demonstration data. " }));
    if (ds.distribution && ds.distribution.status !== "public") notes.push(h("span", { "data-sx": "local-only", title: ds.distribution.reason || null, text: "Preview copy, not cleared for redistribution. " }));
    (ds.notices || []).slice(0, 1).forEach(function (t) { notes.push(h("span", { "data-sx": "notice", text: t })); });
    var cite = ds.citation || {};
    el.appendChild(h("footer", { class: "sx-foot" }, [
      h("span", { class: "sx-foot-src" }, [document.createTextNode(cite.text.split(". ")[0] + (cite.peer_reviewed === false ? ". Preprint, not peer reviewed. " : ". ")), cite.url ? link("Publication", cite.url) : null]),
      h("span", { class: "sx-foot-note" }, notes)
    ]));
    this.tip = h("div", { class: "sx-tip", hidden: true });
    el.appendChild(this.tip);
    this.render();
  };

  Explorer.prototype.refreshLayers = function () { this.index = null; };

  /* ----- what is listed ----- */

  Explorer.prototype.markerLayers = function () {
    var layer = this.model.layerById[this.state.layer], trained = (layer && layer.trained_on) || [];
    return this.model.layers.filter(function (l) { return l.role === "marker" || trained.indexOf(l.id) >= 0; });
  };

  // The marker entry for one protein group, if any: { layer, assignment }.
  Explorer.prototype.markerOf = function (entityId) {
    var model = this.model, hit = null;
    this.markerLayers().forEach(function (l) { var a = model.byLayer[l.id][entityId]; if (a && !hit) hit = { layer: l, assignment: a }; });
    return hit;
  };

  Explorer.prototype.matchesFilter = function (e) {
    var st = this.state, a = this.layerInfo.map[e.id], comp = st.compartment;
    if (st.show === "markers") {
      var m = this.markerOf(e.id);
      return !!m && (!comp || calls(m.assignment).indexOf(comp) >= 0);
    }
    if (!a) return false;
    if (st.show === "unknown") return a.status !== "assigned" && (!comp || a.compartment === comp);
    if (st.show === "assigned" || comp) return a.status === "assigned" && (!comp || calls(a).indexOf(comp) >= 0);
    return true;
  };

  Explorer.prototype.computeList = function () {
    var self = this, st = this.state, model = this.model, list;
    if (st.gene) list = (model.geneIndex[st.gene] || []).map(function (id) { return model.entityById[id]; });
    else {
      list = model.entities.filter(function (e) { return self.matchesFilter(e); });
      if (st.query) {
        var keep = {};
        this.matches(st.query).forEach(function (x) { keep[x.e.id] = true; });
        list = list.filter(function (e) { return keep[e.id]; });
      }
    }
    this.filtered = sortEntities(model, list, st.sort || { key: "genes", dir: "asc" }, this.adapter);
  };

  /* ----- rendering ----- */

  Explorer.prototype.render = function () {
    var self = this, st = this.state, model = this.model, layer = model.layerById[st.layer];
    if (!layer) { this.central.textContent = "This dataset has no localization assignments."; return; }
    var map = model.byLayer[layer.id], counts = layerCounts(model, layer.id), nAssigned = 0, nUnassigned = 0;
    Object.keys(map).forEach(function (id) { if (map[id].status === "assigned") nAssigned++; else nUnassigned++; });
    this.layerInfo = { layer: layer, map: map, counts: counts, assigned: nAssigned, unassigned: nUnassigned, word: statusLabel(layer, "below_threshold") };
    this.training = trainingSet(model, layer.id);
    this.computeList();

    this.navList.textContent = "";
    MODES.forEach(function (m) {
      var on = m.id === "markers" ? (st.mode === "proteins" && st.show === "markers") : (st.mode === m.id && !(m.id === "proteins" && st.show === "markers"));
      self.navList.appendChild(h("li", {}, [h("button", { type: "button", class: "sx-nav-item" + (on ? " sx-on" : ""), "data-mode": m.id, "aria-current": on ? "page" : null,
        onclick: function () {
          if (m.id === "markers") self.go({ mode: "proteins", show: "markers" });
          else if (m.id === "proteins") self.go({ mode: "proteins", show: st.show === "markers" ? "all" : st.show });
          else self.go({ mode: m.id });
        } }, [icon(m.icon), m.label])]));
    });
    this.compSelect.textContent = "";
    this.compSelect.appendChild(h("option", { value: "", text: "All compartments" }));
    model.compartments.forEach(function (c) { self.compSelect.appendChild(h("option", { value: c.id, text: c.label, selected: st.compartment === c.id })); });
    Array.prototype.forEach.call(this.showBox.querySelectorAll("input"), function (i) { i.checked = i.value === st.show; });

    this.renderCentral();
    this.renderDetails();
    this.renderCompartments();
    this.renderScores();
    this.renderEnrichment();
    this.drawMap();
  };

  Explorer.prototype.panelHead = function (title, extra) {
    return h("div", { class: "sx-panel-head" }, [h("h3", { text: title })].concat(extra || []));
  };

  Explorer.prototype.tabs = function (name, items, current, pick) {
    return h("div", { class: "sx-tabs", role: "tablist", "data-sx": name }, items.map(function (it) {
      var on = it.id === current;
      return h("button", { type: "button", role: "tab", class: "sx-tab" + (on ? " sx-on" : ""), "aria-selected": on ? "true" : "false", "data-tab": it.id,
        title: it.title || null, onclick: function () { pick(it.id); }, text: it.label });
    }));
  };

  Explorer.prototype.renderCentral = function () {
    var st = this.state, box = this.central, view = { map: this.mapView, proteins: this.listView, compartments: this.compartmentsView, enrichment: this.enrichmentView, methods: this.methodsView }[st.mode];
    box.textContent = "";
    box.setAttribute("data-mode", st.mode);
    this.canvas = null; this.rows = null;
    var kids = view.call(this);
    for (var i = 0; i < kids.length; i++) if (kids[i]) box.appendChild(kids[i]);
    this.renderRows();
  };

  /* ----- central panel: the map ----- */

  Explorer.prototype.mapView = function () {
    var self = this, st = this.state, model = this.model, cap = model.capabilities, info = this.layerInfo;
    var has = cap.embeddings.length > 0;
    var tabItems = has ? cap.embeddings.map(function (id) { return { id: id, label: model.embeddingById[id].label }; })
      : (this.options.mapTabs || ["t-SNE", "PCA", "UMAP"]).map(function (t, i) { return { id: String(i), label: t, title: "Not available yet" }; });
    var tabs = this.tabs("map-tabs", tabItems, has ? st.embedding : String(st.mapTab), function (id) { self.set(has ? { embedding: id } : { mapTab: +id }); });
    var controls = h("div", { class: "sx-controls" }, [
      h("label", {}, [h("span", { text: "Color by:" }), h("select", { "data-sx": "color-by", disabled: !has, "aria-label": "Color by" }, [h("option", { text: "Compartment" })])]),
      h("label", {}, [h("span", { text: "Point size:" }), h("select", { "data-sx": "point-size", disabled: !has, "aria-label": "Point size", onchange: function () { st.pointSize = this.value; self.drawMap(); } },
        [["default", "Default"], ["small", "Small"], ["large", "Large"]].map(function (o) { return h("option", { value: o[0], text: o[1], selected: st.pointSize === o[0] }); }))])
    ]);
    var plot;
    if (has) {
      var emb = model.embeddingById[st.embedding];
      this.canvas = h("canvas", { class: "sx-map", "data-sx": "map-canvas", role: "img", "aria-label": "Map of protein groups, " + emb.label + ". The protein list holds the same protein groups." });
      this.canvas.addEventListener("mousemove", function (ev) { self.hoverMap(ev); });
      this.canvas.addEventListener("mouseleave", function () { self.tip.hidden = true; });
      this.canvas.addEventListener("click", function (ev) { var p = self.nearest(ev); if (p) self.set({ entity: p.id }); });
      plot = h("div", { class: "sx-plot", "data-sx": "map" }, [this.canvas,
        h("p", { class: "sx-caption", text: emb.method.name + " of the measured profiles, " + SOURCE[emb.source] + "." })]);
    } else {
      var label = tabItems[st.mapTab] ? tabItems[st.mapTab].label : "Map";
      plot = h("div", { class: "sx-plot sx-plot-empty", "data-sx": "no-map", role: "img", "aria-label": "No spatial map is available yet" }, [
        h("div", { class: "sx-axes" }, [h("span", { class: "sx-axis-y", text: label + " 2" }), h("span", { class: "sx-axis-x", text: label + " 1" })]),
        h("div", { class: "sx-empty" }, [
          h("strong", { text: "Spatial map not yet available" }),
          h("p", { text: this.options.mapPending || "This view needs map coordinates computed from the measured fractionation profiles, which this dataset does not include yet." }),
          h("p", { class: "sx-muted", text: "No points are drawn. Nothing here is simulated." })
        ])
      ]);
    }
    var legend = h("ul", { class: "sx-legend-list", "data-sx": "legend" }, model.compartments.map(function (c) {
      var on = st.compartment === c.id;
      return h("li", {}, [h("button", { type: "button", class: "sx-legend-item" + (on ? " sx-on" : ""), "data-compartment": c.id, "aria-pressed": on ? "true" : "false",
        title: c.description || null, onclick: function () { self.go({ compartment: on ? null : c.id }); } }, [self.dot(c.id), c.label + " (" + info.counts[c.id].assigned.toLocaleString() + ")"])]);
    }));
    if (info.unassigned) {
      var onU = st.show === "unknown";
      legend.appendChild(h("li", {}, [h("button", { type: "button", class: "sx-legend-item" + (onU ? " sx-on" : ""), "data-show": "unknown", "aria-pressed": onU ? "true" : "false",
        onclick: function () { self.go({ show: onU ? "all" : "unknown", compartment: null }); } }, [h("span", { class: "sx-dot sx-dot-unknown", "aria-hidden": "true" }), "Unknown (" + info.unassigned.toLocaleString() + ")"])]));
    }
    return [
      this.panelHead("Spatial proteome map"),
      h("div", { class: "sx-tabrow" }, [tabs, controls]),
      h("div", { class: "sx-map-body" }, [plot, h("div", { class: "sx-legend-col" }, [legend, h("p", { class: "sx-caption", text: "Numbers indicate protein groups" })])])
    ];
  };

  /* ----- central panel: lists and tables ----- */

  Explorer.prototype.listTitle = function () {
    var st = this.state, c = st.compartment ? this.model.compById[st.compartment].label : null;
    if (st.gene) return "Protein groups for " + this.geneText(st.gene);
    var what = { all: "Proteins", assigned: "Assigned proteins", markers: "Marker proteins", unknown: "Proteins without a final call" }[st.show];
    if (st.show === "all" && c) what = "Proteins assigned";
    return what + (c ? (st.show === "unknown" ? ", closest to " + c : (st.show === "markers" ? " for " + c : (st.show === "all" ? " to " + c : " in " + c))) : "") + (st.query ? " matching “" + st.query + "”" : "");
  };

  Explorer.prototype.listView = function () {
    var self = this, st = this.state, info = this.layerInfo, layer = info.layer;
    var sortBtn = function (key, text, firstDir) {
      var on = st.sort ? st.sort.key === key : key === "genes", dir = on ? (st.sort ? st.sort.dir : "asc") : null;
      return h("button", { type: "button", class: "sx-sort" + (on ? " sx-on" : ""), "data-sort": key, title: "Sort by " + text,
        text: text + (on ? (dir === "desc" ? " ↓" : " ↑") : ""),
        onclick: function () { self.set({ sort: { key: key, dir: on ? (dir === "asc" ? "desc" : "asc") : (firstDir || "asc") }, shown: PAGE }); } });
    };
    this.rows = h("tbody", { "data-sx": "rows" });
    this.more = h("button", { type: "button", class: "sx-more", "data-sx": "more", onclick: function () { st.shown += PAGE; self.renderRows(); } });
    var chips = [];
    if (st.query) chips.push(h("button", { type: "button", class: "sx-chipbtn", "data-sx": "clear-query", text: "“" + st.query + "” ×", onclick: function () { self.search.value = ""; self.go({ query: "" }); } }));
    if (st.gene) chips.push(h("button", { type: "button", class: "sx-chipbtn", "data-sx": "clear-gene", text: self.geneText(st.gene) + " ×", onclick: function () { self.go({ gene: null }); } }));
    var head = [h("th", { scope: "col" }, [sortBtn("genes", "Protein")]),
      h("th", { scope: "col" }, [sortBtn("c:" + layer.id, st.show === "unknown" ? "Closest class" : "Assignment")])];
    if (layer.score) head.push(h("th", { scope: "col", class: "sx-num", title: layer.score.description || "" }, [sortBtn("s:" + layer.id, shortLabel(layer) + " score", "desc")]));
    head.push(h("th", { scope: "col", text: "Marker" }), h("th", { scope: "col", text: "Other evidence" }));
    return [
      this.panelHead(this.listTitle(), [h("span", { class: "sx-count", "data-sx": "count", "aria-live": "polite" })].concat(chips)),
      h("div", { class: "sx-scroll sx-fill" }, [h("table", { class: "sx-list" }, [h("thead", {}, [h("tr", {}, head)]), this.rows]), this.more])
    ];
  };

  Explorer.prototype.markerText = function (entityId) {
    var m = this.markerOf(entityId), layer = this.layerInfo.layer;
    if (!m) return null;
    return (layer.trained_on || []).indexOf(m.layer.id) >= 0 ? "Training marker" : "Marker";
  };

  // Short tags for what other curated sources (not the marker sets) say.
  Explorer.prototype.evidenceChips = function (e) {
    var model = this.model, info = this.layerInfo, call = finalCall(info.map[e.id]), out = [], markers = this.markerLayers();
    model.layers.forEach(function (l) {
      if (l.id === info.layer.id || l.evidence_type !== "curated_annotation" || markers.indexOf(l) >= 0) return;
      var cs = calls(model.byLayer[l.id][e.id]);
      if (!cs.length) return;
      var agrees = call != null && cs.indexOf(call) >= 0;
      var names = cs.map(function (c) { return model.compById[c].label; }).join(", ");
      out.push(h("span", { class: "sx-chip" + (agrees ? " sx-chip-agree" : ""), "data-chip": l.id,
        title: l.label + ": " + names + (agrees ? ". Same compartment as the assignment." : ""), text: shortLabel(l) + (agrees ? " ✓" : ": " + names) }));
    });
    return out;
  };

  Explorer.prototype.renderRows = function () {
    if (!this.rows || !this.rows.isConnected) return;
    var self = this, st = this.state, model = this.model, info = this.layerInfo, list = this.filtered, slice = list.slice(0, st.shown);
    this.rows.textContent = "";
    slice.forEach(function (e) {
      var a = info.map[e.id], title = self.entityTitle(e), desc = self.entityDescription(e), first = e.members[0].id, cell;
      if (!a) cell = [h("span", { class: "sx-muted", text: "Not detected" })];
      else if (a.status === "assigned") cell = [self.dot(a.compartment), model.compById[a.compartment].label];
      else cell = [h("span", { class: "sx-muted", text: statusLabel(info.layer, a.status) }),
        a.compartment != null ? h("span", { class: "sx-closest", title: "Closest class named by the method. Not an assignment." }, [self.dot(a.compartment, true), model.compById[a.compartment].label]) : null];
      var cells = [h("td", {}, [
        h("div", { class: "sx-row-title" }, [h("strong", { text: title }),
          e.members.length > 1 ? h("span", { class: "sx-tag", title: "A protein group that mass spectrometry could not split further", text: "group of " + e.members.length }) : null,
          e.detected === false ? h("span", { class: "sx-tag", text: "not detected" }) : null]),
        h("div", { class: "sx-row-desc", title: desc || null, text: (title !== first ? first : "") + (desc ? (title !== first ? " · " : "") + desc : "") })
      ]), h("td", { class: "sx-loc" }, cell)];
      if (info.layer.score) cells.push(h("td", { class: "sx-num sx-mono", text: a && a.score != null ? formatScore(a.score) : "" }));
      var mk = self.markerText(e.id);
      cells.push(h("td", {}, mk ? [h("span", { class: "sx-chip", "data-chip": "marker", text: mk })] : []));
      cells.push(h("td", {}, [h("div", { class: "sx-chips" }, self.evidenceChips(e))]));
      self.rows.appendChild(h("tr", { "data-entity": e.id, tabindex: "0", role: "button", "aria-label": "Details for " + title,
        class: e.id === st.entity ? "sx-row-on" : null,
        onclick: function () { self.set({ entity: e.id }); },
        onkeydown: function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); self.set({ entity: e.id }); } } }, cells));
    });
    if (!list.length) this.rows.appendChild(h("tr", {}, [h("td", { colspan: "5", class: "sx-muted", text: "No protein matches." })]));
    var count = this.central.querySelector("[data-sx=count]");
    if (count) count.textContent = list.length > slice.length ? "Showing " + slice.length + " of " + list.length.toLocaleString() : plural(list.length, "protein group");
    this.more.hidden = list.length <= slice.length;
    this.more.textContent = "Show " + Math.min(PAGE, list.length - slice.length) + " more";
  };

  Explorer.prototype.compartmentRows = function (compact) {
    var self = this, st = this.state, model = this.model, info = this.layerInfo, markers = this.markerLayers(), nMarkers = {};
    markers.forEach(function (l) {
      var m = model.byLayer[l.id];
      Object.keys(m).forEach(function (id) { calls(m[id]).forEach(function (c) { nMarkers[c] = (nMarkers[c] || 0) + 1; }); });
    });
    var rows = model.compartments.map(function (c) {
      var on = st.compartment === c.id, n = info.counts[c.id];
      var cells = [h("td", {}, [self.dot(c.id), c.label]), h("td", { class: "sx-num", text: n.assigned.toLocaleString() }), h("td", { class: "sx-num", text: String(nMarkers[c.id] || 0) })];
      if (!compact) cells.push(h("td", { class: "sx-num", title: "Named by the method for this compartment, without a final call", text: String(n.below_threshold) }));
      var url = c.ontology_id && self.adapter.termUrl ? safeHref(self.adapter.termUrl(c.ontology_id)) : null;
      cells.push(h("td", { title: c.ontology_note || null }, [c.ontology_id ? (url ? h("a", { href: url, text: c.ontology_id, onclick: function (ev) { ev.stopPropagation(); } }) : c.ontology_id) : "—"]));
      if (!compact) cells.push(h("td", { class: "sx-muted", text: c.ontology_note || c.description || "" }));
      return h("tr", { "data-compartment": c.id, tabindex: "0", role: "button", class: on ? "sx-row-on" : null, "aria-label": "Show proteins assigned to " + c.label,
        onclick: function () { self.go(compact ? { compartment: on ? null : c.id } : { compartment: c.id, mode: "proteins", show: "assigned" }); },
        onkeydown: function (ev) { if (ev.key === "Enter") self.go({ compartment: on ? null : c.id }); } }, cells);
    });
    if (info.unassigned) {
      var cells = [h("td", {}, [h("span", { class: "sx-dot sx-dot-unknown", "aria-hidden": "true" }), "Unknown"]), h("td", { class: "sx-num", text: info.unassigned.toLocaleString() }), h("td", { class: "sx-num", text: "—" })];
      if (!compact) cells.push(h("td", { class: "sx-num", text: "—" }));
      cells.push(h("td", { text: "—" }));
      if (!compact) cells.push(h("td", { class: "sx-muted", text: "Detected, published without a final call (“" + info.word + "”)." }));
      rows.push(h("tr", { "data-show": "unknown", tabindex: "0", role: "button", class: st.show === "unknown" ? "sx-row-on" : null,
        onclick: function () { self.go({ show: "unknown", compartment: null, mode: compact ? st.mode : "proteins" }); } }, cells));
    }
    var head = ["Compartment", "Proteins", "Markers"].concat(compact ? [] : ["Closest, no call"], [compact ? "GO term" : "Ontology term"], compact ? [] : ["Note"]);
    return h("table", { class: "sx-table sx-comp-table" }, [h("thead", {}, [h("tr", {}, head.map(function (t, i) { return h("th", { scope: "col", class: i > 0 && i < (compact ? 3 : 4) ? "sx-num" : null, text: t }); }))]), h("tbody", {}, rows)]);
  };

  Explorer.prototype.compartmentsView = function () {
    return [this.panelHead("Compartments", [h("span", { class: "sx-count", text: plural(this.model.compartments.length, "compartment") + ". Select one to list its proteins." })]),
      h("div", { class: "sx-scroll sx-fill" }, [this.compartmentRows(false)])];
  };

  Explorer.prototype.renderCompartments = function () {
    var box = this.compPanel;
    box.textContent = "";
    box.appendChild(this.panelHead("Compartments"));
    box.appendChild(h("div", { class: "sx-scroll sx-fill" }, [this.compartmentRows(true)]));
  };

  /* ----- protein details ----- */

  Explorer.prototype.renderDetails = function () {
    var self = this, model = this.model, st = this.state, info = this.layerInfo, e = model.entityById[st.entity], box = this.details;
    box.textContent = "";
    if (!info) return;
    if (!e) {
      box.appendChild(this.panelHead("Protein details"));
      box.appendChild(h("div", { class: "sx-empty sx-fill", "data-sx": "no-protein" }, [h("strong", { text: "No protein selected" }),
        h("p", { text: "Search for a gene or protein, or select one in a list, to see its localization here." })]));
      return;
    }
    var layer = info.layer, a = info.map[e.id], genes = entityGenes(e), call = finalCall(a);
    var url = genes.length ? safeHref(this.adapter.geneUrl && this.adapter.geneUrl(genes[0])) : null;
    box.appendChild(this.panelHead("Protein details", [url ? h("a", { class: "sx-open", "data-sx": "gene-link", href: url, title: this.geneText(genes[0]) + ": " + (this.adapter.geneLinkText || "gene page"), "aria-label": this.geneText(genes[0]) + ": " + (this.adapter.geneLinkText || "gene page") },
      [icon("M10 2h6v6h-1.500V4.600L8.500 10.600 7.400 9.500l6-6H10V2zM3 5h5v1.500H4.500v7h7V10H13v5H3V5z")]) : null]));
    var pill = !a ? h("span", { class: "sx-pill", text: "Not detected" })
      : a.status === "assigned" ? h("span", { class: "sx-pill sx-pill-ok", "data-sx": "status-pill", text: "Assigned" })
      : h("span", { class: "sx-pill", "data-sx": "status-pill", text: statusLabel(layer, a.status).replace(/^./, function (c) { return c.toUpperCase(); }) });
    var id = genes.length ? genes[0] + (genes.length > 1 ? " +" + (genes.length - 1) : "") : e.members[0].id;
    var name = this.entityDescription(e), sym = genes.length ? this.entityTitle(e) : "";
    box.appendChild(h("div", { class: "sx-d-id" }, [
      h("div", {}, [h("strong", { class: "sx-d-title", "data-sx": "drawer-title", text: id }), pill]),
      h("div", { class: "sx-d-name", "data-sx": "protein-name", text: (name || "") + (sym && sym !== id ? (name ? " (" + sym + ")" : sym) : "") })
    ]));
    box.appendChild(this.tabs("detail-tabs", [{ id: "overview", label: "Overview" }, { id: "spatial", label: "Spatial data" }, { id: "annotations", label: "Annotations" }, { id: "sequences", label: "Sequences" }],
      st.detailTab, function (t) { self.set({ detailTab: t }); }));
    var body = h("div", { class: "sx-d-body sx-fill", "data-sx": "detail-body", "data-tab": st.detailTab });
    box.appendChild(body);
    var kv = function (rows) {
      return h("table", { class: "sx-kv" }, [h("tbody", {}, rows.filter(Boolean).map(function (r) {
        return h("tr", { "data-row": r[2] || null }, [h("th", { scope: "row", text: r[0] }), h("td", {}, Array.isArray(r[1]) ? r[1] : [r[1]])]);
      }))]);
    };
    var others = model.layers.filter(function (l) { return l.id !== layer.id; });
    var sourceRows = function (layers, empty) {
      var rows = layers.filter(function (l) { return model.byLayer[l.id][e.id]; }).map(function (l) {
        var x = model.byLayer[l.id][e.id], cs = calls(x), scope = sharedScope(model, layer.id, l.id);
        var comparable = call != null && cs.length && (!scope || scope.indexOf(call) >= 0) && (layer.trained_on || []).indexOf(l.id) < 0;
        var agrees = comparable && cs.indexOf(call) >= 0;
        return h("li", { class: "sx-source-row", "data-layer": l.id }, [
          h("div", { class: "sx-source-head" }, [h("strong", { text: l.label }), badge(l.evidence_type)]),
          h("div", { class: "sx-source-val" }, [cs.length ? self.locationLine(x, l) : h("span", { class: "sx-muted", text: self.callText(x, l) }),
            comparable ? h("span", { class: "sx-verdict" + (agrees ? " sx-agree" : ""), text: agrees ? "same as the assignment" : "differs from the assignment" }) : null,
            x.score != null ? h("span", { class: "sx-mono", text: l.score.name + " = " + formatScore(x.score) }) : null])
        ].concat(self.attributeNodes(x, l)));
      });
      return rows.length ? h("ul", { class: "sx-sources" }, rows) : h("p", { class: "sx-muted", text: empty });
    };

    if (st.detailTab === "overview") {
      var assignment;
      if (!a) assignment = h("span", { class: "sx-muted", text: "Not detected in this experiment" });
      else if (call != null) assignment = h("span", { class: "sx-place", "data-sx": "loc" }, [this.dot(call), model.compById[call].label]);
      else assignment = h("span", { "data-sx": "loc" }, [h("span", { text: "No final call (published as “" + statusLabel(layer, a.status) + "”)" }),
        a.compartment != null ? h("div", { class: "sx-muted", "data-sx": "closest", text: "Closest class: " + model.compById[a.compartment].label + ". This is not an assignment." }) : null]);
      var mk = this.markerOf(e.id), isInput = !!this.training[e.id];
      var markerCell = !mk ? "No" : [h("span", { text: (isInput ? "Yes, used to train the classifier" : "Yes, not used for training") + " (" + calls(mk.assignment).map(function (c) { return model.compById[c].label; }).join(", ") + ")" })];
      var rows = [
        ["Protein group", [h("span", { class: "sx-mono", text: e.members[0].id + (e.members.length > 1 ? " +" + (e.members.length - 1) : "") }),
          document.createTextNode("  (" + plural(genes.length, "gene") + ")")], "group"],
        ["Assignment", assignment, "assignment"],
        a && a.score != null ? [shortLabel(layer) + " score", [h("span", { class: "sx-mono", "data-score": layer.id, title: layer.score.name + ". " + INTERPRETATION[layer.score.interpretation], text: formatScore(a.score) }),
          isInput ? h("div", { class: "sx-muted", "data-sx": "training-input", text: "Training marker: this class and score were given to the classifier, not predicted by it." }) : null], "score"] : null,
        ["Marker", markerCell, "marker"]
      ];
      (this.adapter.overviewRows ? this.adapter.overviewRows(e, this) || [] : []).forEach(function (r) { rows.push(r); });
      body.appendChild(kv(rows));
      if (genes.length > 1) body.appendChild(h("p", { class: "sx-note", "data-sx": "multi-gene-note", text: "This entry is a protein group covering " + genes.length + " genes. The measurement cannot be split between them, so the result applies to the group as a whole." }));
      genes.forEach(function (g) {
        var also = model.geneIndex[g].filter(function (x) { return x !== e.id; });
        if (also.length) body.appendChild(h("p", { class: "sx-muted", "data-sx": "also-in" }, [document.createTextNode(self.geneText(g) + " is also in: ")].concat(also.map(function (x) {
          return h("button", { type: "button", class: "sx-linkbtn", text: model.entityById[x].members[0].id, onclick: function () { self.set({ entity: x }); } });
        }))));
      });
      body.appendChild(h("div", { class: "sx-subhead" }, [h("h4", { text: "Fractionation profile" })]));
      body.appendChild(model.capabilities.profiles ? this.profileChart(e) : h("div", { class: "sx-empty sx-empty-small", "data-sx": "pending-profile" }, [
        h("strong", { text: "Fractionation profile not yet available" }),
        h("p", { text: this.options.profilePending || "This view needs the measured abundance of the protein across the fractions, which this dataset does not include yet. Nothing is drawn in its place." })]));
    } else if (st.detailTab === "spatial") {
      body.appendChild(h("h4", { text: layer.label }));
      body.appendChild(kv([
        ["Evidence", badge(layer.evidence_type)],
        ["Final call", a ? this.callText(a, layer) : "Not detected"],
        a && a.score != null ? [layer.score.name, h("span", { class: "sx-mono", text: formatScore(a.score) })] : null,
        layer.score ? ["About the score", h("span", { "data-sx": "score-note", text: INTERPRETATION[layer.score.interpretation] + " " + (layer.score.interpretation_basis || layer.score.description || "") })] : null,
        ["Method", (layer.method.name || "") + (layer.method.software ? ", " + layer.method.software : "")]
      ]));
      var fromAuthors = others.filter(function (l) { return l.source === "author"; });
      if (fromAuthors.length) { body.appendChild(h("h4", { "data-sx": "from-authors-head", text: "Reference sets in the publication" })); body.appendChild(h("div", { "data-sx": "from-authors" }, [sourceRows(fromAuthors, "Not in any reference set of the publication.")])); }
      if (e.mapping_note) body.appendChild(h("p", { class: "sx-muted", text: e.mapping_note }));
    } else if (st.detailTab === "annotations") {
      var elsewhere = others.filter(function (l) { return l.source !== "author"; });
      body.appendChild(h("div", { "data-sx": "elsewhere" }, [elsewhere.length ? sourceRows(elsewhere, "No location annotated in the compartments compared here.") : h("p", { class: "sx-muted", text: "No external annotations are loaded for this dataset." })]));
    } else {
      body.appendChild(h("table", { class: "sx-table", "data-sx": "members" }, [
        h("thead", {}, [h("tr", {}, [h("th", { text: "Protein" }), h("th", { text: "Gene" }), h("th", { text: "Description" })])]),
        h("tbody", {}, e.members.map(function (m) {
          return h("tr", {}, [h("td", { class: "sx-mono" }, [link(m.id, self.adapter.memberUrl && self.adapter.memberUrl(m.id))]),
            h("td", {}, [m.gene != null ? link(self.geneText(m.gene), self.adapter.geneUrl && self.adapter.geneUrl(m.gene)) : h("span", { class: "sx-muted", text: "no gene match" })]),
            h("td", { text: m.description || "" })]);
        }))
      ]));
      body.appendChild(h("p", { class: "sx-muted", text: "Sequences are not stored with this dataset. Each accession links to its sequence record." }));
    }
  };

  /* ----- bottom row: score distribution ----- */

  Explorer.prototype.renderScores = function () {
    var self = this, box = this.scoresPanel, info = this.layerInfo, layer = info.layer, training = this.training;
    box.textContent = "";
    box.appendChild(this.panelHead("Score distribution"));
    if (!layer.score) { box.appendChild(h("div", { class: "sx-empty sx-fill" }, [h("strong", { text: "No scores" }), h("p", { text: "This assignment source does not report a score." })])); return; }
    var rest = [], fed = [];
    this.model.entities.forEach(function (e) {
      if (!self.matchesFilter(e)) return;
      var a = info.map[e.id];
      if (!a || a.score == null) return;
      (training[e.id] ? fed : rest).push(a.score);
    });
    var all = rest.concat(fed);
    if (!all.length) { box.appendChild(h("div", { class: "sx-empty sx-fill" }, [h("strong", { text: "Nothing to plot" }), h("p", { text: "No scored protein groups match the current filter." })])); return; }
    var bins = 20, lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (lo >= 0 && hi <= 1) { lo = 0; hi = 1; }
    if (hi === lo) hi = lo + 1;
    var bin = function (v) { return Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins)); };
    var cr = new Array(bins).fill(0), cf = new Array(bins).fill(0);
    rest.forEach(function (v) { cr[bin(v)]++; });
    fed.forEach(function (v) { cf[bin(v)]++; });
    var top = 1;
    for (var i = 0; i < bins; i++) top = Math.max(top, cr[i] + cf[i]);
    var step = Math.pow(10, Math.floor(Math.log10(top))), nice = Math.ceil(top / step) * step;
    if (nice / step > 5 && step > 1) { step = step * 2; nice = Math.ceil(top / step) * step; }
    var W = 380, H = 240, pad = { l: 54, r: 14, t: 26, b: 44 }, bw = (W - pad.l - pad.r) / bins;
    var x = function (v) { return pad.l + (v - lo) / (hi - lo) * (W - pad.l - pad.r); };
    var y = function (n) { return H - pad.b - (n / nice) * (H - pad.t - pad.b); };
    var kids = [], ticks = Math.min(4, Math.round(nice / step));
    for (var t = 0; t <= ticks; t++) {
      var val = nice * t / ticks;
      kids.push(s("line", { x1: pad.l, x2: W - pad.r, y1: y(val), y2: y(val), class: t ? "sx-gridline" : "sx-axis" }));
      kids.push(svgText(pad.l - 8, y(val) + 4, Math.round(val).toLocaleString(), null, "end"));
    }
    kids.push(s("line", { x1: pad.l, x2: pad.l, y1: y(0), y2: pad.t - 6, class: "sx-axis" }));
    for (var k = 0; k <= 5; k++) kids.push(svgText(x(lo + (hi - lo) * k / 5), H - pad.b + 16, (lo + (hi - lo) * k / 5).toFixed(1)));
    kids.push(svgText((W + pad.l - pad.r) / 2, H - 6, shortLabel(layer) + " score (" + layer.score.name + ")", "sx-axis-title"));
    var yl = svgText(14, (H - pad.b + pad.t) / 2, "Number of protein groups", "sx-axis-title");
    yl.setAttribute("transform", "rotate(-90 14 " + ((H - pad.b + pad.t) / 2) + ")");
    kids.push(yl);
    for (var j = 0; j < bins; j++) {
      var a0 = lo + (hi - lo) * j / bins, a1 = lo + (hi - lo) * (j + 1) / bins, range = a0.toFixed(2) + " to " + a1.toFixed(2);
      if (cr[j]) { var r1 = s("rect", { x: pad.l + j * bw + 1, y: y(cr[j]), width: Math.max(1, bw - 2), height: y(0) - y(cr[j]), class: "sx-hist" }), t1 = s("title"); t1.textContent = cr[j] + " protein groups, score " + range; r1.appendChild(t1); kids.push(r1); }
      if (cf[j]) { var r2 = s("rect", { x: pad.l + j * bw + 1, y: y(cr[j] + cf[j]), width: Math.max(1, bw - 2), height: y(cr[j]) - y(cr[j] + cf[j]) - (cr[j] ? 1 : 0), class: "sx-hist sx-hist-train" }), t2 = s("title"); t2.textContent = cf[j] + " training markers, score " + range + ". Their class was supplied, not predicted."; r2.appendChild(t2); kids.push(r2); }
    }
    var sorted = rest.slice().sort(function (p, q) { return p - q; });
    if (sorted.length) {
      var med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      kids.push(s("line", { x1: x(med), x2: x(med), y1: pad.t - 4, y2: y(0), class: "sx-median" }));
      var ml = svgText(x(med), pad.t - 10, "Median: " + med.toFixed(2), "sx-median-label"); ml.setAttribute("data-sx", "median");
      var tt = s("title"); tt.textContent = "Median of the plotted scores" + (fed.length ? ", training markers left out" : "") + ". A description of the distribution, not a classification cutoff."; ml.appendChild(tt);
      kids.push(ml);
    }
    box.appendChild(h("div", { class: "sx-fill sx-chartwrap" }, [
      s("svg", { viewBox: "0 0 " + W + " " + H, class: "sx-chart", role: "img", "data-sx": "histogram", "aria-label": "Histogram of " + layer.score.name + " for " + all.length + " protein groups" }, kids),
      h("div", { class: "sx-legend sx-legend-inline", "data-sx": "score-legend" }, [
        h("span", {}, [h("i", { class: "sx-key-box" }), plural(rest.length, "protein group")]),
        fed.length ? h("span", { "data-sx": "training-note", title: "Their class and score were supplied to the classifier, not predicted by it." }, [h("i", { class: "sx-key-box sx-key-train" }), plural(fed.length, "training marker") + " (score supplied)"]) : null
      ])
    ]));
  };

  /* ----- bottom row: functional enrichment ----- */

  Explorer.prototype.enrichTarget = function () {
    var st = this.state, info = this.layerInfo;
    if (st.compartment) return { id: st.compartment, why: "selected compartment" };
    var a = info.map[st.entity], c = finalCall(a);
    return c ? { id: c, why: "compartment of the selected protein" } : null;
  };

  Explorer.prototype.loadEnrichment = function (tabId, compId) {
    var self = this, key = this.state.layer + "|" + tabId + "|" + compId;
    if (!this.enrichCache[key]) {
      var out;
      try { out = this.adapter.enrichment(this.context(compId), tabId, this); } catch (err) { out = Promise.reject(err); }
      this.enrichCache[key] = Promise.resolve(out).then(function (r) { return r || { terms: [] }; }, function (err) { delete self.enrichCache[key]; return { error: (err && err.message) || "failed", terms: [] }; });
    }
    return this.enrichCache[key];
  };

  Explorer.prototype.enrichTabs = function () {
    return this.adapter.enrichmentTabs || [{ id: "terms", label: "Terms" }];
  };

  Explorer.prototype.renderEnrichment = function () {
    var self = this, st = this.state, box = this.enrichPanel, model = this.model, tabs = this.enrichTabs();
    var tab = tabs.filter(function (t) { return t.id === st.enrichTab; })[0] || tabs[0];
    var target = this.enrichTarget(), token = this.enrichToken = {};
    box.textContent = "";
    box.appendChild(this.panelHead("Functional enrichment", target ? [h("span", { class: "sx-count", "data-sx": "enrich-target", title: target.why }, [this.dot(target.id), model.compById[target.id].label])] : null));
    box.appendChild(this.tabs("enrich-tabs", tabs, tab.id, function (id) { st.enrichTab = id; self.renderEnrichment(); }));
    var body = h("div", { class: "sx-fill sx-chartwrap", "data-sx": "enrich-body" });
    box.appendChild(body);
    var empty = function (title, text) { body.textContent = ""; body.appendChild(h("div", { class: "sx-empty sx-empty-small", "data-sx": "enrich-empty" }, [h("strong", { text: title }), h("p", { text: text })])); };
    if (!this.adapter.enrichment) return empty("Enrichment is not available", "This site does not provide a functional enrichment service for the dataset.");
    if (tab.unavailable) return empty(tab.label + " not available", tab.unavailable);
    if (!target) return empty("Choose a compartment", "Select a compartment, or a protein with a final call, to see the functions over-represented among its proteins.");
    body.appendChild(h("p", { class: "sx-muted", text: "Calculating…" }));
    this.loadEnrichment(tab.id, target.id).then(function (r) {
      if (self.enrichToken !== token) return;
      if (r.error) return empty("Enrichment could not be calculated", "The enrichment service did not answer. Try again in a moment.");
      var terms = (r.terms || []).slice(0, 10);
      if (!terms.length) return empty("No term stands out", r.summary || "No term is over-represented among these proteins.");
      body.textContent = "";
      var W = 430, rowH = 18, pad = { l: 186, r: 14, t: 6, b: 34 }, H = pad.t + terms.length * rowH + pad.b;
      var val = function (t) { return t.q > 0 ? -Math.log10(t.q) : 320; }, max = Math.max.apply(null, terms.map(val));
      var step = max > 100 ? 50 : max > 40 ? 20 : max > 20 ? 10 : max > 8 ? 5 : 2, top = Math.ceil(max / step) * step;
      var x = function (v) { return pad.l + v / top * (W - pad.l - pad.r); }, kids = [];
      for (var v = 0; v <= top; v += step) {
        kids.push(s("line", { x1: x(v), x2: x(v), y1: pad.t, y2: H - pad.b, class: v ? "sx-gridline" : "sx-axis" }));
        kids.push(svgText(x(v), H - pad.b + 14, String(v)));
      }
      kids.push(svgText((W + pad.l - pad.r) / 2, H - 4, "−log10(FDR)", "sx-axis-title"));
      terms.forEach(function (t, i) {
        var yy = pad.t + i * rowH, name = t.name.length > 30 ? t.name.slice(0, 29) + "…" : t.name;
        var label = svgText(pad.l - 8, yy + rowH / 2 + 4, name, "sx-bar-label", "end"), lt = s("title"); lt.textContent = t.name + " (" + t.id + ")"; label.appendChild(lt);
        var bar = s("rect", { x: pad.l, y: yy + 3, width: Math.max(1, x(val(t)) - pad.l), height: rowH - 6, rx: 1, class: "sx-bar-rect", "data-term": t.id }), bt = s("title");
        bt.textContent = t.name + ": " + t.count + " of " + t.n + " protein groups here, FDR " + t.q.toExponential(1) + (t.fold != null ? ", " + t.fold + " times the expected share" : "");
        bar.appendChild(bt);
        kids.push(label, bar);
      });
      body.appendChild(s("svg", { viewBox: "0 0 " + W + " " + H, class: "sx-chart sx-barchart", role: "img", "data-sx": "enrich-chart", "aria-label": "Most over-represented terms for " + model.compById[target.id].label }, kids));
      body.appendChild(h("p", { class: "sx-caption", "data-sx": "enrich-summary", title: r.summary || null }, [
        h("button", { type: "button", class: "sx-linkbtn", "data-sx": "enrich-more", text: "All " + r.terms.length + " terms and method", onclick: function () { self.go({ mode: "enrichment" }); } }),
        document.createTextNode(" " + (r.summary || ""))]));
    });
  };

  Explorer.prototype.enrichmentView = function () {
    var self = this, st = this.state, model = this.model, target = this.enrichTarget(), tabs = this.enrichTabs();
    var tab = tabs.filter(function (t) { return t.id === st.enrichTab; })[0] || tabs[0];
    var body = h("div", { class: "sx-scroll sx-fill sx-pad", "data-sx": "enrich-full" });
    var say = function (title, text) { body.textContent = ""; body.appendChild(h("div", { class: "sx-empty" }, [h("strong", { text: title }), h("p", { text: text })])); };
    if (!this.adapter.enrichment) say("Enrichment is not available", "This site does not provide a functional enrichment service for the dataset.");
    else if (tab.unavailable) say(tab.label + " not available", tab.unavailable);
    else if (!target) say("Choose a compartment", "Use the compartment filter, or select a protein with a final call.");
    else {
      body.appendChild(h("p", { class: "sx-muted", text: "Calculating…" }));
      var token = this.enrichFullToken = {};
      this.loadEnrichment(tab.id, target.id).then(function (r) {
        if (self.enrichFullToken !== token || !body.isConnected) return;
        if (r.error) return say("Enrichment could not be calculated", "The enrichment service did not answer.");
        body.textContent = "";
        if (r.summary) body.appendChild(h("p", { "data-sx": "enrich-full-summary", text: r.summary }));
        if (r.method) body.appendChild(h("p", { class: "sx-muted", text: r.method }));
        if (!r.terms.length) { body.appendChild(h("p", { text: "No term is over-represented." })); return; }
        body.appendChild(h("table", { class: "sx-table" }, [
          h("thead", {}, [h("tr", {}, ["Term", "Kind", "Here", "Detected", "Fold", "FDR"].map(function (t) { return h("th", { text: t }); }))]),
          h("tbody", {}, r.terms.slice(0, 200).map(function (t) {
            return h("tr", {}, [h("td", {}, [link(t.name, t.url), h("div", { class: "sx-mono sx-muted", text: t.id })]), h("td", { text: t.kind || "" }),
              h("td", { text: t.count + " / " + t.n }), h("td", { text: t.background != null ? t.background + " / " + t.backgroundN : "" }),
              h("td", { text: t.fold == null ? "" : String(t.fold) }), h("td", { text: t.q.toExponential(1) })]);
          }))
        ]));
      });
    }
    return [this.panelHead("Enrichment analysis", target ? [h("span", { class: "sx-count" }, [this.dot(target.id), model.compById[target.id].label])] : null),
      this.tabs("enrich-tabs-full", tabs, tab.id, function (id) { self.set({ enrichTab: id }); }), body];
  };

  /* ----- data and methods ----- */

  Explorer.prototype.methodsView = function () {
    var self = this, model = this.model, ds = model.bundle.dataset, st = this.state, info = this.layerInfo, m = ds.mapping, cap = model.capabilities;
    var computational = model.layers.filter(function (l) { return l.evidence_type === "computational_assignment"; });
    var evidence = EVIDENCE_ORDER.map(function (ev) {
      var items;
      if (ev === "measured_profile") {
        items = [cap.profiles ? Object.keys(model.bundle.profiles.values).length + " profiles across " + model.bundle.fractions.length + " fractions, " + SOURCE[model.bundle.profiles.source] + "." : cap.reasons.profiles];
        cap.embeddings.forEach(function (id) { var x = model.embeddingById[id]; items.push("Map: " + x.label + " (" + x.method.name + ", " + SOURCE[x.source] + ")."); });
        if (!cap.embeddings.length) items.push(cap.reasons.embeddings);
      } else {
        items = model.layers.filter(function (l) { return l.evidence_type === ev; }).map(function (l) {
          return l.label + ": " + plural(Object.keys(model.byLayer[l.id]).length, "protein group") + ", " + SOURCE[l.source] + ". " + (l.method.description || l.method.name) + (l.description ? " " + l.description : "");
        });
        if (!items.length) items = ["None in this dataset."];
      }
      return h("div", { class: "sx-ev-row", "data-evidence": ev }, [h("div", {}, [badge(ev)]),
        h("div", {}, [h("p", { class: "sx-muted", text: EVIDENCE[ev].text }), h("ul", {}, items.map(function (t) { return h("li", { text: t }); }))])]);
    });
    var kids = [
      (ds.notices || []).length ? h("ul", { class: "sx-notices", "data-sx": "notices" }, ds.notices.map(function (t) { return h("li", { text: t }); })) : null,
      ds.description ? h("p", { text: ds.description }) : null,
      h("h4", { "data-sx": "help", text: "How to use this page" }),
      h("ul", {}, ["Search for a gene or protein in the sidebar to see where it was found.", "Filter by compartment, or select a compartment in the legend or table, to list its proteins and its enriched functions.",
        "Use Show in map to restrict lists and charts to assigned proteins, markers, or proteins without a final call.", "Select a protein in any list to see its details on the right."].map(function (t) { return h("li", { text: t }); })),
      h("h4", { "data-sx": "citation", text: "How to cite" }),
      h("p", { class: "sx-cite" }, [document.createTextNode(ds.citation.text + " "), ds.citation.url ? link("Publication", ds.citation.url) : null]),
      h("p", { "data-sx": "license" }, [document.createTextNode("License: "), link(ds.license.name || ds.license.id, ds.license.url), document.createTextNode(". " + ds.attribution)]),
      h("h4", { text: "Kinds of evidence" }),
      h("div", { "data-sx": "evidence" }, evidence),
      computational.length > 1 ? h("label", { class: "sx-inline" }, [h("span", { text: "Assignments shown in the explorer" }),
        h("select", { "data-sx": "layer-select", onchange: function () { self.enrichCache = {}; self.go({ layer: this.value, compare: null, compartment: null, show: "all" }); } },
          computational.map(function (l) { return h("option", { value: l.id, text: l.label, selected: l.id === st.layer }); }))]) : null,
      h("h4", { text: "Agreement between evidence sources" }),
      this.concordancePanel(info.layer),
      h("h4", { text: "Identifiers and provenance" }),
      h("p", { "data-sx": "mapping", text: m.entities_total + " protein groups: " + m.entities_mapped + " fully mapped to genes, " + m.entities_partial + " partly mapped, " +
        m.entities_unmapped + " unmapped. " + m.entities_multi_gene + " groups span more than one gene. " + m.genes_total + " genes in total. Method: " + m.method }),
      m.notes ? h("p", { class: "sx-muted", text: m.notes }) : null,
      h("div", { "data-sx": "provenance" }, [
        h("p", { text: "Built " + ds.provenance.built + " by " + ds.provenance.builder + "." }),
        h("ul", {}, ds.provenance.sources.map(function (src) { return h("li", { text: src.name + ": " + (src.description || "") + (src.sha256 ? " (sha256 " + src.sha256.slice(0, 12) + ")" : "") }); })),
        h("ol", {}, ds.provenance.steps.map(function (t) { return h("li", { text: t }); }))
      ]),
      h("h4", { text: "Compartment names" }),
      h("ul", { "data-sx": "vocabulary" }, model.compartments.map(function (c) {
        return h("li", { text: c.label + (c.ontology_id ? " = " + c.ontology_id : " (no ontology term)") + (c.ontology_note ? ". " + c.ontology_note : "") + (c.description ? " " + c.description : "") });
      }))
    ];
    return [this.panelHead("Data and methods"), h("div", { class: "sx-scroll sx-fill sx-pad sx-methods", "data-sx": "about" }, kids)];
  };

  Explorer.prototype.geneText = function (g) {
    return (this.adapter.geneLabel && this.adapter.geneLabel(g)) || g;
  };

  Explorer.prototype.entityTitle = function (e) {
    var self = this, genes = entityGenes(e);
    if (!genes.length) return e.label || e.members[0].id;
    var names = genes.slice(0, 2).map(function (g) { return self.geneText(g); }).join(", ");
    return names + (genes.length > 2 ? " +" + (genes.length - 2) : "");
  };

  // A host that curates gene names is the better source for a description
  // than the accession's own product text.
  Explorer.prototype.entityDescription = function (e) {
    var genes = entityGenes(e);
    if (e.label && genes.length) return e.label;
    var hosted = genes.length && this.adapter.geneName ? this.adapter.geneName(genes[0]) : "";
    return hosted || e.members[0].description || "";
  };

  Explorer.prototype.dot = function (compId, hollow) {
    var color = this.color(compId);
    return h("span", { class: "sx-dot" + (hollow ? " sx-dot-hollow" : ""), style: hollow ? "border-color:" + color : "background:" + color, "aria-hidden": "true" });
  };

  // Ranked matches: exact gene name, exact identifier, then prefixes, then text.
  Explorer.prototype.matches = function (query) {
    var q = (query || "").trim().toLowerCase(), self = this, model = this.model;
    if (q.length < 2) return [];
    if (!this.index) {
      this.index = model.entities.map(function (e) {
        var names = entityGenes(e).map(function (g) { return String(self.geneText(g)).toLowerCase(); });
        var ids = [e.id.toLowerCase()];
        e.members.forEach(function (m) { ids.push(m.id.toLowerCase()); if (m.gene != null) ids.push(String(m.gene).toLowerCase()); });
        return { e: e, names: names, ids: ids, blob: model.blobs[e.id] || (model.blobs[e.id] = searchBlob(e, self.adapter)) };
      });
    }
    var bare = q.replace(/\.\d+$/, "");
    var hits = [];
    this.index.forEach(function (row, i) {
      var rank = 9;
      if (row.names.indexOf(q) >= 0) rank = 0;
      else if (row.ids.indexOf(q) >= 0 || row.ids.some(function (x) { return x.replace(/\.\d+$/, "") === bare; })) rank = 1;
      else if (row.names.some(function (x) { return x.indexOf(q) === 0; })) rank = 2;
      else if (row.ids.some(function (x) { return x.indexOf(q) === 0; })) rank = 3;
      else if (row.blob.indexOf(q) >= 0) rank = 4;
      if (rank < 9) hits.push({ e: row.e, rank: rank, i: i });
    });
    hits.sort(function (a, b) { return a.rank - b.rank || a.i - b.i; });
    return hits;
  };

  Explorer.prototype.closeSuggestions = function () {
    this.suggestBox.hidden = true;
    this.suggestBox.textContent = "";
    this.search.setAttribute("aria-expanded", "false");
    this.search.removeAttribute("aria-activedescendant");
    this.active = -1;
  };

  Explorer.prototype.renderSuggestions = function () {
    var self = this, hits = this.matches(this.search.value), q = this.search.value.trim();
    this.suggestions = hits.slice(0, 8);
    this.active = -1;
    this.suggestBox.textContent = "";
    if (q.length < 2) { this.closeSuggestions(); return; }
    this.suggestBox.hidden = false;
    this.search.setAttribute("aria-expanded", "true");
    if (!hits.length) {
      this.suggestBox.appendChild(h("li", { class: "sx-suggest-none", role: "option", "aria-disabled": "true", text: "No protein matches “" + q + "”." }));
      return;
    }
    this.suggestions.forEach(function (hit, i) {
      var e = hit.e, a = (self.model.byLayer[self.state.layer] || {})[e.id], call = finalCall(a);
      self.suggestBox.appendChild(h("li", { id: "sx-opt-" + i, role: "option", "data-entity": e.id, class: "sx-suggest",
        onmousedown: function (ev) { ev.preventDefault(); self.pick(e); } }, [
        h("span", { class: "sx-suggest-main" }, [h("strong", { text: self.entityTitle(e) }), h("span", { class: "sx-muted", text: " " + self.entityDescription(e) })]),
        h("span", { class: "sx-suggest-loc" }, call != null ? [self.dot(call), self.model.compById[call].label] : [a ? "No final call" : "Not detected"])
      ]));
    });
    if (hits.length > this.suggestions.length) {
      this.suggestBox.appendChild(h("li", { class: "sx-suggest sx-suggest-all", role: "option", id: "sx-opt-all", "data-sx": "all-results",
        onmousedown: function (ev) { ev.preventDefault(); self.showResults(); } }, ["See all " + hits.length.toLocaleString() + " matches"]));
    }
  };

  Explorer.prototype.pick = function (entity) {
    this.closeSuggestions();
    this.set({ entity: entity.id });
  };

  Explorer.prototype.searchKey = function (ev) {
    var options = this.suggestBox.querySelectorAll(".sx-suggest"), n = options.length;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!n) return;
      ev.preventDefault();
      this.active = (this.active + (ev.key === "ArrowDown" ? 1 : -1) + n + (this.active < 0 && ev.key === "ArrowUp" ? 1 : 0)) % n;
      Array.prototype.forEach.call(options, function (o, i) { o.classList.toggle("sx-on", i === this.active); }, this);
      this.search.setAttribute("aria-activedescendant", options[this.active].id);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      var hits = this.matches(this.search.value);
      if (this.active >= 0 && options[this.active]) {
        if (options[this.active].id === "sx-opt-all") this.showResults(); else this.pick(this.suggestions[this.active].e);
      } else if (hits.length === 1 || (hits.length > 1 && hits[0].rank <= 1 && hits[1].rank > 1)) this.pick(hits[0].e);
      else if (hits.length) this.showResults();
    } else if (ev.key === "Escape") this.closeSuggestions();
  };

  Explorer.prototype.color = function (compId) {
    var slot = this.model.colors[compId];
    return slot ? cssVar(this.el, "--sx-c" + slot, "#888") : cssVar(this.el, "--sx-neutral", "#9a9993");
  };

  Explorer.prototype.panel = function (name, title, layerOrEvidence, kids) {
    var ev = typeof layerOrEvidence === "string" ? layerOrEvidence : layerOrEvidence && layerOrEvidence.evidence_type;
    return h("section", { class: "sx-panel", "data-sx": name }, [
      h("h3", {}, [document.createTextNode(title + " "), ev ? badge(ev) : null])
    ].concat(kids));
  };

  Explorer.prototype.drawMap = function () {
    var model = this.model, st = this.state, canvas = this.canvas;
    if (!canvas || !model.capabilities.embeddings.length || !canvas.isConnected) { this.points = null; return; }
    var emb = model.embeddingById[st.embedding], map = model.byLayer[st.layer] || {};
    var w = canvas.clientWidth || 600, hgt = canvas.clientHeight || 340;   // sized by the stylesheet
    var dpr = root.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var ids = Object.keys(emb.coordinates), xs = [], ys = [];
    ids.forEach(function (id) { xs.push(emb.coordinates[id][0]); ys.push(emb.coordinates[id][1]); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var pad = { l: 16, r: 16, t: 12, b: 26 };
    var sx = function (v) { return pad.l + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * (w - pad.l - pad.r); };
    var sy = function (v) { return hgt - pad.b - (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0)) * (hgt - pad.t - pad.b); };
    var r = (ids.length > 1500 ? 2.5 : 4) * ({ small: 0.7, large: 1.4 }[st.pointSize] || 1);
    var neutral = cssVar(this.el, "--sx-neutral", "#9a9993"), surface = cssVar(this.el, "--sx-surface", "#fff"),
        ink = cssVar(this.el, "--sx-ink", "#111"), muted = cssVar(this.el, "--sx-muted", "#777");
    var inFilter = {};
    this.filtered.forEach(function (e) { inFilter[e.id] = true; });
    var filtering = this.filtered.length !== model.entities.length;
    var self = this, points = [];
    ids.forEach(function (id, i) {
      var call = finalCall(map[id]);
      var focus = st.compartment && call === st.compartment;
      points.push({ id: id, x: sx(xs[i]), y: sy(ys[i]), call: call, focus: focus,
        dim: filtering && !inFilter[id],
        color: call == null ? neutral : (focus && !model.colors[call] ? ink : self.color(call)) });
    });
    ctx.clearRect(0, 0, w, hgt);
    var pass = function (test, alpha) {
      ctx.globalAlpha = alpha;
      points.forEach(function (p) {
        if (!test(p)) return;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
      });
    };
    pass(function (p) { return p.dim; }, 0.18);
    pass(function (p) { return !p.dim && p.call == null; }, 0.55);
    pass(function (p) { return !p.dim && p.call != null; }, 0.9);
    ctx.globalAlpha = 1;
    var sel = points.filter(function (p) { return p.id === st.entity; })[0];
    if (sel) {
      ctx.beginPath(); ctx.arc(sel.x, sel.y, r + 4, 0, Math.PI * 2); ctx.fillStyle = surface; ctx.fill();
      ctx.beginPath(); ctx.arc(sel.x, sel.y, r + 2, 0, Math.PI * 2); ctx.fillStyle = sel.color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
    }
    ctx.fillStyle = muted; ctx.font = "12px system-ui, sans-serif";
    var axes = emb.axes || ["Dimension 1", "Dimension 2"];
    ctx.textAlign = "right"; ctx.fillText(axes[0] + " →", w - pad.r, hgt - 8);
    ctx.textAlign = "left"; ctx.fillText("↑ " + axes[1], pad.l, hgt - 8);
    this.points = points; this.pointRadius = r;
  };

  Explorer.prototype.nearest = function (ev) {
    if (!this.points) return null;
    var rect = this.canvas.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var best = null, bd = Math.pow(this.pointRadius + 8, 2);
    this.points.forEach(function (p) {
      var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  };

  Explorer.prototype.hoverMap = function (ev) {
    var p = this.nearest(ev), model = this.model, self = this;
    this.canvas.style.cursor = p ? "pointer" : "default";
    if (!p) { this.tip.hidden = true; return; }
    var e = model.entityById[p.id], a = (model.byLayer[this.state.layer] || {})[p.id];
    this.tip.textContent = "";
    this.tip.appendChild(h("strong", { text: e.label || e.members[0].id + (e.members.length > 1 ? " +" + (e.members.length - 1) : "") }));
    var genes = entityGenes(e);
    this.tip.appendChild(h("div", { text: genes.length ? genes.map(function (g) { return self.geneText(g); }).join(", ") : "No gene mapping" }));
    this.tip.appendChild(h("div", { text: this.callText(a) }));
    var host = this.el.getBoundingClientRect();
    this.tip.hidden = false;
    this.tip.style.left = Math.min(ev.clientX - host.left + 14, host.width - this.tip.offsetWidth - 4) + "px";
    this.tip.style.top = (ev.clientY - host.top + 14) + "px";
  };

  Explorer.prototype.callText = function (a, layer) {
    if (!a) return "Not in this layer";
    var model = this.model;
    layer = layer || model.layerById[this.state.layer];
    if (a.status === "assigned") return calls(a).map(function (c) { return model.compById[c].label; }).join(", ");
    var word = statusLabel(layer, a.status);
    return a.compartment != null ? word + " (method named " + model.compById[a.compartment].label + ")" : word;
  };

  Explorer.prototype.concordancePanel = function (layer) {
    var self = this, model = this.model, st = this.state;
    var others = model.layers.filter(function (l) { return l.id !== layer.id; });
    if (!others.length) return null;
    // default to a layer that was not an input to this one, so the first
    // comparison a reader sees is never a circular one
    var independent = others.filter(function (l) { return (layer.trained_on || []).indexOf(l.id) < 0 && (l.trained_on || []).indexOf(layer.id) < 0; });
    var other = model.layerById[st.compare] && st.compare !== layer.id ? model.layerById[st.compare] : (independent[0] || others[0]);
    var related = (layer.trained_on || []).indexOf(other.id) >= 0 || (other.trained_on || []).indexOf(layer.id) >= 0;
    var skip = (layer.trained_on || []).indexOf(other.id) < 0 && Object.keys(this.training).length ? this.training : null;
    var c = concordance(model, layer.id, other.id, skip);
    var outside = c.scope ? model.compartments.filter(function (k) { return c.scope.indexOf(k.id) < 0; }).map(function (k) { return k.label; }) : [];
    var rowIds = model.compartments.filter(function (k) { return c.table[k.id]; });
    var colIds = model.compartments.filter(function (k) { return rowIds.some(function (r) { return c.table[r.id][k.id]; }); });
    var max = 1;
    rowIds.forEach(function (r) { colIds.forEach(function (k) { max = Math.max(max, c.table[r.id][k.id] || 0); }); });
    var table = c.both ? h("div", { class: "sx-scroll" }, [h("table", { class: "sx-matrix" }, [
      h("thead", {}, [h("tr", {}, [h("th", { text: layer.label + " ↓ / " + other.label + " →" })].concat(colIds.map(function (k) { return h("th", { text: k.label }); })))]),
      h("tbody", {}, rowIds.map(function (r) {
        return h("tr", {}, [h("th", { text: r.label })].concat(colIds.map(function (k) {
          var n = c.table[r.id][k.id] || 0;
          return h("td", { class: r.id === k.id ? "sx-diag" : null, style: n ? "background:color-mix(in srgb, var(--sx-seq) " + Math.round(12 + 68 * n / max) + "%, transparent)" : null, text: n ? String(n) : "" });
        })));
      }))
    ])]) : null;
    return this.panel("concordance", "Agreement between layers", null, [
      h("label", { class: "sx-inline" }, [h("span", { text: "Compare with" }), h("select", { "data-sx": "compare-select", onchange: function () { self.set({ compare: this.value }); } },
        others.map(function (l) { return h("option", { value: l.id, text: l.label + " (" + EVIDENCE[l.evidence_type].label + ")", selected: l.id === other.id }); }))]),
      other.method.description ? h("p", { class: "sx-muted", "data-sx": "compare-about", text: other.label + ": " + other.method.description }) : null,
      related ? h("p", { class: "sx-notice", "data-sx": "training-warning", text: "These layers are not independent: one was used to train the other. Agreement here is expected and is not validation." }) : null,
      h("p", { "data-sx": "concordance-summary", text: c.shared + " protein groups appear in both layers. " + c.both + " have a call in both, and " + c.agree + " of those agree." }),
      c.skipped ? h("p", { class: "sx-muted", "data-sx": "concordance-skipped", text: c.skipped + " protein groups that were training inputs to " + layer.label + " are left out of this comparison." }) : null,
      c.scope ? h("p", { class: "sx-muted", "data-sx": "concordance-scope", text: "Compared within the " + c.scope.length + " compartments both layers can name." +
        (outside.length ? " Calls to these compartments are left out, not counted as disagreement: " + outside.join(", ") + "." : "") }) : null,
      table,
      h("p", { class: "sx-muted", text: "The two layers are different kinds of evidence (" + EVIDENCE[layer.evidence_type].label + " and " + EVIDENCE[other.evidence_type].label + "). Agreement is counted, never merged." })
    ]);
  };

  Explorer.prototype.exportTSV = function () {
    var text = toTSV(this.model, this.filtered, this.adapter);
    if (this.options.onExport) return this.options.onExport(text);
    var url = URL.createObjectURL(new Blob([text], { type: "text/tab-separated-values" }));
    var a = h("a", { href: url, download: this.model.bundle.dataset.id + ".tsv" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  Explorer.prototype.profileChart = function (entity) {
    var model = this.model, st = this.state, fr = model.bundle.fractions, vec = model.bundle.profiles.values[entity.id];
    if (!vec) return h("p", { class: "sx-muted", text: "No profile was measured for this protein group." });
    var a = (model.byLayer[st.layer] || {})[entity.id], call = finalCall(a), peers = [], med = null;
    if (call != null) {
      var map = model.byLayer[st.layer];
      Object.keys(map).forEach(function (id) { if (id !== entity.id && finalCall(map[id]) === call) peers.push(id); });
      if (peers.length) med = medianProfile(model, peers);
    }
    var all = vec.concat(med || []).filter(function (v) { return v != null; });
    var top = Math.max.apply(null, all) || 1, W = 520, H = 190, pad = { l: 40, r: 12, t: 12, b: 44 };
    var x = function (i) { return pad.l + (fr.length === 1 ? 0.5 : i / (fr.length - 1)) * (W - pad.l - pad.r); };
    var y = function (v) { return H - pad.b - (v / top) * (H - pad.t - pad.b); };
    var path = function (values) {
      var d = "", pen = false;
      values.forEach(function (v, i) { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); pen = true; });
      return d;
    };
    var kids = [
      s("line", { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: "sx-axis" }),
      s("line", { x1: pad.l, x2: W - pad.r, y1: y(top), y2: y(top), class: "sx-gridline" }),
      svgText(pad.l - 6, y(0) + 4, "0", null, "end"), svgText(pad.l - 6, y(top) + 4, formatScore(+top.toPrecision(3)), null, "end")
    ];
    var step = Math.ceil(fr.length / 12);
    fr.forEach(function (f, i) {
      if (i % step === 0) kids.push(svgText(x(i), H - pad.b + 16, f.label.length > 9 ? f.id : f.label));
      if (i && f.condition !== fr[i - 1].condition) kids.push(s("line", { x1: (x(i) + x(i - 1)) / 2, x2: (x(i) + x(i - 1)) / 2, y1: pad.t, y2: y(0), class: "sx-gridline" }));
    });
    if (model.bundle.profiles.unit) kids.push(svgText(pad.l, H - 4, model.bundle.profiles.unit, null, "start"));
    if (med) kids.push(s("path", { d: path(med), class: "sx-line sx-line-ref" }));
    kids.push(s("path", { d: path(vec), class: "sx-line sx-line-main" }));
    vec.forEach(function (v, i) {
      if (v == null) return;
      var dot = s("circle", { cx: x(i), cy: y(v), r: 4, class: "sx-dot" }), t = s("title");
      t.textContent = fr[i].label + ": " + formatScore(v) + (med && med[i] != null ? " (compartment median " + formatScore(+med[i].toPrecision(4)) + ")" : "");
      dot.appendChild(t); kids.push(dot);
    });
    var missing = vec.filter(function (v) { return v == null; }).length;
    return h("div", {}, [
      h("div", { class: "sx-legend" }, [
        h("span", {}, [h("i", { class: "sx-key sx-key-main" }), document.createTextNode("This protein group")]),
        med ? h("span", {}, [h("i", { class: "sx-key sx-key-ref" }), document.createTextNode("Median of " + peers.length + " others assigned to " + model.compById[call].label)]) : null
      ]),
      s("svg", { viewBox: "0 0 " + W + " " + H, class: "sx-chart", role: "img", "data-sx": "profile-chart", "aria-label": "Measured profile across fractions" }, kids),
      missing ? h("p", { class: "sx-muted", text: missing + " fraction(s) have no measurement and are left as gaps." }) : null
    ]);
  };

  Explorer.prototype.locationLine = function (a, layer) {
    var self = this, model = this.model;
    return h("span", { class: "sx-places" }, calls(a).map(function (c) {
      return h("span", { class: "sx-place" }, [self.dot(c), model.compById[c].label]);
    }));
  };

  Explorer.prototype.attributeNodes = function (a, layer) {
    var out = [], attrs = a.attributes || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k], label = (layer.attribute_labels || {})[k] || k;
      if (typeof v === "string" && v.indexOf("; ") >= 0) {
        out.push(h("div", { class: "sx-attr" }, [h("span", { class: "sx-attr-k", text: label }), h("ul", { class: "sx-terms" }, v.split("; ").map(function (t) { return h("li", { text: t }); }))]));
      } else {
        out.push(h("div", { class: "sx-attr" }, [h("span", { class: "sx-attr-k", text: label }), h("span", { text: v === true ? "yes" : v === false ? "no" : String(v) })]));
      }
    });
    return out;
  };

  Explorer.prototype.addLayers = function (layers) {
    var self = this, added = 0;
    (layers || []).forEach(function (layer) {
      var problem = validLayer(layer, self.model);
      if (problem) { if (root.console) root.console.warn("SpatialExplorer: ignored extra layer, " + problem); return; }
      var dropped = indexLayer(self.model, layer);
      if (dropped && root.console) root.console.warn("SpatialExplorer: layer " + layer.id + ": " + dropped + " assignments referenced unknown ids and were ignored");
      added++;
    });
    if (added) this.render();
    return added;
  };

  // What a host panel needs to describe one compartment: its assigned protein
  // groups, the genes usable for an enrichment test, and the matching background.
  Explorer.prototype.context = function (compId) {
    var model = this.model, st = this.state, map = model.byLayer[st.layer] || {};
    compId = compId || st.compartment;
    var ids = Object.keys(map).filter(function (id) { return compId ? calls(map[id]).indexOf(compId) >= 0 : map[id].status === "assigned"; });
    var genes = {};
    ids.forEach(function (id) { entityGenes(model.entityById[id]).forEach(function (g) { genes[g] = true; }); });
    return { genes: Object.keys(genes).sort(), backgroundGenes: detectedGenes(model), entities: ids,
             study: studyGenes(model, ids), studyBackground: detectedGenes(model, true),
             layer: st.layer, layerLabel: model.layerById[st.layer].label,
             compartment: compId, compartmentLabel: compId ? model.compById[compId].label : null,
             view: st.view, dataset: model.bundle.dataset.id };
  };

  Explorer.prototype.markSelected = function () {
    var id = this.state.entity;
    Array.prototype.forEach.call(this.main.querySelectorAll("tr[data-entity]"), function (tr) {
      tr.classList.toggle("sx-row-on", tr.getAttribute("data-entity") === id);
    });
  };

  /* ---------- entry point ---------- */

  function mount(el, options) {
    options = options || {};
    var adapter = options.adapter || {};
    if (!el || !el.appendChild) return Promise.reject(new Error("SpatialExplorer.mount needs an element"));
    var loading = options.bundle ? Promise.resolve(options.bundle) : fetch(options.bundleUrl).then(function (r) {
      if (!r.ok) throw new Error("could not load bundle (" + r.status + ")");
      return r.json();
    });
    return loading.then(function (bundle) {
      var problems = checkBundle(bundle);
      if (problems.length) throw new Error("not a usable bundle: " + problems.join("; "));
      var explorer = new Explorer(el, indexBundle(bundle), adapter, options);
      if (!adapter.extraLayers) return explorer;
      return Promise.resolve().then(function () { return adapter.extraLayers(bundle); }).then(function (layers) {
        explorer.addLayers(layers);
        return explorer;
      }, function (err) {
        if (root.console) root.console.warn("SpatialExplorer: extra layers unavailable", err);
        return explorer;
      });
    }).catch(function (err) {
      el.textContent = "";
      el.appendChild(h("p", { class: "sx-error", role: "alert", text: "Spatial proteomics data could not be shown: " + err.message }));
      throw err;
    });
  }

  root.SpatialExplorer = {
    version: VERSION,
    mount: mount,
    EVIDENCE: EVIDENCE,
    core: {
      checkBundle: checkBundle, indexBundle: indexBundle, capabilities: capabilities, entityGenes: entityGenes,
      mappingStatus: mappingStatus, finalCall: finalCall, calls: calls, statusLabel: statusLabel, formatScore: formatScore,
      layerCounts: layerCounts, sharedScope: sharedScope, trainingSet: trainingSet, concordance: concordance,
      histogram: histogram, detectedGenes: detectedGenes, studyGenes: studyGenes, geneSummary: geneSummary,
      filterEntities: filterEntities, sortEntities: sortEntities, toTSV: toTSV, medianProfile: medianProfile
    }
  };
})(typeof window !== "undefined" ? window : this);
