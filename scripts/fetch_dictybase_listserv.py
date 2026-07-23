#!/usr/bin/env python3
"""Mirror the dictyBase "Dicty ListServ Archive" before dictybase.org retires.

The archive (http://dictybase.org/ListServ_archive/) is a curated collection of
questions and answers sent to the dicty@listserv mailing list since 1997,
grouped into ~18 topic pages. This script:

  1. downloads every ListServ_archive HTML page (index + questions index +
     unanswered + one content page per topic) and saves raw copies under
     assets/listserv/pages/ for preservation, and
  2. parses the topic pages into structured JSON (assets/listserv/archive.json)
     so the site can render the whole archive natively — searchable, in our own
     styling, with no dependency on dictybase.org.

Build-time only (needs network). Re-run to refresh:

    python3 scripts/fetch_dictybase_listserv.py
"""
import html
import json
import os
import re
import sys
import urllib.request
from html.parser import HTMLParser

BASE = "http://dictybase.org/ListServ_archive/"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "listserv")
PAGES_DIR = os.path.join(OUT_DIR, "pages")

# The three navigation pages plus one content page per topic. Order here sets the
# order of sections on our page; titles come from the questions index below.
CONTENT_FILES = [
    "listserv_archive_generalq.html", "listserv_archive_genef.html",
    "listserv_archive_transfo.html", "listserv_archive_ko.html",
    "listserv_archive_geneex.html", "listserv_archive_vectors.html",
    "listserv_archive_growth.html", "listserv_archive_media.html",
    "listserv_archive_axe.html", "listserv_archive_bacteria.html",
    "listserv_archive_celldiff.html", "listserv_archive_molecbiol.html",
    "listserv_archive_proteins.html", "listserv_archive_biochem.html",
    "listserv_archive_cytosk.html", "listserv_archive_cellbio.html",
    "listserv_archive_micros.html", "listserv_archive_staining.html",
    "listserv_archive_reagents.html",
]
NAV_FILES = ["index.html", "listserv_archive_questions.html", "listserv_archive_unansw.html"]

# Top-level section titles, keyed by content file (from the archive's own
# "Jump to Section" index). Hardcoded because a few files use section anchors
# the index doesn't expose cleanly.
TITLES = {
    "listserv_archive_generalq.html": "General Dictyostelium Questions",
    "listserv_archive_genef.html": "Gene Features",
    "listserv_archive_transfo.html": "Transformation",
    "listserv_archive_ko.html": "Gene Disruption",
    "listserv_archive_geneex.html": "Gene Expression in Dictyostelium",
    "listserv_archive_vectors.html": "Dictyostelium Vectors",
    "listserv_archive_growth.html": "Growing Dictyostelium",
    "listserv_archive_media.html": "Media",
    "listserv_archive_axe.html": "Growing Dictyostelium in Axenic Medium",
    "listserv_archive_bacteria.html": "Growing Dictyostelium on Bacteria",
    "listserv_archive_celldiff.html": "Dictyostelium Cell Types and Cell Differentiation",
    "listserv_archive_molecbiol.html": "Molecular Biology Techniques",
    "listserv_archive_proteins.html": "Dictyostelium Proteins",
    "listserv_archive_biochem.html": "Biochemistry Techniques",
    "listserv_archive_cytosk.html": "Cytoskeleton",
    "listserv_archive_cellbio.html": "Cell Biology Methods",
    "listserv_archive_micros.html": "Microscopy",
    "listserv_archive_staining.html": "Cell Staining",
    "listserv_archive_reagents.html": "Drugs, Inhibitors, Reagents",
}


