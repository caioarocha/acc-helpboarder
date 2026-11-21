// Importado ANTES do LangChain: garante que nenhum dado saia da máquina por telemetria.
// O LangSmith (tracing do LangChain) enviaria prompts e prints para a nuvem se estivesse ligado.
for (const key of ['LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGSMITH_TRACING', 'LANGSMITH_TRACING_V2']) {
  process.env[key] = 'false';
}
for (const key of ['LANGCHAIN_API_KEY', 'LANGSMITH_API_KEY', 'LANGCHAIN_ENDPOINT', 'LANGSMITH_ENDPOINT']) {
  delete process.env[key];
}

/** Só aceita o Ollama rodando na própria máquina, para o modelo nunca ser um serviço externo. */
export function assertLocalUrl(url: string) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(`OLLAMA_BASE_URL precisa apontar para a sua máquina (localhost). Valor atual: ${url}`);
  }
}
