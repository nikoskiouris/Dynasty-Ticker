import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, accessSync, constants, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(name) {
  return readFileSync(join(root, name), "utf8");
}

function bash(script, extraEnv = {}) {
  return spawnSync("bash", [join(root, script)], {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

test("Netlify git builds skip so merges do not publish", () => {
  accessSync(join(root, "scripts/netlify-ignore.sh"), constants.X_OK);
  const toml = read("netlify.toml");
  assert.match(toml, /ignore = "bash \.\/scripts\/netlify-ignore\.sh"/);
  const skipped = bash("scripts/netlify-ignore.sh");
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.match(skipped.stdout, /Skipping Netlify git build/);
});

test("Netlify git/hook command refuses to publish git branches", () => {
  accessSync(join(root, "scripts/netlify-git-build.sh"), constants.X_OK);
  const toml = read("netlify.toml");
  assert.match(toml, /command = "bash \.\/scripts\/netlify-git-build\.sh"/);
  assert.doesNotMatch(toml, /refresh_market_data/);
  const refused = bash("scripts/netlify-git-build.sh");
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /Refusing Netlify git\/hook build/);
  assert.match(refused.stdout, /Git pushes must not publish/);
});

test("live deploy script uses Netlify CLI, not a build hook", () => {
  accessSync(join(root, "scripts/deploy_live_site.sh"), constants.X_OK);
  const script = read("scripts/deploy_live_site.sh");
  assert.match(script, /NETLIFY_AUTH_TOKEN/);
  assert.match(script, /NETLIFY_SITE_ID/);
  assert.match(script, /netlify-cli@27 deploy/);
  assert.match(script, /--prod/);
  assert.match(script, /--no-build/);
  assert.match(script, /--functions=netlify\/functions/);
  assert.match(script, /refresh_market_data\.sh/);
  assert.match(script, /netlify_stop_git_builds\.sh/);
  assert.doesNotMatch(script, /NETLIFY_BUILD_HOOK/);
  assert.doesNotMatch(script, /curl/);

  const missing = bash("scripts/deploy_live_site.sh", {
    NETLIFY_AUTH_TOKEN: "",
    NETLIFY_SITE_ID: "",
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /NETLIFY_AUTH_TOKEN/);
});

test("GitHub Actions publish only from a GitHub Release", () => {
  const release = read(".github/workflows/deploy-release.yml");
  assert.match(release, /release:/);
  assert.match(release, /types:\s*\[published\]/);
  assert.match(release, /bash scripts\/deploy_live_site\.sh/);
  assert.match(release, /group: deploy-live/);
  assert.match(release, /Refuse untagged manual deploys/);
  assert.match(release, /Do not deploy develop or main/);
  assert.doesNotMatch(release, /NETLIFY_BUILD_HOOK/);

  const refresh = read(".github/workflows/deploy-site.yml");
  assert.match(refresh, /releases\/latest/);
  assert.match(refresh, /bash scripts\/deploy_live_site\.sh/);
  assert.match(refresh, /group: deploy-live/);
  assert.match(refresh, /workflow_dispatch:/);
  assert.doesNotMatch(refresh, /schedule:/);
  assert.doesNotMatch(refresh, /cron:/);
  assert.doesNotMatch(refresh, /NETLIFY_BUILD_HOOK/);
  assert.doesNotMatch(refresh, /curl /);

  const mockRefresh = read(".github/workflows/refresh-rookie-mock.yml");
  assert.match(mockRefresh, /schedule:/);
  assert.match(mockRefresh, /cron:/);
  assert.match(mockRefresh, /update_dynasty_rookie_mock\.py/);
  assert.match(mockRefresh, /ref:\s*develop/);
  assert.match(mockRefresh, /HEAD:develop/);
  assert.doesNotMatch(mockRefresh, /deploy_live_site/);
  assert.doesNotMatch(mockRefresh, /netlify/i);
  assert.doesNotMatch(mockRefresh, /--prod/);
});

test("push to prod cuts a GitHub Release", () => {
  accessSync(join(root, "scripts/cut_github_release.sh"), constants.X_OK);
  const workflow = read(".github/workflows/cut-release.yml");
  assert.match(workflow, /branches:\s*\[prod\]/);
  assert.match(workflow, /cut_github_release\.sh/);
  assert.match(workflow, /contents:\s*write/);

  const script = read("scripts/cut_github_release.sh");
  assert.match(script, /gh release create/);
  assert.match(script, /CUT_RELEASE_DRY_RUN/);
  assert.doesNotMatch(script, /netlify deploy/);

  const missing = bash("scripts/cut_github_release.sh", {
    GH_TOKEN: "",
    GITHUB_TOKEN: "",
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /GH_TOKEN/);

  const dry = bash("scripts/cut_github_release.sh", {
    GH_TOKEN: "fake",
    GITHUB_REPOSITORY: "nikoskiouris/Dynasty-Ticker",
    GITHUB_SHA: "abc1234deadbeef",
    CUT_RELEASE_DRY_RUN: "1",
  });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Would create release prod-/);
});

test("Netlify git builds are stopped at the site so merges never start a job", () => {
  accessSync(join(root, "scripts/netlify_stop_git_builds.sh"), constants.X_OK);
  const script = read("scripts/netlify_stop_git_builds.sh");
  assert.match(script, /stop_builds/);
  assert.match(script, /api\.netlify\.com\/api\/v1\/sites/);
  assert.doesNotMatch(script, /stop auto publishing/i);

  const workflow = read(".github/workflows/stop-netlify-git-builds.yml");
  assert.match(workflow, /netlify_stop_git_builds\.sh/);
  assert.match(workflow, /push:/);

  const missing = bash("scripts/netlify_stop_git_builds.sh", {
    NETLIFY_AUTH_TOKEN: "",
    NETLIFY_SITE_ID: "",
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /NETLIFY_AUTH_TOKEN/);

  const dry = bash("scripts/netlify_stop_git_builds.sh", {
    NETLIFY_AUTH_TOKEN: "fake",
    NETLIFY_SITE_ID: "site-id",
    NETLIFY_STOP_BUILDS_DRY_RUN: "1",
  });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Would stop Netlify git builds/);
});

test("develop publishes a GitHub Pages preview and not the live site", () => {
  accessSync(join(root, "scripts/stage_pages_preview.sh"), constants.X_OK);
  const workflow = read(".github/workflows/preview-pages.yml");
  assert.match(workflow, /branches:\s*\[develop\]/);
  assert.match(workflow, /stage_pages_preview\.sh/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /group: pages-preview/);
  assert.doesNotMatch(workflow, /deploy_live_site/);
  assert.doesNotMatch(workflow, /branches:\s*\[prod\]/);
  assert.doesNotMatch(workflow, /cname/i);
  assert.doesNotMatch(workflow, /dynastyticker\.com/);

  const dest = mkdtempSync(join(tmpdir(), "pages-preview-"));
  try {
    const staged = spawnSync("bash", [join(root, "scripts/stage_pages_preview.sh"), dest], {
      encoding: "utf8",
    });
    assert.equal(staged.status, 0, staged.stderr);
    assert.equal(readFileSync(join(dest, "robots.txt"), "utf8"), "User-agent: *\nDisallow: /\n");
    assert.equal(existsSync(join(dest, ".nojekyll")), true);
    assert.equal(existsSync(join(dest, "index.html")), true);
    assert.equal(existsSync(join(dest, "sitemap.xml")), false);
    assert.equal(existsSync(join(dest, "_redirects")), false);
    assert.match(read("docs/robots.txt"), /Sitemap: https:\/\/dynastyticker\.com\/sitemap\.xml/);
    assert.match(read("docs/_redirects"), /\/api\/visit/);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }

  const refused = spawnSync("bash", [join(root, "scripts/stage_pages_preview.sh"), join(root, "docs")], {
    encoding: "utf8",
  });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refusing to stage/);
});

test("agents land work on develop and release from prod", () => {
  const agents = read("AGENTS.md");
  assert.match(agents, /Open PRs against \*\*`develop`\*\*/);
  assert.match(agents, /develop` into `prod/);
  assert.doesNotMatch(agents, /daily job refreshes/i);

  const readme = read("README.md");
  assert.match(readme, /Work on `develop`/);
  assert.match(readme, /merged into `prod`/);
  assert.match(readme, /do \*\*not\*\* mean credits were spent/i);
  assert.match(readme, /Stopped builds/);
  assert.match(readme, /nikoskiouris\.github\.io\/Dynasty-Ticker/);
  assert.match(readme, /Do \*\*not\*\* add a custom domain/);
  assert.match(agents, /github\.io\/Dynasty-Ticker/);
  assert.doesNotMatch(readme, /Stop auto publishing so Netlify does not start/);

  const tests = read(".github/workflows/test.yml");
  assert.match(tests, /"develop"/);
  assert.match(tests, /"prod"/);
});
