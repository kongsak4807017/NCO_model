# Raw CMI archive

The authorised collector writes rendered CMI pages here as:

```
data/cmi/raw/definitions/<indicator-code>.html\ndata/cmi/raw/<fiscal-year>/<indicator-code>.html
```

Raw files are the audit trail for parser verification. If the complete raw archive becomes too large for the normal Git repository, keep the normalized five-year dataset in GitHub and move the raw archive to a versioned release or approved organisational storage while retaining SHA-256 hashes in `data/cmi/manifests/source_manifest.json`.

Do not edit raw pages manually.


The `definitions/` copy is collected independently of the annual value pages. It is used to preserve the published numerator/denominator/formula metadata even when a fiscal year has no observed value.
