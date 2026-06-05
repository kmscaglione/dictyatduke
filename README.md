# dictyBase v2

Fresh focused prototype for a replacement dictyBase experience.

## Scope

- Gene search with local autocomplete-style suggestions.
- Gene record pages at `/gene/:symbol`.
- Direct external link-outs to PubMed, AlphaFold, NCBI Gene, UniProt, and VEuPathDB.
- Seed records for `cln5`, `acaA`, `mhcA`, `carA`, `rasG`, and `pkaC`.
- Salvaged v1 source-derived seed records for `gbpC`, `sadA`, `tgrB1`, `tgrC1`, `pdsA`, `csaA`, `regA`, `act15`, and `ecmA`.
- Summary, GO, phenotypes, literature, and structures sections.

Stocks, downloads, accounts, queues, and broad tool/workspace flows are intentionally left out for now.

## Run

```bash
python3 serve.py 8768
```

Then open:

```text
http://127.0.0.1:8768/
```

If that port is already occupied, use another port:

```bash
python3 serve.py 8769
```

Useful direct routes:

```text
http://127.0.0.1:8768/gene/cln5
http://127.0.0.1:8768/gene/acaA
http://127.0.0.1:8768/search?q=pkaC
http://127.0.0.1:8768/gene/gbpC
```
