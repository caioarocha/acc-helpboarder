import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config, isMock } from './config';
import { HttpError, checkConnection, getIterations, loadStories, storyIdsInIteration } from './azure';
import { mockAutomation, mockIterations, mockLoadStories, mockRegression, mockStoryIdsForIteration } from './mock';
import { loadRegression } from './regression';
import { aiStatus, generateBug, type BugImage } from './bugAgent';
import { basicWorkItems, createBug, listAreas } from './bugs';
import { deleteTemplate, listTemplates, upsertTemplate } from './bugTemplates';
import { readPrefs, savePrefs } from './prefs';
import { authStatus, loginOptions, loginVerify, logout, registerOptions, registerVerify, requireSession } from './auth';
import { loadAutomation } from './automation';
import { computeMetrics, uniqueById } from '../shared/metrics';
import type { ConnectionStatus, StoriesResponse, StorySummary } from '../shared/types';

const app = express();
// Prints de evidência chegam em base64 no corpo da requisição
app.use(express.json({ limit: '40mb' }));

// ---------- Bloqueio com digital (Windows Hello) ----------
// Estas rotas ficam livres; todo o resto de /api exige sessão desbloqueada.
app.get('/api/auth/status', async (req, res) => {
  res.json(await authStatus(req));
});
app.post('/api/auth/register/options', async (req, res) => {
  res.json(await registerOptions(req));
});
app.post('/api/auth/register/verify', async (req, res) => {
  res.json(await registerVerify(req, res));
});
app.post('/api/auth/login/options', async (_req, res) => {
  res.json(await loginOptions());
});
app.post('/api/auth/login/verify', async (req, res) => {
  res.json(await loginVerify(req, res));
});
app.post('/api/auth/logout', (req, res) => {
  res.json(logout(req, res));
});
app.use(requireSession);

function buildResponse(data: { stories: StorySummary[]; notFound: number[]; warnings: string[] }): StoriesResponse {
  const tests = uniqueById(data.stories.flatMap((s) => s.testCases));
  const bugs = uniqueById(data.stories.flatMap((s) => s.bugs));
  return {
    source: isMock ? 'mock' : 'azure',
    syncedAt: new Date().toISOString(),
    stories: data.stories,
    totals: { ...computeMetrics(tests, bugs), stories: data.stories.length },
    notFound: data.notFound,
    warnings: data.warnings,
  };
}

const getStories = (ids: number[]) => (isMock ? Promise.resolve(mockLoadStories(ids)) : loadStories(ids));

app.get('/api/status', async (_req, res) => {
  const base: ConnectionStatus = {
    mode: isMock ? 'mock' : 'azure',
    connected: false,
    organization: config.org || null,
    project: config.project || null,
    error: null,
  };
  if (isMock) return res.json(base);
  try {
    await checkConnection();
    res.json({ ...base, connected: true });
  } catch (e) {
    res.json({ ...base, error: (e as Error).message });
  }
});

app.get('/api/iterations', async (_req, res) => {
  res.json(isMock ? mockIterations() : await getIterations());
});

