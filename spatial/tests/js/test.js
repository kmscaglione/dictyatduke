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
