# Accenture HelpBoarder — QA Analytics

Dashboard de acompanhamento de testes a partir dos Work Items do Azure DevOps (sem Test Plans).

## Como os dados são lidos

```
User Story ──(filho)──> Test Suite IPC ──(filho)──> Test Case ──(Related)──> Bug
```

- **Resultado do teste:** campo `State` do Test Case (Ready, In Progress, Passed, Failed, Blocked, Cancelled)
- **Automação:** campo `Execution Mode` (Automatic / Manual)
- **Aprovação:** Passed ÷ Test Cases (Cancelled ficam fora da conta)
- **Execução:** (Passed + Failed + Blocked) ÷ Test Cases
- **Saúde da US:** regras em `shared/metrics.ts` (`HEALTH_RULES`)

## Rodar

```powershell
npm install
copy .env.example .env   # preencha AZDO_ORG, AZDO_PROJECT e AZDO_PAT
npm run dev
```

Abra http://localhost:5173. Sem PAT no `.env`, o app roda em **modo demonstração** com dados fictícios.

O PAT precisa só do escopo **Work Items: Read**. Ele fica no `.env`, só o backend lê, e nunca vai para o navegador.

Se estiver atrás de um proxy corporativo, defina `HTTPS_PROXY` e `NODE_USE_ENV_PROXY=1` antes do `npm run dev`.

## Estrutura

- `server/`: API Express (`azure.ts` chama o Azure DevOps, `mock.ts` gera os dados de demonstração)
- `shared/`: tipos e cálculo de métricas usados pelo backend e pelo frontend
- `src/`: frontend React (`pages/Dashboard.tsx`, `pages/UserStories.tsx`, `components/`)
