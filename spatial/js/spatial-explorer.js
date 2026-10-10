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

  /* ---------- the explorer ---------- */

  var PAGE = 50;
  var NAV_RESET = { filter: "", shown: PAGE, sort: null, facet: null, named: null, includeOther: false, gene: null };

  function shortLabel(layer) { return layer.short_label || layer.label; }
  function plural(n, word) { return n.toLocaleString() + " " + word + (n === 1 ? "" : "s"); }

  function Explorer(el, model, adapter, options) {
    this.el = el;
    this.model = model;
    this.adapter = adapter;
    this.options = options;
    this.panelCache = {};
    var first = model.layers.filter(function (l) { return l.evidence_type === "computational_assignment"; })[0] || model.layers[0];
    var init = options.initial || {};
    var st = this.state = {
      layer: model.layerById[init.layer] ? init.layer : (first ? first.id : null),
      view: "home", compartment: null, entity: null, query: "", gene: null,
      filter: "", shown: PAGE, sort: null, facet: null, named: null, includeOther: false,
      embedding: model.capabilities.embeddings[0] || null, compare: null
    };
    if (model.compById[init.compartment]) { st.view = "compartment"; st.compartment = init.compartment; }
    else if (init.view === "unassigned") st.view = "unassigned";
    if (model.entityById[init.entity]) st.entity = init.entity;
    else if (init.gene && model.geneIndex[init.gene]) {
      st.entity = model.geneIndex[init.gene][0];
      if (model.geneIndex[init.gene].length > 1) { st.view = "search"; st.gene = init.gene; }
    }
    this.build();
  }

  Explorer.prototype.set = function (patch) {
    var st = this.state, keys = Object.keys(patch), before = st.entity;
    keys.forEach(function (k) { st[k] = patch[k]; });
    if (keys.length === 1 && keys[0] === "entity") {
      this.markSelected();
      this.renderDrawer(before == null);
      this.drawMap();
    } else this.render();
    if (keys.indexOf("entity") >= 0 && this.options.onSelect) this.options.onSelect(st.entity, this);
    if (this.options.onState) this.options.onState({ view: st.view, compartment: st.compartment, entity: st.entity, gene: st.gene, query: st.query, layer: st.layer }, this);
  };

  // Move to another view, clearing list filters that belonged to the old one.
  Explorer.prototype.go = function (patch) {
    var full = {}, k;
    for (k in NAV_RESET) full[k] = NAV_RESET[k];
    for (k in patch) full[k] = patch[k];
    this.set(full);
  };

  Explorer.prototype.home = function () { this.go({ view: "home", compartment: null, query: "" }); };
  Explorer.prototype.showCompartment = function (id) { if (this.model.compById[id]) this.go({ view: "compartment", compartment: id, query: "" }); };
  Explorer.prototype.showUnassigned = function () { this.go({ view: "unassigned", compartment: null, query: "" }); };

  Explorer.prototype.destroy = function () {
    root.removeEventListener("resize", this.onResize);
    document.removeEventListener("keydown", this.onKey);
    this.el.textContent = "";
    this.el.classList.remove("sx-root");
    this.el.removeAttribute("data-sx-theme");
  };

  Explorer.prototype.showGene = function (geneId) {
    var ids = this.model.geneIndex[geneId] || [];
    if (ids.length > 1) this.go({ view: "search", gene: geneId, query: "", compartment: null, entity: ids[0] });
    else if (ids.length) this.set({ entity: ids[0] });
    return ids.length;
  };

  Explorer.prototype.select = function (entityId) {
    if (entityId == null || this.model.entityById[entityId]) this.set({ entity: entityId });
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

  Explorer.prototype.entityDescription = function (e) {
    return e.label && entityGenes(e).length ? e.label : (e.members[0].description || "");
  };

  Explorer.prototype.dot = function (compId, hollow) {
    var color = this.color(compId);
    return h("span", { class: "sx-dot" + (hollow ? " sx-dot-hollow" : ""), style: hollow ? "border-color:" + color : "background:" + color, "aria-hidden": "true" });
  };

  /* ----- search ----- */

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

  Explorer.prototype.showResults = function () {
    var q = this.search.value.trim();
    this.closeSuggestions();
    this.go({ view: "search", query: q, compartment: null });
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

  /* ----- skeleton ----- */

  Explorer.prototype.build = function () {
    var self = this, ds = this.model.bundle.dataset, el = this.el;
    el.textContent = "";
    el.classList.add("sx-root");
    el.setAttribute("data-sx-theme", { dark: "dark", auto: "auto" }[this.options.theme] || "light");
    var pending = null;
    this.onResize = function () { clearTimeout(pending); pending = setTimeout(function () { self.drawMap(); }, 120); };
    root.addEventListener("resize", this.onResize);
    this.onKey = function (ev) {
      if (!self.el.isConnected) { document.removeEventListener("keydown", self.onKey); return; }
      if (ev.key === "Escape" && self.state.entity != null && document.activeElement !== self.search) self.select(null);
    };
    document.addEventListener("keydown", this.onKey);

    var flags = [];
    if (ds.synthetic) flags.push(h("span", { class: "sx-flag", "data-sx": "synthetic", text: "Synthetic demonstration data" }));
    if (ds.distribution && ds.distribution.status !== "public") flags.push(h("span", { class: "sx-flag sx-flag-strong", "data-sx": "local-only", text: "Local copy, not for distribution" }));
    (ds.notices || []).slice(0, 1).forEach(function (text) { flags.push(h("span", { class: "sx-flag", "data-sx": "notice", text: text })); });

    this.subtitle = h("p", { class: "sx-sub", "data-sx": "summary" });
    this.search = h("input", { type: "search", class: "sx-search-input", "data-sx": "search", role: "combobox", autocomplete: "off", spellcheck: "false",
      "aria-label": "Search for a gene or protein", "aria-expanded": "false", "aria-controls": "sx-suggestions", "aria-autocomplete": "list",
      placeholder: this.options.searchPlaceholder || "Search a gene or protein by name or identifier",
      oninput: function () { self.renderSuggestions(); }, onkeydown: function (ev) { self.searchKey(ev); },
      onfocus: function () { if (this.value.trim().length >= 2) self.renderSuggestions(); },
      onblur: function () { setTimeout(function () { self.closeSuggestions(); }, 120); } });
    this.suggestBox = h("ul", { id: "sx-suggestions", class: "sx-suggestions", role: "listbox", "data-sx": "suggestions", hidden: true });
    var cite = ds.citation || {};
    el.appendChild(h("header", { class: "sx-top" }, [
      flags.length ? h("div", { class: "sx-flags" }, flags) : null,
      h("h2", { class: "sx-title", text: ds.title }),
      this.subtitle,
      h("p", { class: "sx-source" }, [document.createTextNode(cite.text.split(". ")[0] + (cite.peer_reviewed === false ? ". Preprint, not peer reviewed. " : ". ")),
        cite.url ? link("Publication", cite.url) : null]),
      h("div", { class: "sx-search" }, [this.search, this.suggestBox]),
      this.options.searchHint ? h("p", { class: "sx-hint", text: this.options.searchHint }) : null
    ]));
    this.main = h("main", { class: "sx-main", "data-sx": "main" });
    el.appendChild(this.main);
    this.about = h("details", { class: "sx-about", "data-sx": "about", ontoggle: function () { if (this.open) self.renderAbout(); } }, [
      h("summary", { text: "About this dataset: methods, evidence and provenance" }), h("div", { class: "sx-about-body" })
    ]);
    el.appendChild(this.about);
    this.drawer = h("aside", { class: "sx-drawer", "data-sx": "drawer", role: "dialog", "aria-label": "Protein details", hidden: true });
    el.appendChild(this.drawer);
    this.tip = h("div", { class: "sx-tip", hidden: true });
    el.appendChild(this.tip);
    this.render();
  };

  Explorer.prototype.refreshLayers = function () { this.index = null; };

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

  /* ----- rendering ----- */

  Explorer.prototype.render = function () {
    var st = this.state, model = this.model, layer = model.layerById[st.layer];
    this.main.textContent = "";
    this.canvas = null;
    if (!layer) { this.main.appendChild(h("p", { text: "This dataset has no localization assignments." })); return; }
    var map = model.byLayer[layer.id], counts = layerCounts(model, layer.id), nAssigned = 0, nUnassigned = 0;
    Object.keys(map).forEach(function (id) { if (map[id].status === "assigned") nAssigned++; else nUnassigned++; });
    this.layerInfo = { layer: layer, map: map, counts: counts, assigned: nAssigned, unassigned: nUnassigned, word: statusLabel(layer, "below_threshold") };
    this.training = trainingSet(model, layer.id);
    if (st.view === "unassigned" && !nUnassigned) st.view = "home";
    var detected = model.entities.filter(function (e) { return e.detected !== false; }).length;
    this.subtitle.textContent = model.bundle.dataset.organism.name + ". " + plural(detected, "protein group") + " detected, " +
      nAssigned.toLocaleString() + " assigned to " + plural(model.compartments.length, "compartment") +
      (nUnassigned ? ", " + nUnassigned.toLocaleString() + " without a final call." : ".");
    this.computeList();
    var view = { home: this.homeView, compartment: this.compartmentView, unassigned: this.unassignedView, search: this.searchView }[st.view];
    var kids = view.call(this);
    for (var i = 0; i < kids.length; i++) if (kids[i]) this.main.appendChild(kids[i]);
    this.renderRows();
    this.renderDrawer(false);
    if (this.about.open) this.renderAbout();
    this.drawMap();
  };

  Explorer.prototype.homeView = function () {
    var self = this, model = this.model, info = this.layerInfo, cap = model.capabilities, max = 1;
    model.compartments.forEach(function (c) { max = Math.max(max, info.counts[c.id].assigned); });
    var cards = model.compartments.map(function (c) {
      var n = info.counts[c.id].assigned;
      return h("button", { type: "button", class: "sx-card", "data-compartment": c.id, title: c.description || null,
        onclick: function () { self.showCompartment(c.id); } }, [
        h("span", { class: "sx-card-name" }, [self.dot(c.id), c.label]),
        h("span", { class: "sx-card-n", text: n.toLocaleString() }),
        h("span", { class: "sx-card-unit", text: n === 1 ? "protein" : "proteins" }),
        h("span", { class: "sx-meter" }, [h("i", { style: "width:" + Math.max(2, n / max * 100) + "%;background:" + self.color(c.id) })])
      ]);
    });
    if (info.unassigned) {
      cards.push(h("button", { type: "button", class: "sx-card sx-card-open", "data-view": "unassigned", onclick: function () { self.showUnassigned(); } }, [
        h("span", { class: "sx-card-name" }, [h("span", { class: "sx-dot sx-dot-hollow", "aria-hidden": "true" }), "Unassigned"]),
        h("span", { class: "sx-card-n", text: info.unassigned.toLocaleString() }),
        h("span", { class: "sx-card-unit", text: "detected, no final call" }),
        h("span", { class: "sx-card-cta", text: "Explore these proteins →" })
      ]));
    }
    var missing = [];
    if (!cap.profiles) missing.push(h("li", { "data-sx": "no-profiles", text: "Fractionation profile of each protein" }));
    if (!cap.embeddings.length) missing.push(h("li", { "data-sx": "no-map", text: "Spatial map of all proteins" }));
    var pending = missing.length ? h("section", { class: "sx-pending", "data-sx": "pending" }, [
      h("h3", { text: "Awaiting the fractionation data" }),
      h("ul", {}, missing),
      h("p", { text: "These views need the measured abundance of each protein across the fractions, which this dataset does not include yet. They will appear here when the data are added. Nothing is drawn in their place." })
    ]) : null;
    return [
      h("div", { class: "sx-section-head" }, [h("h3", { text: "Where proteins were found" }),
        h("p", { class: "sx-muted", text: "Select a compartment to see its proteins." })]),
      h("div", { class: "sx-cards", "data-sx": "cards" }, cards),
      cap.embeddings.length ? this.mapPanel(info.layer) : null,
      pending
    ];
  };

  Explorer.prototype.crumbs = function () {
    var self = this, st = this.state, info = this.layerInfo;
    var options = [h("option", { value: "", text: "Jump to…" })].concat(this.model.compartments.map(function (c) {
      return h("option", { value: c.id, text: c.label + " (" + info.counts[c.id].assigned + ")", selected: st.view === "compartment" && st.compartment === c.id });
    }));
    if (info.unassigned) options.push(h("option", { value: "__unassigned", text: "Unassigned (" + info.unassigned + ")", selected: st.view === "unassigned" }));
    return h("nav", { class: "sx-crumbs", "aria-label": "Compartments" }, [
      h("button", { type: "button", class: "sx-back", "data-sx": "home", text: "← All compartments", onclick: function () { self.home(); } }),
      h("label", { class: "sx-jump" }, [h("span", { class: "sx-visually-hidden", text: "Jump to a compartment" }),
        h("select", { "data-sx": "jump", onchange: function () {
          if (this.value === "__unassigned") self.showUnassigned(); else if (this.value) self.showCompartment(this.value);
        } }, options)])
    ]);
  };

  Explorer.prototype.compartmentView = function () {
    var self = this, st = this.state, info = this.layerInfo, c = this.model.compById[st.compartment], n = info.counts[c.id];
    var toggle = n.below_threshold ? h("button", { type: "button", class: "sx-toggle", "data-sx": "include-other", "aria-pressed": st.includeOther ? "true" : "false",
      text: st.includeOther ? "Hide the " + n.below_threshold + " without a final call" : "Also show " + n.below_threshold + " closest to " + c.label + " without a final call",
      onclick: function () { self.set({ includeOther: !st.includeOther, shown: PAGE }); } }) : null;
    var side = this.sidePanel(c);
    return [
      this.crumbs(),
      h("header", { class: "sx-view-head" }, [
        h("h3", { class: "sx-view-title" }, [this.dot(c.id), c.label]),
        h("p", { class: "sx-view-count", "data-sx": "headline", text: plural(n.assigned, "protein") + " assigned" }),
        c.description ? h("p", { class: "sx-muted", text: c.description }) : null,
        toggle
      ]),
      h("div", { class: "sx-cols" + (side ? "" : " sx-cols-one") }, [this.listCard(), side])
    ];
  };

  // The host's summary of a compartment (for example enriched functions).
  Explorer.prototype.sidePanel = function (c) {
    if (!this.adapter.compartmentPanel) return null;
    var self = this, key = this.state.layer + "|" + c.id, box = h("aside", { class: "sx-side", "data-sx": "side" });
    if (this.panelCache[key]) { box.appendChild(this.panelCache[key]); return box; }
    box.appendChild(h("p", { class: "sx-muted", text: "Loading…" }));
    var done = function (node) {
      if (!node || node.nodeType !== 1) { box.textContent = ""; return; }
      self.panelCache[key] = node;
      if (box.isConnected || !self.main.querySelector("[data-sx=side]")) { box.textContent = ""; box.appendChild(node); }
    };
    var out;
    try { out = this.adapter.compartmentPanel(this.context(c.id), this); } catch (err) { out = null; }
    if (out && typeof out.then === "function") out.then(done, function () { box.textContent = ""; });
    else done(out);
    return box;
  };

  Explorer.prototype.unassignedView = function () {
    var self = this, st = this.state, model = this.model, info = this.layerInfo;
    var ids = Object.keys(info.map).filter(function (id) { return info.map[id].status !== "assigned"; });
    var facets = model.layers.filter(function (l) { return l.id !== info.layer.id; }).map(function (l) {
      var m = model.byLayer[l.id], n = 0;
      ids.forEach(function (id) { if (calls(m[id]).length) n++; });
      return { layer: l, n: n };
    }).filter(function (f) { return f.n > 0; });
    var side = facets.length ? h("aside", { class: "sx-side", "data-sx": "other-evidence" }, [
      h("h4", { text: "What is already known" }),
      h("p", { class: "sx-muted", text: "Unassigned proteins that carry a location in another source. Select one to list them." }),
      h("ul", { class: "sx-facets" }, facets.map(function (f) {
        var on = st.facet === f.layer.id;
        return h("li", {}, [h("button", { type: "button", class: "sx-facet" + (on ? " sx-on" : ""), "data-facet": f.layer.id, "aria-pressed": on ? "true" : "false",
          onclick: function () { self.set({ facet: on ? null : f.layer.id, shown: PAGE }); } }, [
          h("span", { class: "sx-facet-n", text: f.n.toLocaleString() }), h("span", { class: "sx-facet-label" }, [document.createTextNode(f.layer.label), badge(f.layer.evidence_type)])
        ])]);
      })),
      st.facet ? h("button", { type: "button", class: "sx-back", "data-sx": "clear-facet", text: "Show all unassigned", onclick: function () { self.set({ facet: null, shown: PAGE }); } }) : null
    ]) : null;
    return [
      this.crumbs(),
      h("header", { class: "sx-view-head" }, [
        h("h3", { class: "sx-view-title" }, [h("span", { class: "sx-dot sx-dot-hollow", "aria-hidden": "true" }), "Unassigned"]),
        h("p", { class: "sx-view-count", "data-sx": "headline", text: plural(info.unassigned, "protein group") + " detected without a final call" }),
        h("p", { class: "sx-muted sx-measure", "data-sx": "unassigned-lede", text: "These proteins were measured, but the published result leaves their location open (“" + info.word +
          "”). The closest class is shown for reference only. It is not an assignment." })
      ]),
      h("div", { class: "sx-cols" + (side ? "" : " sx-cols-one") }, [this.listCard(), side])
    ];
  };

  Explorer.prototype.searchView = function () {
    var st = this.state, n = this.filtered.length;
    var title = st.gene ? this.geneText(st.gene) + " is in " + plural(n, "protein group") : plural(n, "protein group") + " match “" + st.query + "”";
    return [
      this.crumbs(),
      h("header", { class: "sx-view-head" }, [h("h3", { class: "sx-view-title", text: "Search results" }), h("p", { class: "sx-view-count", "data-sx": "headline", text: title })]),
      h("div", { class: "sx-cols sx-cols-one" }, [this.listCard()])
    ];
  };

  /* ----- the protein list ----- */

  Explorer.prototype.computeList = function () {
    var st = this.state, model = this.model, list;
    if (st.view === "compartment") {
      list = filterEntities(model, { layer: st.layer, compartment: st.compartment, status: st.includeOther ? "all" : "assigned", query: st.filter }, this.adapter);
    } else if (st.view === "unassigned") {
      list = filterEntities(model, { layer: st.layer, view: "unassigned", compartment: st.named, query: st.filter }, this.adapter);
      if (st.facet && model.byLayer[st.facet]) {
        var m = model.byLayer[st.facet];
        list = list.filter(function (e) { return calls(m[e.id]).length > 0; });
      }
    } else if (st.view === "search") {
      list = st.gene ? (model.geneIndex[st.gene] || []).map(function (id) { return model.entityById[id]; }) : this.matches(st.query).map(function (x) { return x.e; });
    } else list = model.entities;
    // Lists open in gene-name order. Ordering by score is offered but is not
    // the default: training inputs can all carry the top score and would
    // otherwise fill the first page of every compartment.
    var sort = st.sort;
    if (!sort && st.view !== "search" && st.view !== "home") sort = { key: "genes", dir: "asc" };
    this.filtered = st.view === "home" ? list : sortEntities(model, list, sort, this.adapter);
  };

  Explorer.prototype.listCard = function () {
    var self = this, st = this.state, info = this.layerInfo, layer = info.layer, timer = null;
    var showCall = st.view !== "compartment" || st.includeOther;
    var tools = [];
    if (st.view !== "search") {
      var input = h("input", { type: "search", "data-sx": "filter", class: "sx-filter", placeholder: "Filter this list", "aria-label": "Filter this list", value: st.filter,
        oninput: function () {
          var v = this.value;
          clearTimeout(timer);
          timer = setTimeout(function () { st.filter = v; st.shown = PAGE; self.computeList(); self.renderRows(); }, 140);
        } });
      tools.push(input);
    }
    if (st.view === "unassigned") {
      var named = {};
      Object.keys(info.map).forEach(function (id) { var a = info.map[id]; if (a.status !== "assigned" && a.compartment != null) named[a.compartment] = (named[a.compartment] || 0) + 1; });
      tools.push(h("select", { "data-sx": "named", "aria-label": "Closest class", onchange: function () { self.set({ named: this.value || null, shown: PAGE }); } },
        [h("option", { value: "", text: "Any closest class" })].concat(this.model.compartments.filter(function (c) { return named[c.id]; }).map(function (c) {
          return h("option", { value: c.id, text: "Closest to " + c.label + " (" + named[c.id] + ")", selected: st.named === c.id });
        }))));
    }
    if (layer.score && st.view !== "search") {
      var current = st.sort ? st.sort.key + "|" + st.sort.dir : "genes|asc";
      tools.push(h("select", { "data-sx": "sort", "aria-label": "Sort", onchange: function () {
        var p = this.value.split("|");
        self.set({ sort: { key: p[0], dir: p[1] }, shown: PAGE });
      } }, [["genes|asc", "Gene name, A to Z"], ["s:" + layer.id + "|desc", "Highest score first"], ["s:" + layer.id + "|asc", "Lowest score first"]].map(function (o) {
        return h("option", { value: o[0], text: o[1], selected: current === o[0] });
      })));
    }
    tools.push(h("span", { class: "sx-grow" }));
    tools.push(h("span", { class: "sx-count", "data-sx": "count", "aria-live": "polite" }));
    tools.push(h("button", { type: "button", class: "sx-quiet", "data-sx": "export", text: "Download (TSV)", onclick: function () { self.exportTSV(); } }));
    this.rows = h("tbody", { "data-sx": "rows" });
    this.more = h("button", { type: "button", class: "sx-more", "data-sx": "more", onclick: function () { st.shown += PAGE; self.renderRows(); } });
    var head = [h("th", { scope: "col", text: "Protein" })];
    if (showCall) head.push(h("th", { scope: "col", text: st.view === "unassigned" ? "Closest class" : "Location" }));
    if (layer.score) head.push(h("th", { scope: "col", class: "sx-num", title: layer.score.description || "", text: "Score (" + layer.score.name + ")" }));
    head.push(h("th", { scope: "col", text: "Other evidence" }));
    this.listShowsCall = showCall;
    return h("section", { class: "sx-list-card", "data-sx": "list" }, [
      h("div", { class: "sx-toolbar" }, tools),
      h("div", { class: "sx-scroll" }, [h("table", { class: "sx-list" }, [h("thead", {}, [h("tr", {}, head)]), this.rows])]),
      this.more
    ]);
  };

  // Short tags for what the other curated sources say about one protein group.
  Explorer.prototype.evidenceChips = function (e) {
    var model = this.model, info = this.layerInfo, call = finalCall(info.map[e.id]), out = [];
    model.layers.forEach(function (l) {
      if (l.id === info.layer.id || l.evidence_type !== "curated_annotation") return;
      var cs = calls(model.byLayer[l.id][e.id]);
      if (!cs.length) return;
      var agrees = call != null && cs.indexOf(call) >= 0, isInput = (info.layer.trained_on || []).indexOf(l.id) >= 0;
      var names = cs.map(function (c) { return model.compById[c].label; }).join(", ");
      out.push(h("span", { class: "sx-chip" + (agrees ? " sx-chip-agree" : ""), "data-chip": l.id,
        title: l.label + ": " + names + (agrees ? ". Same compartment as the assignment." : ""),
        text: shortLabel(l) + (agrees ? (isInput ? "" : " ✓") : ": " + names) }));
    });
    return out;
  };

  Explorer.prototype.renderRows = function () {
    if (!this.rows || !this.rows.isConnected) return;
    var self = this, st = this.state, model = this.model, info = this.layerInfo, list = this.filtered, slice = list.slice(0, st.shown);
    this.rows.textContent = "";
    slice.forEach(function (e) {
      var a = info.map[e.id], title = self.entityTitle(e), desc = self.entityDescription(e), first = e.members[0].id;
      var cells = [h("td", {}, [
        h("div", { class: "sx-row-title" }, [h("strong", { text: title }),
          e.members.length > 1 ? h("span", { class: "sx-tag", title: "A protein group that mass spectrometry could not split further", text: "group of " + e.members.length }) : null,
          e.detected === false ? h("span", { class: "sx-tag", text: "not detected" }) : null]),
        desc ? h("div", { class: "sx-row-desc", text: desc }) : null,
        title !== first ? h("div", { class: "sx-row-id sx-mono", text: first }) : null
      ])];
      if (self.listShowsCall) {
        var cell;
        if (!a) cell = [h("span", { class: "sx-muted", text: "Not detected" })];
        else if (a.status === "assigned") cell = [self.dot(a.compartment), model.compById[a.compartment].label];
        else if (st.view === "unassigned") cell = a.compartment != null ? [self.dot(a.compartment, true), h("span", { class: "sx-muted", text: model.compById[a.compartment].label })] : [];
        else cell = [h("span", { class: "sx-muted", text: "No final call" })];
        cells.push(h("td", { class: "sx-loc" }, cell));
      }
      if (info.layer.score) cells.push(h("td", { class: "sx-num sx-mono", text: a && a.score != null ? formatScore(a.score) : "" }));
      cells.push(h("td", {}, [h("div", { class: "sx-chips" }, self.evidenceChips(e))]));
      self.rows.appendChild(h("tr", { "data-entity": e.id, tabindex: "0", role: "button", "aria-label": "Details for " + title,
        class: e.id === st.entity ? "sx-row-on" : null,
        onclick: function () { self.set({ entity: e.id }); },
        onkeydown: function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); self.set({ entity: e.id }); } } }, cells));
    });
    if (!list.length) this.rows.appendChild(h("tr", {}, [h("td", { colspan: "4", class: "sx-muted", text: "No protein matches." })]));
    var count = this.main.querySelector("[data-sx=count]");
    if (count) count.textContent = list.length > slice.length ? "Showing " + slice.length + " of " + list.length.toLocaleString() : plural(list.length, "protein group");
    this.more.hidden = list.length <= slice.length;
    this.more.textContent = "Show " + Math.min(PAGE, list.length - slice.length) + " more";
  };

  Explorer.prototype.markSelected = function () {
    var id = this.state.entity;
    Array.prototype.forEach.call(this.main.querySelectorAll("tr[data-entity]"), function (tr) {
      tr.classList.toggle("sx-row-on", tr.getAttribute("data-entity") === id);
    });
  };

  /* ----- the details panel ----- */

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

  Explorer.prototype.renderDrawer = function (focus) {
    var self = this, model = this.model, st = this.state, info = this.layerInfo, e = model.entityById[st.entity], box = this.drawer;
    box.textContent = "";
    if (!e || !info) {
      box.hidden = true;
      this.el.classList.remove("sx-has-drawer");
      if (this.returnFocus && this.returnFocus.isConnected) this.returnFocus.focus();
      this.returnFocus = null;
      return;
    }
    if (box.hidden) this.returnFocus = document.activeElement && this.el.contains(document.activeElement) ? document.activeElement : null;
    var layer = info.layer, a = info.map[e.id], genes = entityGenes(e), call = finalCall(a);
    var close = h("button", { type: "button", class: "sx-close", "data-sx": "drawer-close", "aria-label": "Close details", text: "×", onclick: function () { self.select(null); } });

    // 1. where it was found
    var loc;
    if (!a) loc = [h("p", { class: "sx-loc-main sx-muted", text: "Not detected in this experiment" })];
    else if (call != null) {
      loc = [h("p", { class: "sx-loc-main" }, [this.dot(call), model.compById[call].label])];
    } else {
      loc = [h("p", { class: "sx-loc-main sx-muted", text: "No final call" }),
        h("p", { "data-sx": "closest", text: "Published as “" + statusLabel(layer, a.status) + "”." + (a.compartment != null ? " Closest class: " + model.compById[a.compartment].label + ". This is not an assignment." : "") })];
    }
    if (a) {
      loc.push(h("p", { class: "sx-loc-source" }, [badge(layer.evidence_type), document.createTextNode(" " + layer.label)]));
      if (a.score != null) {
        loc.push(h("p", { class: "sx-score" }, [h("span", { class: "sx-attr-k", text: "Reported score" }),
          h("span", { class: "sx-mono", "data-score": layer.id, text: layer.score.name + " = " + formatScore(a.score) })]));
        loc.push(h("details", { class: "sx-fine", "data-sx": "score-note" }, [h("summary", { text: "About this score" }),
          h("p", { text: INTERPRETATION[layer.score.interpretation] + " " + (layer.score.interpretation_basis || layer.score.description || "") })]));
      }
      if (this.training[e.id]) loc.push(h("p", { class: "sx-note", "data-sx": "training-input", text: "This protein was a training marker: its class was given to the classifier, not predicted by it." }));
    }

    // 2. other sources, grouped by where they come from
    var others = model.layers.filter(function (l) { return l.id !== layer.id; });
    var block = function (layers, empty) {
      var rows = layers.filter(function (l) { return model.byLayer[l.id][e.id]; }).map(function (l) {
        var x = model.byLayer[l.id][e.id], cs = calls(x), scope = sharedScope(model, layer.id, l.id);
        var comparable = call != null && cs.length && (!scope || scope.indexOf(call) >= 0);
        var agrees = comparable && cs.indexOf(call) >= 0;
        return h("li", { class: "sx-source-row", "data-layer": l.id }, [
          h("div", { class: "sx-source-head" }, [h("strong", { text: l.label }), badge(l.evidence_type)]),
          h("div", { class: "sx-source-val" }, [cs.length ? self.locationLine(x, l) : h("span", { class: "sx-muted", text: self.callText(x, l) }),
            comparable && (layer.trained_on || []).indexOf(l.id) < 0 ? h("span", { class: "sx-verdict" + (agrees ? " sx-agree" : ""), text: agrees ? "same as the assignment" : "differs from the assignment" }) : null,
            x.score != null ? h("span", { class: "sx-mono", text: l.score.name + " = " + formatScore(x.score) }) : null])
        ].concat(self.attributeNodes(x, l)));
      });
      return rows.length ? h("ul", { class: "sx-sources" }, rows) : h("p", { class: "sx-muted", text: empty });
    };
    var fromAuthors = others.filter(function (l) { return l.source === "author"; });
    var elsewhere = others.filter(function (l) { return l.source !== "author"; });

    // 3. measured profile, or a plain statement that it is pending
    var profile = model.capabilities.profiles ? this.profileChart(e)
      : h("p", { class: "sx-muted", "data-sx": "pending-profile", text: "Awaiting the fractionation data. The profile of this protein across fractions will be shown here." });

    var members = h("table", { class: "sx-members", "data-sx": "members" }, [
      h("thead", {}, [h("tr", {}, [h("th", { text: "Protein" }), h("th", { text: "Gene" }), h("th", { text: "Description" })])]),
      h("tbody", {}, e.members.map(function (m) {
        return h("tr", {}, [h("td", { class: "sx-mono" }, [link(m.id, self.adapter.memberUrl && self.adapter.memberUrl(m.id))]),
          h("td", {}, [m.gene != null ? link(self.geneText(m.gene), self.adapter.geneUrl && self.adapter.geneUrl(m.gene)) : h("span", { class: "sx-muted", text: "no gene match" })]),
          h("td", { text: m.description || "" })]);
      }))
    ]);
    var notes = [];
    if (genes.length > 1) notes.push(h("p", { class: "sx-note", "data-sx": "multi-gene-note", text: "This entry is a protein group covering " + genes.length + " genes. The measurement cannot be split between them, so the result applies to the group as a whole." }));
    if (e.mapping_note) notes.push(h("p", { class: "sx-muted", text: e.mapping_note }));
    genes.forEach(function (g) {
      var also = model.geneIndex[g].filter(function (id) { return id !== e.id; });
      if (also.length) notes.push(h("p", { class: "sx-muted", "data-sx": "also-in" }, [document.createTextNode(self.geneText(g) + " is also in: ")].concat(also.map(function (id) {
        return h("button", { type: "button", class: "sx-linkbtn", text: model.entityById[id].members[0].id, onclick: function () { self.set({ entity: id }); } });
      }))));
    });
    var geneLinks = genes.slice(0, 6).map(function (g) {
      var url = safeHref(self.adapter.geneUrl && self.adapter.geneUrl(g));
      return url ? h("a", { class: "sx-btn", "data-sx": "gene-link", href: url, text: self.geneText(g) + ": " + (self.adapter.geneLinkText || "gene page") + " →" }) : null;
    });
    var section = function (name, title, kids) { return h("section", { class: "sx-d-section", "data-sx": name }, [h("h4", { text: title })].concat(kids)); };

    box.appendChild(h("div", { class: "sx-d-head" }, [
      h("div", {}, [h("p", { class: "sx-eyebrow", text: e.members.length > 1 ? "Protein group of " + e.members.length : "Protein" }),
        h("h3", { class: "sx-d-title", "data-sx": "drawer-title", text: this.entityTitle(e) }),
        this.entityDescription(e) ? h("p", { class: "sx-d-desc", text: this.entityDescription(e) }) : null]),
      close
    ]));
    box.appendChild(h("div", { class: "sx-d-body" }, [
      geneLinks.some(Boolean) ? h("div", { class: "sx-d-links" }, geneLinks) : null,
      section("loc", "Localization", loc)
    ].concat(notes, [
      fromAuthors.length ? section("from-authors", "Reference sets in the publication", [block(fromAuthors, "Not in any reference set of the publication.")]) : null,
      elsewhere.length ? section("elsewhere", "Existing annotations", [block(elsewhere, "No location annotated in the compartments compared here.")]) : null,
      section("profile", "Fractionation profile", [profile]),
      section("group", e.members.length > 1 ? "Proteins in this group" : "Protein", [members])
    ])));
    box.hidden = false;
    this.el.classList.add("sx-has-drawer");
    if (focus) close.focus();
  };

  /* ----- methods and provenance, on demand ----- */

  Explorer.prototype.renderAbout = function () {
    var self = this, model = this.model, ds = model.bundle.dataset, st = this.state, info = this.layerInfo, body = this.about.lastChild, m = ds.mapping, cap = model.capabilities;
    body.textContent = "";
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
      (ds.notices || []).length ? h("ul", { class: "sx-notices" }, ds.notices.map(function (t) { return h("li", { text: t }); })) : null,
      ds.description ? h("p", { text: ds.description }) : null,
      h("p", { class: "sx-cite" }, [document.createTextNode(ds.citation.text + " "), ds.citation.url ? link("Publication", ds.citation.url) : null]),
      h("p", { "data-sx": "license" }, [document.createTextNode("License: "), link(ds.license.name || ds.license.id, ds.license.url), document.createTextNode(". " + ds.attribution)]),
      h("h4", { text: "Kinds of evidence" }),
      h("div", { "data-sx": "evidence" }, evidence),
      computational.length > 1 ? h("label", { class: "sx-inline" }, [h("span", { text: "Assignments shown in the explorer" }),
        h("select", { "data-sx": "layer-select", onchange: function () { self.panelCache = {}; self.go({ layer: this.value, compare: null, view: "home", compartment: null }); } },
          computational.map(function (l) { return h("option", { value: l.id, text: l.label, selected: l.id === st.layer }); }))]) : null,
      h("h4", { text: "Scores and agreement" }),
      this.scorePanel(info.layer),
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
    kids.forEach(function (k) { if (k) body.appendChild(k); });
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

  Explorer.prototype.mapPanel = function (layer) {
    var self = this, model = this.model, cap = model.capabilities;
    if (!cap.embeddings.length) return null;
    var emb = model.embeddingById[this.state.embedding];
    var pick = cap.embeddings.length > 1 ? h("select", { "data-sx": "embedding-select", "aria-label": "Map", onchange: function () { self.set({ embedding: this.value }); } },
      cap.embeddings.map(function (id) { return h("option", { value: id, text: model.embeddingById[id].label, selected: id === emb.id }); })) : null;
    this.canvas = h("canvas", { class: "sx-map", "data-sx": "map-canvas", role: "img",
      "aria-label": "Map of protein groups, " + emb.label + ". The table below lists the same protein groups." });
    this.canvas.addEventListener("mousemove", function (ev) { self.hoverMap(ev); });
    this.canvas.addEventListener("mouseleave", function () { self.tip.hidden = true; });
    this.canvas.addEventListener("click", function (ev) { var p = self.nearest(ev); if (p) self.set({ entity: p.id }); });
    return this.panel("map", "Map", "measured_profile", [
      pick,
      h("p", { class: "sx-muted", text: emb.label + ". Method: " + emb.method.name + ", applied to the measured profiles, " + SOURCE[emb.source] +
        ". Points are coloured by " + layer.label + "; grey points have no call in that layer." }),
      this.canvas
    ]);
  };

  Explorer.prototype.drawMap = function () {
    var model = this.model, st = this.state, canvas = this.canvas;
    if (!canvas || !model.capabilities.embeddings.length || !canvas.isConnected) { this.points = null; return; }
    var emb = model.embeddingById[st.embedding], map = model.byLayer[st.layer] || {};
    var w = canvas.clientWidth || 600, hgt = Math.round(Math.min(460, Math.max(280, w * 0.62)));
    var dpr = root.devicePixelRatio || 1;
    canvas.style.height = hgt + "px";
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
    var r = ids.length > 1500 ? 2.5 : 4;
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

  Explorer.prototype.scorePanel = function (layer) {
    if (!layer.score) return null;
    var st = this.state, map = this.model.byLayer[layer.id], values = [], training = this.training || {}, nTraining = 0;
    Object.keys(map).forEach(function (eid) {
      var a = map[eid];
      if (st.view === "unassigned" && a.status === "assigned") return;
      if (a.score != null && (!st.compartment || a.compartment === st.compartment)) { values.push(a.score); if (training[eid]) nTraining++; }
    });
    if (!values.length) return null;
    var bins = 24, hist = histogram(values, bins), W = 520, H = 170, pad = { l: 36, r: 12, t: 14, b: 34 };
    var top = Math.max.apply(null, hist.counts), bw = (W - pad.l - pad.r) / bins;
    var x = function (v) { return pad.l + (v - hist.lo) / (hist.hi - hist.lo) * (W - pad.l - pad.r); };
    var y = function (n) { return H - pad.b - (n / top) * (H - pad.t - pad.b); };
    var kids = [
      s("line", { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: "sx-axis" }),
      s("line", { x1: pad.l, x2: W - pad.r, y1: y(top), y2: y(top), class: "sx-gridline" }),
      svgText(pad.l - 6, y(0) + 4, "0", null, "end"), svgText(pad.l - 6, y(top) + 4, String(top), null, "end"),
      svgText(pad.l, H - 16, formatScore(+hist.lo.toFixed(3)), null, "start"),
      svgText(W - pad.r, H - 16, formatScore(+hist.hi.toFixed(3)), null, "end"),
      svgText((W + pad.l - pad.r) / 2, H - 2, layer.score.name)
    ];
    hist.counts.forEach(function (n, i) {
      if (!n) return;
      var lo = hist.lo + (hist.hi - hist.lo) * i / bins, hi = hist.lo + (hist.hi - hist.lo) * (i + 1) / bins;
      var rect = s("rect", { x: pad.l + i * bw + 1, y: y(n), width: Math.max(1, bw - 2), height: y(0) - y(n), rx: 2, class: "sx-hist" });
      var t = s("title"); t.textContent = n + " protein groups, " + layer.score.name + " " + lo.toFixed(3) + " to " + hi.toFixed(3);
      rect.appendChild(t); kids.push(rect);
    });
    var thr = layer.score.threshold, thrNote = null;
    if (thr && thr.value >= hist.lo && thr.value <= hist.hi) {
      kids.push(s("line", { x1: x(thr.value), x2: x(thr.value), y1: pad.t - 6, y2: y(0), class: "sx-threshold" }));
      kids.push(svgText(x(thr.value) + 4, pad.t + 2, "threshold", "sx-axis-text", "start"));
    }
    if (thr) {
      thrNote = h("p", { class: "sx-muted", "data-sx": "threshold-note", text: "Threshold: " + thr.rule.replace("value", formatScore(thr.value)) + ". " +
        (thr.basis === "observed_in_data" ? "Not stated numerically by the source; observed in the data. " : "Stated by the source. ") + (thr.description || "") });
    }
    var where = st.compartment ? this.model.compById[st.compartment].label : "all compartments";
    return this.panel("scores", "Score distribution", layer, [
      h("p", { class: "sx-muted", "data-sx": "score-note", text: layer.score.name + " for " + values.length + " protein groups, " + where + ". " +
        INTERPRETATION[layer.score.interpretation] + (layer.score.interpretation_basis ? " " + layer.score.interpretation_basis : "") }),
      s("svg", { viewBox: "0 0 " + W + " " + H, class: "sx-chart", role: "img", "aria-label": "Histogram of " + layer.score.name }, kids),
      nTraining ? h("p", { class: "sx-muted", "data-sx": "training-note", text: nTraining + " of these protein groups were training inputs to this method. Their class was supplied, not predicted, so their scores are not comparable with the rest." }) : null,
      thrNote
    ]);
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