app.get('/api/stories', async (req, res) => {
  const ids = [
    ...new Set(
      String(req.query.ids ?? '')
        .split(/[\s,;]+/)
        .map((s) => Number(s.replace('#', '')))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (!ids.length) throw new HttpError('Informe ao menos um ID de User Story.', 400);
  if (ids.length > 200) throw new HttpError('Máximo de 200 User Stories por consulta.', 400);
  res.json(buildResponse(await getStories(ids)));
});

app.get('/api/dashboard', async (req, res) => {
  const iteration = String(req.query.iteration ?? '').trim();
  if (!iteration) throw new HttpError('Informe a sprint (iteration).', 400);
  const ids = isMock ? mockStoryIdsForIteration(iteration) : await storyIdsInIteration(iteration);
  res.json(buildResponse(ids.length ? await getStories(ids) : { stories: [], notFound: [], warnings: [] }));
});

app.get('/api/automation', async (_req, res) => {
  res.json(isMock ? mockAutomation() : await loadAutomation());
});

// ---------- Bugs (agente local) ----------

app.get('/api/bugs/meta', async (_req, res) => {
  const [ai, areas, iterations] = await Promise.all([
    aiStatus(),
    isMock ? Promise.resolve(['Projeto Demo', 'Projeto Demo\\Formalizacao', 'Projeto Demo\\Pagamentos']) : listAreas(),
    isMock ? Promise.resolve(mockIterations()) : getIterations(),
  ]);
  res.json({ ai, areas, iterations: iterations.map((i) => ({ path: i.path, isCurrent: i.isCurrent })), mock: isMock });
});

// ---------- Preferências salvas (sobrevivem a reinícios) ----------

app.get('/api/prefs', async (_req, res) => {
  res.json(await readPrefs());
});

app.put('/api/prefs', async (req, res) => {
  const raw: unknown[] = Array.isArray(req.body?.usIds) ? req.body.usIds : [];
  const usIds = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  res.json(await savePrefs({ usIds }));
});

app.get('/api/workitems/basic', async (req, res) => {
  const ids = [
    ...new Set(
      String(req.query.ids ?? '')
        .split(/[\s,;]+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (isMock) {
    return res.json(
      mockLoadStories(ids).stories.map((s) => ({
        id: s.id,
        title: s.title,
        type: 'User Story',
        areaPath: 'Projeto Demo\\Formalizacao',
        iterationPath: s.iterationPath,
      })),
    );
  }
  res.json(await basicWorkItems(ids));
});

app.get('/api/bugs/templates', async (_req, res) => {
  res.json(await listTemplates());
});

app.post('/api/bugs/templates', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) throw new HttpError('Dê um nome ao modelo.', 400);
  res.json(await upsertTemplate(name, req.body?.fields ?? {}));
});

app.delete('/api/bugs/templates/:id', async (req, res) => {
  await deleteTemplate(String(req.params.id));
  res.json({ ok: true });
});

app.post('/api/bugs/generate', async (req, res) => {
  const description = String(req.body?.description ?? '');
  const images: BugImage[] = Array.isArray(req.body?.images) ? req.body.images.slice(0, 6) : [];
  if (!description.trim() && !images.length) throw new HttpError('Descreva o bug ou anexe uma evidência.', 400);

  const status = await aiStatus();
  if (!status.running) throw new HttpError('O Ollama não está rodando. Abra o Ollama e tente de novo.', 503);
  if (!status.installed) throw new HttpError(`O modelo ${status.model} não foi baixado. Rode: ollama pull ${status.model}`, 503);

  const abort = new AbortController();
  res.on('close', () => abort.abort());
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  try {
    for await (const chunk of generateBug(description, images, abort.signal)) res.write(chunk);
  } catch (e) {
    if (!abort.signal.aborted) res.write(`\n\n[ERRO] ${(e as Error).message}`);
  }
  res.end();
});

app.post('/api/bugs/create', async (req, res) => {
  const b = req.body ?? {};
  const toIds = (v: unknown) =>
    String(v ?? '')
      .split(/[\s,;]+/)
      .map((s) => Number(s.replace('#', '')))
      .filter((n) => Number.isInteger(n) && n > 0);
  const input = {
    title: String(b.title ?? ''),
    body: String(b.body ?? ''),
    severity: String(b.severity ?? ''),
    stageIntroduced: String(b.stageIntroduced ?? ''),
    channel: String(b.channel ?? ''),
    origin: String(b.origin ?? 'INTERNO'),
    areaPath: String(b.areaPath ?? ''),
    iterationPath: String(b.iterationPath ?? ''),
    tags: String(b.tags ?? '').split(/[;,]/),
    stageFound: b.stageFound ? String(b.stageFound) : undefined,
    defectType: b.defectType ? String(b.defectType) : undefined,
    relatedIds: toIds(b.relatedIds),
    parentId: toIds(b.parentId)[0] ?? null,
    images: Array.isArray(b.images) ? (b.images as BugImage[]).slice(0, 10) : [],
    validateOnly: !!b.validateOnly,
  };
  if (isMock) {
    return res.json({ validateOnly: input.validateOnly, id: input.validateOnly ? null : 99999, title: input.title, url: null, attachments: input.images.length });
  }
  res.json(await createBug(input));
});

app.get('/api/regression', async (_req, res) => {
  res.json(isMock ? mockRegression() : await loadRegression());
});

// ---------- Modo "app" (inicia com o Windows): o mesmo servidor entrega a tela compilada ----------
const serveWeb = process.env.SERVE_WEB === 'true';
const distDir = resolve(process.cwd(), 'dist');
if (serveWeb) {
  if (!existsSync(join(distDir, 'index.html'))) {
    console.error('Pasta dist não encontrada. Rode "npm run build" antes de "npm start".');
  }
  app.use(express.static(distDir));
  // Rotas da tela (ex.: /regressao) devolvem o index.html; /api continua sendo a API
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Erro inesperado';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

const onListen = () => {
  console.log(
    `${serveWeb ? 'Cockpit' : 'API'} em http://localhost:${config.port} — ${
      isMock ? 'MODO DEMONSTRAÇÃO (sem PAT no .env)' : `Azure DevOps: ${config.org}/${config.project}`
    }`,
  );
};
// No modo app, só a própria máquina acessa (127.0.0.1)
if (serveWeb) app.listen(config.port, '127.0.0.1', onListen);
else app.listen(config.port, onListen);
