import type { Channel, RegEnv, RegGroupKey } from '../shared/types';

/** Meta de aprovação do regressivo (Passed / total). Pode ser trocada por REG_GOAL no .env (ex.: 0.85). */
export const REG_GOAL = Number(process.env.REG_GOAL) > 0 ? Number(process.env.REG_GOAL) : 0.85;

export const GROUP_LABEL: Record<RegGroupKey, string> = {
  corban: 'CORBAN',
  agencias: 'Agências',
  consolidado: 'Consolidado',
  manualCorban: 'Manual · CORBAN',
  manualAgencias: 'Manual · Agências',
};

/**
 * IDs das queries salvas no Azure DevOps (Shared Queries).
 * Para trocar uma query, abra-a no Azure DevOps e copie o GUID da URL (.../_queries/query/<ID>/).
 */
export const REG_QUERIES: Record<RegEnv, Record<RegGroupKey, string>> = {
  HML: {
    corban: '42f04055-2ae1-49b4-83e9-3fde75267aa0', // Regressão HML - CBN
    agencias: '50ee553b-8c7d-47e5-9359-77cfe4ef06be', // _AGN - Agências/Regressão HML - AGN
    consolidado: 'e98e54f9-858a-482e-9d4b-659858bad80e', // Regressivo HML - Consolidado
    manualCorban: '69453c25-f7cf-4b09-a8e6-ae6aa8f920e5', // Regression Tests/Testes Regressivos Manuais - CBN - HML
    manualAgencias: '977e2fdc-a898-4162-9044-4014af5e3058', // Regression Tests/Testes Regressivos Manuais - AGN - HML
  },
  HFX: {
    corban: 'fd7edf13-8dd8-4469-ab2c-f52b310de19a', // _CBN - Corban/Regressão HFX - Corban
    agencias: '7ebae902-8b92-4658-85b2-4b621a977b96', // _AGN - Agências/Regressão HFX - AGN
    consolidado: '64aab3e4-839e-44eb-bba4-2f9ba03b887f', // Regressivo Consolidado - HFX
    manualCorban: '8b342877-82e2-41aa-90e1-38d14a704151', // Testes Regressivos Manuais - CBN - HFX
    manualAgencias: '0e4253b2-e740-497f-a0ea-4af8fb004885', // Testes Regressivos Manuais - AGN - HFX
  },
};

/**
 * Queries da esteira usadas pela pipeline da GMUD (Quality Gate).
 * A pipeline soma Tests Passed / Tests Failed dessas suites para conferir a meta.
 */
export const REG_QG_QUERIES: Record<RegEnv, string> = {
  HML: '9372f7af-fee0-4876-86e7-44bbd17a0eef', // Shared Queries/QA/Query Esteira - HML
  HFX: '391ce58a-c183-4bc0-9514-0af786c4975c', // Shared Queries/QA/Query Esteira - HFX
};

/** Queries das Suites de regressão (Test Suite iPC com os jobs de execução) */
export const REG_SUITE_QUERIES: { env: RegEnv; channel: Channel; id: string }[] = [
  { env: 'HML', channel: 'CORBAN', id: 'fdd06fcf-2d99-450e-be8c-fdd097a96ad9' }, // Suites Regressivo HML - CORBAN (atualizado)
  { env: 'HFX', channel: 'CORBAN', id: '3ac90b79-4245-4bc2-b519-2a59cc4abff2' }, // Suites Regressivo HFX - CORBAN (atualizado)
  { env: 'HML', channel: 'Agencias', id: 'c6675f5d-33f7-4e51-9f24-b017ea589289' }, // Suites Regressão HML - AGN
];
