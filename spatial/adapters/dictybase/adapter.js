/* dictyBase adapter for the spatial proteomics explorer.
 *
 * The only browser code that knows both sides: it mounts the generic explorer
 * on /tools/spatial, links protein groups to dictyBase gene pages, adds
 * dictyBase GO annotations as separate layers, runs GO enrichment against the
 * detected proteome, and renders the per-gene section on gene pages.
 *
 * The host page passes a small `host` object, so this file does not reach
 * into the application's globals:
 *   host.gene(ddb)     -> { symbol, name, synonyms } or null
 *   host.geneHref(ddb) -> in-app link to the gene page
 */
(function (root) {
  "use strict";

  var EXPLORER_JS = "/spatial/js/spatial-explorer.js";
  var EXPLORER_CSS = "/spatial/js/spatial-explorer.css";
  var statusPromise = null, assetsPromise = null;

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] == null || attrs[k] === false) return;
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else if (k === "style") node.style.cssText = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function getJSON(url, options) {
    return fetch(url, options).then(function (r) {
      if (!r.ok) throw new Error("request failed (" + r.status + ")");
      return r.json();
    });
  }

  function status() {
    if (!statusPromise) {
      statusPromise = getJSON("/api/spatial/status").catch(function () { return { available: false, reason: "Status could not be read." }; });
    }
    return statusPromise;
  }

  function loadExplorer() {
    if (root.SpatialExplorer) return Promise.resolve();
    if (!assetsPromise) {
      assetsPromise = new Promise(function (resolve, reject) {
        document.head.appendChild(el("link", { rel: "stylesheet", href: EXPLORER_CSS }));
        var s = el("script", { src: EXPLORER_JS });
        s.onload = resolve;
        s.onerror = function () { reject(new Error("The explorer script could not be loaded.")); };
        document.head.appendChild(s);
      });
    }
    return assetsPromise;
  }

  /* ---------- functional enrichment against the detected proteome ---------- */

  var KIND = { P: "Biological process", F: "Molecular function", C: "Cellular component" };
  var NOT_YET = "This analysis is not available yet. Only GO term enrichment has been validated against the detected-proteome background.";
  var ENRICHMENT_TABS = [
    { id: "go", label: "GO terms" },
    { id: "domains", label: "Protein domains", unavailable: NOT_YET },
    { id: "pathways", label: "Pathways", unavailable: NOT_YET },
    { id: "complexes", label: "Complexes", unavailable: NOT_YET }
  ];

  // GO enrichment for the protein groups assigned to one compartment. Study and
  // background follow the same rule: detected groups that resolve to one gene.
  function enrichment(ctx) {
    var study = ctx.study;
    if (study.genes.length < 2) return Promise.resolve({ terms: [], summary: "Too few proteins assigned here to test." });
    return getJSON("/api/enrichment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genes: study.genes, background_genes: ctx.studyBackground, min_study: 2 })
    }).then(function (r) {
      var hits = r.results.filter(function (t) { return t.q_value < 0.05; });
      var unnamed = hits.filter(function (t) { return !t.name; }).map(function (t) { return t.id; }).slice(0, 200);
      var named = unnamed.length ? getJSON("/api/spatial/go-names?ids=" + unnamed.join(",")).then(function (x) { return x.names; }, function () { return {}; }) : Promise.resolve({});
      return named.then(function (names) {
        var left = [];
        if (study.multi_gene) left.push(study.multi_gene + " multi-gene groups");
        if (study.unmapped) left.push(study.unmapped + " without a gene match");
        if (study.undetected) left.push(study.undetected + " not detected");
        return {
          terms: hits.map(function (t) {
            return { id: t.id, name: t.name || names[t.id] || t.id, kind: KIND[t.aspect] || t.aspect, q: t.q_value, count: t.study_count, n: t.study_n,
                     background: t.pop_count, backgroundN: t.pop_n, fold: t.fold_enrichment, url: "/go/" + encodeURIComponent(t.id) };
          }),
          summary: hits.length + " GO terms at FDR below 0.05 among " + r.study_n + " annotated proteins assigned to " + ctx.compartmentLabel + ", against " + r.background_n + " annotated detected proteins.",
          method: study.genes.length + " genes from " + study.used + " protein groups assigned to " + ctx.compartmentLabel + " (" + ctx.layerLabel + "). Background: " + r.background_requested_n +
            " genes from protein groups detected in this experiment, not the whole genome." + (left.length ? " Left out because they cannot be tied to one gene: " + left.join(", ") + "." : "") +
            " Hypergeometric test with Benjamini-Hochberg correction. Training markers are included. Cellular component terms partly restate the localization itself."
        };
      });
    });
  }

  /* ---------- the dashboard page ---------- */

  var EXAMPLE_GENE = "DDB_G0271848";   // porA, shown when a visitor arrives without choosing a protein

  // Rows the generic details panel cannot know: GO annotations and outside links.
  function overviewRows(host) {
    return function (entity, explorer) {
      var model = explorer.model, rows = [];
      var go = function (layerId) { return (model.byLayer[layerId] || {})[entity.id]; };
      var termLinks = function (a) {
        var out = [];
        String((a.attributes || {}).terms || "").split("; ").filter(Boolean).forEach(function (t, i) {
          var m = t.match(/^(.*) \((GO:\d{7})\)$/);
          if (i) out.push(document.createElement("br"));
          out.push(m ? el("a", { href: "/go/" + m[2], text: m[1] + " (" + m[2] + ")" }) : document.createTextNode(t));
        });
        return out;
      };
      var exp = go("go-cc-experimental"), inf = go("go-cc-inferred");
      if (exp) rows.push(["GO cellular component", termLinks(exp), "go"]);
      else if (inf) rows.push(["GO cellular component", [el("span", { class: "sx-muted", text: "Inferred only: " })].concat(termLinks(inf)), "go"]);
      else rows.push(["GO cellular component", [el("span", { class: "sx-muted", text: "None in the compartments compared here" })], "go"]);
      var codes = (exp || inf) && ((exp || inf).attributes || {}).codes;
      if (codes) rows.push(["Evidence", codes + (exp ? "" : " (inferred, not experimental)"), "evidence"]);
      var links = [], sep = function () { if (links.length) links.push(document.createTextNode(" | ")); };
      entity.members.forEach(function (m) {
        if (m.gene == null || links.some(function (n) { return n.getAttribute && n.getAttribute("data-gene") === m.gene; })) return;
        sep(); links.push(el("a", { href: host.geneHref(m.gene), "data-gene": m.gene, text: "dictyBase" + (entity.members.length > 1 ? " " + ((host.gene(m.gene) || {}).symbol || m.gene) : "") }));
      });
      links = links.slice(0, 9);
      sep(); links.push(el("a", { href: "https://www.ncbi.nlm.nih.gov/protein/" + encodeURIComponent(entity.members[0].id), target: "_blank", rel: "noopener", text: "NCBI Protein" }));
      var firstGene = entity.members.filter(function (m) { return m.gene != null; })[0];
      if (firstGene) { sep(); links.push(el("a", { href: "https://www.uniprot.org/uniprotkb?query=" + encodeURIComponent(firstGene.gene), target: "_blank", rel: "noopener", text: "UniProt" })); }
      rows.push(["External links", links, "links"]);
      return rows;
    };
  }

  function explorerAdapter(host) {
    return {
      geneUrl: function (id) { return host.geneHref(id); },
      geneLabel: function (id) { var g = host.gene(id); return (g && g.symbol) || id; },
      geneLinkText: "dictyBase gene page",
      geneName: function (id) { var g = host.gene(id); return (g && g.name) || ""; },
      memberUrl: function (acc) { return "https://www.ncbi.nlm.nih.gov/protein/" + encodeURIComponent(acc); },
      termUrl: function (id) { return "/go/" + encodeURIComponent(id); },
      searchText: function (entity) {
        return entity.members.map(function (m) {
          var g = m.gene != null ? host.gene(m.gene) : null;
          return g ? [g.symbol, g.name].concat(g.synonyms || []).join(" ") : "";
        }).join(" ");
      },
      extraLayers: function () { return getJSON("/api/spatial/layers").then(function (r) { return r.layers || []; }); },
      enrichment: enrichment,
      enrichmentTabs: ENRICHMENT_TABS,
      overviewRows: overviewRows(host)
    };
  }

  // Keep the address bar in step with what is on screen, so a view can be
  // bookmarked, shared, or returned to from a gene page.
  function syncUrl(state) {
    var p = new URLSearchParams();
    if (state.mode !== "map") p.set("mode", state.mode);
    if (state.compartment) p.set("compartment", state.compartment);
    if (state.show !== "all") p.set("show", state.show);
    if (state.gene) p.set("gene", state.gene);
    else if (state.query) p.set("q", state.query);
    if (state.entity) p.set("protein", state.entity);
    var query = p.toString();
    try { root.history.replaceState(root.history.state, "", "/tools/spatial" + (query ? "?" + query : "")); } catch (err) { /* address bar only */ }
  }

  // Fills `shell` with the dashboard. Query parameters mode, compartment, show,
  // gene, protein and q select the starting state, so gene pages can link in.
  function openPage(shell, host) {
    shell.textContent = "";
    var mountPoint = el("div", { id: "spatial-explorer", "data-spatial-explorer": "1" }, [el("p", { class: "muted", style: "padding:24px", text: "Loading spatial proteomics data…" })]);
    // the same page header every dictyBase tool uses: eyebrow, title, summary
    var actions = el("div", { class: "spatial-actions", "data-spatial-actions": "1" });
    var summary = el("p", {}, ["Explore the subcellular organization of the ", el("em", { text: "Dictyostelium" }), " proteome using subcellular fractionation and mass spectrometry."]);
    var page = el("article", { class: "record-card research-card spatial-page" }, [
      el("header", { class: "record-header" }, [
        el("div", { class: "record-title" }, [
          el("p", { class: "eyebrow", text: "Tools · Proteomics" }),
          el("h2", {}, ["Spatial Proteomics Explorer ", el("span", { class: "spatial-preview-label", "data-spatial-preview": "1", text: "Preview \u2014 under development" })]), summary]),
        actions]),
      mountPoint]);
    shell.appendChild(page);
    // The dashboard needs more width than the site's reading column. Only the
    // column widens; the site header, navigation and footer stay as they are.
    document.body.classList.add("spatial-wide");
    var watch = new MutationObserver(function () {
      if (page.isConnected && !shell.hasAttribute("hidden")) return;
      document.body.classList.remove("spatial-wide");
      watch.disconnect();
    });
    watch.observe(shell, { childList: true, attributes: true, attributeFilter: ["hidden"] });
    return status().then(function (st) {
      if (!st.available) {
        mountPoint.textContent = "";
        mountPoint.appendChild(el("p", { "data-spatial-unavailable": "1", style: "padding:24px", text: "Spatial proteomics data are not available on this server. " + (st.reason || "") }));
        return null;
      }
      var params = new URLSearchParams(root.location.search);
      var chosen = params.get("protein") || params.get("gene");
      return loadExplorer().then(function () {
        return root.SpatialExplorer.mount(mountPoint, {
          bundleUrl: "/api/spatial/bundle", adapter: explorerAdapter(host), theme: "light",
          header: false,
          searchHint: "e.g. DDB_G0271848, porA, XP_637740.1",
          mapPending: "Awaiting the experimental fractionation matrix and map coordinates from the authors of the study.",
          profilePending: "Awaiting the experimental fractionation matrix from the authors of the study. Nothing is drawn in its place.",
          initial: { mode: params.get("mode"), compartment: params.get("compartment"), show: params.get("show"), view: params.get("view"),
                     gene: params.get("gene") || (chosen ? null : EXAMPLE_GENE), entity: params.get("protein"), layer: params.get("layer") },
          onState: syncUrl
        });
      }).then(function (explorer) {
        root.dictySpatialExplorer = explorer;
        // header buttons, as ordinary site buttons
        [["about", "About", function () { explorer.go({ mode: "methods" }); }],
         ["export", "Download", function () { explorer.exportTSV(); }],
         ["cite", "Cite", function () { explorer.go({ mode: "methods" }); var t = mountPoint.querySelector("[data-sx=citation]"); if (t) t.scrollIntoView({ block: "nearest" }); }]].forEach(function (b) {
          var btn = el("button", { type: "button", class: "button", "data-spatial-action": b[0], text: b[1] });
          btn.addEventListener("click", b[2]);
          actions.appendChild(btn);
        });
        var q = params.get("q");
        if (q && !params.get("gene")) { explorer.search.value = q; explorer.showResults(); }
        return explorer;
      });
    }).catch(function (err) {
      if (!mountPoint.querySelector("[role=alert]")) {
        mountPoint.textContent = "";
        mountPoint.appendChild(el("p", { role: "alert", style: "padding:24px", text: "The spatial proteomics explorer could not be opened: " + err.message }));
      }
      return null;
    });
  }

  /* ---------- the gene page section ---------- */

  // One compact block per protein group: where the protein was found, the
  // reported score, any reference set it belongs to, and a link into the explorer.
  function groupBlock(g, host, ddb, many) {
    var main = g.assignments.filter(function (a) { return a.evidence_type === "computational_assignment"; })[0];
    var refs = g.assignments.filter(function (a) { return a !== main && a.source === "author" && a.status === "assigned"; });
    var mono = "font-family:ui-monospace,Menlo,monospace;font-size:.75rem";
    var muted = "color:var(--muted,#6b7280)";
    var line = el("div", { "data-spatial-layer": main ? main.layer : "", style: "margin-top:4px" });
    if (!main) line.appendChild(el("span", { text: "Not detected in this experiment." }));
    else if (main.status === "assigned") {
      line.appendChild(el("strong", { style: "font-size:.95rem", text: main.compartment }));
      line.appendChild(el("span", { style: muted, text: "  published SVM assignment" }));
    } else {
      line.appendChild(el("strong", { style: "font-size:.95rem", text: "No final call" }));
      line.appendChild(el("span", { style: muted, text: "  published as “" + main.status_label + "”" + (main.compartment ? "; closest class " + main.compartment + ", not an assignment" : "") }));
    }
    var rows = [line];
    if (main && main.score != null) rows.push(el("div", { style: muted }, ["Reported score ", el("span", { style: mono, text: main.score_name + " = " + String(main.score) })]));
    if (main && main.training_input) rows.push(el("div", { style: muted, text: "Training marker: this class was given to the classifier, not predicted by it." }));
    if (refs.length) rows.push(el("div", { "data-spatial-refs": "1", style: muted, text: "Also in: " + refs.map(function (a) { return a.label.replace(/ \(Tinker et al\. 2026\)$/, "") + " (" + a.compartment + ")"; }).join("; ") + "." }));
    if (g.other_genes.length) {
      var shared = el("div", { "data-spatial-shared": "1", style: muted }, ["Measured as a protein group shared with "]);
      g.other_genes.slice(0, 6).forEach(function (id, i) {
        var info = host.gene(id);
        if (i) shared.appendChild(document.createTextNode(", "));
        shared.appendChild(el("a", { class: "text-link", href: host.geneHref(id), text: (info && info.symbol) || id }));
      });
      shared.appendChild(document.createTextNode((g.other_genes.length > 6 ? " and " + (g.other_genes.length - 6) + " more" : "") + ". The result applies to the group as a whole."));
      rows.push(shared);
    }
    if (many) rows.unshift(el("div", { style: mono + ";margin-top:8px", text: g.members.map(function (m) { return m.id; }).slice(0, 3).join("; ") + (g.members.length > 3 ? " …" : "") }));
    rows.push(el("div", { style: "margin-top:4px" }, [el("a", { class: "text-link", "data-spatial-link": "1",
      href: "/tools/spatial?gene=" + encodeURIComponent(ddb) + "&protein=" + encodeURIComponent(g.entity), text: "View in the spatial proteomics explorer →" })]));
    return el("div", { "data-spatial-group": g.entity }, rows);
  }

  // Renders into `target` only when the gene has a protein group. Returns the
  // number of groups shown.
  function geneSection(target, host, ddb) {
    return status().then(function (st) {
      if (!st.available) return 0;
      return getJSON("/api/spatial/gene?ddb=" + encodeURIComponent(ddb)).then(function (data) {
        if (!data.groups.length) return 0;
        var c = data.dataset.citation || {}, many = data.groups.length > 1;
        var box = el("div", { "data-spatial-gene": ddb, style: "border-left:3px solid var(--teal,#0b746a);background:var(--soft,#e7eef7);color:var(--ink,#1f2937);padding:10px 14px;border-radius:6px;font-size:.8125rem;line-height:1.5" }, [
          el("div", { style: "font-size:.6875rem;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:var(--muted,#6b7280)",
            text: "Subcellular localization · spatial proteomics" + (many ? " · " + data.groups.length + " protein groups" : "") })
        ]);
        data.groups.forEach(function (g) { box.appendChild(groupBlock(g, host, ddb, many)); });
        box.appendChild(el("div", { style: "margin-top:6px;color:var(--muted,#6b7280);font-size:.75rem" }, [
          (c.text || "").split(",")[0].replace(/ [A-Z-]+$/, "") + " et al. 2026, ",
          c.url ? el("a", { class: "text-link", href: c.url, target: "_blank", rel: "noopener", text: "preprint" }) : "preprint",
          c.peer_reviewed === false ? ", not peer reviewed." : ".",
          data.dataset.public ? "" : " Dataset under evaluation, local preview."
        ]));
        target.textContent = "";
        target.appendChild(box);
        return data.groups.length;
      });
    }).catch(function () { return 0; });
  }

  root.DictySpatial = { status: status, openPage: openPage, geneSection: geneSection };
})(window);
