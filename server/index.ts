import express, { type NextFunction, type Request, type Response } from 'express';
import { config, isMock } from './config';
import { HttpError, checkConnection, getIterations, loadStories, storyIdsInIteration } from './azure';
import { mockIterations, mockLoadStories, mockStoryIdsForIteration } from './mock';
import { computeMetrics, uniqueById } from '../shared/metrics';
import type { ConnectionStatus, StoriesResponse, StorySummary } from '../shared/types';

const app = express();

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

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Erro inesperado';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(
    `API em http://localhost:${config.port} — ${
      isMock ? 'MODO DEMONSTRAÇÃO (sem PAT no .env)' : `Azure DevOps: ${config.org}/${config.project}`
    }`,
  );
});
