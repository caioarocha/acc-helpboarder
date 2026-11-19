import 'dotenv/config';

const env = (name: string) => (process.env[name] ?? '').trim();
const list = (name: string, fallback: string[]) => {
  const v = env(name);
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
};

/** Aceita "minha-org" ou "https://dev.azure.com/minha-org" */
function normalizeOrg(value: string) {
  const m = /dev\.azure\.com\/([^/]+)/i.exec(value);
  return m ? m[1] : value.replace(/\/+$/, '');
}

export const config = {
  port: Number(env('API_PORT') || 3001),
  org: normalizeOrg(env('AZDO_ORG')),
  project: env('AZDO_PROJECT'),
  pat: env('AZDO_PAT'),
  areaPath: env('AZDO_AREA_PATH'),
  types: {
    story: env('AZDO_TYPE_STORY') || 'User Story',
    suite: env('AZDO_TYPE_SUITE') || 'Test Suite IPC',
    test: env('AZDO_TYPE_TEST') || 'Test Case',
    bug: env('AZDO_TYPE_BUG') || 'Bug',
  },
  executionModeField: env('AZDO_FIELD_EXECUTION_MODE'),
  bugClosedStates: list('AZDO_BUG_CLOSED_STATES', ['Closed', 'Done', 'Resolved', 'Removed', 'Rejected', 'Cancelled']).map((s) => s.toLowerCase()),
};

export const isMock = env('MOCK') === 'true' || !config.pat || !config.org || !config.project;
