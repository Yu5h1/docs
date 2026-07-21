# Docs

Source layout:

- `vendor/task-progress/`: pinned TaskProgress Git submodule
- `reports/<scope>/report.json`: public task reports
- `pages/`: documents, tutorials, and workflows
- `index.html`: docs landing page and legacy scope-link redirect

`.github/workflows/pages.yml` assembles a temporary Pages artifact. It copies only
`vendor/task-progress/viewer/` into the public `task-progress/` path, so CLI source,
tests, builds, schemas, and internal documentation are never deployed.

TaskProgress scope links use `/task-progress/?scope=<scope>`. Update the Viewer by
advancing the submodule commit, committing that gitlink change, and pushing `main`.
