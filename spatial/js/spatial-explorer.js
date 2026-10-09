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
  var PAGE = 25;
  var MAX_COLORS = 8;

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

  // Colour belongs to the compartment for the whole session. With more
  // compartments than distinguishable hues, the largest ones in the first
  // computational layer (else the first layer) take a hue and the rest stay
  // neutral; a selected compartment is always emphasised regardless.
  function assignColors(model) {
    var lead = model.layers.filter(function (l) { return l.evidence_type === "computational_assignment"; })[0] || model.layers[0];
    var counts = lead ? layerCounts(model, lead.id) : {};
    var ranked = model.compartments.map(function (c, i) {
      var n = counts[c.id] ? counts[c.id].assigned + counts[c.id].below_threshold : 0;
      return { id: c.id, n: n, i: i };
    });
    if (ranked.length > MAX_COLORS) {
      ranked.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
      ranked = ranked.slice(0, MAX_COLORS).sort(function (a, b) { return a.i - b.i; });
    }
    ranked.forEach(function (r, slot) { model.colors[r.id] = slot + 1; });
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

  function Explorer(el, model, adapter, options) {
    this.el = el;
    this.model = model;
    this.adapter = adapter;
    this.options = options;
    var first = model.layers.filter(function (l) { return l.evidence_type === "computational_assignment"; })[0] || model.layers[0];
    var init = options.initial || {};
    this.state = {
      layer: model.layerById[init.layer] ? init.layer : (first ? first.id : null),
      compartment: model.compById[init.compartment] ? init.compartment : null,
      status: "all", query: "", gene: init.gene || null,
      view: init.view === "unassigned" ? "unassigned" : "browse", sort: null, compSort: "source", analysis: null,
      entity: model.entityById[init.entity] ? init.entity : null,
      embedding: model.capabilities.embeddings[0] || null,
      compare: null, page: 0
    };
    if (this.state.gene && !this.state.entity && model.geneIndex[this.state.gene]) {
      this.state.entity = model.geneIndex[this.state.gene][0];
    }
    this.build();
  }

  Explorer.prototype.set = function (patch) {
    var st = this.state, k;
    for (k in patch) st[k] = patch[k];
    if (!("analysis" in patch) && !("page" in patch) && !("entity" in patch && Object.keys(patch).length === 1)) st.analysis = null;
    if (!("page" in patch) && !("entity" in patch && Object.keys(patch).length === 1)) st.page = 0;
    this.render();
    if ("entity" in patch && this.options.onSelect) this.options.onSelect(st.entity, this);
  };

  Explorer.prototype.destroy = function () {
    root.removeEventListener("resize", this.onResize);
    this.el.textContent = "";
    this.el.classList.remove("sx-root");
    this.el.removeAttribute("data-sx-theme");
  };

  Explorer.prototype.showGene = function (geneId) {
    var ids = this.model.geneIndex[geneId] || [];
    this.set({ gene: geneId, compartment: null, status: "all", query: "", entity: ids[0] || null });
    return ids.length;
  };

  Explorer.prototype.select = function (entityId) {
    if (this.model.entityById[entityId]) this.set({ entity: entityId });
  };

  Explorer.prototype.geneText = function (g) {
    return (this.adapter.geneLabel && this.adapter.geneLabel(g)) || g;
  };

  Explorer.prototype.build = function () {
    var self = this, ds = this.model.bundle.dataset, el = this.el;
    el.textContent = "";
    el.classList.add("sx-root");
    el.setAttribute("data-sx-theme", { dark: "dark", auto: "auto" }[this.options.theme] || "light");
    var pending = null;
    this.onResize = function () {
      clearTimeout(pending);
      pending = setTimeout(function () { self.drawMap(); }, 120);
    };
    root.addEventListener("resize", this.onResize);

    var notices = [];
    if (ds.synthetic) notices.push(h("p", { class: "sx-notice", "data-sx": "synthetic", text: "Synthetic demonstration data. Not a biological result." }));
    if (ds.distribution && ds.distribution.status !== "public") {
      notices.push(h("p", { class: "sx-notice sx-notice-strong", "data-sx": "local-only",
        text: "Local copy, not for distribution. " + (ds.distribution.reason || "") }));
    }
    (ds.notices || []).forEach(function (text) {
      notices.push(h("p", { class: "sx-notice", "data-sx": "notice", text: text }));
    });
    var cite = h("p", { class: "sx-cite" }, [
      document.createTextNode(ds.citation.text + " "),
      ds.citation.url ? link("Source", ds.citation.url) : null,
      ds.citation.peer_reviewed === false ? h("span", { class: "sx-muted", text: " Preprint, not peer reviewed." }) : null
    ]);
    var lic = h("p", { class: "sx-muted", "data-sx": "license" }, [
      document.createTextNode("License: "), link(ds.license.name || ds.license.id, ds.license.url),
      document.createTextNode(". " + ds.attribution)
    ]);
    var m = ds.mapping;
    var prov = h("details", { class: "sx-prov", "data-sx": "provenance" }, [
      h("summary", { text: "Provenance and identifier mapping" }),
      h("p", { text: "Built " + ds.provenance.built + " by " + ds.provenance.builder + "." }),
      h("ul", {}, ds.provenance.sources.map(function (src) {
        return h("li", { text: src.name + ": " + (src.description || "") + (src.sha256 ? " (sha256 " + src.sha256.slice(0, 12) + ")" : "") });
      })),
      h("ol", {}, ds.provenance.steps.map(function (t) { return h("li", { text: t }); })),
      h("p", { "data-sx": "mapping", text: m.entities_total + " protein groups: " + m.entities_mapped + " fully mapped to genes, " +
        m.entities_partial + " partly mapped, " + m.entities_unmapped + " unmapped. " + m.entities_multi_gene +
        " groups span more than one gene. " + m.genes_total + " genes in total. Method: " + m.method }),
      m.notes ? h("p", { class: "sx-muted", text: m.notes }) : null,
      h("p", { text: "Compartment vocabulary:" }),
      h("ul", { "data-sx": "vocabulary" }, this.model.compartments.map(function (c) {
        return h("li", { text: c.label + (c.ontology_id ? " = " + c.ontology_id : " (no ontology term)") +
          (c.ontology_note ? ". " + c.ontology_note : "") + (c.description ? " " + c.description : "") });
      }))
    ]);
    el.appendChild(h("header", { class: "sx-head" }, [
      h("h2", { class: "sx-title", text: ds.title }),
      h("p", { class: "sx-sub", text: ds.organism.name + (ds.organism.condition ? ", " + ds.organism.condition : "") })
    ].concat(notices, [ds.description ? h("p", { text: ds.description }) : null, cite, lic, prov])));

    this.evidenceEl = h("section", { class: "sx-evidence", "data-sx": "evidence", "aria-label": "Evidence in this dataset" });
    el.appendChild(this.evidenceEl);

    this.layerSelect = h("select", { id: "sx-layer", "data-sx": "layer-select", onchange: function () {
      self.set({ layer: this.value, compartment: null, compare: null, sort: null, view: "browse" });
    } });
    this.statusSelect = h("select", { "data-sx": "status-select", onchange: function () { self.set({ status: this.value }); } }, [
      h("option", { value: "all", text: "All protein groups" }),
      h("option", { value: "assigned", text: "Assigned only" }),
      h("option", { value: "below_threshold", text: "Below threshold only" })
    ]);
    this.statusWrap = h("label", {}, [h("span", { text: "Show" }), this.statusSelect]);
    var timer = null;
    this.search = h("input", { type: "search", "data-sx": "search", placeholder: "Protein, gene or description", "aria-label": "Search", oninput: function () {
      var v = this.value;
      clearTimeout(timer);
      timer = setTimeout(function () { self.set({ query: v }); }, 150);
    } });
    el.appendChild(h("div", { class: "sx-controls" }, [
      h("label", {}, [h("span", { text: "Colour and filter by" }), this.layerSelect]),
      this.statusWrap,
      h("label", { class: "sx-grow" }, [h("span", { text: "Search" }), this.search])
    ]));
    this.body = h("div", { class: "sx-body" });
    el.appendChild(this.body);
    this.tip = h("div", { class: "sx-tip", hidden: true });
    el.appendChild(this.tip);
    this.refreshLayers();
    this.render();
  };

  Explorer.prototype.refreshLayers = function () {
    var self = this, model = this.model, cap = model.capabilities, b = model.bundle;
    this.layerSelect.textContent = "";
    LAYER_EVIDENCE.forEach(function (ev) {
      var layers = model.layers.filter(function (l) { return l.evidence_type === ev; });
      if (!layers.length) return;
      self.layerSelect.appendChild(h("optgroup", { label: EVIDENCE[ev].label }, layers.map(function (l) {
        return h("option", { value: l.id, text: l.label });
      })));
    });
    this.layerSelect.value = this.state.layer;

    var rows = EVIDENCE_ORDER.map(function (ev) {
      var items;
      if (ev === "measured_profile") {
        items = cap.profiles
          ? [h("li", { text: Object.keys(b.profiles.values).length + " profiles across " + b.fractions.length + " fractions, " + SOURCE[b.profiles.source] + "." })]
          : [h("li", { class: "sx-muted", "data-sx": "no-profiles", text: cap.reasons.profiles + " The profile view is unavailable." })];
        if (cap.embeddings.length) {
          cap.embeddings.forEach(function (id) {
            var e = model.embeddingById[id];
            items.push(h("li", { text: "Map: " + e.label + " (" + e.method.name + ", " + SOURCE[e.source] + ")." }));
          });
        } else {
          items.push(h("li", { class: "sx-muted", "data-sx": "no-map", text: cap.reasons.embeddings + " The map view is unavailable." }));
        }
      } else {
        var layers = model.layers.filter(function (l) { return l.evidence_type === ev; });
        items = layers.length ? layers.map(function (l) {
          return h("li", {}, [h("strong", { text: l.label }), document.createTextNode(": " + Object.keys(model.byLayer[l.id]).length +
            " protein groups, " + SOURCE[l.source] + ". " + (l.method.description || l.method.name))]);
        }) : [h("li", { class: "sx-muted", text: "None in this dataset." })];
      }
      return h("div", { class: "sx-ev-row", "data-evidence": ev }, [
        h("div", {}, [badge(ev)]), h("div", {}, [h("p", { class: "sx-muted", text: EVIDENCE[ev].text }), h("ul", {}, items)])
      ]);
    });
    this.evidenceEl.textContent = "";
    this.evidenceEl.appendChild(h("h3", { text: "Evidence in this dataset" }));
    rows.forEach(function (r) { self.evidenceEl.appendChild(r); });
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
    if (added) { this.refreshLayers(); this.render(); }
    return added;
  };

  Explorer.prototype.color = function (compId) {
    var slot = this.model.colors[compId];
    return slot ? cssVar(this.el, "--sx-series-" + slot, "#888") : cssVar(this.el, "--sx-neutral", "#9a9993");
  };

  Explorer.prototype.render = function () {
    var st = this.state, model = this.model, self = this;
    var layer = model.layerById[st.layer];
    this.body.textContent = "";
    if (!layer) { this.body.appendChild(h("p", { text: "This dataset has no assignment layers." })); return; }
    var map = model.byLayer[layer.id], nUnassigned = 0;
    Object.keys(map).forEach(function (eid) { if (map[eid].status !== "assigned") nUnassigned++; });
    if (!nUnassigned) st.view = "browse";
    var unassigned = st.view === "unassigned";
    if (unassigned && !st.sort && layer.score) st.sort = { key: "s:" + layer.id, dir: "desc" };
    this.statusSelect.options[1].textContent = "Only " + statusLabel(layer, "assigned");
    this.statusSelect.options[2].textContent = "Only " + statusLabel(layer, "below_threshold");
    this.statusSelect.value = st.status;
    this.statusWrap.hidden = unassigned;
    this.filtered = filterEntities(model, st, this.adapter);
    this.training = trainingSet(model, layer.id);
    this.undetected = model.entities.filter(function (e) { return e.detected === false; }).length;
    var word = statusLabel(layer, "below_threshold");
    this.body.appendChild(h("div", { class: "sx-tabs", role: "tablist", "data-sx": "views" }, [
      h("button", { type: "button", role: "tab", "aria-selected": unassigned ? "false" : "true", class: unassigned ? null : "sx-on", "data-view": "browse",
        text: "By compartment", onclick: function () { self.set({ view: "browse", compartment: null, sort: null }); } }),
      nUnassigned ? h("button", { type: "button", role: "tab", "aria-selected": unassigned ? "true" : "false", class: unassigned ? "sx-on" : null, "data-view": "unassigned",
        text: "Without a final call (" + nUnassigned + ")", onclick: function () { self.set({ view: "unassigned", compartment: null, status: "all", sort: null }); } }) : null
    ]));
    if (unassigned) {
      this.body.appendChild(h("p", { class: "sx-lede", "data-sx": "unassigned-lede", text: nUnassigned + " protein groups in " + layer.label +
        " have no final call (" + word + "). They were detected and remain part of the dataset. The compartment shown for each is the one the method named, kept for reference; it is not an assignment." }));
    }

    var chips = [];
    if (st.gene) chips.push(h("button", { class: "sx-chip", type: "button", "data-sx": "gene-chip", text: "Gene: " + this.geneText(st.gene) + " ×",
      onclick: function () { self.set({ gene: null }); } }));
    if (st.compartment) chips.push(h("button", { class: "sx-chip", type: "button", text: model.compById[st.compartment].label + " ×",
      onclick: function () { self.set({ compartment: null }); } }));

    var grid = h("div", { class: "sx-grid" }, [this.compartmentPanel(layer), h("div", { class: "sx-stack" }, [
      this.mapPanel(layer), this.scorePanel(layer), unassigned ? this.otherEvidencePanel(layer) : this.concordancePanel(layer)
    ])]);
    this.body.appendChild(grid);
    this.body.appendChild(this.tablePanel(layer, chips));
    if (st.analysis) this.body.appendChild(h("section", { class: "sx-panel", "data-sx": "analysis" }, [st.analysis]));
    this.body.appendChild(this.detailPanel());
    this.drawMap();
  };

  Explorer.prototype.panel = function (name, title, layerOrEvidence, kids) {
    var ev = typeof layerOrEvidence === "string" ? layerOrEvidence : layerOrEvidence && layerOrEvidence.evidence_type;
    return h("section", { class: "sx-panel", "data-sx": name }, [
      h("h3", {}, [document.createTextNode(title + " "), ev ? badge(ev) : null])
    ].concat(kids));
  };

  Explorer.prototype.compartmentPanel = function (layer) {
    var self = this, model = this.model, st = this.state, counts = layerCounts(model, layer.id);
    var unassigned = st.view === "unassigned", max = 1, word = statusLabel(layer, "below_threshold");
    if (unassigned) model.compartments.forEach(function (c) { counts[c.id] = { assigned: 0, below_threshold: counts[c.id].below_threshold }; });
    model.compartments.forEach(function (c) { max = Math.max(max, counts[c.id].assigned + counts[c.id].below_threshold); });
    var hasBelow = model.compartments.some(function (c) { return counts[c.id].below_threshold > 0; });
    var order = model.compartments.slice();
    if (st.compSort === "name") order.sort(function (a, b) { return a.label.localeCompare(b.label); });
    if (st.compSort === "assigned") order.sort(function (a, b) { return counts[b.id].assigned - counts[a.id].assigned; });
    if (st.compSort === "other") order.sort(function (a, b) { return counts[b.id].below_threshold - counts[a.id].below_threshold; });
    var rows = order.map(function (c) {
      var n = counts[c.id], on = st.compartment === c.id;
      var bar = h("span", { class: "sx-bar" }, [
        h("span", { class: "sx-bar-a", style: "width:" + (n.assigned / max * 100) + "%;background:" + self.color(c.id) }),
        h("span", { class: "sx-bar-b", style: "width:" + (n.below_threshold / max * 100) + "%" })
      ]);
      return h("li", {}, [h("button", { type: "button", class: "sx-comp" + (on ? " sx-on" : ""), "aria-pressed": on ? "true" : "false",
        "data-compartment": c.id, title: [c.description, c.ontology_id, c.ontology_note].filter(Boolean).join(" "),
        onclick: function () { self.set({ compartment: on ? null : c.id }); } }, [
        h("span", { class: "sx-swatch", style: "background:" + self.color(c.id) }),
        h("span", { class: "sx-comp-name", text: c.label }),
        h("span", { class: "sx-comp-n", text: unassigned ? String(n.below_threshold) : String(n.assigned) + (n.below_threshold ? " + " + n.below_threshold : "") }),
        bar
      ])]);
    });
    var uncolored = model.compartments.length - Object.keys(model.colors).length;
    var list = h("ul", { class: "sx-comps" }, rows);
    var tools = h("div", { class: "sx-comp-tools" }, [
      h("input", { type: "search", "data-sx": "compartment-search", placeholder: "Find a compartment", "aria-label": "Find a compartment", oninput: function () {
        var needle = this.value.trim().toLowerCase();
        Array.prototype.forEach.call(list.children, function (li) { li.hidden = !!needle && li.textContent.toLowerCase().indexOf(needle) < 0; });
      } }),
      h("select", { "data-sx": "compartment-sort", "aria-label": "Sort compartments", onchange: function () { self.set({ compSort: this.value, page: st.page }); } }, [
        ["source", "Source order"], ["name", "Name"], ["assigned", "Most " + statusLabel(layer, "assigned")], ["other", "Most " + word]
      ].filter(function (o) { return o[0] !== "other" || hasBelow; }).filter(function (o) { return !(unassigned && o[0] === "assigned"); }).map(function (o) {
        return h("option", { value: o[0], text: o[1], selected: st.compSort === o[0] });
      }))
    ]);
    return this.panel("compartments", unassigned ? "Compartment named by the method" : "Compartments", layer, [
      h("p", { class: "sx-muted", text: unassigned
        ? layer.label + ". Number of protein groups without a final call, by the compartment the method named."
        : layer.label + ". Counts are protein groups with a final call" + (hasBelow ? ", plus those the method named for this compartment whose final call is \"" + word + "\" (pale bar)." : ".") }),
      tools, list,
      uncolored > 0 ? h("p", { class: "sx-muted", text: "The " + MAX_COLORS + " largest compartments have their own colour. Select any compartment to highlight it." }) : null
    ]);
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

  // One line that keeps both published facts apart: the final call, and (when
  // there is no final call) the compartment the method named.
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

  Explorer.prototype.tablePanel = function (layer, chips) {
    var self = this, model = this.model, st = this.state, rows = this.filtered;
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (st.page >= pages) st.page = pages - 1;
    var slice = rows.slice(st.page * PAGE, st.page * PAGE + PAGE);
    var sortBtn = function (key, text, firstDir) {
      var on = st.sort && st.sort.key === key, dir = on ? st.sort.dir : null;
      return h("button", { type: "button", class: "sx-sort" + (on ? " sx-on" : ""), "data-sort": key, title: "Sort by " + text,
        text: text + (on ? (dir === "desc" ? " ↓" : " ↑") : ""),
        onclick: function () { self.set({ sort: { key: key, dir: on ? (dir === "asc" ? "desc" : "asc") : (firstDir || "asc") } }); } });
    };
    var ariaSort = function (keys) {
      var on = st.sort && keys.indexOf(st.sort.key) >= 0;
      return on ? (st.sort.dir === "desc" ? "descending" : "ascending") : null;
    };
    var head = h("tr", {}, [h("th", { "aria-sort": ariaSort(["group"]) }, [sortBtn("group", "Protein group")]),
      h("th", { "aria-sort": ariaSort(["genes"]) }, [sortBtn("genes", "Genes")])].concat(model.layers.map(function (l) {
      return h("th", { class: l.id === layer.id ? "sx-col-on" : null, "aria-sort": ariaSort(["c:" + l.id, "s:" + l.id]) }, [
        h("div", {}, [sortBtn("c:" + l.id, l.label)]), badge(l.evidence_type),
        l.score ? h("div", {}, [sortBtn("s:" + l.id, l.score.name, "desc")]) : null]);
    })));
    var body = slice.map(function (e) {
      var genes = entityGenes(e);
      var geneCell = genes.length ? genes.map(function (g, i) {
        return h("span", {}, [i ? document.createTextNode(", ") : null, link(self.geneText(g), self.adapter.geneUrl && self.adapter.geneUrl(g))]);
      }) : [h("span", { class: "sx-tag", text: "no gene mapping" })];
      if (genes.length > 1) geneCell.push(h("span", { class: "sx-tag", title: "This protein group cannot be resolved to a single gene.", text: genes.length + " genes" }));
      if (mappingStatus(e) === "partial") geneCell.push(h("span", { class: "sx-tag", text: "partly mapped" }));
      var name = e.label || e.members[0].description || "";
      return h("tr", { class: e.id === st.entity ? "sx-row-on" : null, "data-entity": e.id, tabindex: "0",
        onclick: function (ev) { if (ev.target.tagName !== "A") self.set({ entity: e.id }); },
        onkeydown: function (ev) { if (ev.key === "Enter") self.set({ entity: e.id }); } }, [
        h("td", {}, [h("div", { class: "sx-mono", text: e.members[0].id + (e.members.length > 1 ? " +" + (e.members.length - 1) : "") }),
          name ? h("div", { class: "sx-muted", text: name }) : null,
          e.detected === false ? h("span", { class: "sx-tag", text: "not detected in this experiment" }) : null]),
        h("td", {}, geneCell)
      ].concat(model.layers.map(function (l) {
        var a = model.byLayer[l.id][e.id];
        if (!a) return h("td", { class: "sx-muted", text: "" });
        return h("td", { class: a.status === "assigned" ? null : "sx-muted" }, [
          h("div", { text: self.callText(a, l) }), a.score != null ? h("div", { class: "sx-mono", text: formatScore(a.score) }) : null,
          trainingSet(model, l.id)[e.id] ? h("span", { class: "sx-tag", text: "training input" }) : null]);
      })));
    });
    var actions = [h("button", { type: "button", "data-sx": "export", text: "Download table (TSV)", onclick: function () { self.exportTSV(); } })];
    (this.adapter.actions || []).forEach(function (act) {
      actions.push(h("button", { type: "button", "data-action": act.id, text: act.label, onclick: function () { self.runAction(act); } }));
    });
    return this.panel("table", "Protein groups", null, [
      h("div", { class: "sx-tablebar" }, [h("span", { "data-sx": "count", text: rows.length + " of " + model.entities.length + " protein groups" + (this.undetected ? " (" + this.undetected + " of the " + model.entities.length + " are listed by an annotation layer but were not detected)" : "") })].concat(chips, [h("span", { class: "sx-grow" })], actions)),
      h("div", { class: "sx-scroll" }, [h("table", { class: "sx-table" }, [h("thead", {}, [head]), h("tbody", {}, body)])]),
      rows.length ? null : h("p", { class: "sx-muted", text: "No protein groups match." }),
      pages > 1 ? h("div", { class: "sx-pager" }, [
        h("button", { type: "button", "data-sx": "prev", disabled: st.page === 0, text: "Previous", onclick: function () { self.set({ page: st.page - 1 }); } }),
        h("span", { text: "Page " + (st.page + 1) + " of " + pages }),
        h("button", { type: "button", "data-sx": "next", disabled: st.page >= pages - 1, text: "Next", onclick: function () { self.set({ page: st.page + 1 }); } })
      ]) : null
    ]);
  };

  Explorer.prototype.context = function () {
    var genes = {}, model = this.model;
    this.filtered.forEach(function (e) { entityGenes(e).forEach(function (g) { genes[g] = true; }); });
    var ids = this.filtered.map(function (e) { return e.id; }), map = model.byLayer[this.state.layer] || {}, comp = this.state.compartment;
    var called = ids.filter(function (id) { return map[id] && map[id].status === "assigned"; });
    return { genes: Object.keys(genes).sort(), backgroundGenes: detectedGenes(model), entities: ids,
             // for enrichment: listed groups with a final call, one gene per group, and the matching background
             study: studyGenes(model, called), studyBackground: detectedGenes(model, true),
             layer: this.state.layer, layerLabel: model.layerById[this.state.layer].label,
             compartment: comp, compartmentLabel: comp ? model.compById[comp].label : null,
             view: this.state.view, dataset: model.bundle.dataset.id };
  };

  // An action may return a DOM node (or a promise of one). It is shown in an
  // analysis panel under the table until the selection changes.
  Explorer.prototype.runAction = function (act) {
    var self = this, token = {};
    this.actionToken = token;
    var show = function (node) { if (self.actionToken === token && node && node.nodeType === 1) self.set({ analysis: node, page: self.state.page }); };
    var out;
    try { out = act.run(this.context(), this); } catch (err) { out = h("p", { class: "sx-error", text: "The analysis failed: " + err.message }); }
    if (out && typeof out.then === "function") {
      show(h("p", { class: "sx-muted", text: "Running…" }));
      out.then(show, function (err) { show(h("p", { class: "sx-error", text: "The analysis failed: " + err.message })); });
    } else show(out);
  };

  // What other layers say about the protein groups this layer left without a call.
  Explorer.prototype.otherEvidencePanel = function (layer) {
    var model = this.model, ids = this.filtered.map(function (e) { return e.id; });
    var rows = model.layers.filter(function (l) { return l.id !== layer.id; }).map(function (l) {
      var map = model.byLayer[l.id], n = 0, top = {};
      ids.forEach(function (id) { calls(map[id]).forEach(function (c, i) { if (!i) n++; top[c] = (top[c] || 0) + 1; }); });
      var best = Object.keys(top).sort(function (a, b) { return top[b] - top[a]; }).slice(0, 3).map(function (c) { return model.compById[c].label + " " + top[c]; });
      return h("tr", { "data-layer": l.id }, [h("th", {}, [document.createTextNode(l.label + " "), badge(l.evidence_type)]), h("td", { text: String(n) }), h("td", { class: "sx-muted", text: best.join(", ") })]);
    });
    if (!rows.length) return null;
    return this.panel("other-evidence", "Other evidence for these protein groups", null, [
      h("p", { class: "sx-muted", text: "How many of the " + ids.length + " listed protein groups carry a call in each of the other layers. The layers stay separate; nothing here changes the published result." }),
      h("table", { class: "sx-matrix sx-wide" }, [h("thead", {}, [h("tr", {}, [h("th", { text: "Layer" }), h("th", { text: "With a call" }), h("th", { text: "Most frequent" })])]), h("tbody", {}, rows)])
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

  Explorer.prototype.detailPanel = function () {
    var self = this, model = this.model, st = this.state, e = model.entityById[st.entity];
    if (!e) return h("section", { class: "sx-panel", "data-sx": "detail" }, [h("h3", { text: "Details" }), h("p", { class: "sx-muted", text: "Select a protein group in the table" + (model.capabilities.embeddings.length ? " or on the map." : ".") })]);
    var genes = entityGenes(e);
    var members = h("table", { class: "sx-table sx-compact", "data-sx": "members" }, [
      h("thead", {}, [h("tr", {}, [h("th", { text: "Member" }), h("th", { text: "Gene" }), h("th", { text: "Description" })])]),
      h("tbody", {}, e.members.map(function (m) {
        return h("tr", {}, [h("td", { class: "sx-mono" }, [link(m.id, self.adapter.memberUrl && self.adapter.memberUrl(m.id))]),
          h("td", {}, [m.gene != null ? link(self.geneText(m.gene), self.adapter.geneUrl && self.adapter.geneUrl(m.gene)) : h("span", { class: "sx-tag", text: "no gene mapping" })]),
          h("td", { text: m.description || "" })]);
      }))
    ]);
    var notes = [];
    if (genes.length > 1) notes.push(h("p", { class: "sx-notice", "data-sx": "multi-gene-note", text: "This protein group contains proteins from " + genes.length + " genes. The measurement cannot be attributed to one of them, so every result here applies to the group as a whole." }));
    if (e.mapping_note) notes.push(h("p", { class: "sx-muted", text: e.mapping_note }));
    if (e.detected === false) notes.push(h("p", { class: "sx-notice", text: "Listed by an annotation layer but not detected in this experiment." }));
    genes.forEach(function (g) {
      var others = model.geneIndex[g].filter(function (id) { return id !== e.id; });
      if (others.length) notes.push(h("p", { class: "sx-muted" }, [document.createTextNode(self.geneText(g) + " also appears in " + others.length + " other protein group(s): ")].concat(
        others.map(function (id) { return h("button", { type: "button", class: "sx-linkbtn", text: model.entityById[id].members[0].id, onclick: function () { self.set({ entity: id }); } }); }))));
    });

    var sections = EVIDENCE_ORDER.map(function (ev) {
      var content;
      if (ev === "measured_profile") {
        content = model.capabilities.profiles ? self.profileChart(e) : h("p", { class: "sx-muted", text: model.capabilities.reasons.profiles });
      } else {
        var layers = model.layers.filter(function (l) { return l.evidence_type === ev && model.byLayer[l.id][e.id]; });
        if (!layers.length) return null;
        content = h("ul", { class: "sx-assign" }, layers.map(function (l) {
          var a = model.byLayer[l.id][e.id], bits = [h("strong", { text: l.label }), document.createTextNode(": " + self.callText(a, l))];
          var fed = trainingSet(model, l.id)[e.id];
          if (fed) bits.push(h("div", { class: "sx-notice", "data-sx": "training-input", text: "This protein group was a training input (" + model.layerById[fed].label + "). Its class here was supplied to the method, not predicted by it." }));
          if (a.score != null) bits.push(h("span", { class: "sx-mono", "data-score": l.id, text: "  " + l.score.name + " = " + formatScore(a.score) }));
          var attrs = a.attributes || {};
          Object.keys(attrs).forEach(function (k) {
            var v = attrs[k];
            bits.push(h("span", { class: "sx-muted", text: "  " + ((l.attribute_labels || {})[k] || k) + ": " + (v === true ? "yes" : v === false ? "no" : v) }));
          });
          bits.push(h("div", { class: "sx-muted", text: l.method.name + (l.method.software ? ", " + l.method.software : "") + ", " + SOURCE[l.source] + "." }));
          return h("li", {}, bits);
        }));
      }
      return h("div", { class: "sx-ev-row", "data-evidence": ev }, [h("div", {}, [badge(ev)]), h("div", {}, [content])]);
    });
    return h("section", { class: "sx-panel", "data-sx": "detail" }, [
      h("h3", { text: e.label || e.members[0].id + (e.members.length > 1 ? " and " + (e.members.length - 1) + " more" : "") })
    ].concat(notes, [members], sections));
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
