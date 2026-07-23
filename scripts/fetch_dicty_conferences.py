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

# The four galleries that still serve real photos, (year -> listing page).
GALLERIES = {
    1995: "/DictyAnnualConference/dicty95/dicty95_pics.html",
    1997: "/DictyAnnualConference/dicty97/thumbs.html",
    1998: "/DictyAnnualConference/dicty98/dicty98.html",
    2001: "/DictyAnnualConference/dicty01/index.html",
}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60, context=CTX).read()


def main():
    media = {}

    # abstract books
    adir = MEET / "abstracts"
    adir.mkdir(parents=True, exist_ok=True)
    for year, path in ABSTRACTS.items():
        try:
            data = get(BASE + path)
        except Exception as exc:  # noqa: BLE001
            print(f"  abstract {year}: {exc}"); continue
        if len(data) < 1000:
            print(f"  abstract {year}: too small, skipped"); continue
        rel = f"meetings/abstracts/dicty{year}_abstracts.pdf"
        (ROOT / "assets" / rel).write_bytes(data)
        media.setdefault(str(year), {})["abstract"] = rel
        print(f"  abstract {year}: {len(data):,} bytes")

    # photo galleries
    for year, page in GALLERIES.items():
        pageurl = BASE + page
        try:
            body = get(pageurl).decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            print(f"  gallery {year}: {exc}"); continue
        hrefs = re.findall(r'href="([^"]+\.(?:jpg|jpeg|JPG|JPEG))"', body)
        srcs = re.findall(r'src="([^"]+\.(?:jpg|jpeg|JPG|JPEG))"', body)
        urls = [u for u in (hrefs or srcs) if "/inc/images/" not in u]
        urls = sorted({urllib.parse.urljoin(pageurl, u) for u in urls})
        pdir = MEET / "pictures" / f"dicty{year}"
        pdir.mkdir(parents=True, exist_ok=True)
        saved = []
        for u in urls:
            name = urllib.parse.unquote(u.rsplit("/", 1)[-1])
            try:
                img = get(u)
            except Exception:
                continue
            if len(img) < 500:
                continue
            (pdir / name).write_bytes(img)
            saved.append(f"meetings/pictures/dicty{year}/{name}")
        if saved:
            media.setdefault(str(year), {})["pictures"] = saved
        print(f"  gallery {year}: {len(saved)} photos")

    (MEET / "media.json").write_text(json.dumps(media, indent=1, sort_keys=True) + "\n")
    tot_pics = sum(len(v.get("pictures", [])) for v in media.values())
    print(f"\nWrote {MEET/'media.json'}: {sum('abstract' in v for v in media.values())} "
          f"abstract books, {tot_pics} photos across {len(GALLERIES)} galleries")


if __name__ == "__main__":
    main()
