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

  /* ---------- enriched functions for a compartment ---------- */

  var ASPECT = { P: "Biological process", F: "Molecular function", C: "Cellular component" };

  // Shown beside a compartment's protein list. The first view is a short list
  // of functions; the test, the background and the full table are one click away.
  function functionsPanel(ctx) {
    var study = ctx.study;
    var box = el("div", { "data-spatial-enrichment": ctx.compartment }, [el("h4", { text: "Enriched functions" })]);
    if (study.genes.length < 2) {
      box.appendChild(el("p", { class: "sx-muted", text: "Too few proteins here to test." }));
      return Promise.resolve(box);
    }
    return getJSON("/api/enrichment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genes: study.genes, background_genes: ctx.studyBackground, min_study: 2 })
    }).then(function (r) {
      var hits = r.results.filter(function (t) { return t.q_value < 0.05; });
      var unnamed = hits.filter(function (t) { return !t.name; }).map(function (t) { return t.id; }).slice(0, 200);
      var named = unnamed.length ? getJSON("/api/spatial/go-names?ids=" + unnamed.join(",")).then(function (x) { return x.names; }, function () { return {}; }) : Promise.resolve({});
      return named.then(function (names) {
        hits.forEach(function (t) { if (!t.name) t.name = names[t.id] || t.id; });
        return renderFunctions(box, ctx, r, hits);
      });
    }, function () {
      box.appendChild(el("p", { class: "sx-muted", text: "Enrichment could not be computed just now." }));
      return box;
    });
  }

  function renderFunctions(box, ctx, r, hits) {
    var study = ctx.study, left = [];
    if (study.multi_gene) left.push(study.multi_gene + " multi-gene groups");
    if (study.unmapped) left.push(study.unmapped + " without a gene match");
    if (study.undetected) left.push(study.undetected + " not detected");
    box.appendChild(el("p", { class: "sx-muted", "data-enrich-summary": "1", text: "GO terms over-represented among the " + r.study_n + " annotated proteins assigned here, compared with all proteins detected in the experiment." }));
    if (!hits.length) {
      box.appendChild(el("p", { text: "No function stands out." }));
    } else {
      // processes and functions first: component terms mostly restate the location
      ["P", "F", "C"].forEach(function (aspect) {
        var terms = hits.filter(function (t) { return t.aspect === aspect; }).slice(0, aspect === "P" ? 5 : 3);
        if (!terms.length) return;
        box.appendChild(el("p", { class: "sx-fn-group", text: ASPECT[aspect] }));
        box.appendChild(el("ul", { class: "sx-fn-list" }, terms.map(function (t) {
          return el("li", { class: "sx-fn", "data-go": t.id }, [
            el("a", { class: "sx-fn-name", href: "/go/" + encodeURIComponent(t.id), text: t.name }),
            el("span", { class: "sx-fn-bar" }, [el("i", { style: "width:" + Math.round(100 * t.study_count / t.study_n) + "%" })]),
            el("span", { class: "sx-fn-meta", text: t.study_count + " of " + t.study_n + " proteins · " + (t.fold_enrichment >= 10 ? Math.round(t.fold_enrichment) : t.fold_enrichment) + "× more than expected" })
          ]);
        })));
      });
    }
    var details = el("details", { class: "sx-fine", "data-enrich-details": "1" }, [
      el("summary", { text: "How this was calculated" + (hits.length ? " and all " + hits.length + " terms" : "") }),
      el("p", { "data-enrich-background": "1", text: study.genes.length + " genes from " + study.used + " protein groups assigned to " + ctx.compartmentLabel + " (" + ctx.layerLabel + "); " + r.study_n +
        " have a GO annotation. Background: " + r.background_requested_n + " genes from protein groups detected in this experiment, " + r.background_n + " with a GO annotation. It is not the whole genome." +
        (left.length ? " Left out because they cannot be tied to one gene: " + left.join(", ") + "." : "") }),
      el("p", { text: "Hypergeometric test with Benjamini-Hochberg correction, q below 0.05. Training markers are included. Cellular component terms partly restate the localization itself." })
    ]);
    if (hits.length) {
      details.appendChild(el("div", { class: "sx-scroll" }, [el("table", { class: "sx-table" }, [
        el("thead", {}, [el("tr", {}, ["GO term", "Kind", "Here", "Detected", "Fold", "q"].map(function (t) { return el("th", { text: t }); }))]),
        el("tbody", {}, hits.slice(0, 100).map(function (t) {
          return el("tr", {}, [
            el("td", {}, [el("a", { href: "/go/" + encodeURIComponent(t.id), text: t.name }), el("div", { class: "sx-mono sx-muted", text: t.id })]),
            el("td", { text: ASPECT[t.aspect] || t.aspect }), el("td", { text: t.study_count + " / " + t.study_n }), el("td", { text: t.pop_count + " / " + t.pop_n }),
            el("td", { text: t.fold_enrichment == null ? "" : String(t.fold_enrichment) }), el("td", { text: t.q_value.toExponential(1) })
          ]);
        }))
      ])]));
    }
    box.appendChild(details);
    return box;
  }

  /* ---------- the tool page ---------- */

  function explorerAdapter(host) {
    return {
      geneUrl: function (id) { return host.geneHref(id); },
      geneLabel: function (id) { var g = host.gene(id); return (g && g.symbol) || id; },
      geneLinkText: "dictyBase gene page",
      memberUrl: function (acc) { return "https://www.ncbi.nlm.nih.gov/protein/" + encodeURIComponent(acc); },
      searchText: function (entity) {
        return entity.members.map(function (m) {
          var g = m.gene != null ? host.gene(m.gene) : null;
          return g ? [g.symbol, g.name].concat(g.synonyms || []).join(" ") : "";
        }).join(" ");
      },
      extraLayers: function () { return getJSON("/api/spatial/layers").then(function (r) { return r.layers || []; }); },
      compartmentPanel: functionsPanel
    };
  }

  // Keep the address bar in step with what is on screen, so a view can be
  // bookmarked, shared, or returned to from a gene page.
  function syncUrl(state) {
    var p = new URLSearchParams();
    if (state.view === "compartment" && state.compartment) p.set("compartment", state.compartment);
    else if (state.view === "unassigned") p.set("view", "unassigned");
    else if (state.view === "search" && state.gene) p.set("gene", state.gene);
    else if (state.view === "search" && state.query) p.set("q", state.query);
    if (state.entity) p.set("protein", state.entity);
    var query = p.toString();
    try { root.history.replaceState(root.history.state, "", "/tools/spatial" + (query ? "?" + query : "")); } catch (err) { /* address bar only */ }
  }

  // Fills `shell` with the page. Query parameters gene, protein, compartment,
  // view and q select the starting state, so gene pages can link straight in.
  function openPage(shell, host) {
    shell.textContent = "";
    var mountPoint = el("div", { id: "spatial-explorer", "data-spatial-explorer": "1" }, [el("p", { class: "muted", text: "Loading spatial proteomics data…" })]);
    shell.appendChild(el("article", { class: "record-card research-card spatial-page" }, [mountPoint]));
    return status().then(function (st) {
      if (!st.available) {
        mountPoint.textContent = "";
        mountPoint.appendChild(el("p", { "data-spatial-unavailable": "1", style: "padding:24px", text: "Spatial proteomics data are not available on this server. " + (st.reason || "") }));
        return null;
      }
      var params = new URLSearchParams(root.location.search);
      return loadExplorer().then(function () {
        return root.SpatialExplorer.mount(mountPoint, {
          bundleUrl: "/api/spatial/bundle", adapter: explorerAdapter(host), theme: "light",
          searchPlaceholder: "Search a gene or protein, for example mhcA, DDB_G0286355 or XP_637740.1",
          initial: { gene: params.get("gene"), entity: params.get("protein"), view: params.get("view"), compartment: params.get("compartment"), layer: params.get("layer") },
          onState: syncUrl
        });
      }).then(function (explorer) {
        root.dictySpatialExplorer = explorer;
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
