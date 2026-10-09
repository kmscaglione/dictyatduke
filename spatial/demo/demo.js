/* Standalone host for the explorer. Shows what a host supplies: a bundle URL
   and an adapter. Nothing here comes from any real site or organism. */
(function () {
  "use strict";
  var DATASETS = [
    { file: "alpha.bundle.json", label: "Exemplum primum: profiles and an author-supplied map" },
    { file: "beta.derived.bundle.json", label: "Fictus alter: profiles, computed PCA map and layer" },
    { file: "beta.bundle.json", label: "Fictus alter: profiles only, no map" },
    { file: "alpha.assignments-only.bundle.json", label: "Exemplum primum: assignments only" }
  ];
  var params = new URLSearchParams(location.search);
  var select = document.getElementById("dataset"), log = document.getElementById("log"), mountEl = document.getElementById("explorer");
  var current = null;

  // A mock host: gene links, gene symbols, one host annotation layer, one action.
  function adapter(bundle) {
    return {
      geneUrl: function (id) { return "#gene/" + encodeURIComponent(id); },
      geneLabel: function (id) { return id.replace(/^locus:/, ""); },
      searchText: function (entity) { return entity.members.length > 1 ? "multi-member" : ""; },
      extraLayers: function (b) {
        var first = b.layers[0];
        return Promise.resolve([{
          id: "host-annotations", label: "Host annotations (mock)", evidence_type: "curated_annotation", source: "external",
          method: { name: "mock host lookup", description: "Stand-in for annotations a host site would supply." },
          assignments: first.assignments.slice(0, 6).map(function (a) { return { entity: a.entity, compartment: a.compartment, status: "assigned" }; })
        }]);
      },
      actions: [{ id: "enrich", label: "Send genes to host analysis", run: function (ctx) {
        log.textContent = ctx.genes.length + " genes sent, against a background of " + ctx.backgroundGenes.length + " detected genes.";
      } }]
    };
  }

  function show(url) {
    if (current) current.destroy();
    current = null;
    log.textContent = "";
    return window.SpatialExplorer.mount(mountEl, { bundleUrl: url, adapter: adapter(), theme: "auto" }).then(function (ex) {
      current = ex;
      window.demoExplorer = ex;
      return ex;
    });
  }

  DATASETS.forEach(function (d) {
    var o = document.createElement("option");
    o.value = "../tests/fixtures/" + d.file; o.textContent = d.label;
    select.appendChild(o);
  });
  // ?bundle=<relative path> lets a developer look at a local, unpublished bundle
  var custom = params.get("bundle");
  if (custom && /^[\w.\-\/]+\.json$/.test(custom) && custom.indexOf("//") < 0) {
    var o = document.createElement("option");
    o.value = custom; o.textContent = "Local file: " + custom; o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener("change", function () { show(select.value); });
  show(select.value);
})();
