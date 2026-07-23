#!/usr/bin/env python3
"""Preserve the Dictyostelium conference abstract books and surviving photo
galleries from dictybase.org/DictyAnnualConference, and write a manifest the
meetings page links by year.

Abstract books: one PDF per year, 1999-2018 (2006 lives under dicty06/).
Photo galleries: most are already dead on dictyBase (404 / replaced by the site
template); only four survive — Dourdan 1995, Snowbird 1997, Irsee 1998, San
Diego 2001 — so only those are mirrored.

Stored under assets/meetings/{abstracts,pictures}/ and indexed in
assets/meetings/media.json. Re-run to refresh. Standard library only.

  python3 scripts/fetch_dicty_conferences.py
"""
import json
import pathlib
import re
import ssl
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MEET = ROOT / "assets" / "meetings"
BASE = "http://dictybase.org"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = {"User-Agent": "dictyBase-preservation/1.0 (+https://dicty.labs.duke.edu)"}

# Abstract book PDFs, by year. 2006 is the odd one out (under dicty06/).
ABSTRACTS = {y: (f"/DictyAnnualConference/dicty06/dicty2006_abstracts.pdf" if y == 2006
                 else f"/DictyAnnualConference/dicty{y}.pdf") for y in range(1999, 2019)}

# dictyBase gallery entry pages, by year. Each meeting folder is crawled from
# here (sub-pages differ per year: "Page 1/2/3", "Directory 1-4", per-contributor
# folders, or a single page), collecting every photo in that meeting's directory.
GALLERIES = {
    1975: "/DictyAnnualConference/dicty75/dicty75_1.html",
    1977: "/DictyAnnualConference/dicty77/dicty77_1.html",
    1981: "/DictyAnnualConference/dicty81/dicty81_1.html",
    1983: "/DictyAnnualConference/dicty83/dicty83_1.html",
    1987: "/DictyAnnualConference/dicty87/dicty87_1.html",
    1995: "/DictyAnnualConference/dicty95/dicty95_pics.html",
    1996: "/DictyAnnualConference/dicty96/dicty96_1.html",
    1997: "/DictyAnnualConference/dicty97/thumbs.html",
    1998: "/DictyAnnualConference/dicty98/dicty98.html",
    2000: "/DictyAnnualConference/dicty00/index.html",
    2001: "/DictyAnnualConference/dicty01/index.html",
    2002: "/DictyAnnualConference/dicty02/index.html",
    2003: "/DictyAnnualConference/dicty03/index.html",
    2004: "/DictyAnnualConference/dicty04/index.html",
    2005: "/DictyAnnualConference/dicty05/index.html",
    2006: "/DictyAnnualConference/dicty06/index.html",
    2007: "/DictyAnnualConference/dicty07/index.html",
    2008: "/DictyAnnualConference/dicty08/index.html",
    2009: "/DictyAnnualConference/dicty09/index.html",
    2010: "/DictyAnnualConference/dicty10/index.html",
}


def crawl_gallery(start, max_pages=100):
    """Collect every photo URL under a meeting's folder, following in-folder
    sub-page/sub-directory links (not the site chrome, which lives elsewhere)."""
    m = re.match(r"(/DictyAnnualConference/dicty\d+/)", start)
    base = BASE + (m.group(1) if m else start.rsplit("/", 1)[0] + "/")
    seen, queue, images = set(), [BASE + start], set()
    while queue and len(seen) < max_pages:
        pg = queue.pop(0)
        if pg in seen:
            continue
        seen.add(pg)
        try:
            body = get(pg).decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            continue
        for u in re.findall(r'(?:href|src)="([^"]+\.(?:jpe?g|png))"', body, re.I):
            if "/inc/images/" not in u:
                images.add(urllib.parse.urljoin(pg, u))
        for h in re.findall(r'href="([^"]+)"', body, re.I):
            full = urllib.parse.urljoin(pg, h).split("#")[0].split("?")[0]
            if full.startswith(base) and full not in seen and not re.search(
                    r"\.(?:css|js|pdf|zip|gif|jpe?g|png)$", full, re.I):
                last = full.rstrip("/").rsplit("/", 1)[-1]
                # follow HTML pages, directories, or extensionless (dir) links —
                # the per-year sub-galleries (Page N, Directory N, contributor names).
                # Extensionless dir links need a trailing slash so their pages'
                # RELATIVE image URLs resolve inside the folder, not its parent.
                if full.endswith(".html") or full.endswith("/"):
                    queue.append(full)
                elif "." not in last:
                    queue.append(full + "/")
    return sorted(images)