def fetch(name):
    # Reuse the saved raw copy when present (re-parsing without re-downloading);
    # pass --refresh to force a fresh download of every page.
    cached = os.path.join(PAGES_DIR, name)
    if "--refresh" not in sys.argv and os.path.exists(cached):
        with open(cached, encoding="utf-8") as fh:
            return fh.read()
    url = BASE + ("" if name == "index.html" else name)
    req = urllib.request.Request(url, headers={"User-Agent": "dictyBase-mirror/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


# ---- HTML sanitiser -------------------------------------------------------
# Keep the answer markup (nested lists, emphasis, author attributions, links)
# but drop presentational cruft (font/color/style) and rewrite links: internal
# cross-references become in-page anchors; everything else opens in a new tab.
ALLOWED = {"ul", "ol", "li", "b", "i", "em", "strong", "br", "p", "a",
           "sub", "sup", "blockquote", "table", "tr", "td", "th", "pre"}
DROP_CONTENT = {"script", "style"}


class Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self._skip = 0
        self._a_stack = []   # per <a>: True if we emitted a tag to close

    def handle_starttag(self, tag, attrs):
        if tag in DROP_CONTENT:
            self._skip += 1
            return
        if tag == "font":  # unwrap: drop the tag, keep its text
            return
        if tag not in ALLOWED:
            return
        if tag == "a":
            new = rewrite_href(dict(attrs).get("href", ""))
            if not new:                       # dead/unmappable link -> unwrap to text
                self._a_stack.append(False)
            elif new.startswith(("/", "#")):  # our own page or in-page anchor
                self.out.append(f'<a href="{html.escape(new)}">')
                self._a_stack.append(True)
            else:                             # external link
                self.out.append(f'<a href="{html.escape(new)}" target="_blank" rel="noopener">')
                self._a_stack.append(True)
        else:
            self.out.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag in DROP_CONTENT:
            self._skip = max(0, self._skip - 1)
            return
        if tag == "font" or tag not in ALLOWED:
            return
        if tag == "a":
            if self._a_stack and self._a_stack.pop():
                self.out.append("</a>")
            return
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self._skip:
            return
        self.out.append(html.escape(data, quote=False))

    def result(self):
        s = "".join(self.out)
        s = re.sub(r"(?:\s*<br>\s*){3,}", "<br><br>", s)   # collapse runs of <br>
        s = re.sub(r"<(ul|ol)>\s*</\1>", "", s)             # drop empty lists
        return s.strip()


def rewrite_href(href):
    """Rewrite a source link to its equivalent on this site.

    Returns an in-page anchor (#..), one of our own routes (/..), an external
    URL, or "" when the link is dead/unmappable and should be unwrapped to
    plain text (keeping the citation but dropping the broken href).
    """
    href = (href or "").strip().lstrip()
    href = re.sub(r"^(?:%20|\s)+", "", href)   # some source hrefs have a leading space
    if not href or href.startswith(("#top", "javascript:")):
        return ""
    # Cross-reference within the archive -> in-page anchor (qid).
    m = re.match(r"listserv_archive_[\w]+\.html#([\w]+)", href, re.I)
    if m:
        return "#" + m.group(1)

    # Normalise dictybase.org URLs (absolute or root-relative) to a path so we
    # can map them onto our own routes.
    dm = re.match(r"https?://(?:www\.)?dictybase\.org(/.*)?$", href, re.I)
    path = dm.group(1) if dm else (href if href.startswith("/") else None)
    if path:
        g = re.search(r"gene_page\.pl\?(?:gene_name|dictybaseid)=([\w.\-]+)", path, re.I)
        if g:
            return "/gene/" + g.group(1)
        if re.search(r"/blast\.pl", path, re.I):
            return "/tools/blast"
        if re.search(r"/SC/|/StockCenter", path, re.I):
            return "/stock-center"
        if re.search(r"/suggestion\b", path, re.I):
            return "/community/suggestions"
        # dictyBase's reference/publication system is retired (500s everywhere),
        # so refNo/author links can't resolve — keep the citation text, drop link.
        if re.search(r"reference\.pl|/publication/", path, re.I):
            return ""
        am = re.search(r"/ListServ_archive/listserv_archive_[\w]+\.html#([\w]+)", path, re.I)
        if am:
            return "#" + am.group(1)
        if re.match(r"/ListServ_archive/", path, re.I):
            return "/community/listserv"
        # Other dictybase.org pages we don't host yet — leave pointing at the
        # source for now (some still resolve); revisit as pages are migrated.
        return "http://dictybase.org" + path

    if href.startswith(("http://", "https://", "mailto:")):
        return href
    if href.startswith("listserv_archive"):   # bare archive page, no anchor
        return ""
    # Bare external domain with no scheme (e.g. www.jacksonimmuno.com).
    if re.match(r"(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:/|$)", href):
        return "http://" + href
    return ""   # anything else relative/unknown -> unwrap to text


def sanitize(fragment):
    p = Sanitizer()
    p.feed(fragment)
    return p.result()


def strip_tags(fragment):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", fragment)).strip()


# ---- extract the ordered section list from the questions index ------------
def parse_section_order(questions_html):
    """[(section_id, title, content_file)] in the order the index presents them."""
    body = questions_html
    sections = []
    # A section header: <a name="ID" ...></a> <a href="file.html#ID"><...>Title</a>
    for m in re.finditer(
        r'<a\s+name="([\w]+)"[^>]*></a>\s*'
        r'<a\s+href="(listserv_archive_[\w]+\.html)#\1"[^>]*>(.*?)</a>',
        body, re.I | re.S):
        sid, cfile, title = m.group(1), m.group(2), strip_tags(m.group(3))
        if title:
            sections.append((sid, title, cfile))
    return sections


# ---- parse Q&A blocks out of a content page -------------------------------
def extract_balanced(s, start):
    """Return the <ul>...</ul> (balanced) beginning at or after index `start`."""
    i = s.find("<ul", start)
    if i < 0:
        return "", start
    depth, j = 0, i
    for m in re.finditer(r"<(/?)ul\b[^>]*>", s[i:]):
        if not m.group(1):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                j = i + m.end()
                return s[i:j], j
    return s[i:], len(s)


def parse_content_page(page_html):
    """{qid: {q, date, answersHtml}} for every answered question on the page."""
    body = page_html[page_html.lower().find("<body"):]
    out = {}
    # Question anchor immediately followed by a bold question in the same <p>.
    anchors = list(re.finditer(
        r'<a\s+name="([\w]+)"[^>]*></a>\s*<b>(.*?)</b>(.*?)(?=<a\s+name="[\w]+"[^>]*></a>\s*<b>|<hr\b|</body>)',
        body, re.I | re.S))
    for m in anchors:
        qid, qhtml, rest = m.group(1), m.group(2), m.group(3)
        question = strip_tags(qhtml)
        if not question:
            continue
        # Optional asked-date: a leading <i> whose text starts with a digit
        # (e.g. "26 Jan 1998"). Author attributions start with a name, so they
        # don't match and stay in the answer body. Answers are not always in a
        # <ul> — some flow as inline text — so keep everything after the date.
        date = ""
        dm = re.match(r"\s*(?:<br>\s*)*<i>\s*-?\s*([0-9][^<]{0,45}?)\s*</i>\s*(?:<br>\s*)*", rest)
        if dm:
            date = strip_tags(dm.group(1))
            rest = rest[dm.end():]
        # Drop the per-answer "[TOP] [INDEX]" nav and the page footer that follow
        # the answer text (whichever chrome marker appears first).
        cut = len(rest)
        for marker in (r'<p\s+align="right"', r'/inc/images/logo\.gif', r'<!--\s*footer'):
            mm = re.search(marker, rest, re.I)
            if mm:
                cut = min(cut, mm.start())
        rest = rest[:cut]
        out[qid] = {
            "q": question,
            "date": date,
            "answersHtml": sanitize(rest),
        }
    return out


def parse_unanswered(page_html):
    body = page_html[page_html.lower().find("<body"):]
    # The unanswered questions live in the <ul> right after the content <hr>;
    # scope to it so the site-navigation <li>s above aren't swept in.
    hr = re.search(r"<hr\b[^>]*>\s*<ul\b", body, re.I)
    ul, _ = extract_balanced(body, hr.start() if hr else 0)
    items = []
    for m in re.finditer(r"<li\b[^>]*>(.*?)</li>", ul, re.I | re.S):
        frag = m.group(1)
        # split the question from its trailing <i>author, place, date</i>
        am = re.search(r"<i>\s*-?\s*(.*?)</i>", frag, re.S)
        by = strip_tags(am.group(1)) if am else ""
        q = strip_tags(frag[:am.start()] if am else frag)
        if len(q) > 12:
            items.append({"q": q, "by": by})
    return items


def parse_intro(index_html):
    m = re.search(r"We have complied a ListServ Archive.*?since 1997\.", index_html, re.S)
    return strip_tags(m.group(0)) if m else (
        "Questions and answers sent to the dicty@listserv mailing list since 1997.")


def main():
    os.makedirs(PAGES_DIR, exist_ok=True)
    raw = {}
    for name in NAV_FILES + CONTENT_FILES:
        try:
            raw[name] = fetch(name)
        except Exception as e:
            print(f"  ! {name}: {e}")
            continue
        with open(os.path.join(PAGES_DIR, name), "w", encoding="utf-8") as fh:
            fh.write(raw[name])
        print(f"  saved {name} ({len(raw[name]):,} bytes)")

    order = parse_section_order(raw.get("listserv_archive_questions.html", ""))
    print(f"\n  {len(order)} sections in index order")

    # content-file -> section title (first section that points at it wins)
    file_title = {}
    for sid, title, cfile in order:
        file_title.setdefault(cfile, title)

    sections = []
    total_q = 0
    for cfile in CONTENT_FILES:
        page = raw.get(cfile)
        if not page:
            continue
        qmap = parse_content_page(page)
        # order questions by their appearance in the index, then any extras
        ordered_ids = [qid for qid in _index_qids_flat(raw, cfile) if qid in qmap]
        for qid in qmap:
            if qid not in ordered_ids:
                ordered_ids.append(qid)
        questions = [dict(id=qid, **qmap[qid]) for qid in ordered_ids]
        total_q += len(questions)
        sections.append({
            "id": cfile.replace("listserv_archive_", "").replace(".html", ""),
            "title": TITLES.get(cfile) or file_title.get(cfile, cfile),
            "questions": questions,
        })
        print(f"  {cfile}: {len(questions)} Q&A")

    unanswered = parse_unanswered(raw.get("listserv_archive_unansw.html", ""))
    data = {
        "source": BASE,
        "intro": parse_intro(raw.get("index.html", "")),
        "sections": sections,
        "unanswered": unanswered,
        "counts": {"questions": total_q, "sections": len(sections),
                   "unanswered": len(unanswered)},
    }
    out = os.path.join(OUT_DIR, "archive.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f"\n  wrote {out}: {total_q} questions in {len(sections)} sections, "
          f"{len(unanswered)} unanswered")


def _index_qids_flat(raw, cfile):
    """Question ids (in index order) that link to a given content file."""
    q = raw.get("listserv_archive_questions.html", "")
    return [m.group(1) for m in re.finditer(
        re.escape(cfile) + r"#([\w]+)", q)]


if __name__ == "__main__":
    main()
