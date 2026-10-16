import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, accessSync, constants, existsSync } from "node:fs";
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
  assert.match(script, /NETLIFY_CLI_VERSION="27\.12\.1"/);
  assert.match(script, /npx --yes "netlify-cli@\$\{NETLIFY_CLI_VERSION\}" deploy/);
  assert.match(script, /--skip-functions-cache/);
  // Static check runs before any Netlify call; the bundle check runs before the upload.
  assert.ok(script.indexOf("deploy_bundle_expect.mjs") < script.indexOf("ensure_netlify_salts.py"));
  assert.ok(script.indexOf("node \"$bundle_tools/verify_deploy_bundle.mjs\"") < script.indexOf("npx --yes \"netlify-cli@"));
  assert.match(script, /--prod/);
  assert.match(script, /--no-build/);
  assert.match(script, /npm ci/);
  assert.doesNotMatch(script, /--auth=/);
  assert.doesNotMatch(script, /--site=/);
  assert.match(script, /--functions=netlify\/functions/);
  assert.match(script, /refresh_market_data\.sh/);
  assert.match(script, /netlify_stop_git_builds\.sh/);
  assert.match(script, /ensure_netlify_salts\.py/);
  assert.match(script, /VISIT_SALT/);
  assert.match(script, /RATHER_SALT/);
  assert.doesNotMatch(script, /NETLIFY_BUILD_HOOK/);
  // No build hooks: the only curl is the read-only post-deploy card check.
  assert.doesNotMatch(script.slice(0, script.indexOf("# Post-deploy:")), /curl/);

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
  assert.match(release, /assert_prod_release\.sh/);
  assert.doesNotMatch(release, /github\.ref/);
  assert.doesNotMatch(release, /NETLIFY_BUILD_HOOK/);

  const refresh = read(".github/workflows/deploy-site.yml");
  assert.match(refresh, /releases\/latest/);
  assert.match(refresh, /bash scripts\/deploy_live_site\.sh/);
  assert.match(refresh, /group: deploy-live/);
  assert.match(refresh, /assert_prod_release\.sh/);
  assert.match(refresh, /workflow_dispatch:/);
  assert.doesNotMatch(refresh, /schedule:/);
  assert.doesNotMatch(refresh, /cron:/);
  assert.doesNotMatch(refresh, /NETLIFY_BUILD_HOOK/);
  assert.doesNotMatch(refresh, /curl /);

  const valueRefresh = read(".github/workflows/refresh-player-values.yml");
  assert.match(valueRefresh, /player-values\/build\.py/);
  assert.match(valueRefresh, /HEAD:develop/);
  assert.match(valueRefresh, /git fetch --no-tags origin develop/);
  assert.match(valueRefresh, /cron: "17 11 \* \* \*"/);
  assert.match(valueRefresh, /prices_unchanged\.py/);
  assert.match(valueRefresh, /archive_price_snapshot\.py/);
  assert.match(valueRefresh, /git diff --cached --quiet -- docs\/data\/player_values\.json player-values\/validation\.json docs\/data\/price-history/);
  assert.match(valueRefresh, /\[skip netlify\]/);
  assert.match(valueRefresh, /docs\/data\/price-history/);
  assert.doesNotMatch(valueRefresh, /player_value_history\.json/);
  assert.doesNotMatch(valueRefresh, /abbrev-ref/);
  assert.doesNotMatch(valueRefresh, /deploy_live_site/);
  assert.doesNotMatch(valueRefresh, /--prod/);

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
  assert.match(script, /targetCommitish/);
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

test("live publish accepts only a prod release tag", () => {
  accessSync(join(root, "scripts/assert_prod_release.sh"), constants.X_OK);
  function check(tag) {
    return spawnSync("bash", [join(root, "scripts/assert_prod_release.sh"), tag], {
      encoding: "utf8",
      env: { ...process.env, RELEASE_CHECK_DRY_RUN: "1" },
    });
  }
  for (const tag of [
    "prod-20260926-live-62996b8",
    "prod-20260926-215221-62996b8",
    "prod-20261014-183000-d968e4b",
  ]) {
    const ok = check(tag);
    assert.equal(ok.status, 0, `${tag} ${ok.stderr}`);
    assert.match(ok.stdout, /Release tag ok/);
  }
  for (const tag of ["", "develop", "main", "prod", "refs/heads/prod", "prod-not-a-release"]) {
    const bad = check(tag);
    assert.equal(bad.status, 1, tag);
    assert.match(bad.stderr, /Refusing to publish/);
  }
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
  assert.match(workflow, /branches:\s*\[develop, prod, main\]/);

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

test("GitHub Pages is not a second copy of the app", () => {
  assert.equal(existsSync(join(root, ".github/workflows/preview-pages.yml")), false);
  assert.equal(existsSync(join(root, ".github/workflows/refresh-pages-preview.yml")), false);
  accessSync(join(root, "scripts/stage_pages_preview.sh"), constants.X_OK);
  const stage = read("scripts/stage_pages_preview.sh");
  assert.match(stage, /Refusing to stage a preview/);
  assert.doesNotMatch(stage, /upload-pages-artifact/);
  const refused = bash("scripts/stage_pages_preview.sh");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refusing to stage a preview/);

  const agents = read("AGENTS.md");
  assert.match(agents, /github\.io is not the app/);
  assert.match(agents, /301/);
  assert.doesNotMatch(agents, /publishes `develop` to/);

  const readme = read("README.md");
  assert.match(readme, /github\.io is not the app/);
  assert.match(readme, /301/);
  assert.match(readme, /no GitHub Pages preview workflow/);
  assert.match(readme, /stage_pages_preview\.sh/);
  assert.match(readme, /That script refuses/);
  assert.doesNotMatch(readme, /preview-pages\.yml/);
  assert.doesNotMatch(readme, /unreleased `develop` also goes to GitHub Pages/);
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
  assert.match(readme, /github\.io is not the app/);
  assert.match(readme, /Do \*\*not\*\* add a custom domain/);
  assert.match(agents, /github\.io is not the app/);
  assert.match(readme, /\?sample=1/);
  assert.doesNotMatch(readme, /Stop auto publishing so Netlify does not start/);

  const tests = read(".github/workflows/test.yml");
  assert.match(tests, /"develop"/);
  assert.match(tests, /"prod"/);
});


test("a prod push deploys its published release without relying on a token-created release event", () => {
  const workflow = read(".github/workflows/cut-release.yml");
  assert.match(workflow, /needs: cut-release/);
  assert.match(workflow, /tag: \$\{\{ steps\.release\.outputs\.tag \}\}/);
  assert.match(workflow, /ref: \$\{\{ needs\.cut-release\.outputs\.tag \}\}/);
  assert.match(workflow, /group: deploy-live/);
  assert.match(workflow, /assert_prod_release\.sh "\$RELEASE_TAG"/);
  assert.ok(workflow.indexOf('assert_prod_release.sh') < workflow.indexOf('deploy_live_site.sh'));
  assert.match(workflow, /bash scripts\/deploy_live_site\.sh/);
  assert.doesNotMatch(workflow, /schedule:/);
});
