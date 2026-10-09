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

  function citationLine(ds) {
    var c = ds.citation || {};
    return el("p", {}, [
      "Source: " + c.text + " ",
      c.url ? el("a", { class: "text-link", href: c.url, target: "_blank", rel: "noopener", text: "Preprint" }) : null,
      c.peer_reviewed === false ? " (not peer reviewed)." : "."
    ]);
  }

  /* ---------- GO enrichment against the detected proteome ---------- */

  var ASPECT = { P: "Process", F: "Function", C: "Component" };

  function enrichmentAction() {
    return {
      id: "go-enrichment",
      label: "GO enrichment for this compartment",
      run: function (ctx) {
        if (ctx.view === "unassigned") return el("p", { text: "Enrichment is run on protein groups with a final call. Switch to By compartment and select one." });
        if (!ctx.compartment) return el("p", { text: "Select a compartment first. Enrichment is computed for the protein groups with a final call in that compartment." });
        var study = ctx.study;
        if (study.genes.length < 2) return el("p", { text: "Too few genes with a final call in " + ctx.compartmentLabel + " to test." });
        return getJSON("/api/enrichment", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ genes: study.genes, background_genes: ctx.studyBackground, min_study: 2 })
        }).then(function (r) { return renderEnrichment(ctx, r); });
      }
    };
  }

  function renderEnrichment(ctx, r) {
    var study = ctx.study, left = [];
    if (study.multi_gene) left.push(study.multi_gene + " multi-gene groups");
    if (study.unmapped) left.push(study.unmapped + " unmapped groups");
    if (study.undetected) left.push(study.undetected + " undetected groups");
    var significant = r.results.filter(function (t) { return t.q_value < 0.05; });
    var rows = significant.slice(0, 40);
    var wrap = el("div", { "data-spatial-enrichment": ctx.compartment }, [
      el("h3", { text: "GO enrichment: " + ctx.compartmentLabel }),
      el("p", { "data-enrich-summary": "1", text: study.genes.length + " genes from " + study.used + " protein groups with a final call in " + ctx.compartmentLabel +
        " (" + ctx.layerLabel + "). " + r.study_n + " of them have a GO annotation and were tested." +
        (left.length ? " Left out because they cannot be attributed to one gene: " + left.join(", ") + "." : "") }),
      el("p", { "data-enrich-background": "1", text: "Background: the detected proteome, " + r.background_requested_n + " genes from single-gene protein groups detected in this experiment, of which " +
        r.background_n + " have a GO annotation. This is not the whole genome." }),
      el("p", { class: "sx-muted", text: "Hypergeometric test with Benjamini-Hochberg correction, the same engine as the GO enrichment tool. " +
        significant.length + " terms at q < 0.05" + (significant.length > rows.length ? "; the first " + rows.length + " are shown." : ".") +
        " Cellular component terms partly restate the localization itself, and training markers are included in the set." })
    ]);
    if (!rows.length) {
      wrap.appendChild(el("p", { text: "No GO term is over-represented at q < 0.05." }));
      return wrap;
    }
    var body = el("tbody", {}, rows.map(function (t) {
      var name = el("a", { class: "text-link", href: "/go/" + encodeURIComponent(t.id), "data-go": t.id, text: t.name || t.id });
      return el("tr", {}, [
        el("td", {}, [name, el("div", { class: "sx-mono sx-muted", text: t.id })]),
        el("td", { text: ASPECT[t.aspect] || t.aspect }),
        el("td", { text: t.study_count + " / " + t.study_n }),
        el("td", { text: t.pop_count + " / " + t.pop_n }),
        el("td", { text: t.fold_enrichment == null ? "" : String(t.fold_enrichment) }),
        el("td", { text: t.q_value.toExponential(2) })
      ]);
    }));
    var unnamed = rows.filter(function (t) { return !t.name; }).map(function (t) { return t.id; });
    if (unnamed.length) {
      getJSON("/api/spatial/go-names?ids=" + unnamed.join(",")).then(function (r) {
        Array.prototype.forEach.call(body.querySelectorAll("a[data-go]"), function (a) {
          var n = r.names[a.getAttribute("data-go")];
          if (n) a.textContent = n;
        });
      }).catch(function () {});
    }
    wrap.appendChild(el("div", { class: "sx-scroll" }, [el("table", { class: "sx-table sx-compact" }, [
      el("thead", {}, [el("tr", {}, ["GO term", "Aspect", "In set", "In background", "Fold", "q value"].map(function (t) { return el("th", { text: t }); }))]),
      body
    ])]));
    return wrap;
  }

  /* ---------- the tool page ---------- */

  function explorerAdapter(host) {
    return {
      geneUrl: function (id) { return host.geneHref(id); },
      geneLabel: function (id) { var g = host.gene(id); return (g && g.symbol) || id; },
      memberUrl: function (acc) { return "https://www.ncbi.nlm.nih.gov/protein/" + encodeURIComponent(acc); },
      searchText: function (entity) {
        return entity.members.map(function (m) {
          var g = m.gene != null ? host.gene(m.gene) : null;
          return g ? [g.symbol, g.name].concat(g.synonyms || []).join(" ") : "";
        }).join(" ");
      },
      extraLayers: function () { return getJSON("/api/spatial/layers").then(function (r) { return r.layers || []; }); },
      actions: [enrichmentAction()]
    };
  }

  // Fills `shell` with the page. Query parameters gene, view, compartment and
  // layer select the starting state, so gene pages can link straight in.
  function openPage(shell, host) {
    shell.textContent = "";
    var mountPoint = el("div", { id: "spatial-explorer", "data-spatial-explorer": "1" }, [el("p", { class: "muted", text: "Loading spatial proteomics data…" })]);
    var intro = el("div", { class: "record-title" }, [
      el("p", { class: "eyebrow", text: "Tools · Proteomics · Dataset under evaluation" }),
      el("h2", { text: "Subcellular spatial proteomics" })
    ]);
    shell.appendChild(el("article", { class: "record-card research-card" }, [
      el("header", { class: "record-header" }, [intro]),
      el("div", { class: "record-body" }, [mountPoint])
    ]));
    return status().then(function (st) {
      if (!st.available) {
        mountPoint.textContent = "";
        mountPoint.appendChild(el("p", { "data-spatial-unavailable": "1", text: "Spatial proteomics data are not available on this server. " + (st.reason || "") }));
        return null;
      }
      intro.appendChild(el("p", { text: "Protein localization assignments from subcellular fractionation and mass spectrometry of vegetative cells. " +
        st.counts.detected.toLocaleString() + " detected protein groups, shown with the published classes and scores exactly as reported." }));
      intro.appendChild(citationLine(st.dataset));
      var params = new URLSearchParams(root.location.search);
      return loadExplorer().then(function () {
        return root.SpatialExplorer.mount(mountPoint, {
          bundleUrl: "/api/spatial/bundle", adapter: explorerAdapter(host), theme: "light",
          initial: { gene: params.get("gene"), view: params.get("view"), compartment: params.get("compartment"), layer: params.get("layer") }
        });
      }).then(function (explorer) { root.dictySpatialExplorer = explorer; return explorer; });
    }).catch(function (err) {
      if (!mountPoint.querySelector("[role=alert]")) {
        mountPoint.textContent = "";
        mountPoint.appendChild(el("p", { role: "alert", text: "The spatial proteomics explorer could not be opened: " + err.message }));
      }
      return null;
    });
  }

  /* ---------- the gene page section ---------- */

  var EVIDENCE_TEXT = {
    computational_assignment: "Computed from fractionation profiles",
    curated_annotation: "Curated",
    sequence_prediction: "Sequence prediction"
  };

  function assignmentLine(a) {
    var call;
    if (a.status === "assigned") call = [a.compartment].concat(a.others || []).join(", ");
    else call = a.status_label + (a.compartment ? " (method named " + a.compartment + ")" : "");
    var bits = [el("strong", { text: a.label + ": " }), call];
    if (a.score != null) bits.push(el("span", { style: "font-family:ui-monospace,Menlo,monospace;font-size:.75rem", text: "  " + a.score_name + " = " + String(a.score) }));
    Object.keys(a.attributes || {}).forEach(function (k) {
      var v = a.attributes[k];
      bits.push(el("span", { style: "color:var(--muted,#6b7280)", text: "  " + k + ": " + (v === true ? "yes" : v === false ? "no" : v) }));
    });
    if (a.training_input) bits.push(el("div", { style: "color:var(--muted,#6b7280)", text: "Training input (" + a.training_input + "): the class was supplied to the classifier, not predicted." }));
    return el("li", { "data-spatial-layer": a.layer, title: EVIDENCE_TEXT[a.evidence_type] || "" }, bits);
  }

  // Renders into `target` only when the gene has a protein group. Returns the
  // number of groups shown.
  function geneSection(target, host, ddb) {
    return status().then(function (st) {
      if (!st.available) return 0;
      return getJSON("/api/spatial/gene?ddb=" + encodeURIComponent(ddb)).then(function (data) {
        if (!data.groups.length) return 0;
        var c = data.dataset.citation || {};
        var box = el("div", { "data-spatial-gene": ddb, style: "border-left:3px solid var(--teal,#0b746a);background:var(--soft,#e7eef7);color:var(--ink,#1f2937);padding:9px 12px;border-radius:6px;font-size:.8125rem;line-height:1.5" }, [
          el("div", {}, [el("strong", { text: "Subcellular spatial proteomics. " }),
            data.dataset.public ? null : el("span", { text: "Dataset under evaluation, local preview. " }),
            "Detected in " + data.groups.length + " protein group" + (data.groups.length > 1 ? "s" : "") + " in vegetative cells."])
        ]);
        data.groups.forEach(function (g) {
          var members = g.members.map(function (m) { return m.id; });
          var head = el("div", { style: "margin-top:6px" }, [el("span", { style: "font-family:ui-monospace,Menlo,monospace;font-size:.75rem", text: members.slice(0, 4).join("; ") + (members.length > 4 ? " and " + (members.length - 4) + " more" : "") })]);
          box.appendChild(head);
          if (g.other_genes.length) {
            var shared = el("div", { "data-spatial-shared": "1" }, ["This protein group also contains proteins from " + g.other_genes.length + " other gene" + (g.other_genes.length > 1 ? "s" : "") + " ("]);
            g.other_genes.slice(0, 8).forEach(function (id, i) {
              var info = host.gene(id);
              if (i) shared.appendChild(document.createTextNode(", "));
              shared.appendChild(el("a", { class: "text-link", href: host.geneHref(id), text: (info && info.symbol) || id }));
            });
            shared.appendChild(document.createTextNode((g.other_genes.length > 8 ? ", …" : "") + "). The result applies to the group as a whole and cannot be attributed to this gene alone."));
            box.appendChild(shared);
          }
          if (!g.detected) box.appendChild(el("div", { text: "Listed by an annotation layer but not detected in this experiment." }));
          box.appendChild(el("ul", { style: "margin:4px 0 0;padding-left:18px" }, g.assignments.map(assignmentLine)));
        });
        if (!data.has_profiles) box.appendChild(el("div", { style: "color:var(--muted,#6b7280);margin-top:6px", text: "Fractionation profiles and the spatial map are awaiting the full experimental matrix." }));
        box.appendChild(el("div", { style: "margin-top:6px" }, [
          el("a", { class: "text-link", href: "/tools/spatial?gene=" + encodeURIComponent(ddb), "data-spatial-link": "1", text: "Open in the spatial proteomics explorer" }),
          " · " + (c.text || "").split(".")[0].split(",")[0] + " et al., ",
          c.url ? el("a", { class: "text-link", href: c.url, target: "_blank", rel: "noopener", text: "bioRxiv preprint" }) : "preprint",
          c.peer_reviewed === false ? " (not peer reviewed)." : "."
        ]));
        target.textContent = "";
        target.appendChild(box);
        return data.groups.length;
      });
    }).catch(function () { return 0; });
  }

  root.DictySpatial = { status: status, openPage: openPage, geneSection: geneSection };
})(window);
