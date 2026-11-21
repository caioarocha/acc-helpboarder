# Cockpit — QA Analytics

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

## Uso diário

Clique duas vezes em **`Iniciar Cockpit.bat`** (também há atalhos na Área de Trabalho e no Menu Iniciar > Cockpit).
Ele sobe o servidor em segundo plano e abre **http://localhost:4300** no navegador (só a sua máquina acessa).
Se o Cockpit já estiver rodando, apenas abre a página.

- **Reiniciar** (depois de trocar o `.env` ou quando houver atualização): Menu Iniciar > Cockpit > *Reiniciar Cockpit* (`scripts/cockpit-restart.cmd`)
- **Parar:** Menu Iniciar > Cockpit > *Parar Cockpit* (`scripts/cockpit-stop.cmd`)
- **Log:** `data/cockpit.log`

Arquivos: `scripts/cockpit-start.cmd` (compila a tela e sobe o servidor), `scripts/cockpit-hidden.vbs` (roda sem janela).

## Bloqueio com digital (Windows Hello)

O Cockpit só abre depois da verificação com o Windows Hello (WebAuthn). A digital não sai do computador:
o Windows confirma a identidade e o servidor valida a assinatura com a chave pública salva em `data/auth.json`.

- **Primeiro acesso:** botão *Cadastrar minha digital*
- **Liberado por 8 horas** (ou até reiniciar o Cockpit / clicar em *Bloquear* na barra lateral)
- Sem sessão desbloqueada, toda a API responde `401` (ninguém usa o seu token sem a digital)
- O Windows pode oferecer rosto ou PIN além da digital (é como o Windows Hello funciona)
- **Perdeu o acesso?** Apague `data/auth.json` e cadastre de novo

## Desenvolvimento

```powershell
npm install
copy .env.example .env   # preencha AZDO_ORG, AZDO_PROJECT e AZDO_PAT
npm run dev
```

Abra http://localhost:5173 (modo desenvolvimento, pode rodar junto com o da porta 4300). Sem PAT no `.env`, o app roda em **modo demonstração** com dados fictícios.

O PAT precisa do escopo **Work Items: Read & Write** (escrita só para criar bugs). Ele fica no `.env`, só o backend lê, e nunca vai para o navegador.

Se estiver atrás de um proxy corporativo, defina `HTTPS_PROXY` e `NODE_USE_ENV_PROXY=1` antes do `npm run dev`.

## Estrutura

- `server/`: API Express (`azure.ts` chama o Azure DevOps, `mock.ts` gera os dados de demonstração)
- `shared/`: tipos e cálculo de métricas usados pelo backend e pelo frontend
- `src/`: frontend React (`pages/Dashboard.tsx`, `pages/UserStories.tsx`, `components/`)
