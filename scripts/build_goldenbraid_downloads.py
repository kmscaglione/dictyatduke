#!/usr/bin/env python3
"""Build the GoldenBraid plasmid file downloads (SnapGene .dna maps).

Copies the Dictyostelium GoldenBraid kit files (Shaulsky lab) from the three
source folders into assets/goldenbraid/<group>/ and writes
assets/goldenbraid/manifest.json, which the Downloads page lists. Each current
group also gets a zip for bulk download.

    python3 scripts/build_goldenbraid_downloads.py [SOURCE_DIR]

SOURCE_DIR (default ~/Downloads) holds the folders as received:
  "Assemblies Plasmid Files/"                         -> assemblies
  "Assemblies Plasmid Files/Legacy constructs/"       -> legacy-constructs
  "Assemblies Plasmid Files/Legacy actin8 terminator/" -> legacy-actin8-terminator
  "Backbones .dna Files/"                             -> backbones
  "Parts/"                                            -> parts

The two legacy groups (~345 MB; mostly SnapGene's saved edit history) are too
large for git. They are gitignored and copied to the server by hand (see
docs/OPERATIONS.md); the manifest still lists them. Files are copied unchanged.
Standard library only.
"""
import json
import os
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "goldenbraid")
SRC = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads")

# (key, title, source folder relative to SRC, recurse into subfolders, in git)
GROUPS = [
    ("assemblies", "Assemblies", "Assemblies Plasmid Files", False, True),
    ("backbones", "Backbones", "Backbones .dna Files", True, True),
    ("parts", "Parts", "Parts", True, True),
    ("legacy-constructs", "Legacy constructs", "Assemblies Plasmid Files/Legacy constructs", True, False),
    ("legacy-actin8-terminator", "Legacy actin8 terminator",
     "Assemblies Plasmid Files/Legacy actin8 terminator", True, False),
]
BLURBS = {
    "assemblies": "Assembled GoldenBraid plasmids: transcriptional units and multi-unit constructs.",
    "backbones": "GoldenBraid destination vectors (pDGB alpha and omega backbones, and pUPD2).",
    "parts": "Domesticated parts: promoters, coding sequences, tags and terminators.",
    "legacy-constructs": "Earlier pBSK-based versions of the assemblies.",
    "legacy-actin8-terminator": "Earlier pBSK-based constructs that use the actin8 terminator.",
}
ZIP_DATE = (2026, 1, 1, 0, 0, 0)   # fixed, so a rebuild with the same files gives the same zip


def _source_files(folder, recurse):
    base = os.path.join(SRC, folder)
    if not os.path.isdir(base):
        raise SystemExit(f"missing source folder: {base}")
    out = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        for name in sorted(filenames):
            if not name.startswith("."):
                out.append(os.path.join(dirpath, name))
        if not recurse:
            break
    return out


def main():
    manifest = {
        "title": "GoldenBraid plasmid files",
        "credit": "Dictyostelium GoldenBraid kit, Shaulsky lab (Baylor College of Medicine).",
        "format": "SnapGene .dna files (open in SnapGene or the free SnapGene Viewer).",
        "groups": [],
    }
    for key, title, folder, recurse, in_git in GROUPS:
        dest = os.path.join(OUT, key)
        os.makedirs(dest, exist_ok=True)
        files = []
        for src in _source_files(folder, recurse):
            name = os.path.basename(src)
            shutil.copy2(src, os.path.join(dest, name))
            files.append({"name": name, "path": f"goldenbraid/{key}/{name}",
                          "bytes": os.path.getsize(src)})
        names = {f["name"] for f in files}
        if len(names) != len(files):
            raise SystemExit(f"{title}: two source files share a name")
        for stale in set(os.listdir(dest)) - names:           # files removed at the source
            os.remove(os.path.join(dest, stale))
        group = {"key": key, "title": title, "blurb": BLURBS[key], "in_git": in_git,
                 "count": len(files), "bytes": sum(f["bytes"] for f in files), "files": files}
        if in_git:
            zpath = os.path.join(OUT, f"{key}.zip")
            with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
                for f in files:
                    info = zipfile.ZipInfo(f"GoldenBraid {title}/{f['name']}", ZIP_DATE)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    with open(os.path.join(dest, f["name"]), "rb") as fh:
                        z.writestr(info, fh.read())
            group["zip"] = {"path": f"goldenbraid/{key}.zip", "bytes": os.path.getsize(zpath)}
        manifest["groups"].append(group)
        print(f"  {title}: {len(files)} files, {group['bytes'] / 1048576:.1f} MB"
              + ("" if in_git else "  (server only, not in git)"))
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)
        fh.write("\n")
    print(f"Wrote {os.path.relpath(os.path.join(OUT, 'manifest.json'), ROOT)}")


if __name__ == "__main__":
    main()
