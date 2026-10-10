/* Browser tests for the explorer. Open tests/js/test.html over http from the
   module's own directory; no host site is involved. Results land in the page
   and in window.__sxResults. Only synthetic fixtures are used. */
(function () {
  "use strict";
  var SX = window.SpatialExplorer, C = SX.core;
  var FIX = "../fixtures/", tests = [], results = [];
  var stage = document.getElementById("stage");

  function test(name, fn) { tests.push({ name: name, fn: fn }); }
  function ok(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
  function eq(a, b, msg) {
    var x = JSON.stringify(a), y = JSON.stringify(b);
    if (x !== y) throw new Error((msg || "not equal") + ": " + x.slice(0, 160) + " vs " + y.slice(0, 160));
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function load(name) { return fetch(FIX + name).then(function (r) { return r.json(); }); }
  function fresh() { stage.textContent = ""; var d = document.createElement("div"); stage.appendChild(d); return d; }
  function q(el, sel) { return el.querySelector(sel); }
  function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function mount(bundle, opts) {
    var o = opts || {}; o.bundle = bundle;
    return SX.mount(fresh(), o);
  }
  function sortTable(t) { var o = {}; Object.keys(t).sort().forEach(function (k) { o[k] = t[k]; }); return o; }

  var F = {}, EXPECT;
  var NAMES = ["alpha.bundle.json", "beta.bundle.json", "beta.derived.bundle.json", "alpha.assignments-only.bundle.json"];

  test("fixtures load and pass the shape check", function () {
    NAMES.forEach(function (n) { eq(C.checkBundle(F[n]), [], n); ok(F[n].dataset.synthetic === true, n + " must be synthetic"); });
  });

  test("shape check refuses foreign, future and unattributed bundles", function () {
    ok(C.checkBundle({}).length > 0);
    var b = clone(F["alpha.bundle.json"]); b.schema_version = "2.0.0"; ok(C.checkBundle(b).length === 1);
    b = clone(F["alpha.bundle.json"]); delete b.dataset.license; ok(C.checkBundle(b).length === 1);
    b = clone(F["alpha.bundle.json"]); delete b.dataset.provenance; ok(C.checkBundle(b).length === 1);
  });

  test("capabilities follow the data, not the dataset name", function () {
    var a = C.capabilities(F["alpha.bundle.json"]);
    ok(a.profiles === true); eq(a.embeddings, ["author-map"]);
    var o = C.capabilities(F["alpha.assignments-only.bundle.json"]);
    ok(o.profiles === false && o.embeddings.length === 0 && o.reasons.profiles && o.reasons.embeddings);
    var b = C.capabilities(F["beta.bundle.json"]);
    ok(b.profiles === true && b.embeddings.length === 0);
    eq(C.capabilities(F["beta.derived.bundle.json"]).embeddings, ["pca"]);
    var bad = clone(F["alpha.bundle.json"]);
    Object.keys(bad.profiles.values).forEach(function (k) { bad.profiles.values[k] = [1, 2]; });
    ok(C.capabilities(bad).profiles === false, "profiles of the wrong length are not usable");
    bad = clone(F["alpha.bundle.json"]); bad.profiles.evidence_type = "computational_assignment";
    ok(C.capabilities(bad).profiles === false, "profiles must be declared as measured");
  });

  test("layer counts, concordance, mapping and background match the Python reference", function () {
    ["alpha.bundle.json", "beta.bundle.json", "alpha.assignments-only.bundle.json"].forEach(function (n) {
      var m = C.indexBundle(clone(F[n])), want = EXPECT[n];
      m.layers.forEach(function (l) { eq(sortTable(C.layerCounts(m, l.id)), sortTable(want.layer_counts[l.id]), n + " counts " + l.id); });
      Object.keys(want.concordance).forEach(function (key) {
        var ids = key.split("|"), got = C.concordance(m, ids[0], ids[1]), w = want.concordance[key];
        eq([got.shared, got.both, got.agree], [w.n_shared, w.n_both_assigned, w.n_agree], n + " concordance " + key);
        var gt = {}; Object.keys(got.table).forEach(function (k) { gt[k] = sortTable(got.table[k]); });
        var wt = {}; Object.keys(w.table).forEach(function (k) { wt[k] = sortTable(w.table[k]); });
        eq(sortTable(gt), sortTable(wt), n + " table " + key);
      });
      eq(C.detectedGenes(m), want.detected_genes, n + " detected genes");
      m.entities.forEach(function (e) { ok(C.mappingStatus(e) === want.mapping_status[e.id], e.id); });
      Object.keys(want.gene_groups).forEach(function (g) { eq(m.geneIndex[g], want.gene_groups[g]); });
    });
  });

  test("protein groups keep every gene, and genes keep every group", function () {
    var m = C.indexBundle(clone(F["alpha.bundle.json"]));
    var multi = m.entities.filter(function (e) { return C.entityGenes(e).length > 1; });
    eq(multi.map(function (e) { return e.id; }), m.bundle.dataset.mapping.multi_gene_entities);
    multi.forEach(function (e) { C.entityGenes(e).forEach(function (g) { ok(m.geneIndex[g].indexOf(e.id) >= 0); }); });
    var shared = Object.keys(EXPECT["alpha.bundle.json"].gene_groups)[0], sum = C.geneSummary(m, shared);
    ok(sum.length === 2, "one gene in two groups gives two summaries");
    sum.forEach(function (x) {
      ok(x.assignments.length > 0);
      var ids = x.assignments.map(function (a) { return a.layer; });
      ok(ids.length === new Set(ids).size, "one row per layer");
      x.assignments.forEach(function (a) { ok(SX.EVIDENCE[a.evidence_type], "evidence type travels with every row"); });
    });
    eq(C.geneSummary(m, "no-such-gene"), []);
  });

  test("scores are shown exactly as supplied", function () {
    eq(C.formatScore(0.123456789012345), "0.123456789012345");
    eq(C.formatScore(0.30000000000000004), "0.30000000000000004");
    eq(C.formatScore(null), "");
    var b = F["alpha.bundle.json"];
    b.layers.forEach(function (l) { l.assignments.forEach(function (a) { if (a.score != null) ok(Number(C.formatScore(a.score)) === a.score); }); });
  });

  test("filtering by compartment, status, gene and text", function () {
    var m = C.indexBundle(clone(F["alpha.bundle.json"])), want = EXPECT["alpha.bundle.json"].layer_counts.classifier;
    var base = { layer: "classifier", status: "all", query: "", compartment: null, gene: null };
    ok(C.filterEntities(m, base).length === 80);
    m.compartments.forEach(function (c) {
      var st = Object.assign({}, base, { compartment: c.id });
      ok(C.filterEntities(m, st).length === want[c.id].assigned + want[c.id].below_threshold);
      st.status = "assigned"; ok(C.filterEntities(m, st).length === want[c.id].assigned);
    });
    var gene = Object.keys(EXPECT["alpha.bundle.json"].gene_groups)[0];
    ok(C.filterEntities(m, Object.assign({}, base, { gene: gene })).length === 2);
    ok(C.filterEntities(m, Object.assign({}, base, { query: "ep_x0008" })).length === 1, "search finds unmapped accessions");
    ok(C.filterEntities(m, Object.assign({}, base, { query: "zebra" }), { searchText: function () { return "Zebra"; } }).length === 0, "blob is cached per model");
    var m2 = C.indexBundle(clone(F["alpha.bundle.json"]));
    ok(C.filterEntities(m2, Object.assign({}, base, { query: "zebra" }), { searchText: function (e) { return e.members.length > 1 ? "Zebra" : ""; } }).length === 7, "adapter text is searched");
  });

  test("export keeps attribution, licence, layer evidence and exact scores", function () {
    var m = C.indexBundle(clone(F["alpha.bundle.json"])), tsv = C.toTSV(m, m.entities), lines = tsv.replace(/\n$/, "").split("\n");
    ok(lines.length === 80 + 5);
    ok(lines[1].indexOf(m.bundle.dataset.citation.text) >= 0 && lines[2].indexOf("CC0-1.0") >= 0);
    ok(lines[3].indexOf("classifier = Computational assignment") >= 0 && lines[3].indexOf("markers = Curated annotation") >= 0);
    var head = lines[4].split("\t"), col = head.indexOf("classifier.classifier.score");
    ok(col > 0, "score column carries the published score name");
    m.entities.forEach(function (e, i) {
      var cells = lines[5 + i].split("\t");
      ok(cells.length === head.length, "ragged row " + i);
      ok(Number(cells[col]) === m.byLayer.classifier[e.id].score);
      ok(cells[2] === C.entityGenes(e).join(";"));
    });
  });

  test("histogram bins every value", function () {
    var hst = C.histogram([0, 0.1, 0.5, 0.99, 1], 10);
    eq([hst.lo, hst.hi], [0, 1]); ok(hst.counts.reduce(function (a, b) { return a + b; }) === 5);
    ok(C.histogram([], 10).counts.length === 0);
    ok(C.histogram([3, 3, 3], 4).counts.reduce(function (a, b) { return a + b; }) === 3);
  });

  /* ----- the dashboard ----- */

  function type(ex, text) { ex.search.value = text; ex.search.dispatchEvent(new Event("input")); }
  function press(target, key) { target.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true, cancelable: true })); }
  function texts(el, sel) { return qa(el, sel).map(function (n) { return n.textContent; }); }
  function change(node, value) { node.value = value; node.dispatchEvent(new Event("change")); }
  function radio(el, value) { var r = q(el, '[data-sx=show] input[value="' + value + '"]'); r.checked = true; r.dispatchEvent(new Event("change")); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); }
  var ALPHA = "alpha.bundle.json", BETA = "beta.bundle.json", ONLY = "alpha.assignments-only.bundle.json";

  test("dashboard layout: sidebar, map panel, protein details, and three bottom panels", function () {
    return mount(F[ALPHA], { title: "Example Explorer", subtitle: "A subtitle." }).then(function (ex) {
      var el = ex.el;
      ok(q(el, ".sx-title").firstChild.textContent === "Example Explorer" && q(el, "[data-sx=subtitle]").textContent === "A subtitle.");
      ok(q(el, "[data-sx=status]").textContent === "Synthetic");
      eq(qa(el, ".sx-actions [data-action]").map(function (b) { return b.getAttribute("data-action"); }), ["about", "help", "export", "cite"]);
      eq(texts(el, ".sx-sidebar h2"), ["Explore", "Quick search", "Filter by compartment", "Show in map"]);
      eq(qa(el, "[data-sx=nav] [data-mode]").map(function (b) { return b.textContent; }),
         ["Spatial map", "Protein search", "Compartments", "Marker proteins", "Enrichment analysis", "Data and methods"]);
      ok(q(el, '[data-sx=nav] [data-mode="map"]').getAttribute("aria-current") === "page");
      eq(qa(el, ".sx-row-top > section").map(function (x) { return x.getAttribute("data-sx"); }), ["central", "details"]);
      eq(qa(el, ".sx-row-bottom > section").map(function (x) { return x.getAttribute("data-sx"); }), ["compartments", "scores", "enrichment"]);
      eq(texts(el, ".sx-row-bottom .sx-panel-head h3"), ["Compartments", "Score distribution", "Functional enrichment"]);
      ok(q(el, "[data-sx=central] h3").textContent === "Spatial proteome map" && q(el, "[data-sx=details] h3").textContent === "Protein details");
      eq(texts(el, "[data-sx=show] label"), ["All proteins", "Assigned only", "Markers only", "Unknown only"]);
      ok(q(el, "[data-sx=synthetic]") && !q(el, "[data-sx=local-only]"));
      return mount(F[ALPHA], { header: false }).then(function (bare) {
        ok(!q(bare.el, ".sx-titlebar") && q(bare.el, ".sx-sidebar") && q(bare.el, "[data-sx=central]"), "a host may supply the page header itself");
        return ex;
      });
    }).then(function (ex) {
      var el = ex.el = ex.el;
      var before = JSON.stringify(F[ALPHA]);
      ex.go({ mode: "proteins", compartment: "nuc" }); ex.select(ex.filtered[0].id); ex.go({ mode: "methods" });
      ok(JSON.stringify(F[ALPHA]) === before, "rendering must not alter the bundle");
      ex.destroy();
      ok(el.childNodes.length === 0 && !el.classList.contains("sx-root"));
    });
  });

  test("without coordinates the map panel keeps its place and shows a labelled empty state", function () {
    var only = F[ONLY], full = F[ALPHA];
    return mount(only, { mapPending: "Awaiting the matrix." }).then(function (ex) {
      var el = ex.el, none = q(el, "[data-sx=no-map]");
      ok(none.textContent.indexOf("Spatial map not yet available") >= 0 && none.textContent.indexOf("Awaiting the matrix.") > 0 && none.textContent.indexOf("Nothing here is simulated") > 0);
      ok(!q(el, "canvas") && !q(el, "[data-sx=central] svg"), "no points and no chart are drawn");
      eq(texts(el, "[data-sx=map-tabs] .sx-tab"), ["t-SNE", "PCA", "UMAP"]);
      qa(el, "[data-sx=map-tabs] .sx-tab")[1].click();
      ok(q(el, "[data-sx=no-map]") && q(el, ".sx-axis-x").textContent === "PCA 1" && q(el, "[data-sx=map-tabs] .sx-on").textContent === "PCA");
      ok(q(el, "[data-sx=color-by]").disabled && q(el, "[data-sx=point-size]").disabled);
      var want = EXPECT[ONLY].layer_counts.classifier;
      eq(texts(el, "[data-sx=legend] [data-compartment]"), only.compartments.map(function (c) { return c.label + " (" + want[c.id].assigned + ")"; }), "legend counts are real");
      ok(q(el, '[data-sx=legend] [data-show="unknown"]').textContent === "Unknown (40)");
      ex.select(only.entities[0].id);
      var pend = q(el, "[data-sx=pending-profile]");
      ok(pend.textContent.indexOf("Fractionation profile not yet available") === 0 && !q(el, "[data-sx=profile-chart]") && !q(el, "path.sx-line"));
      var b = clone(only); b.fractions = clone(full.fractions); b.profiles = clone(full.profiles);
      return mount(b);
    }).then(function (ex) {
      ex.select(ex.model.entities[1].id);
      ok(q(ex.el, "[data-sx=no-map]") && qa(ex.el, "[data-sx=profile-chart] circle").length === 8 && !q(ex.el, "[data-sx=pending-profile]"), "profiles alone switch on the profile, not the map");
      return mount(full);
    }).then(function (ex) {
      var el = ex.el;
      ok(q(el, "[data-sx=map-canvas]") && !q(el, "[data-sx=no-map]") && ex.points.length === 80, "with coordinates the map is drawn");
      eq(texts(el, "[data-sx=map-tabs] .sx-tab"), ["Author-supplied map (synthetic)"]);
      ok(!q(el, "[data-sx=point-size]").disabled && q(el, "[data-sx=map]").textContent.indexOf("from the publication") > 0);
      change(q(el, "[data-sx=point-size]"), "large");
      ok(ex.pointRadius > 4);
      return mount(F["beta.derived.bundle.json"], { initial: { layer: "model" } });
    }).then(function (ex) {
      ok(q(ex.el, "[data-sx=map]").textContent.indexOf("computed by this software") > 0, "a computed map is labelled as computed");
    });
  });

  test("compartment table and legend show the real counts, with consistent colours", function () {
    return mount(F[ALPHA]).then(function (ex) {
      var el = ex.el, want = EXPECT[ALPHA].layer_counts.classifier, rows = qa(el, "[data-sx=compartments] tbody tr[data-compartment]");
      eq(texts(el, "[data-sx=compartments] thead th"), ["Compartment", "Proteins", "Markers", "GO term"]);
      rows.forEach(function (r) {
        var id = r.getAttribute("data-compartment"), cells = qa(r, "td");
        ok(+cells[1].textContent === want[id].assigned, "proteins " + id);
        ok(+cells[2].textContent === 3, "markers " + id);
      });
      ok(q(el, '[data-sx=compartments] tr[data-show="unknown"] td:nth-child(2)').textContent === "40");
      var tableColors = rows.map(function (r) { return q(r, ".sx-dot").style.backgroundColor; });
      var legendColors = qa(el, "[data-sx=legend] [data-compartment] .sx-dot").map(function (d) { return d.style.backgroundColor; });
      eq(tableColors, legendColors);
      ok(new Set(tableColors).size === 4 && tableColors.every(Boolean), "every compartment has its own colour");
      rows[2].click();
      ok(ex.state.compartment === "nuc" && q(el, "[data-sx=compartment-filter]").value === "nuc" && q(el, '[data-sx=compartments] tr[data-compartment="nuc"]').classList.contains("sx-row-on"));
      ok(q(el, '[data-sx=legend] [data-compartment="nuc"]').getAttribute("aria-pressed") === "true");
      ex.select(ex.model.entities.filter(function (e) { return C.finalCall(ex.model.byLayer.classifier[e.id]) === "nuc"; })[0].id);
      ok(q(el, "[data-sx=details] [data-sx=loc] .sx-dot").style.backgroundColor === tableColors[2], "the colour follows the compartment into the details");
      q(el, '[data-sx=nav] [data-mode="compartments"]').click();
      ok(q(el, "[data-sx=central]").getAttribute("data-mode") === "compartments" && qa(el, "[data-sx=central] tbody tr").length === 5);
      q(el, '[data-sx=central] tr[data-compartment="mem"]').click();
      ok(ex.state.mode === "proteins" && ex.state.compartment === "mem" && ex.filtered.length === want.mem.assigned);
    });
  });

  test("quick search finds a gene and shows its localization in two interactions", function () {
    var b = clone(F[ALPHA]), target = b.entities[20], gene = target.members[0].gene;
    b.entities[30].members[0].id = "QP_000030.2";
    return mount(b, { adapter: { geneLabel: function (g) { return g === gene ? "abcA" : g; }, geneName: function (g) { return g === gene ? "ABC transporter A" : ""; } } }).then(function (ex) {
      var el = ex.el, a = ex.model.byLayer.classifier[target.id];
      type(ex, "abca");
      var first = q(el, "[data-sx=suggestions] .sx-suggest");
      ok(first.getAttribute("data-entity") === target.id && first.textContent.indexOf("abcA") === 0);
      press(ex.search, "Enter");
      ok(ex.state.entity === target.id && q(el, "[data-sx=drawer-title]").textContent === gene);
      ok(q(el, "[data-sx=protein-name]").textContent === "ABC transporter A (abcA)", "the host's gene name is preferred");
      ok(q(el, "[data-score=classifier]").textContent === String(a.score), "reported score, exactly");
      ok(q(el, "[data-row=assignment]").textContent.indexOf(a.status === "assigned" ? ex.model.compById[a.compartment].label : "No final call") >= 0);
      [[b.entities[30].members[0].gene, 30], ["qp_000030.2", 30], ["QP_000030", 30], [b.dataset.mapping.unmapped_entities[0], 7]].forEach(function (c) {
        ok(ex.matches(c[0])[0].e === b.entities[c[1]], "finds " + c[0]);
      });
      type(ex, "zzzz");
      ok(q(el, ".sx-suggest-none").textContent.indexOf("No protein matches") === 0);
      type(ex, "EPG00");
      ok(qa(el, "[data-sx=suggestions] .sx-suggest[data-entity]").length === 8 && q(el, "[data-sx=all-results]"));
      press(ex.search, "ArrowDown"); press(ex.search, "ArrowDown");
      ok(ex.search.getAttribute("aria-activedescendant") === "sx-opt-1");
      press(ex.search, "Escape"); type(ex, "EPG00"); press(ex.search, "Enter");
      ok(ex.state.mode === "proteins" && ex.state.query === "EPG00" && ex.filtered.length === ex.matches("EPG00").length, "an ambiguous query lists every match");
      ok(q(el, "[data-sx=central] h3").textContent.indexOf("matching “EPG00”") > 0);
      q(el, "[data-sx=clear-query]").click();
      ok(ex.state.query === "" && ex.filtered.length === 80);
    });
  });

  test("compartment filter and the display options select what is listed", function () {
    return mount(F[ALPHA]).then(function (ex) {
      var el = ex.el, want = EXPECT[ALPHA].layer_counts.classifier, map = ex.model.byLayer.classifier;
      q(el, '[data-sx=nav] [data-mode="proteins"]').click();
      ok(ex.filtered.length === 80 && q(el, "[data-sx=count]").textContent === "Showing 50 of 80");
      var names = ex.filtered.map(function (e) { return (C.entityGenes(e)[0] || "").toLowerCase(); }).filter(Boolean);
      eq(names, names.slice().sort(), "gene-name order by default");
      radio(el, "assigned");
      ok(ex.filtered.length === 40 && ex.filtered.every(function (e) { return map[e.id].status === "assigned"; }));
      change(q(el, "[data-sx=compartment-filter]"), "mem");
      ok(ex.filtered.length === want.mem.assigned && q(el, "[data-sx=central] h3").textContent === "Assigned proteins in Membrane");
      radio(el, "unknown");
      ok(ex.filtered.length === want.mem.below_threshold && ex.filtered.every(function (e) { return map[e.id].status !== "assigned" && map[e.id].compartment === "mem"; }));
      ok(q(el, "[data-sx=rows] .sx-closest .sx-dot-hollow") && q(el, "[data-sx=rows] td.sx-loc").textContent.indexOf("unknown") === 0, "the closest class is drawn hollow, apart from an assignment");
      change(q(el, "[data-sx=compartment-filter]"), "");
      ok(ex.filtered.length === 40 && q(el, "[data-sx=central] h3").textContent === "Proteins without a final call");
      q(el, '[data-sx=nav] [data-mode="markers"]').click();
      ok(ex.state.show === "markers" && ex.filtered.length === 12 && q(el, '[data-sx=nav] [data-mode="markers"]').classList.contains("sx-on") && !q(el, '[data-sx=nav] [data-mode="proteins"]').classList.contains("sx-on"));
      ok(texts(el, "[data-sx=rows] [data-chip=marker]").every(function (t) { return t === "Training marker"; }));
      radio(el, "all");
      q(el, '[data-sort="s:classifier"]').click();
      var scores = ex.filtered.map(function (e) { return map[e.id].score; });
      eq(scores, scores.slice().sort(function (x, y) { return y - x; }), "sorting by reported score stays available");
      ok(ex.filtered.length === 80, "sorting never drops a protein");
      ex.go({ mode: "map", show: "all" });
      q(el, '[data-sx=legend] [data-show="unknown"]').click();
      ok(ex.state.show === "unknown" && q(el, "[data-sx=show] input:checked").value === "unknown", "the legend and the options stay in step");
      return mount(F[BETA]);
    }).then(function (ex) {
      var el = ex.el;
      ex.showUnassigned();
      ok(qa(el, "[data-sx=rows] tr[data-entity]").length === 50 && q(el, "[data-sx=more]").textContent === "Show 10 more");
      q(el, "[data-sx=more]").click();
      ok(qa(el, "[data-sx=rows] tr[data-entity]").length === 60 && q(el, "[data-sx=more]").hidden && q(el, "[data-sx=count]").textContent === "60 protein groups");
    });
  });

  test("protein details: overview, spatial data, annotations and sequences", function () {
    var b = F[ALPHA], extra = null;
    var adapter = { geneUrl: function (g) { return "/gene/" + g; }, memberUrl: function () { return "javascript:alert(1)"; }, geneLinkText: "host gene page",
      overviewRows: function (e) { extra = e.id; var n = document.createElement("span"); n.textContent = "host value"; return [["Host row", n, "host"]]; } };
    return mount(b, { adapter: adapter }).then(function (ex) {
      var el = ex.el, d = q(el, "[data-sx=details]");
      ok(q(d, "[data-sx=no-protein]").textContent.indexOf("No protein selected") === 0);
      ex.go({ mode: "proteins", compartment: "cyt" });
      var row = q(el, '[data-sx=rows] tr[data-entity="' + b.entities[0].id + '"]');
      ok(row.getAttribute("role") === "button" && row.getAttribute("tabindex") === "0");
      press(row, "Enter");
      ok(ex.state.entity === b.entities[0].id && ex.state.mode === "proteins" && q(el, "tr.sx-row-on") === q(el, '[data-sx=rows] tr[data-entity="' + b.entities[0].id + '"]'));
      eq(texts(d, "[data-sx=detail-tabs] .sx-tab"), ["Overview", "Spatial data", "Annotations", "Sequences"]);
      eq(texts(d, ".sx-kv th"), ["Protein group", "Assignment", "Marker score", "Marker", "Host row"].map(function (t) { return t === "Marker score" ? "Classifier assignment score" : t; }));
      ok(q(d, "[data-sx=status-pill]").textContent === "Assigned" && q(d, "[data-row=assignment]").textContent.indexOf("Cytosol") >= 0);
      ok(q(d, "[data-row=marker]").textContent.indexOf("Yes, used to train the classifier (Cytosol)") >= 0 && q(d, "[data-sx=training-input]"));
      ok(q(d, "[data-row=host] td").textContent === "host value" && extra === b.entities[0].id);
      ok(q(d, "[data-sx=gene-link]").getAttribute("href") === "/gene/" + b.entities[0].members[0].gene && q(d, "[data-sx=gene-link]").getAttribute("aria-label").indexOf("host gene page") > 0);
      ok(!/probab|confiden|%/i.test(q(d, "[data-row=score]").textContent), "the score is not relabelled");
      ok(q(d, ".sx-subhead h4").textContent === "Fractionation profile" && q(d, "[data-sx=profile-chart]"));
      qa(d, "[data-sx=detail-tabs] .sx-tab")[1].click();
      ok(ex.state.detailTab === "spatial" && q(d, "[data-sx=score-note]").textContent.indexOf("does not define the scale") >= 0);
      ok(q(d, '[data-sx=from-authors] [data-layer="markers"]').textContent.indexOf("Cytosol") > 0 && !q(d, '[data-layer="markers"] .sx-verdict'), "a training set is never scored as agreeing");
      qa(d, "[data-sx=detail-tabs] .sx-tab")[2].click();
      ok(q(d, '[data-sx=elsewhere] [data-layer="targeting"] .sx-badge').textContent === "Sequence prediction");
      qa(d, "[data-sx=detail-tabs] .sx-tab")[3].click();
      ok(qa(d, "[data-sx=members] tbody tr").length === 1 && !q(d, "a[href^=javascript]"), "unsafe link schemes are dropped");
      ex.set({ detailTab: "overview", entity: b.dataset.mapping.multi_gene_entities[0] });
      ok(q(d, "[data-sx=multi-gene-note]").textContent.indexOf("covering 2 genes") > 0 && q(d, "[data-row=group]").textContent.indexOf("(2 genes)") > 0);
      ex.select(b.dataset.mapping.unmapped_entities[0]);
      ok(q(d, "[data-row=group]").textContent.indexOf("(0 genes)") > 0 && !q(d, "[data-sx=gene-link]") && q(d, "[data-sx=drawer-title]").textContent === b.dataset.mapping.unmapped_entities[0]);
      var unknown = b.layers[1].assignments.filter(function (a) { return a.status === "below_threshold"; })[0];
      ex.select(unknown.entity);
      ok(q(d, "[data-sx=status-pill]").textContent === "Unknown" && q(d, "[data-sx=closest]").textContent.indexOf("This is not an assignment") > 0);
      ok(q(d, "[data-score=classifier]").textContent === String(unknown.score));
      var shared = Object.keys(EXPECT[ALPHA].gene_groups)[0];
      ok(ex.showGene(shared) === 2 && ex.state.mode === "proteins" && ex.filtered.length === 2 && q(d, "[data-sx=also-in]"), "a gene in two groups lists both");
      ok(ex.showGene("no-such-gene") === 0);
      ex.select(null);
      ok(q(d, "[data-sx=no-protein]"));
    });
  });

  test("score distribution uses the real scores and sets training markers apart", function () {
    return mount(F[ALPHA]).then(function (ex) {
      var el = ex.el, map = ex.model.byLayer.classifier, panel = q(el, "[data-sx=scores]");
      var count = function (sel) { return qa(panel, sel).reduce(function (n, r) { return n + parseInt(q(r, "title").textContent, 10); }, 0); };
      ok(count("rect.sx-hist:not(.sx-hist-train)") === 68 && count("rect.sx-hist-train") === 12, "every score is in a bar; training markers are a separate series");
      ok(q(panel, "[data-sx=training-note]").textContent === "12 training markers (score supplied)");
      ok(q(panel, "[data-sx=score-legend]").textContent.indexOf("68 protein groups") === 0);
      var rest = Object.keys(map).filter(function (id) { return !ex.training[id]; }).map(function (id) { return map[id].score; }).sort(function (x, y) { return x - y; });
      var med = (rest[33] + rest[34]) / 2;
      ok(q(panel, "[data-sx=median]").firstChild.textContent === "Median: " + med.toFixed(2));
      ok(q(panel, "[data-sx=median] title").textContent.indexOf("not a classification cutoff") > 0, "the median is a description, not a threshold");
      ok(q(panel, "svg").getAttribute("aria-label").indexOf("classifier.score") > 0);
      change(q(el, "[data-sx=compartment-filter]"), "mem");
      var want = EXPECT[ALPHA].layer_counts.classifier.mem.assigned;
      ok(count("rect.sx-hist") === want, "the histogram follows the filter");
      ex.go({ layer: "markers", compartment: null });
      ok(q(el, "[data-sx=scores] .sx-empty").textContent.indexOf("No scores") === 0 && !q(el, "[data-sx=histogram]"));
    });
  });

  test("functional enrichment shows what the host calculates, for the chosen compartment", function () {
    var seen = [], fail = false;
    var adapter = {
      enrichmentTabs: [{ id: "go", label: "GO terms" }, { id: "domains", label: "Protein domains", unavailable: "Not validated yet." }],
      enrichment: function (ctx, tab) {
        seen.push({ ctx: ctx, tab: tab });
        if (fail) return Promise.reject(new Error("down"));
        return Promise.resolve({ summary: "2 terms.", method: "A test.", terms: [
          { id: "T:1", name: "first term", kind: "Process", q: 1e-12, count: 5, n: ctx.study.genes.length, background: 9, backgroundN: 70, fold: 4.2, url: "/t/1" },
          { id: "T:2", name: "second term with a very long name indeed that must be cut", kind: "Function", q: 0.004, count: 2, n: ctx.study.genes.length, fold: 2 }] });
      }
    };
    return mount(F[ALPHA], { adapter: adapter }).then(function (ex) {
      var el = ex.el, panel = q(el, "[data-sx=enrichment]"), want = EXPECT[ALPHA].layer_counts.classifier.mem;
      eq(texts(panel, "[data-sx=enrich-tabs] .sx-tab"), ["GO terms", "Protein domains"]);
      ok(q(panel, "[data-sx=enrich-empty]").textContent.indexOf("Choose a compartment") === 0 && seen.length === 0, "nothing is calculated until a compartment is chosen");
      change(q(el, "[data-sx=compartment-filter]"), "mem");
      return wait().then(function () {
        var ctx = seen[0].ctx;
        ok(seen[0].tab === "go" && ctx.compartment === "mem" && ctx.compartmentLabel === "Membrane" && ctx.entities.length === want.assigned);
        ok(ctx.study.used + ctx.study.multi_gene + ctx.study.unmapped + ctx.study.undetected === want.assigned, "every assigned group is accounted for");
        eq(ctx.studyBackground, EXPECT[ALPHA].detected_single_gene_genes);
        ok(ctx.study.genes.every(function (g) { return ctx.studyBackground.indexOf(g) >= 0; }));
        var bars = qa(panel, "[data-sx=enrich-chart] rect[data-term]");
        ok(bars.length === 2 && +bars[0].getAttribute("width") > +bars[1].getAttribute("width"), "bar length follows the calculated FDR");
        ok(q(bars[0], "title").textContent.indexOf("FDR 1.0e-12") > 0 && q(panel, ".sx-axis-title").textContent === "−log10(FDR)");
        ok(q(panel, "[data-sx=enrich-target]").textContent === "Membrane");
        ex.select(ex.filtered[0].id); ex.set({ sort: { key: "genes", dir: "desc" } });
        return wait();
      }).then(function () {
        ok(seen.length === 1 && q(panel, "[data-sx=enrich-chart]"), "the result is not recalculated on a re-render");
        qa(panel, "[data-sx=enrich-tabs] .sx-tab")[1].click();
        ok(q(panel, "[data-sx=enrich-empty]").textContent === "Protein domains not availableNot validated yet." && seen.length === 1);
        qa(panel, "[data-sx=enrich-tabs] .sx-tab")[0].click();
        return wait();
      }).then(function () {
        q(panel, "[data-sx=enrich-more]").click();
        return wait();
      }).then(function () {
        ok(ex.state.mode === "enrichment" && qa(el, "[data-sx=enrich-full] tbody tr").length === 2 && q(el, "[data-sx=enrich-full-summary]").textContent === "2 terms.");
        ok(q(el, "[data-sx=enrich-full] a").getAttribute("href") === "/t/1");
        change(q(el, "[data-sx=compartment-filter]"), "");
        var nuc = ex.model.entities.filter(function (e) { return C.finalCall(ex.model.byLayer.classifier[e.id]) === "nuc"; })[0];
        ex.go({ mode: "map" }); ex.select(nuc.id);
        return wait();
      }).then(function () {
        ok(seen[seen.length - 1].ctx.compartment === "nuc" && q(panel, "[data-sx=enrich-target]").getAttribute("title") === "compartment of the selected protein");
        fail = true; change(q(el, "[data-sx=compartment-filter]"), "cyt");
        return wait();
      }).then(function () {
        ok(q(panel, "[data-sx=enrich-empty]").textContent.indexOf("could not be calculated") > 0, "a failing service is reported, not hidden");
        return mount(F[BETA]);
      }).then(function (ex2) {
        ok(q(ex2.el, "[data-sx=enrichment] [data-sx=enrich-empty]").textContent.indexOf("Enrichment is not available") === 0);
      });
    });
  });

  test("data and methods: evidence kinds, provenance and agreement, on demand", function () {
    return mount(F[ALPHA]).then(function (ex) {
      var el = ex.el;
      ok(!q(el, "[data-sx=about]"));
      q(el, ".sx-actions [data-action=about]").click();
      var about = q(el, "[data-sx=about]");
      ok(ex.state.mode === "methods" && q(el, '[data-sx=nav] [data-mode="methods"]').classList.contains("sx-on"));
      eq(qa(about, "[data-sx=evidence] .sx-ev-row").map(function (r) { return r.getAttribute("data-evidence"); }),
         ["measured_profile", "computational_assignment", "sequence_prediction", "curated_annotation"]);
      ok(q(about, "[data-sx=license]").textContent.indexOf("Creative Commons Zero") >= 0 && q(about, "[data-sx=citation]") && q(about, "[data-sx=help]"));
      ok(q(about, "[data-sx=mapping]").textContent.indexOf("3 unmapped") >= 0 && q(about, "[data-sx=mapping]").textContent.indexOf("4 groups span more than one gene") >= 0);
      ok(qa(about, "[data-sx=vocabulary] li").length === 4 && q(about, "[data-sx=provenance]").textContent.indexOf("make_fixtures.py") > 0);
      ok(q(about, "[data-sx=compare-select]").value === "targeting" && !q(about, "[data-sx=training-warning]"), "the default comparison is never the training set");
      ok(q(about, "[data-sx=concordance-skipped]") && q(about, "[data-sx=concordance-scope]").textContent.indexOf("Cytosol, Membrane, Nucleus") > 0);
      change(q(about, "[data-sx=compare-select]"), "markers");
      ok(q(el, "[data-sx=training-warning]").textContent.indexOf("not independent") > 0 && !q(el, "[data-sx=layer-select]"));
      return mount(F["beta.derived.bundle.json"], { initial: { mode: "methods" } });
    }).then(function (ex) {
      var el = ex.el;
      change(q(el, "[data-sx=layer-select]"), "nearest-centroid");
      ok(ex.state.layer === "nearest-centroid" && !q(el, '[data-sx=legend] [data-show="unknown"]') && ex.layerInfo.unassigned === 0, "switching the assignment source updates every panel");
      ok(!q(el, "[data-sx=scores] [data-sx=median]") || q(el, "[data-sx=scores] [data-sx=histogram]"));
    });
  });

  test("a source may name several compartments, and row tags show agreement", function () {
    return mount(F[BETA]).then(function (ex) {
      var el = ex.el, model = ex.model, ref = model.byLayer["reference-set"], map = model.byLayer.model, b = F[BETA], a = b.layers[0].assignments[7];
      ex.select(a.entity); ex.set({ detailTab: "annotations" });
      eq(texts(el, '[data-layer="reference-set"] .sx-place'), [a.compartment].concat(a.others).map(function (c) { return model.compById[c].label; }));
      var agree = Object.keys(ref).filter(function (id) { return map[id].status === "assigned" && C.calls(ref[id]).indexOf(map[id].compartment) >= 0; })[0];
      ex.go({ mode: "proteins", compartment: map[agree].compartment, show: "assigned" });
      var chip = q(el, '[data-sx=rows] tr[data-entity="' + agree + '"] [data-chip="reference-set"]');
      ok(chip.textContent === "Curated reference set ✓" && chip.classList.contains("sx-chip-agree"));
      return mount(F[ALPHA], { initial: { mode: "proteins", compartment: "cyt" } });
    }).then(function (ex) {
      ok(q(ex.el, "[data-sx=rows] [data-chip=marker]").textContent === "Training marker" && !q(ex.el, '[data-sx=rows] [data-chip="markers"]'), "marker sets have their own column");
      ok(!q(ex.el, '[data-sx=rows] [data-chip="targeting"]'), "sequence predictions stay out of the row summary");
    });
  });

  test("adapter: extra layers stay separate, state changes are reported, failures are contained", function () {
    var b = clone(F[ALPHA]), warned = 0, warn = console.warn, states = [], picked = [], tsv = null;
    console.warn = function () { warned++; };
    var adapter = {
      geneLabel: function (g) { return "sym-" + g; },
      extraLayers: function () {
        return Promise.resolve([
          { id: "host", label: "Host curated", short_label: "Host", evidence_type: "curated_annotation", source: "external", method: { name: "host" },
            assignments: [{ entity: b.entities[0].id, compartment: "nuc", status: "assigned" }, { entity: "ghost", compartment: "nuc", status: "assigned" }] },
          { id: "markers", label: "clash", evidence_type: "curated_annotation", source: "external", method: { name: "x" }, assignments: [] },
          { id: "vague", label: "no evidence type", source: "external", method: { name: "x" }, assignments: [] },
          { id: "sneaky", label: "pretends to be measured", evidence_type: "measured_profile", source: "external", method: { name: "x" }, assignments: [] }
        ]);
      }
    };
    return mount(b, { adapter: adapter, onState: function (s) { states.push(s); }, onSelect: function (id) { picked.push(id); }, onExport: function (t) { tsv = t; } }).then(function (ex) {
      console.warn = warn;
      var el = ex.el;
      eq(ex.model.layers.map(function (l) { return l.id; }), ["markers", "classifier", "targeting", "host"]);
      ok(warned === 4, "three refused layers and one dropped assignment are reported, got " + warned);
      eq(b.layers.length, 3, "the bundle's own layers are untouched");
      ex.go({ mode: "proteins", compartment: "cyt", show: "assigned" });
      ok(q(el, "[data-sx=rows] strong").textContent.indexOf("sym-") === 0, "host gene names are used");
      ok(q(el, '[data-sx=rows] tr[data-entity="' + b.entities[0].id + '"] [data-chip="host"]').textContent === "Host: Nucleus");
      ex.select(b.entities[0].id); ex.set({ detailTab: "annotations" });
      ok(q(el, '[data-sx=elsewhere] [data-layer="host"] .sx-verdict').textContent === "differs from the assignment");
      eq(states[states.length - 1], { mode: "proteins", compartment: "cyt", show: "assigned", entity: b.entities[0].id, gene: null, query: "", layer: "classifier" });
      eq(picked, [b.entities[0].id]);
      q(el, ".sx-actions [data-action=export]").click();
      var lines = tsv.replace(/\n$/, "").split("\n");
      ok(lines.length === 5 + ex.filtered.length && lines[2].indexOf("License:") === 2, "Download exports what is listed, with attribution");
      return mount(F[BETA], { adapter: { extraLayers: function () { return Promise.reject(new Error("host down")); }, enrichment: function () { throw new Error("boom"); } } });
    }).then(function (ex) {
      ok(ex.model.layers.length === 2 && q(ex.el, "[data-sx=compartments] tbody tr"));
      ex.go({ compartment: F[BETA].compartments[0].id });
      return wait().then(function () { ok(q(ex.el, "[data-sx=enrich-empty]").textContent.indexOf("could not be calculated") > 0 && q(ex.el, "[data-sx=histogram]"), "a failing host service leaves the rest usable"); });
    }).finally(function () { console.warn = warn; });
  });

  test("undistributable or undetected data are flagged where they appear", function () {
    var b = clone(F[ONLY]);
    b.dataset.synthetic = false; b.dataset.license.redistribution = "restricted";
    b.dataset.distribution = { status: "local-only", reason: "Reuse terms pending." };
    b.entities[0].detected = false;
    return mount(b, { initial: { mode: "proteins", compartment: "cyt" } }).then(function (ex) {
      ok(q(ex.el, "[data-sx=local-only]").textContent.indexOf("Local copy, not for distribution") === 0 && !q(ex.el, "[data-sx=synthetic]"));
      ok(q(ex.el, "[data-sx=status]").textContent === "Preview" && q(ex.el, "[data-sx=notice]").textContent.indexOf("have not been supplied") > 0);
      ok(q(ex.el, '[data-sx=rows] tr[data-entity="' + b.entities[0].id + '"]').textContent.indexOf("not detected") > 0);
    });
  });

  test("text from a bundle is never treated as markup", function () {
    var b = clone(F[ALPHA]);
    b.entities[0].label = '<img src=x onerror="window.__sxPwned=1">';
    b.entities[0].members[0].gene = null;
    b.dataset.title = "<script>window.__sxPwned=1<\/script>";
    b.dataset.citation.url = "javascript:window.__sxPwned=1";
    b.dataset.mapping = C.indexBundle(clone(b)) && clone(F[ALPHA].dataset.mapping);
    return mount(b, { initial: { entity: b.entities[0].id, mode: "proteins" } }).then(function (ex) {
      ex.go({ query: "<img" });
      ok(ex.filtered.length === 1 && !q(ex.el, "img") && !q(ex.el, "script") && !window.__sxPwned);
      ok(!q(ex.el, ".sx-foot a"), "an unsafe citation link is not rendered as a link");
      ok(q(ex.el, "[data-sx=rows]").textContent.indexOf("<img") >= 0 && q(ex.el, ".sx-title").textContent.indexOf("<script>") === 0);
    });
  });

  test("an unusable bundle fails loudly, in the page and in the promise", function () {
    var el = fresh();
    return SX.mount(el, { bundle: { schema: "something-else" } }).then(function () { throw new Error("should have rejected"); }, function (err) {
      ok(/not a usable bundle/.test(err.message));
      ok(q(el, "[role=alert]"));
    });
  });

  test("a link can open any view directly", function () {
    var b = F[ALPHA], shared = Object.keys(EXPECT[ALPHA].gene_groups)[0];
    return mount(b, { initial: { compartment: "nuc", entity: b.entities[5].id } }).then(function (ex) {
      ok(ex.state.mode === "proteins" && ex.state.compartment === "nuc" && q(ex.el, "[data-sx=drawer-title]").textContent === b.entities[5].members[0].gene + " +1");
      return mount(b, { initial: { mode: "proteins", show: "unknown" } });
    }).then(function (ex) {
      ok(ex.state.show === "unknown" && ex.filtered.length === 40);
      return mount(b, { initial: { view: "unassigned" } });
    }).then(function (ex) {
      ok(ex.state.mode === "proteins" && ex.state.show === "unknown", "older links still work");
      return mount(b, { initial: { mode: "markers" } });
    }).then(function (ex) {
      ok(ex.state.mode === "proteins" && ex.state.show === "markers" && ex.filtered.length === 12);
      return mount(b, { initial: { gene: b.entities[20].members[0].gene } });
    }).then(function (ex) {
      ok(ex.state.mode === "map" && ex.state.entity === b.entities[20].id, "a gene link lands on its protein");
      return mount(b, { initial: { gene: shared } });
    }).then(function (ex) {
      ok(ex.state.mode === "proteins" && ex.filtered.length === 2 && q(ex.el, "[data-sx=central] h3").textContent.indexOf("Protein groups for") === 0);
      q(ex.el, "[data-sx=clear-gene]").click();
      ok(ex.filtered.length === 80);
      return mount(b, { initial: { compartment: "nope", entity: "nope", gene: "nope", mode: "nope", show: "nope" } });
    }).then(function (ex) {
      ok(ex.state.mode === "map" && ex.state.entity === null && ex.state.show === "all", "unknown targets fall back to the default view");
    });
  });

  function run() {
    var list = document.getElementById("results"), i = 0;
    function next() {
      if (i >= tests.length) {
        var failed = results.filter(function (r) { return !r.ok; }).length;
        document.getElementById("summary").textContent = (failed ? "FAILED: " : "PASSED: ") + (results.length - failed) + " of " + results.length + " tests passed";
        document.getElementById("summary").setAttribute("data-status", failed ? "fail" : "pass");
        window.__sxResults = { passed: results.length - failed, failed: failed, results: results };
        stage.textContent = "";
        return;
      }
      var t = tests[i++];
      Promise.resolve().then(t.fn).then(function () { return { name: t.name, ok: true }; }, function (err) {
        return { name: t.name, ok: false, error: String(err && err.message || err) };
      }).then(function (r) {
        results.push(r);
        var li = document.createElement("li");
        li.textContent = (r.ok ? "ok   " : "FAIL ") + r.name + (r.ok ? "" : ": " + r.error);
        list.appendChild(li);
        next();
      });
    }
    next();
  }

  Promise.all(NAMES.map(load).concat([load("expected.json")])).then(function (all) {
    NAMES.forEach(function (n, k) { F[n] = all[k]; });
    EXPECT = all[NAMES.length];
    run();
  }, function (err) {
    document.getElementById("summary").textContent = "FAILED: could not load fixtures: " + err;
    window.__sxResults = { passed: 0, failed: 1, results: [] };
  });
})();