def _is_thumb(u):
    return ("/thumb" in u.lower()
            or re.search(r"(?:^|/)thumb(?:nail)?[_-]|_thumb|_t\.jpe?g$|small", u, re.I) is not None)

# Meetings whose photos live on an external site (dictyBase just embeds/links
# them). We can't mirror these, so record a single link out. The rest of the
# picture links (2010-2016, 2018-2019) are dead on dictyBase and elsewhere.
EXTERNAL_PHOTOS = {
    # dictyBase PhotoFloat galleries (2011-2014): hundreds of full-res originals
    # each (~2.4 GB total), too large to mirror — link to the gallery instead.
    2011: "http://dictybase.org/conferences/pictures/#!/dicty11",
    2012: "http://dictybase.org/conferences/pictures/#!/dicty12",
    2013: "http://dictybase.org/conferences/pictures/#!/dicty13",
    2014: "http://dictybase.org/conferences/pictures/#!/dicty14",
    2017: "https://drive.google.com/drive/folders/0B_xxyPWhEOYCMkl4SmNIYnd6MkU",
}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60, context=CTX).read()


def main():
    media = {}

    # abstract books (skip re-download if already mirrored)
    adir = MEET / "abstracts"
    adir.mkdir(parents=True, exist_ok=True)
    for year, path in ABSTRACTS.items():
        rel = f"meetings/abstracts/dicty{year}_abstracts.pdf"
        dest = ROOT / "assets" / rel
        if dest.exists() and dest.stat().st_size > 1000:
            media.setdefault(str(year), {})["abstract"] = rel
            continue
        try:
            data = get(BASE + path)
        except Exception as exc:  # noqa: BLE001
            print(f"  abstract {year}: {exc}"); continue
        if len(data) < 1000:
            print(f"  abstract {year}: too small, skipped"); continue
        dest.write_bytes(data)
        media.setdefault(str(year), {})["abstract"] = rel
        print(f"  abstract {year}: {len(data):,} bytes")

    # external photo links (one link out; nothing to mirror)
    for year, url in EXTERNAL_PHOTOS.items():
        media.setdefault(str(year), {})["external_photos"] = url
        print(f"  external photos {year}: {url}")

    # photo galleries — crawl each meeting's folder for all photos
    for year, page in GALLERIES.items():
        urls = crawl_gallery(page)
        # prefer full-size over thumbnails; fall back to thumbnails if that's all
        full = [u for u in urls if not _is_thumb(u)]
        urls = full if full else urls
        pdir = MEET / "pictures" / f"dicty{year}"
        pdir.mkdir(parents=True, exist_ok=True)
        saved = []
        for u in urls:
            name = urllib.parse.unquote(u.rsplit("/", 1)[-1])
            dest = pdir / name
            rel = f"meetings/pictures/dicty{year}/{name}"
            if dest.exists() and dest.stat().st_size > 500:
                saved.append(rel); continue
            try:
                img = get(u)
            except Exception:
                continue
            if len(img) < 500:
                continue
            dest.write_bytes(img)
            saved.append(rel)
        if saved:
            media.setdefault(str(year), {})["pictures"] = saved
        print(f"  gallery {year}: {len(saved)} photos")

    # Include any manually-added files (recent meetings contributed directly,
    # not sourced from dictyBase) so they appear on the page too. Anything already
    # set from dictyBase above is left untouched.
    for pdf in sorted((MEET / "abstracts").glob("dicty*_abstracts.pdf")):
        mm = re.search(r"dicty(\d{4})_abstracts", pdf.name)
        if mm:
            media.setdefault(mm.group(1), {}).setdefault("abstract", f"meetings/abstracts/{pdf.name}")
    for pdir in sorted((MEET / "pictures").glob("dicty*")):
        mm = re.search(r"dicty(\d{4})$", pdir.name)
        if not mm or not pdir.is_dir():
            continue
        pics = sorted(f"meetings/pictures/{pdir.name}/{p.name}"
                      for p in pdir.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
        if pics:
            media.setdefault(mm.group(1), {}).setdefault("pictures", pics)

    (MEET / "media.json").write_text(json.dumps(media, indent=1, sort_keys=True) + "\n")
    tot_pics = sum(len(v.get("pictures", [])) for v in media.values())
    print(f"\nWrote {MEET/'media.json'}: {sum('abstract' in v for v in media.values())} "
          f"abstract books, {tot_pics} photos across {len(GALLERIES)} galleries")


if __name__ == "__main__":
    main()
