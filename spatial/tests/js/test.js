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

  test("full bundle: every evidence type is shown separately, map and profile appear", function () {
    var before = JSON.stringify(F["alpha.bundle.json"]);
    return mount(F["alpha.bundle.json"]).then(function (ex) {
      var el = ex.el;
      eq(qa(el, "[data-sx=evidence] .sx-ev-row").map(function (r) { return r.getAttribute("data-evidence"); }),
         ["measured_profile", "computational_assignment", "sequence_prediction", "curated_annotation"]);
      ok(q(el, "[data-sx=synthetic]") && !q(el, "[data-sx=local-only]"));
      ok(q(el, "[data-sx=license]").textContent.indexOf("Creative Commons Zero") >= 0);
      ok(q(el, "[data-sx=mapping]").textContent.indexOf("3 unmapped") >= 0 && q(el, "[data-sx=mapping]").textContent.indexOf("4 groups span more than one gene") >= 0);
      ok(q(el, "[data-sx=map-canvas]") && !q(el, "[data-sx=no-map]") && !q(el, "[data-sx=no-profiles]"));
      ok(ex.points && ex.points.length === 80, "every coordinate is drawn");
      eq(qa(el, "[data-sx=layer-select] optgroup").map(function (g) { return g.label; }),
         ["Computational assignment", "Sequence-based prediction", "Curated annotation"]);
      ex.select(F["alpha.bundle.json"].entities[0].id);
      ok(q(el, "[data-sx=profile-chart]"), "profile chart for a measured entity");
      ok(qa(el, "[data-sx=profile-chart] circle").length === 8);
      var note = q(el, "[data-sx=score-note]").textContent;
      ok(note.indexOf("does not define the scale") >= 0 && !/probab|confiden|%/i.test(note), "unspecified score is not relabelled");
      var a = F["alpha.bundle.json"].layers[1].assignments[0];
      ok(q(el, "[data-score=classifier]").textContent.indexOf("classifier.score = " + String(a.score)) >= 0);
      ok(q(el, "[data-sx=threshold-note]").textContent.indexOf("Stated by the source") >= 0);
      ok(JSON.stringify(F["alpha.bundle.json"]) === before, "rendering must not alter the bundle");
      ex.destroy();
      ok(el.childNodes.length === 0 && !el.classList.contains("sx-root"));
    });
  });

  test("assignments-only bundle: no map, no profile, and the page says why", function () {
    return mount(F["alpha.assignments-only.bundle.json"]).then(function (ex) {
      var el = ex.el;
      ok(!q(el, "[data-sx=map]") && !q(el, "canvas"), "no map without coordinates");
      ok(q(el, "[data-sx=no-profiles]").textContent.indexOf("No measured profiles were supplied") >= 0);
      ok(q(el, "[data-sx=no-map]").textContent.indexOf("No map coordinates were supplied") >= 0);
      ex.select(F["alpha.assignments-only.bundle.json"].entities[0].id);
      ok(!q(el, "[data-sx=profile-chart]") && !q(el, "svg path.sx-line"), "no profile is drawn or invented");
      ok(q(el, "[data-sx=scores]") && q(el, "[data-sx=concordance]") && q(el, "[data-sx=table]"), "assignment views still work");
      ok(ex.points == null);
    });
  });

  test("views switch on by themselves when valid measured data are added", function () {
    var b = clone(F["alpha.assignments-only.bundle.json"]), full = F["alpha.bundle.json"];
    b.fractions = clone(full.fractions); b.profiles = clone(full.profiles);
    return mount(b).then(function (ex) {
      ok(!q(ex.el, "[data-sx=map]") && !q(ex.el, "[data-sx=no-profiles]") && q(ex.el, "[data-sx=no-map]"), "profiles only");
      ex.select(b.entities[1].id);
      ok(q(ex.el, "[data-sx=profile-chart]"));
      b.embeddings = clone(full.embeddings);
      return mount(b);
    }).then(function (ex) {
      ok(q(ex.el, "[data-sx=map-canvas]") && !q(ex.el, "[data-sx=no-map]"), "map appears once coordinates exist");
    });
  });

  test("second organism: different ids, fractions and compartments, same code", function () {
    return mount(F["beta.derived.bundle.json"]).then(function (ex) {
      var el = ex.el, b = F["beta.derived.bundle.json"];
      ok(q(el, ".sx-sub").textContent.indexOf("Fictus alter") === 0);
      ok(qa(el, "[data-compartment]").length === 6);
      ok(q(el, "[data-sx=map]").textContent.indexOf("computed by this software") >= 0, "computed map is labelled as computed");
      var note = q(el, "[data-sx=score-note]").textContent;
      ok(note.indexOf("Defined by the method as a probability") >= 0, "a stated probability may be called one");
      ex.select("grp-0004");
      ok(q(el, "[data-sx=multi-gene-note]").textContent.indexOf("3 genes") >= 0);
      ok(qa(el, "[data-sx=members] tbody tr").length === 3, "all members listed");
      ok(qa(el, "[data-sx=profile-chart] circle").length === b.fractions.length);
      ex.set({ layer: "nearest-centroid" });
      ok(q(el, "[data-sx=score-note]").textContent.indexOf("A similarity") >= 0);
      ok(!q(el, "[data-sx=threshold-note]"), "no threshold is implied where none is declared");
    });
  });

  test("multi-gene, unmapped and shared-gene groups are visible in the table", function () {
    return mount(F["alpha.bundle.json"]).then(function (ex) {
      var el = ex.el, b = F["alpha.bundle.json"];
      ex.set({ query: b.dataset.mapping.multi_gene_entities[0].split(";")[0].toLowerCase() });
      ok(q(el, "[data-sx=count]").textContent.indexOf("1 of 80") === 0);
      ok(q(el, "[data-sx=table] tbody").textContent.indexOf("2 genes") >= 0);
      ex.set({ query: b.dataset.mapping.unmapped_entities[0].toLowerCase() });
      ok(q(el, "[data-sx=table] tbody").textContent.indexOf("no gene mapping") >= 0);
      ok(q(el, "[data-sx=table] tbody tr td:nth-child(3)").textContent.length > 0, "an unmapped group still shows its assignment");
      var gene = Object.keys(EXPECT["alpha.bundle.json"].gene_groups)[0];
      ok(ex.showGene(gene) === 2);
      ok(q(el, "[data-sx=count]").textContent.indexOf("2 of 80") === 0 && q(el, "[data-sx=gene-chip]"));
      ok(q(el, "[data-sx=detail]").textContent.indexOf("also appears in 1 other protein group") >= 0);
      ok(ex.showGene("no-such-gene") === 0);
    });
  });

  test("compartment buttons filter, and paging works", function () {
    return mount(F["beta.bundle.json"]).then(function (ex) {
      var el = ex.el, want = EXPECT["beta.bundle.json"].layer_counts.model, id = F["beta.bundle.json"].compartments[2].id;
      ok(q(el, "[data-sx=count]").textContent.indexOf("120 of 120") === 0);
      ok(qa(el, "[data-sx=table] tbody tr").length === 25);
      q(el, "[data-sx=next]").click();
      ok(q(el, ".sx-pager span").textContent === "Page 2 of 5");
      q(el, '[data-compartment="' + id + '"]').click();
      var n = want[id].assigned + want[id].below_threshold;
      ok(q(el, "[data-sx=count]").textContent.indexOf(n + " of 120") === 0, "count after filter");
      ok(q(el, '[data-compartment="' + id + '"]').getAttribute("aria-pressed") === "true");
      q(el, "[data-sx=status-select]").value = "assigned";
      q(el, "[data-sx=status-select]").dispatchEvent(new Event("change"));
      ok(q(el, "[data-sx=count]").textContent.indexOf(want[id].assigned + " of 120") === 0);
      qa(el, "[data-sx=table] tbody tr")[0].click();
      ok(q(el, ".sx-row-on"), "row click selects");
    });
  });

  test("adapter: links, labels, extra layers kept separate, actions get the detected background", function () {
    var b = clone(F["alpha.bundle.json"]), seen = null, warned = 0, warn = console.warn;
    console.warn = function () { warned++; };
    var adapter = {
      geneUrl: function (g) { return "/gene/" + g; },
      geneLabel: function (g) { return "sym-" + g; },
      memberUrl: function () { return "javascript:alert(1)"; },
      extraLayers: function () {
        return Promise.resolve([
          { id: "host", label: "Host curated", evidence_type: "curated_annotation", source: "external", method: { name: "host" },
            assignments: [{ entity: b.entities[0].id, compartment: "nuc", status: "assigned" }, { entity: "ghost", compartment: "nuc", status: "assigned" }] },
          { id: "markers", label: "clash", evidence_type: "curated_annotation", source: "external", method: { name: "x" }, assignments: [] },
          { id: "vague", label: "no evidence type", source: "external", method: { name: "x" }, assignments: [] },
          { id: "sneaky", label: "pretends to be measured", evidence_type: "measured_profile", source: "external", method: { name: "x" }, assignments: [] }
        ]);
      },
      actions: [{ id: "go", label: "Analyse", run: function (ctx) { seen = ctx; } }]
    };
    return mount(b, { adapter: adapter }).then(function (ex) {
      console.warn = warn;
      var el = ex.el;
      eq(ex.model.layers.map(function (l) { return l.id; }), ["markers", "classifier", "targeting", "host"]);
      ok(warned === 4, "three refused layers and one dropped assignment are reported, got " + warned);
      ok(Object.keys(ex.model.byLayer.host).length === 1);
      eq(b.layers.length, 3, "the bundle's own layers are untouched");
      ok(q(el, '[data-sx=layer-select] option[value="host"]'));
      ok(q(el, "[data-sx=table] tbody a").getAttribute("href").indexOf("/gene/") === 0);
      ok(q(el, "[data-sx=table] tbody a").textContent.indexOf("sym-") === 0);
      ex.select(b.entities[0].id);
      ok(!q(el, "[data-sx=members] a[href^=javascript]"), "unsafe link schemes are dropped");
      q(el, '[data-compartment="mit"]').click();
      q(el, "[data-action=go]").click();
      eq(seen.backgroundGenes, EXPECT["alpha.bundle.json"].detected_genes);
      ok(seen.genes.length > 0 && seen.genes.every(function (g) { return seen.backgroundGenes.indexOf(g) >= 0; }));
      ok(seen.compartment === "mit" && seen.layer === "classifier");
    }).finally(function () { console.warn = warn; });
  });

  test("a failing host adapter does not take the explorer down", function () {
    var warn = console.warn; console.warn = function () {};
    return mount(F["beta.bundle.json"], { adapter: { extraLayers: function () { return Promise.reject(new Error("host down")); } } }).then(function (ex) {
      ok(ex.model.layers.length === 2 && q(ex.el, "[data-sx=table]"));
    }).finally(function () { console.warn = warn; });
  });

  test("undistributable bundles carry a visible notice", function () {
    var b = clone(F["alpha.assignments-only.bundle.json"]);
    b.dataset.synthetic = false; b.dataset.license.redistribution = "restricted";
    b.dataset.distribution = { status: "local-only", reason: "Reuse terms pending." };
    b.entities[0].detected = false;
    return mount(b).then(function (ex) {
      ok(q(ex.el, "[data-sx=local-only]").textContent.indexOf("not for distribution") >= 0 && !q(ex.el, "[data-sx=synthetic]"));
      ok(q(ex.el, "[data-sx=table] tbody tr").textContent.indexOf("not detected in this experiment") >= 0);
    });
  });

  test("text from a bundle is never treated as markup", function () {
    var b = clone(F["alpha.bundle.json"]);
    b.entities[0].label = '<img src=x onerror="window.__sxPwned=1">';
    b.dataset.title = "<script>window.__sxPwned=1<\/script>";
    b.dataset.citation.url = "javascript:window.__sxPwned=1";
    return mount(b, { initial: { entity: b.entities[0].id } }).then(function (ex) {
      ok(!q(ex.el, "img") && !q(ex.el, "script") && !window.__sxPwned);
      ok(!q(ex.el, ".sx-cite a"), "unsafe citation link is not rendered as a link");
      ok(q(ex.el, "[data-sx=detail] h3").textContent.indexOf("<img") === 0);
    });
  });

  test("an unusable bundle fails loudly, in the page and in the promise", function () {
    var el = fresh();
    return SX.mount(el, { bundle: { schema: "something-else" } }).then(function () { throw new Error("should have rejected"); }, function (err) {
      ok(/not a usable bundle/.test(err.message));
      ok(q(el, "[role=alert]"));
    });
  });

  test("initial state and selection callback", function () {
    var b = F["alpha.bundle.json"], picked = [];
    return mount(b, { initial: { layer: "markers", compartment: "nuc", gene: Object.keys(EXPECT["alpha.bundle.json"].gene_groups)[0] },
                      onSelect: function (id) { picked.push(id); } }).then(function (ex) {
      ok(ex.state.layer === "markers" && ex.state.compartment === "nuc" && ex.state.entity);
      ok(q(ex.el, "[data-sx=layer-select]").value === "markers");
      ok(!q(ex.el, "[data-sx=scores]"), "a layer without scores has no score panel");
      ex.select(b.entities[5].id);
      eq(picked, [b.entities[5].id]);
    });
  });

  test("study genes, single-gene background and compartment scopes match the Python reference", function () {
    ["alpha.bundle.json", "beta.bundle.json"].forEach(function (n) {
      var m = C.indexBundle(clone(F[n])), want = EXPECT[n];
      eq(C.detectedGenes(m, true), want.detected_single_gene_genes, n);
      var got = C.studyGenes(m, m.entities.map(function (e) { return e.id; }));
      eq([got.genes, got.used, got.multi_gene, got.unmapped, got.undetected],
         [want.study_all.genes, want.study_all.used, want.study_all.multi_gene, want.study_all.unmapped, want.study_all.undetected], n);
      ok(got.used + got.multi_gene + got.unmapped + got.undetected === m.entities.length, "every group is accounted for");
      Object.keys(want.scopes).forEach(function (key) {
        var ids = key.split("|"), sc = C.sharedScope(m, ids[0], ids[1]);
        eq(sc ? sc.slice().sort() : null, want.scopes[key], n + " scope " + key);
      });
    });
  });

  test("a layer's own word for 'no final call' is used, with the named class kept apart", function () {
    return mount(F["alpha.bundle.json"]).then(function (ex) {
      var el = ex.el, b = F["alpha.bundle.json"], a = b.layers[1].assignments.filter(function (x) { return x.status === "below_threshold"; })[0];
      ex.set({ query: a.entity.split(";")[0].toLowerCase() });
      var cell = qa(el, "[data-sx=table] tbody tr td")[3].textContent;
      ok(cell.indexOf("unknown (method named ") === 0, cell);
      ok(cell.indexOf(String(a.score)) > 0, "score still shown exactly");
      eq(qa(el, "[data-sx=status-select] option").map(function (o) { return o.textContent; }), ["All protein groups", "Only assigned", "Only unknown"]);
      ok(C.toTSV(ex.model, ex.filtered).split("\n")[5].split("\t").indexOf("unknown") > 0);
    });
  });

  test("dedicated view for protein groups without a final call", function () {
    return mount(F["alpha.bundle.json"]).then(function (ex) {
      var el = ex.el, map = ex.model.byLayer.classifier;
      var tab = q(el, "[data-view=unassigned]");
      ok(tab.textContent === "Without a final call (40)");
      tab.click();
      ok(q(el, "[data-sx=count]").textContent.indexOf("40 of 80") === 0);
      ok(q(el, "[data-sx=unassigned-lede]").textContent.indexOf("it is not an assignment") > 0);
      ok(q(el, "[data-sx=status-select]").closest("label").hidden, "status filter is replaced by the view");
      ok(ex.filtered.every(function (e) { return map[e.id].status !== "assigned"; }));
      var scores = ex.filtered.map(function (e) { return map[e.id].score; });
      eq(scores, scores.slice().sort(function (x, y) { return y - x; }), "highest score first by default");
      ok(q(el, "[data-sx=other-evidence]") && !q(el, "[data-sx=concordance]"));
      var n = +q(el, '[data-sx=other-evidence] [data-layer="markers"] td').textContent;
      ok(n === ex.filtered.filter(function (e) { return ex.model.byLayer.markers[e.id]; }).length);
      var total = 0; qa(el, ".sx-comp-n").forEach(function (x) { total += +x.textContent; });
      ok(total === 40, "compartment counts cover every listed group");
      q(el, "[data-view=browse]").click();
      ok(q(el, "[data-sx=count]").textContent.indexOf("80 of 80") === 0 && q(el, "[data-sx=concordance]"));
      ex.set({ layer: "markers" });
      ok(!q(el, "[data-view=unassigned]"), "no tab when every entry has a call");
    });
  });

  test("tables sort by group, gene, compartment and score, with missing values last", function () {
    return mount(F["alpha.bundle.json"]).then(function (ex) {
      var el = ex.el, m = ex.model;
      q(el, '[data-sort="group"]').click();
      var ids = ex.filtered.map(function (e) { return e.members[0].id.toLowerCase(); });
      eq(ids, ids.slice().sort());
      ok(q(el, '[data-sort="group"]').closest("th").getAttribute("aria-sort") === "ascending");
      q(el, '[data-sort="group"]').click();
      eq(ex.filtered.map(function (e) { return e.members[0].id.toLowerCase(); }), ids.slice().reverse());
      q(el, '[data-sort="s:targeting"]').click();
      var sc = ex.filtered.map(function (e) { var a = m.byLayer.targeting[e.id]; return a ? a.score : null; });
      var have = sc.filter(function (v) { return v != null; });
      ok(have.length === 40 && sc.slice(40).every(function (v) { return v == null; }), "unscored groups stay listed, at the end");
      eq(have, have.slice().sort(function (x, y) { return y - x; }));
      q(el, '[data-sort="c:classifier"]').click();
      var labs = ex.filtered.map(function (e) { return m.compById[m.byLayer.classifier[e.id].compartment].label.toLowerCase(); });
      eq(labs, labs.slice().sort());
      q(el, '[data-sort="genes"]').click();
      ok(C.entityGenes(ex.filtered[ex.filtered.length - 1]).length === 0, "unmapped groups sort last, not out");
      ok(ex.filtered.length === 80);
    });
  });

  test("compartment list can be searched and sorted", function () {
    return mount(F["beta.bundle.json"]).then(function (ex) {
      var el = ex.el, input = q(el, "[data-sx=compartment-search]");
      input.value = "plast"; input.dispatchEvent(new Event("input"));
      ok(qa(el, ".sx-comps li").filter(function (li) { return !li.hidden; }).length === 1);
      var sel = q(el, "[data-sx=compartment-sort]"); sel.value = "name"; sel.dispatchEvent(new Event("change"));
      var names = qa(el, ".sx-comp-name").map(function (n) { return n.textContent; });
      eq(names, names.slice().sort());
      sel = q(el, "[data-sx=compartment-sort]"); sel.value = "assigned"; sel.dispatchEvent(new Event("change"));
      var counts = qa(el, ".sx-comp-n").map(function (n) { return parseInt(n.textContent, 10); });
      eq(counts, counts.slice().sort(function (x, y) { return y - x; }));
    });
  });

  test("training inputs are flagged and never presented as validation", function () {
    return mount(F["alpha.bundle.json"]).then(function (ex) {
      var el = ex.el, b = F["alpha.bundle.json"];
      ok(q(el, "[data-sx=compare-select]").value === "targeting", "the default comparison is never the training set");
      ok(!q(el, "[data-sx=training-warning]"));
      var pick = q(el, "[data-sx=compare-select]"); pick.value = "markers"; pick.dispatchEvent(new Event("change"));
      ok(q(el, "[data-sx=training-warning]").textContent.indexOf("not independent") > 0);
      ok(!q(el, "[data-sx=concordance-skipped]"), "the training comparison itself keeps its members");
      ok(q(el, "[data-sx=training-note]").textContent.indexOf("12 of these protein groups were training inputs") === 0);
      ok(qa(el, "[data-sx=table] tbody tr")[0].textContent.indexOf("training input") > 0);
      ex.select(b.entities[0].id);
      ok(q(el, "[data-sx=training-input]").textContent.indexOf("supplied to the method, not predicted") > 0);
      ex.select(b.entities[20].id);
      ok(!q(el, "[data-sx=training-input]"));
      var sel = q(el, "[data-sx=compare-select]"); sel.value = "targeting"; sel.dispatchEvent(new Event("change"));
      ok(!q(el, "[data-sx=training-warning]"));
      ok(q(el, "[data-sx=concordance-skipped]").textContent.indexOf("training inputs") > 0, "training inputs are left out of other comparisons");
      var scope = q(el, "[data-sx=concordance-scope]").textContent;
      ok(scope.indexOf("the 1 compartments both layers can name") > 0 && scope.indexOf("Cytosol, Membrane, Nucleus") > 0, scope);
      var all = C.concordance(ex.model, "classifier", "targeting"), held = C.concordance(ex.model, "classifier", "targeting", ex.training);
      ok(held.shared + held.skipped === all.shared && held.skipped > 0);
    });
  });

  test("a layer may name several compartments for one protein group", function () {
    return mount(F["beta.bundle.json"], { initial: { layer: "reference-set" } }).then(function (ex) {
      var el = ex.el, b = F["beta.bundle.json"], a = b.layers[0].assignments[7];
      ex.select(a.entity);
      var text = q(el, '[data-sx=detail] [data-evidence="curated_annotation"]').textContent;
      [a.compartment].concat(a.others).forEach(function (c) { ok(text.indexOf(ex.model.compById[c].label) >= 0, c); });
      ex.set({ compartment: a.others[1] });
      ok(ex.filtered.some(function (e) { return e.id === a.entity; }), "found under each of its compartments");
      var c = C.concordance(ex.model, "reference-set", "model");
      ok(c.agree <= c.both);
    });
  });

  test("dataset notices and the compartment vocabulary are shown", function () {
    var b = clone(F["alpha.assignments-only.bundle.json"]);
    b.compartments[0].ontology_id = "GO:0000000"; b.compartments[1].ontology_note = "No close term; left out of ontology comparisons.";
    return mount(b).then(function (ex) {
      ok(q(ex.el, "[data-sx=notice]").textContent.indexOf("have not been supplied") > 0);
      var voc = qa(ex.el, "[data-sx=vocabulary] li").map(function (li) { return li.textContent; });
      ok(voc.length === 4 && voc[0].indexOf("= GO:0000000") > 0 && voc[1].indexOf("(no ontology term). No close term") > 0);
    });
  });

  test("an action can return a result that is shown until the selection changes", function () {
    var seen = null;
    var adapter = { actions: [{ id: "enrich", label: "Enrich", run: function (ctx) {
      seen = ctx;
      var d = document.createElement("div"); d.setAttribute("data-result", "1"); d.textContent = ctx.study.genes.length + " genes";
      return Promise.resolve(d);
    } }] };
    return mount(F["alpha.bundle.json"], { adapter: adapter }).then(function (ex) {
      var el = ex.el;
      q(el, '[data-compartment="mem"]').click();
      q(el, "[data-action=enrich]").click();
      return new Promise(function (r) { setTimeout(r, 20); }).then(function () {
        var want = EXPECT["alpha.bundle.json"].layer_counts.classifier.mem.assigned;
        ok(seen.study.used + seen.study.multi_gene + seen.study.unmapped + seen.study.undetected === want, "study is the groups with a final call");
        ok(seen.compartmentLabel === "Membrane" && seen.layerLabel === "Classifier assignment");
        eq(seen.studyBackground, EXPECT["alpha.bundle.json"].detected_single_gene_genes);
        ok(seen.study.genes.every(function (g) { return seen.studyBackground.indexOf(g) >= 0; }), "study lies inside its background");
        ok(q(el, "[data-sx=analysis] [data-result]").textContent === seen.study.genes.length + " genes");
        q(el, "[data-sx=next]") && q(el, "[data-sx=next]").click();
        ok(q(el, "[data-sx=analysis]"), "paging keeps the result");
        q(el, '[data-compartment="nuc"]').click();
        ok(!q(el, "[data-sx=analysis]"), "a new selection clears it");
      });
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
