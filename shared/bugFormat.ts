// Estrutura do bug gerado pelo agente e conversão do texto para o HTML da Description do Azure DevOps.

export const BUG_SECTIONS = [
  '📝 Descrição do Problema',
  '🔁 Passos para Reprodução',
  '❌ Resultado Atual',
  '✅ Resultado Esperado',
  '📊 Massa de Dados',
  '📷 Evidências',
] as const;

const TITLE_HEADER = /^\s*(🐞\s*)?T[íi]tulo do Bug\s*:?\s*$/i;

/** Remove marcações comuns de markdown que modelos pequenos às vezes adicionam */
const clean = (line: string) =>
  line
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*```\w*\s*$/, '')
    .trimEnd();

/** Separa o título (linha depois de "🐞 Título do Bug") do restante do texto */
export function splitGenerated(text: string): { title: string; body: string } {
  const lines = text.replace(/\r/g, '').split('\n').map(clean);
  const idx = lines.findIndex((l) => TITLE_HEADER.test(l));
  let title = '';
  let rest = lines;
  if (idx >= 0) {
    const next = lines.slice(idx + 1).findIndex((l) => l.trim());
    if (next >= 0) {
      title = lines[idx + 1 + next].trim();
      rest = [...lines.slice(0, idx), ...lines.slice(idx + 2 + next)];
    }
  } else {
    // Sem cabeçalho: usa a primeira linha que não é uma seção
    const first = lines.findIndex((l) => l.trim() && !isSectionHeader(l));
    if (first >= 0 && first < lines.findIndex((l) => isSectionHeader(l))) {
      title = lines[first].replace(/^🐞\s*/, '').trim();
      rest = lines.filter((_, i) => i !== first);
    }
  }
  return { title, body: rest.join('\n').trim() };
}

export function isSectionHeader(line: string) {
  const l = line.trim().replace(/:$/, '');
  return BUG_SECTIONS.some((s) => l === s || l === s.replace(/^\S+\s/, ''));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Converte o texto do bug em HTML (padrão dos bugs do projeto: <div> por linha, seções em negrito,
 * listas numeradas e com marcadores). `images` entram no fim da seção de evidências.
 */
export function bugBodyToHtml(body: string, images: { url: string; name: string }[] = []): string {
  const out: string[] = [];
  let list: 'ol' | 'ul' | null = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const raw of body.replace(/\r/g, '').split('\n')) {
    const line = clean(raw);
    const t = line.trim();
    if (!t) {
      closeList();
      continue;
    }
    if (isSectionHeader(t)) {
      closeList();
      if (out.length) out.push('<div><br></div>');
      out.push(`<div><b>${esc(t.replace(/:$/, ''))}</b></div>`);
      continue;
    }
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(t);
    const ul = /^[*\-•]\s+(.*)$/.exec(t);
    if (ol || ul) {
      const kind = ol ? 'ol' : 'ul';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${esc((ol ? ol[2] : ul![1]).trim())}</li>`);
      continue;
    }
    closeList();
    out.push(`<div>${esc(t)}</div>`);
  }
  closeList();

  if (images.length) {
    out.push('<div><br></div>');
    for (const img of images) out.push(`<div><img src="${esc(img.url)}" alt="${esc(img.name)}"><br></div>`);
  }
  return out.join('');
}

/** Dígitos de um texto, para comparar CPF/ID com o que o usuário informou */
const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Proteção contra dado inventado: se o modelo escrever um CPF ou ID de proposta que não aparece
 * na explicação do usuário, a linha volta para "A preencher".
 */
export function sanitizeMassaDeDados(text: string, description: string) {
  const known = digits(description);
  return text.replace(/^(\s*\[(CPF|ID PROPOSTA)\]\s*-\s*)(.+)$/gim, (line, head: string, _k: string, value: string) => {
    const v = digits(value);
    if (!v || /a preencher/i.test(value)) return line;
    return known.includes(v) ? line : `${head}A preencher`;
  });
}

/** Ambientes aceitos no campo obrigatório "Stage Introduced" */
export const STAGES = ['PRO/TST', 'DSV', 'HML', 'HFX', 'PRE PRD', 'PRD', 'BLUE/GREEN'] as const;
export const SEVERITIES = ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'] as const;
export const DEFECT_TYPES = [
  '1- Not a Defect',
  '2- External Issue',
  '3- Authorization',
  '4- Parameters',
  '5- Back End',
  '6- Front End',
] as const;
export const STAGES_FOUND = [
  'System Integration Test',
  'Regression Test',
  'GMUD',
  'Performance Test',
  'Unit Test',
  'Data Migration',
] as const;

/** Origem do bug no prefixo do título */
export const ORIGINS = ['INTERNO', 'EXTERNO'] as const;

/** Prefixo do título no padrão do projeto: [BUG-INTERNO-PRO][CORBAN] ou [BUG-EXTERNO-HML] */
export function titlePrefix(stage: string, channel: string, origin = 'INTERNO') {
  const env = stage.split('/')[0].replace(/\s+/g, '');
  const kind = ORIGINS.includes(origin as (typeof ORIGINS)[number]) ? origin : 'INTERNO';
  return `[BUG-${kind}-${env}]${channel ? `[${channel}]` : ''}`;
}
