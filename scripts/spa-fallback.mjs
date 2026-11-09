// GitHub Pages serves 404.html for unknown paths. Copying index.html there lets
// deep links like /agent-control-room/jobs/job-3 boot the SPA router.
import { copyFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
