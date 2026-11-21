import { assertLocalUrl } from './aiGuard'; // precisa vir antes do LangChain
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
assertLocalUrl(OLLAMA_BASE_URL);

export interface BugImage {
  name: string;
  dataUrl: string;
}

const SYSTEM_PROMPT = `Você é um analista de QA sênior que escreve bugs para o Azure DevOps de um projeto de financiamento de veículos.
Receberá uma explicação breve do problema e, às vezes, prints de evidência (telas, mensagens, DevTools/Network).
Escreva o bug em português do Brasil, com linguagem formal e objetiva, seguindo EXATAMENTE esta estrutura e estes títulos de seção (com os emojis):

🐞 Título do Bug
<uma linha: ação do usuário + o problema + contexto/etapa. Sem prefixos como [BUG]>
📝 Descrição do Problema
<parágrafos curtos: em que fluxo/etapa ocorre, o que acontece, mensagens exibidas entre aspas, impacto no fluxo e o que a evidência mostra (ex.: HTTP 500)>
🔁 Passos para Reprodução

1. <passo>
2. <passo>
...

❌ Resultado Atual
<o que acontece hoje, incluindo mensagens e códigos HTTP vistos nas evidências>
✅ Resultado Esperado
<frase introdutória>

* <comportamento esperado>
* <comportamento esperado>

📊 Massa de Dados
[CPF] - A preencher
[ID PROPOSTA] - A preencher
[CURL]
A preencher, caso necessário para análise técnica.
📷 Evidências

* <o que cada evidência anexada demonstra>

Regras:
- Use somente informações da explicação e das imagens deste bug. NÃO invente dados, IDs, CPFs, URLs, códigos HTTP, nomes de serviços ou causas.
- O exemplo serve APENAS como modelo de formato e tom. Nunca copie fatos, mensagens, telas ou códigos do exemplo.
- Só cite códigos HTTP, requisições ou DevTools se eles aparecerem na explicação ou nas imagens.
- Se não houver imagens, escreva em Evidências: "Nenhuma evidência anexada." (o usuário pode anexar depois).
- Se a explicação informar a causa (ex.: "causa: indisponibilidade do sistema X"), cite essa causa no título, na Descrição do Problema e no Resultado Atual, escrevendo "conforme informado". Se não informar, não especule e não diga que a causa é desconhecida.
- Use todos os detalhes da explicação (etapa, fluxo, botão, mensagem, causa, observações). Não resuma demais: a Descrição deve ter de 3 a 5 frases e o Resultado Esperado deve ter de 3 a 4 itens.
- Se houver alguma observação importante do usuário (ex.: "bug aberto apenas para rastreabilidade"), inclua no fim como "Observação: ...".
- Na Massa de Dados, se o usuário informar CPF, ID de proposta ou cURL, use os valores; senão mantenha "A preencher".
- Nunca copie tokens, senhas ou cabeçalhos de autorização que apareçam nos prints.
- Responda apenas com o bug, sem comentários antes ou depois e sem markdown (sem ###, sem **).`;

// Exemplo só de FORMATO, num cenário diferente de propósito, para o modelo não copiar fatos dele.
const EXAMPLE_INPUT =
  'Na simulação, depois de preencher valor de entrada e prazo, clico em Calcular e o botão fica carregando sem parar. Não aparece nenhuma mensagem.';

const EXAMPLE_OUTPUT = `🐞 Título do Bug
Calcular simulação mantém o botão em carregamento infinito sem retornar o resultado
📝 Descrição do Problema
Durante o fluxo de simulação, após o preenchimento do valor de entrada e do prazo, não é possível obter o resultado da simulação.
Ao clicar em "Calcular", o botão permanece em estado de carregamento indefinidamente e nenhuma mensagem é apresentada ao usuário.
A falha impede a visualização das condições da simulação e, consequentemente, bloqueia a continuidade do fluxo.
🔁 Passos para Reprodução

1. Acessar o fluxo de simulação.
2. Preencher o valor de entrada.
3. Preencher o prazo.
4. Clicar em "Calcular".
5. Observar o comportamento apresentado pelo sistema.

❌ Resultado Atual
O botão "Calcular" permanece em carregamento indefinidamente.
Nenhum resultado ou mensagem é apresentado ao usuário.
✅ Resultado Esperado
O comportamento esperado é que o sistema:

* Processe a simulação com os dados informados;
* Apresente o resultado da simulação após o cálculo;
* Exiba uma mensagem clara caso ocorra alguma falha no processamento.

📊 Massa de Dados
[CPF] - A preencher
[ID PROPOSTA] - A preencher
[CURL]
A preencher, caso necessário para análise técnica.
📷 Evidências

* Nenhuma evidência anexada.`;

/** Verifica se o Ollama está rodando e se o modelo já foi baixado */
export async function aiStatus() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    const data = (await res.json()) as { models?: { name: string }[] };
    const names = (data.models ?? []).map((m) => m.name);
    const installed = names.some((n) => n === OLLAMA_MODEL || n === `${OLLAMA_MODEL}:latest` || n.split(':')[0] === OLLAMA_MODEL);
    return { running: true, model: OLLAMA_MODEL, installed, models: names };
  } catch {
    return { running: false, model: OLLAMA_MODEL, installed: false, models: [] as string[] };
  }
}

/** Gera o bug em streaming (texto vai chegando aos poucos) */
export async function* generateBug(description: string, images: BugImage[], signal?: AbortSignal) {
  const model = new ChatOllama({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL, temperature: 0.2 });

  const userText =
    `Explicação do bug:\n${description.trim() || '(sem explicação, use apenas as evidências)'}\n\n` +
    (images.length
      ? `Foram anexadas ${images.length} evidência(s): ${images.map((i) => i.name).join(', ')}. Analise as imagens.`
      : 'Nenhuma imagem foi anexada.');

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(`Exemplo de explicação:\n${EXAMPLE_INPUT}`),
    new SystemMessage(`Exemplo de resposta no formato correto:\n${EXAMPLE_OUTPUT}`),
    new HumanMessage({
      content: [
        { type: 'text', text: userText },
        ...images.map((img) => ({ type: 'image_url' as const, image_url: img.dataUrl })),
      ],
    }),
  ];

  const stream = await model.stream(messages, { signal });
  for await (const chunk of stream) {
    const text = typeof chunk.content === 'string' ? chunk.content : '';
    if (text) yield text;
  }
}
