# Docs

Source layout:

- `reports/<scope>/report.json`: public task reports
- `pages/`: documents, tutorials, and workflows
- `index.html`: docs landing page and legacy scope-link redirect

`.github/workflows/pages.yml` assembles a temporary Pages artifact. It sparse-checks
out only `viewer/` from `Yu5h1/TaskProgress`, publishes it at `task-progress/`, and
keeps `reports/` at the site root. CLI source, tests, builds, schemas, examples, and
internal documentation are neither checked out nor deployed.

TaskProgress scope links use `/task-progress/?scope=<scope>`. Viewer updates arrive
through the `task-progress-viewer-updated` repository dispatch event; the workflow
can also be run manually with a TaskProgress branch, tag, or commit SHA.
