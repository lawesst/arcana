import { expect, test } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:3101";
const SEED_DAPP_ID = "11111111-1111-4111-8111-111111111111";
const SEED_DAPP_NAME = "Smoke Seed Stylus";
const SEEDED_TX_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1";
const SEEDED_TX_LABEL = "Stylus 0xabcdef03";
const TEST_DAPP_PREFIX = "Smoke E2E ";
const TEST_ALERT_THRESHOLD_MIN = 900_000_000;
const TEST_ALERT_THRESHOLD_MAX = 910_000_000;

type DAppResponse = {
  id: string;
  name: string;
};

type AlertRuleResponse = {
  id: string;
  metric: string;
  threshold: string;
  enabled: boolean;
};

test.afterEach(async ({ request }) => {
  const dappsResponse = await request.get(`${API_BASE_URL}/api/dapps`);
  if (dappsResponse.ok()) {
    const payload = (await dappsResponse.json()) as {
      data: DAppResponse[];
    };

    for (const dapp of payload.data) {
      if (!dapp.name.startsWith(TEST_DAPP_PREFIX)) continue;
      await request.delete(`${API_BASE_URL}/api/dapps/${dapp.id}`);
    }
  }

  const alertsResponse = await request.get(`${API_BASE_URL}/api/alerts`);
  if (alertsResponse.ok()) {
    const payload = (await alertsResponse.json()) as {
      data: AlertRuleResponse[];
    };

    for (const rule of payload.data) {
      const threshold = Number.parseFloat(rule.threshold);
      if (
        rule.metric === "gas_usage" &&
        threshold >= TEST_ALERT_THRESHOLD_MIN &&
        threshold <= TEST_ALERT_THRESHOLD_MAX
      ) {
        await request.delete(`${API_BASE_URL}/api/alerts/${rule.id}`);
      }
    }
  }
});

test("overview renders seeded analytics", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Execution History" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Correlation Insight" }),
  ).toBeVisible();
  await expect(page.getByText("Stylus Participation")).toBeVisible();
  await expect(page.getByText(SEEDED_TX_LABEL)).toBeVisible();
});

test("seeded dApp detail shows real backfill status and events", async ({
  page,
}) => {
  await page.goto(`/dapps/${SEED_DAPP_ID}`);

  await expect(
    page.getByRole("heading", { name: SEED_DAPP_NAME }),
  ).toBeVisible();

  const statusPanel = page.getByTestId("backfill-status-panel");
  await expect(statusPanel).toBeVisible();
  await expect(statusPanel).toContainText(/historical backfill/i);
  await expect(statusPanel).toContainText(/completed/i);
  await expect(statusPanel).toContainText("Indexed Events");
  await expect(page.getByText("SmokeTransfer")).toBeVisible();
});

test("registry can add and archive a monitored dApp", async ({
  page,
  request,
}) => {
  const suffix = Date.now().toString(16);
  const name = `${TEST_DAPP_PREFIX}${suffix}`;
  const address = `0x${suffix.padStart(40, "0").slice(-40)}`;

  await page.goto("/dapps");
  await page.getByTestId("toggle-dapp-form").click();
  await page.getByTestId("dapp-name-input").fill(name);
  await page.getByTestId("dapp-addresses-input").fill(address);
  await page.getByTestId("submit-dapp-form").click();

  await expect(page.getByText(`Now monitoring ${name}.`)).toBeVisible();
  await page.getByRole("link", { name }).click();

  const statusPanel = page.getByTestId("backfill-status-panel");
  await expect(statusPanel).toBeVisible();
  await expect(statusPanel).toContainText(
    /queued|scanning|syncing|completed/i,
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("archive-dapp-button").click();

  await expect
    .poll(async () => {
      const dappsResponse = await request.get(`${API_BASE_URL}/api/dapps`);
      const payload = (await dappsResponse.json()) as { data: DAppResponse[] };
      return payload.data.some((dapp) => dapp.name === name);
    })
    .toBe(false);

  await page.goto("/dapps");
  await expect(page.getByRole("link", { name })).toHaveCount(0);
});

test("global search opens explorer on an exact transaction match", async ({
  page,
}) => {
  await page.goto("/");

  const searchInput = page.getByTestId("global-search-input");
  await searchInput.fill(SEEDED_TX_HASH);
  await searchInput.press("Enter");

  await expect(page.getByTestId("global-search-result")).toBeVisible();
  await page.getByTestId("global-search-result").click();

  await expect(page).toHaveURL(
    new RegExp(`/explorer\\?search=${SEEDED_TX_HASH}$`),
  );
  await expect(page.getByText("Matched a single transaction")).toBeVisible();
  await expect(page.getByText(SEEDED_TX_HASH)).toBeVisible();
});

test("alerts can be created, toggled, and deleted", async ({
  page,
  request,
}) => {
  const threshold = TEST_ALERT_THRESHOLD_MIN + Number(Date.now() % 100_000);

  await page.goto("/alerts");
  await page.getByTestId("toggle-alert-form").click();
  await page.getByTestId("alert-metric-select").selectOption("gas_usage");
  await page.getByTestId("alert-condition-select").selectOption("above");
  await page.getByTestId("alert-threshold-input").fill(String(threshold));
  await page.getByTestId("alert-window-select").selectOption("5m");
  await page.getByTestId("submit-alert-form").click();

  await expect(page.getByText("Alert rule created.")).toBeVisible();

  const alertsResponse = await request.get(`${API_BASE_URL}/api/alerts`);
  const payload = (await alertsResponse.json()) as {
    data: AlertRuleResponse[];
  };
  const createdRule = payload.data.find(
    (rule) =>
      rule.metric === "gas_usage" &&
      Number.parseFloat(rule.threshold) === threshold,
  );

  expect(createdRule).toBeDefined();

  const row = page.getByTestId(`alert-rule-${createdRule!.id}`);
  await expect(row).toBeVisible();

  const toggleButton = page.getByTestId(`alert-toggle-${createdRule!.id}`);
  await toggleButton.click();
  await expect
    .poll(async () => {
      const response = await request.get(`${API_BASE_URL}/api/alerts`);
      const data = (await response.json()) as {
        data: AlertRuleResponse[];
      };
      return data.data.find((rule) => rule.id === createdRule!.id)?.enabled;
    })
    .toBe(false);
  await page.reload();
  await expect(row).toContainText("Paused");

  await page.getByTestId(`alert-toggle-${createdRule!.id}`).click();
  await expect
    .poll(async () => {
      const response = await request.get(`${API_BASE_URL}/api/alerts`);
      const data = (await response.json()) as {
        data: AlertRuleResponse[];
      };
      return data.data.find((rule) => rule.id === createdRule!.id)?.enabled;
    })
    .toBe(true);
  await page.reload();
  await expect(row).toContainText("Enabled");

  await page.getByTestId(`alert-delete-${createdRule!.id}`).click();
  await expect
    .poll(async () => {
      const response = await request.get(`${API_BASE_URL}/api/alerts`);
      const data = (await response.json()) as {
        data: AlertRuleResponse[];
      };
      return data.data.some((rule) => rule.id === createdRule!.id);
    })
    .toBe(false);
  await page.reload();
  await expect(page.getByTestId(`alert-rule-${createdRule!.id}`)).toHaveCount(0);
});
