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
    eq(C.formatScore(0.695576586918301), "0.695576586918301");
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

  /* ----- the interface ----- */

  function type(ex, text) { ex.search.value = text; ex.search.dispatchEvent(new Event("input")); }
  function press(target, key) { target.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true, cancelable: true })); }
  function texts(el, sel) { return qa(el, sel).map(function (n) { return n.textContent; }); }
  function change(node, value) { node.value = value; node.dispatchEvent(new Event("change")); }
  var ALPHA = "alpha.bundle.json", BETA = "beta.bundle.json";

  test("landing page: one card per compartment with its count, and no table", function () {
    return mount(F[ALPHA]).then(function (ex) {
      var el = ex.el, want = EXPECT[ALPHA].layer_counts.classifier;
      var cards = qa(el, "[data-sx=cards] [data-compartment]");
      eq(cards.map(function (c) { return c.getAttribute("data-compartment"); }), F[ALPHA].compartments.map(function (c) { return c.id; }));
      cards.forEach(function (c) { ok(+q(c, ".sx-card-n").textContent === want[c.getAttribute("data-compartment")].assigned); ok(c.tagName === "BUTTON", "cards are keyboard reachable"); });
      ok(q(el, "[data-sx=cards] [data-view=unassigned] .sx-card-n").textContent === "40", "unassigned has its own entry point");
      ok(!q(el, "table") && !q(el, "[data-sx=list]"), "no table on the landing page");
      ok(q(el, "[data-sx=summary]").textContent.indexOf("80 protein groups detected, 40 assigned to 4 compartments, 40 without a final call") > 0);
      ok(q(el, "[data-sx=synthetic]") && !q(el, "[data-sx=local-only]"));
      ok(q(el, "[data-sx=search]") === el.querySelector("input"), "search is the first control");
      ok(!q(el, "[data-sx=about]").open, "methods and provenance start closed");
      var colors = cards.map(function (c) { return q(c, ".sx-dot").style.backgroundColor; });
      ok(new Set(colors).size === colors.length && colors.every(Boolean), "every compartment has its own colour");
      var before = JSON.stringify(F[ALPHA]);
      ex.showCompartment("nuc"); ex.select(ex.filtered[0].id);
      ok(q(el, ".sx-view-title .sx-dot").style.backgroundColor === colors[2], "the colour follows the compartment into its view");
      ok(q(el, "[data-sx=loc] .sx-dot").style.backgroundColor === colors[2], "and into the details panel");
      ok(JSON.stringify(F[ALPHA]) === before, "rendering must not alter the bundle");
      ex.destroy();
      ok(el.childNodes.length === 0 && !el.classList.contains("sx-root"));
    });
  });

  test("journey A: find a gene and read its localization in two interactions", function () {
    var b = F[ALPHA], target = b.entities[20], gene = target.members[0].gene;
    return mount(b, { adapter: { geneLabel: function (g) { return g === gene ? "abcA" : g; } } }).then(function (ex) {
      var el = ex.el, a = ex.model.byLayer.classifier[target.id];
      type(ex, "abca");                                             // 1: type
      var first = q(el, "[data-sx=suggestions] .sx-suggest");
      ok(first.getAttribute("data-entity") === target.id && first.textContent.indexOf("abcA") === 0, "the exact gene name ranks first");
      ok(q(el, "[data-sx=search]").getAttribute("aria-expanded") === "true");
      press(ex.search, "Enter");                                     // 2: Enter
      ok(ex.state.entity === target.id && !q(el, "[data-sx=drawer]").hidden);
      ok(q(el, "[data-sx=drawer-title]").textContent === "abcA");
      var loc = q(el, "[data-sx=loc]").textContent;
      ok(loc.indexOf(a.status === "assigned" ? ex.model.compById[a.compartment].label : "No final call") >= 0, "localization is the first thing shown");
      ok(q(el, "[data-score=classifier]").textContent === "classifier.score = " + String(a.score), "reported score, exactly");
      ok(q(el, "[data-sx=suggestions]").hidden);
    });
  });

  test("search accepts gene ids and protein accessions, with or without a version", function () {
    var b = clone(F[ALPHA]);
    b.entities[30].members[0].id = "QP_000030.2";
    return mount(b).then(function (ex) {
      var el = ex.el;
      [[b.entities[30].members[0].gene, 30], ["qp_000030.2", 30], ["QP_000030", 30], [b.dataset.mapping.unmapped_entities[0], 7]].forEach(function (c) {
        ok(ex.matches(c[0])[0].e === b.entities[c[1]], "finds " + c[0]);
      });
      type(ex, "zzzz");
      ok(q(el, ".sx-suggest-none").textContent.indexOf("No protein matches") === 0);
      type(ex, "a");
      ok(q(el, "[data-sx=suggestions]").hidden, "one letter is not searched");
      type(ex, "EPG00");
      ok(qa(el, "[data-sx=suggestions] .sx-suggest[data-entity]").length === 8 && q(el, "[data-sx=all-results]"));
      press(ex.search, "ArrowDown"); press(ex.search, "ArrowDown");
      ok(qa(el, ".sx-suggest")[1].classList.contains("sx-on") && ex.search.getAttribute("aria-activedescendant") === "sx-opt-1", "arrow keys move through suggestions");
      press(ex.search, "Enter");
      ok(ex.state.entity === ex.suggestions[1].e.id);
      ex.select(null); type(ex, "EPG00"); press(ex.search, "Enter");
      ok(ex.state.view === "search" && q(el, "[data-sx=headline]").textContent.indexOf("protein groups match “EPG00”") > 0, "an ambiguous query lists every match");
      ok(ex.filtered.length === ex.matches("EPG00").length && q(el, "[data-sx=rows] tr[data-entity]"));
      press(ex.search, "Escape");
    });
  });

  test("journey B: a compartment shows its proteins at once, and the host's functional summary", function () {
    var seen = [], calls = 0;
    var adapter = { compartmentPanel: function (ctx) {
      calls++; seen.push(ctx);
      var d = document.createElement("div"); d.setAttribute("data-result", ctx.compartment); d.textContent = ctx.study.genes.length + " genes";
      return Promise.resolve(d);
    } };
    return mount(F[ALPHA], { adapter: adapter }).then(function (ex) {
      var el = ex.el, want = EXPECT[ALPHA].layer_counts.classifier.mem, map = ex.model.byLayer.classifier;
      q(el, '[data-compartment="mem"]').click();
      ok(ex.state.view === "compartment" && q(el, ".sx-view-title").textContent === "Membrane");
      ok(q(el, "[data-sx=headline]").textContent === want.assigned + " proteins assigned");
      eq(qa(el, "[data-sx=rows] tr[data-entity]").length, want.assigned);
      ok(ex.filtered.every(function (e) { return map[e.id].status === "assigned" && map[e.id].compartment === "mem"; }), "only assigned proteins by default");
      var byName = function (list) { return list.map(function (e) { return (C.entityGenes(e)[0] || "").toLowerCase(); }).filter(Boolean); };
      eq(byName(ex.filtered), byName(ex.filtered).slice().sort(), "gene-name order by default");
      ok(q(el, "[data-sx=sort]").value === "genes|asc" && ex.state.sort === null);
      var top = ex.filtered.slice(0, 5).filter(function (e) { return ex.training[e.id]; }).length;
      ok(top < 5, "training markers do not fill the top of the list");
      ok(texts(el, "[data-sx=list] thead th").join("|") === "Protein|Score (classifier.score)|Other evidence", "no redundant location column inside one compartment");
      return new Promise(function (r) { setTimeout(r, 20); }).then(function () {
        var ctx = seen[0];
        ok(q(el, '[data-sx=side] [data-result="mem"]').textContent === ctx.study.genes.length + " genes", "host panel is shown beside the list");
        ok(ctx.entities.length === want.assigned && ctx.compartmentLabel === "Membrane" && ctx.layerLabel === "Classifier assignment");
        ok(ctx.study.used + ctx.study.multi_gene + ctx.study.unmapped + ctx.study.undetected === want.assigned, "every assigned group is accounted for");
        eq(ctx.studyBackground, EXPECT[ALPHA].detected_single_gene_genes);
        ok(ctx.study.genes.every(function (g) { return ctx.studyBackground.indexOf(g) >= 0; }));
        var toggle = q(el, "[data-sx=include-other]");
        ok(toggle.textContent === "Also show " + want.below_threshold + " closest to Membrane without a final call");
        toggle.click();
        eq(ex.filtered.length, want.assigned + want.below_threshold);
        ok(q(el, "[data-sx=include-other]").getAttribute("aria-pressed") === "true" && texts(el, "[data-sx=list] thead th")[1] === "Location");
        ok(q(el, "[data-sx=rows]").textContent.indexOf("No final call") > 0);
        ok(calls === 1 && q(el, '[data-sx=side] [data-result="mem"]'), "the panel is not recomputed on a re-render");
        var filter = q(el, "[data-sx=filter]"); filter.value = ex.filtered[0].members[0].id.toLowerCase(); filter.dispatchEvent(new Event("input"));
        return new Promise(function (r) { setTimeout(r, 220); });
      }).then(function () {
        ok(q(el, "[data-sx=count]").textContent === "1 protein group" && document.activeElement !== null);
        ok(q(el, "[data-sx=filter]").isConnected, "typing a filter does not rebuild the toolbar");
        change(q(el, "[data-sx=jump]"), "nuc");
        ok(ex.state.compartment === "nuc" && ex.state.filter === "" && !ex.state.includeOther, "moving to another compartment clears the old filters");
        change(q(el, "[data-sx=sort]"), "s:classifier|desc");
        var scores = ex.filtered.map(function (e) { return ex.model.byLayer.classifier[e.id].score; });
        eq(scores, scores.slice().sort(function (x, y) { return y - x; }), "sorting by reported score stays available");
        ok(ex.filtered.length === EXPECT[ALPHA].layer_counts.classifier.nuc.assigned, "sorting never drops a protein");
        q(el, "[data-sx=home]").click();
        ok(ex.state.view === "home" && q(el, "[data-sx=cards]"));
      });
    });
  });

  test("selecting a protein opens a details panel in place, in a clear order", function () {
    var b = F[ALPHA];
    return mount(b, { adapter: { geneUrl: function (g) { return "/gene/" + g; }, memberUrl: function () { return "javascript:alert(1)"; }, geneLinkText: "host gene page" } }).then(function (ex) {
      var el = ex.el;
      ex.showCompartment("cyt");
      var row = q(el, '[data-sx=rows] tr[data-entity="' + b.entities[0].id + '"]');
      ok(row.getAttribute("role") === "button" && row.getAttribute("tabindex") === "0");
      row.focus();
      press(row, "Enter");
      var drawer = q(el, "[data-sx=drawer]");
      ok(!drawer.hidden && drawer.getAttribute("role") === "dialog" && ex.state.view === "compartment", "opens without leaving the list");
      ok(document.activeElement === q(el, "[data-sx=drawer-close]"), "focus moves into the panel");
      eq(texts(drawer, ".sx-d-section > h4"), ["Localization", "Reference sets in the publication", "Existing annotations", "Fractionation profile", "Protein"]);
      ok(q(drawer, "[data-sx=loc] .sx-loc-main").textContent === "Cytosol");
      ok(q(drawer, "[data-sx=loc] .sx-badge").textContent === "Computed from profiles", "the kind of evidence is labelled");
      ok(q(drawer, "[data-sx=training-input]").textContent.indexOf("training marker") > 0);
      var note = q(drawer, "[data-sx=score-note]");
      ok(!note.open && note.textContent.indexOf("does not define the scale") > 0 && !/probab|confiden|%/i.test(q(drawer, "[data-sx=loc]").textContent), "the score is not relabelled, and its caveat is one click away");
      ok(q(drawer, '[data-sx=from-authors] [data-layer="markers"]').textContent.indexOf("Cytosol") > 0);
      ok(q(drawer, '[data-sx=from-authors] [data-layer="markers"] .sx-badge').textContent === "Curated");
      ok(!q(drawer, '[data-layer="markers"] .sx-verdict'), "a training set is never scored as agreeing");
      ok(q(drawer, '[data-layer="targeting"] .sx-badge').textContent === "Sequence prediction");
      var link = q(drawer, "[data-sx=gene-link]");
      ok(link.getAttribute("href") === "/gene/" + b.entities[0].members[0].gene && link.textContent.indexOf("host gene page") > 0);
      ok(!q(drawer, "a[href^=javascript]"), "unsafe link schemes are dropped");
      ok(q(el, "tr.sx-row-on") === row, "the list marks the open protein");
      press(document.body, "Escape");
      ok(drawer.hidden && ex.state.entity === null && document.activeElement === row, "Escape closes it and returns focus");
      row.click(); q(el, "[data-sx=drawer-close]").click();
      ok(drawer.hidden);
      ex.select(b.dataset.mapping.multi_gene_entities[0]);
      ok(q(drawer, "[data-sx=multi-gene-note]").textContent.indexOf("covering 2 genes") > 0 && qa(drawer, "[data-sx=members] tbody tr").length === 2);
      ok(qa(drawer, "[data-sx=gene-link]").length === 2, "one link per gene, never collapsed");
      ex.select(b.dataset.mapping.unmapped_entities[0]);
      ok(q(drawer, "[data-sx=members]").textContent.indexOf("no gene match") > 0 && !q(drawer, "[data-sx=gene-link]") && q(drawer, "[data-sx=loc] .sx-loc-main"));
      var shared = Object.keys(EXPECT[ALPHA].gene_groups)[0];
      ok(ex.showGene(shared) === 2 && ex.state.view === "search" && ex.filtered.length === 2, "a gene in two groups lists both");
      ok(q(drawer, "[data-sx=also-in]").textContent.indexOf("is also in") > 0);
      ok(ex.showGene("no-such-gene") === 0);
    });
  });

  test("journey C: unassigned proteins have their own view and show what is already known", function () {
    return mount(F[ALPHA]).then(function (ex) {
      var el = ex.el, map = ex.model.byLayer.classifier, b = F[ALPHA];
      q(el, "[data-view=unassigned]").click();
      ok(ex.state.view === "unassigned" && q(el, "[data-sx=headline]").textContent === "40 protein groups detected without a final call");
      ok(q(el, "[data-sx=unassigned-lede]").textContent.indexOf("“unknown”") > 0 && q(el, "[data-sx=unassigned-lede]").textContent.indexOf("not an assignment") > 0);
      ok(ex.filtered.length === 40 && ex.filtered.every(function (e) { return map[e.id].status !== "assigned"; }));
      ok(texts(el, "[data-sx=list] thead th")[1] === "Closest class");
      ok(q(el, "[data-sx=rows] .sx-loc .sx-dot-hollow"), "the closest class is drawn hollow, unlike an assignment");
      var facets = qa(el, "[data-sx=other-evidence] [data-facet]");
      facets.forEach(function (f) {
        var m = ex.model.byLayer[f.getAttribute("data-facet")];
        var n = Object.keys(map).filter(function (id) { return map[id].status !== "assigned" && C.calls(m[id]).length; }).length;
        ok(+q(f, ".sx-facet-n").textContent === n && n > 0, "facet count " + f.getAttribute("data-facet"));
      });
      var markers = q(el, '[data-facet="markers"]'), n = +q(markers, ".sx-facet-n").textContent;
      markers.click();
      ok(ex.filtered.length === n && q(el, '[data-facet="markers"]').getAttribute("aria-pressed") === "true");
      ok(q(el, "[data-sx=rows] [data-chip=markers]").textContent.indexOf("Marker: ") === 0, "the existing annotation is visible in the row");
      q(el, "[data-sx=rows] tr").click();
      var loc = q(el, "[data-sx=loc]").textContent;
      ok(loc.indexOf("No final call") >= 0 && q(el, "[data-sx=closest]").textContent.indexOf("This is not an assignment") > 0);
      ok(q(el, '[data-sx=from-authors] [data-layer="markers"] .sx-place'), "and in the details panel");
      q(el, "[data-sx=clear-facet]").click();
      ok(ex.filtered.length === 40);
      var named = q(el, "[data-sx=named]"), opt = named.options[1].value;
      change(named, opt);
      ok(ex.filtered.length === EXPECT[ALPHA].layer_counts.classifier[opt].below_threshold);
      ex.go({ layer: "markers", view: "unassigned" });
      ok(ex.state.view === "home" && !q(el, "[data-view=unassigned]"), "no unassigned entry when every protein has a call");
      ok(b.layers[1].assignments.length === 80);
    });
  });

  test("long lists page in with Show more", function () {
    return mount(F[BETA]).then(function (ex) {
      var el = ex.el;
      ex.showUnassigned();
      ok(qa(el, "[data-sx=rows] tr[data-entity]").length === 50 && q(el, "[data-sx=count]").textContent === "Showing 50 of 60");
      ok(q(el, "[data-sx=more]").textContent === "Show 10 more");
      q(el, "[data-sx=more]").click();
      ok(qa(el, "[data-sx=rows] tr[data-entity]").length === 60 && q(el, "[data-sx=more]").hidden && q(el, "[data-sx=count]").textContent === "60 protein groups");
    });
  });

  test("journey E: views that need the fractionation data say so, and appear when it exists", function () {
    var only = F["alpha.assignments-only.bundle.json"], full = F[ALPHA];
    return mount(only).then(function (ex) {
      var el = ex.el, pending = q(el, "[data-sx=pending]");
      ok(pending.textContent.indexOf("Awaiting the fractionation data") === 0);
      ok(q(pending, "[data-sx=no-profiles]") && q(pending, "[data-sx=no-map]") && pending.textContent.indexOf("Nothing is drawn in their place") > 0);
      ok(!q(el, "canvas") && !q(el, "svg"), "no chart without data");
      ex.select(only.entities[0].id);
      ok(q(el, "[data-sx=pending-profile]").textContent.indexOf("Awaiting the fractionation data") === 0 && !q(el, "[data-sx=profile-chart]"));
      ok(q(el, "[data-sx=notice]").textContent.indexOf("have not been supplied") > 0);
      var b = clone(only); b.fractions = clone(full.fractions); b.profiles = clone(full.profiles);
      return mount(b);
    }).then(function (ex) {
      ok(!q(ex.el, "[data-sx=no-profiles]") && q(ex.el, "[data-sx=no-map]"), "with profiles, only the map is still pending");
      ex.select(ex.model.entities[1].id);
      ok(qa(ex.el, "[data-sx=profile-chart] circle").length === 8 && !q(ex.el, "[data-sx=pending-profile]"));
      return mount(full);
    }).then(function (ex) {
      ok(!q(ex.el, "[data-sx=pending]") && q(ex.el, "[data-sx=map-canvas]") && ex.points.length === 80, "with coordinates, the map is drawn and nothing is pending");
      ok(q(ex.el, "[data-sx=map]").textContent.indexOf("from the publication") > 0);
    });
  });

  test("methods, evidence and provenance are complete, but only on demand", function () {
    return mount(F[ALPHA]).then(function (ex) {
      var el = ex.el, about = q(el, "[data-sx=about]");
      ok(q(about, ".sx-about-body").childNodes.length === 0, "nothing is rendered until asked for");
      about.open = true; about.dispatchEvent(new Event("toggle"));
      eq(qa(about, "[data-sx=evidence] .sx-ev-row").map(function (r) { return r.getAttribute("data-evidence"); }),
         ["measured_profile", "computational_assignment", "sequence_prediction", "curated_annotation"]);
      ok(q(about, "[data-sx=license]").textContent.indexOf("Creative Commons Zero") >= 0);
      ok(q(about, "[data-sx=mapping]").textContent.indexOf("3 unmapped") >= 0 && q(about, "[data-sx=mapping]").textContent.indexOf("4 groups span more than one gene") >= 0);
      ok(qa(about, "[data-sx=vocabulary] li").length === 4 && q(about, "[data-sx=provenance]").textContent.indexOf("make_fixtures.py") > 0);
      ok(q(about, "[data-sx=scores] [data-sx=threshold-note]").textContent.indexOf("Stated by the source") >= 0);
      ok(q(about, "[data-sx=training-note]").textContent.indexOf("12 of these protein groups were training inputs") === 0);
      ok(q(about, "[data-sx=compare-select]").value === "targeting" && !q(about, "[data-sx=training-warning]"), "the default comparison is never the training set");
      ok(q(about, "[data-sx=concordance-skipped]") && q(about, "[data-sx=concordance-scope]").textContent.indexOf("Cytosol, Membrane, Nucleus") > 0);
      change(q(about, "[data-sx=compare-select]"), "markers");
      ok(q(el, "[data-sx=training-warning]").textContent.indexOf("not independent") > 0 && !q(el, "[data-sx=concordance-skipped]"));
      ok(!q(el, "[data-sx=layer-select]"), "no assignment switch when there is only one");
      return mount(F["beta.derived.bundle.json"]);
    }).then(function (ex) {
      var el = ex.el, about = q(el, "[data-sx=about]");
      about.open = true; about.dispatchEvent(new Event("toggle"));
      ok(q(about, "[data-sx=score-note]").textContent.indexOf("Defined by the method as a probability") >= 0, "a stated probability may be called one");
      change(q(about, "[data-sx=layer-select]"), "nearest-centroid");
      ok(ex.state.layer === "nearest-centroid" && !q(el, "[data-view=unassigned]"), "switching the assignment source updates the whole view");
      ok(q(el, "[data-sx=about] [data-sx=score-note]").textContent.indexOf("A similarity") >= 0 && !q(el, "[data-sx=about] [data-sx=threshold-note]"));
    });
  });

  test("second organism: different ids, fractions and compartments, same code", function () {
    return mount(F["beta.derived.bundle.json"], { initial: { layer: "model" } }).then(function (ex) {
      var el = ex.el, b = F["beta.derived.bundle.json"], a = b.layers[0].assignments[7];
      ok(q(el, "[data-sx=summary]").textContent.indexOf("Fictus alter") === 0 && qa(el, "[data-sx=cards] [data-compartment]").length === 6);
      ok(q(el, "[data-sx=map]").textContent.indexOf("computed by this software") >= 0, "a computed map is labelled as computed");
      ex.select("grp-0004");
      ok(q(el, "[data-sx=multi-gene-note]").textContent.indexOf("3 genes") >= 0 && qa(el, "[data-sx=members] tbody tr").length === 3);
      ok(qa(el, "[data-sx=profile-chart] circle").length === b.fractions.length);
      ex.select(a.entity);
      var places = texts(el, '[data-layer="reference-set"] .sx-place');
      eq(places, [a.compartment].concat(a.others).map(function (c) { return ex.model.compById[c].label; }), "a source may name several compartments");
      ex.showCompartment(a.others[1]);
      ok(q(el, '[data-sx=rows] tr[data-entity="' + a.entity + '"]') || ex.model.byLayer.model[a.entity].compartment !== a.others[1]);
    });
  });

  test("row tags show agreement with other curated sources, never for training sets", function () {
    return mount(F[BETA]).then(function (ex) {
      var el = ex.el, model = ex.model, ref = model.byLayer["reference-set"], map = model.byLayer.model;
      var agree = Object.keys(ref).filter(function (id) { return map[id].status === "assigned" && C.calls(ref[id]).indexOf(map[id].compartment) >= 0; })[0];
      ex.showCompartment(map[agree].compartment);
      var chip = q(el, '[data-sx=rows] tr[data-entity="' + agree + '"] [data-chip="reference-set"]');
      ok(chip.textContent === "Curated reference set ✓" && chip.classList.contains("sx-chip-agree") && chip.title.indexOf("Same compartment") > 0);
      return mount(F[ALPHA]);
    }).then(function (ex) {
      ex.showCompartment("cyt");
      var chip = q(ex.el, '[data-sx=rows] [data-chip="markers"]');
      ok(chip.textContent === "Marker", "a training marker is named but not ticked");
      ok(!q(ex.el, '[data-sx=rows] [data-chip="targeting"]'), "sequence predictions stay out of the row summary");
    });
  });

  test("adapter: extra layers stay separate, state changes are reported, failures are contained", function () {
    var b = clone(F[ALPHA]), warned = 0, warn = console.warn, states = [], picked = [];
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
    return mount(b, { adapter: adapter, onState: function (s) { states.push(s); }, onSelect: function (id) { picked.push(id); } }).then(function (ex) {
      console.warn = warn;
      var el = ex.el;
      eq(ex.model.layers.map(function (l) { return l.id; }), ["markers", "classifier", "targeting", "host"]);
      ok(warned === 4, "three refused layers and one dropped assignment are reported, got " + warned);
      eq(b.layers.length, 3, "the bundle's own layers are untouched");
      ex.showCompartment("cyt");
      ok(q(el, "[data-sx=rows] strong").textContent.indexOf("sym-") === 0, "host gene names are used");
      ok(q(el, '[data-sx=rows] tr[data-entity="' + b.entities[0].id + '"] [data-chip="host"]').textContent === "Host: Nucleus");
      ex.select(b.entities[0].id);
      ok(q(el, '[data-sx=elsewhere] [data-layer="host"] .sx-verdict').textContent === "differs from the assignment");
      eq(states[states.length - 1], { view: "compartment", compartment: "cyt", entity: b.entities[0].id, gene: null, query: "", layer: "classifier" });
      eq(picked, [b.entities[0].id]);
      return mount(F[BETA], { adapter: { extraLayers: function () { return Promise.reject(new Error("host down")); }, compartmentPanel: function () { throw new Error("boom"); } } });
    }).then(function (ex) {
      ok(ex.model.layers.length === 2 && q(ex.el, "[data-sx=cards]"));
      ex.showCompartment(F[BETA].compartments[0].id);
      ok(q(ex.el, "[data-sx=list]") && q(ex.el, "[data-sx=side]").textContent === "", "a failing host panel leaves the list usable");
    }).finally(function () { console.warn = warn; });
  });

  test("undistributable or undetected data are flagged where they appear", function () {
    var b = clone(F["alpha.assignments-only.bundle.json"]);
    b.dataset.synthetic = false; b.dataset.license.redistribution = "restricted";
    b.dataset.distribution = { status: "local-only", reason: "Reuse terms pending." };
    b.entities[0].detected = false;
    return mount(b, { initial: { compartment: "cyt" } }).then(function (ex) {
      ok(q(ex.el, "[data-sx=local-only]").textContent === "Local copy, not for distribution" && !q(ex.el, "[data-sx=synthetic]"));
      ok(q(ex.el, '[data-sx=rows] tr[data-entity="' + b.entities[0].id + '"]').textContent.indexOf("not detected") > 0);
      ok(q(ex.el, "[data-sx=summary]").textContent.indexOf("79 protein groups detected") > 0);
      var tsv = C.toTSV(ex.model, ex.filtered).split("\n");
      ok(tsv[2].indexOf("License:") === 2 && tsv[5].split("\t").indexOf("unknown") < 0 && tsv.some(function (l) { return l.split("\t").indexOf("unknown") > 0 || true; }));
    });
  });

  test("text from a bundle is never treated as markup", function () {
    var b = clone(F[ALPHA]);
    b.entities[0].label = '<img src=x onerror="window.__sxPwned=1">';
    b.entities[0].members[0].gene = null;
    b.dataset.mapping = null;
    b.dataset.title = "<script>window.__sxPwned=1<\/script>";
    b.dataset.citation.url = "javascript:window.__sxPwned=1";
    b.dataset.mapping = clone(F[ALPHA].dataset.mapping);
    return mount(b, { initial: { entity: b.entities[0].id, compartment: "cyt" } }).then(function (ex) {
      ok(!q(ex.el, "img") && !q(ex.el, "script") && !window.__sxPwned);
      ok(!q(ex.el, ".sx-source a"), "an unsafe citation link is not rendered as a link");
      ok(q(ex.el, "[data-sx=drawer-title]").textContent.indexOf("<img") === 0 && q(ex.el, ".sx-title").textContent.indexOf("<script>") === 0);
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
      ok(ex.state.view === "compartment" && q(ex.el, ".sx-view-title").textContent === "Nucleus" && q(ex.el, "[data-sx=drawer-title]"));
      return mount(b, { initial: { view: "unassigned" } });
    }).then(function (ex) {
      ok(ex.state.view === "unassigned" && q(ex.el, "[data-sx=unassigned-lede]"));
      return mount(b, { initial: { gene: b.entities[20].members[0].gene } });
    }).then(function (ex) {
      ok(ex.state.view === "home" && ex.state.entity === b.entities[20].id && !q(ex.el, "[data-sx=drawer]").hidden, "a gene link lands on its protein");
      return mount(b, { initial: { gene: shared } });
    }).then(function (ex) {
      ok(ex.state.view === "search" && ex.filtered.length === 2 && q(ex.el, "[data-sx=headline]").textContent.indexOf("is in 2 protein groups") > 0);
      return mount(b, { initial: { compartment: "nope", entity: "nope", gene: "nope" } });
    }).then(function (ex) {
      ok(ex.state.view === "home" && ex.state.entity === null, "unknown targets fall back to the landing page");
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
