import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import {
  Bug,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  Eye,
  ImagePlus,
  Layers,
  Loader2,
  Lock,
  PencilLine,
  RotateCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { ConnectionStatus } from '../../shared/types';
import {
  DEFECT_TYPES,
  ORIGINS,
  SEVERITIES,
  STAGES,
  STAGES_FOUND,
  bugBodyToHtml,
  sanitizeMassaDeDados,
  splitGenerated,
  titlePrefix,
} from '../../shared/bugFormat';
import { api, useAsync, type BugTemplate, type CreatedBug } from '../api';
import { PageHeader } from '../components/PageHeader';
import { useSavedUsIds } from '../usIds';
import { Card, ErrorBox } from '../components/ui';

interface Evidence {
  name: string;
  dataUrl: string;
  size: number;
}

interface Fields {
  origin: string;
  stageIntroduced: string;
  channel: string;
  severity: string;
  areaPath: string;
  iterationPath: string;
  tags: string;
  stageFound: string;
  defectType: string;
  relatedIds: string;
  parentId: string;
  /** Origem do vínculo: '' | 'reg:HML' | 'reg:HFX' | 'us:<id>' | 'custom' */
  usRef: string;
}

const FIELDS_KEY = 'cockpit.bug-fields';

/** Modelos que já vêm prontos */
const BUILTIN_TEMPLATES: BugTemplate[] = (['HML', 'HFX'] as const).map((env) => ({
  id: `builtin-reg-${env}`,
  name: `Regressão ${env}`,
  updatedAt: '',
  fields: { usRef: `reg:${env}`, parentId: '', stageIntroduced: env, stageFound: 'Regression Test', tags: 'Regressão' },
}));

/** Acrescenta uma tag sem duplicar */
const addTag = (tags: string, tag: string) => {
  const list = tags.split(';').map((t) => t.trim()).filter(Boolean);
  return list.some((t) => t.toLowerCase() === tag.toLowerCase()) ? list.join('; ') : [...list, tag].join('; ');
};

/** Ao sair de "Regressão" para uma US, desfaz o que a regressão tinha preenchido */
const leaveRegression = (f: { usRef: string; stageFound: string; tags: string }) =>
  f.usRef.startsWith('reg:')
    ? {
        stageFound: f.stageFound === 'Regression Test' ? 'System Integration Test' : f.stageFound,
        tags: f.tags
          .split(';')
          .map((t) => t.trim())
          .filter((t) => t && t.toLowerCase() !== 'regressão')
          .join('; '),
      }
    : {};

const EMPTY: Fields = {
  origin: 'INTERNO',
  stageIntroduced: 'PRO/TST',
  channel: '',
  severity: '',
  areaPath: '',
  iterationPath: '',
  tags: '',
  stageFound: 'System Integration Test',
  defectType: '',
  relatedIds: '',
  parentId: '',
  usRef: '',
};
const MAX_IMAGE_MB = 8;

function readFields(): Fields {
  try {
    const saved = JSON.parse(localStorage.getItem(FIELDS_KEY) ?? '{}');
    // Test Cases relacionados não são lembrados (mudam a cada bug)
    return { ...EMPTY, ...saved, relatedIds: '' };
  } catch {
    return EMPTY;
  }
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export function BugsPage({ status }: { status: ConnectionStatus | null }) {
  const meta = useAsync(() => api.bugsMeta(), 'bugs-meta');
  const ai = meta.data?.ai;
  const aiReady = !!ai?.running && !!ai?.installed;

  const [mode, setMode] = useState<'ai' | 'paste'>('ai');
  const [description, setDescription] = useState('');
  const [pasted, setPasted] = useState('');
  const [images, setImages] = useState<Evidence[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const abortRef = useRef<AbortController | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [fields, setFieldsState] = useState<Fields>(readFields);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState<'create' | 'validate' | null>(null);
  const [result, setResult] = useState<CreatedBug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const patchFields = (patch: Partial<Fields> | ((f: Fields) => Partial<Fields>)) => {
    setFieldsState((f) => {
      const next = { ...f, ...(typeof patch === 'function' ? patch(f) : patch) };
      try {
        localStorage.setItem(FIELDS_KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
    setConfirming(false);
  };
  const setField = <K extends keyof Fields>(k: K, v: Fields[K]) => patchFields({ [k]: v } as Partial<Fields>);

  // US informadas na aba User Stories (com título, Area e Iteration)
  const { ids: usIds } = useSavedUsIds();
  const usList = useAsync(() => (usIds.length ? api.workItemsBasic(usIds) : null), `us-basic-${usIds.join(',')}`);

  // Modelos
  const templates = useAsync(() => api.bugTemplates(), 'bug-templates');
  const allTemplates = [...BUILTIN_TEMPLATES, ...(templates.data ?? [])];
  const [templateId, setTemplateId] = useState('');
  const [savingName, setSavingName] = useState<string | null>(null);
  const [templateMsg, setTemplateMsg] = useState<string | null>(null);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = allTemplates.find((x) => x.id === id);
    if (!t) return;
    patchFields(t.fields as Partial<Fields>);
    setTemplateMsg(`Modelo "${t.name}" aplicado.`);
  };

  const suggestName = () => {
    if (fields.usRef.startsWith('us:')) {
      const us = usList.data?.find((u) => `us:${u.id}` === fields.usRef);
      return us ? `US #${us.id} - ${us.title}`.slice(0, 80) : `US #${fields.parentId}`;
    }
    if (fields.usRef.startsWith('reg:')) return `Regressão ${fields.usRef.slice(4)} - ${fields.channel || 'geral'}`;
    return '';
  };

  const saveTemplate = async () => {
    if (!savingName?.trim()) return;
    try {
      const { relatedIds: _skip, ...rest } = fields;
      const t = await api.saveBugTemplate(savingName.trim(), rest as unknown as Record<string, string>);
      templates.reload();
      setTemplateId(t.id);
      setSavingName(null);
      setTemplateMsg(`Modelo "${t.name}" salvo.`);
    } catch (e) {
      setTemplateMsg((e as Error).message);
    }
  };

  const removeTemplate = async () => {
    const t = templates.data?.find((x) => x.id === templateId);
    if (!t) return;
    await api.deleteBugTemplate(t.id);
    templates.reload();
    setTemplateId('');
    setTemplateMsg(`Modelo "${t.name}" excluído.`);
  };

  /** Escolha no campo "User Story (pai)" */
  const chooseUs = (value: string) => {
    if (value.startsWith('reg:')) {
      const env = value.slice(4);
      patchFields((f) => ({
        usRef: value,
        parentId: '',
        stageIntroduced: env,
        stageFound: 'Regression Test',
        tags: addTag(f.tags, 'Regressão'),
      }));
    } else if (value.startsWith('us:')) {
      const id = value.slice(3);
      const us = usList.data?.find((u) => String(u.id) === id);
      patchFields((f) => ({
        ...leaveRegression(f),
        usRef: value,
        parentId: id,
        areaPath: us?.areaPath || f.areaPath,
        iterationPath: us?.iterationPath || f.iterationPath,
      }));
    } else {
      patchFields((f) => ({ ...leaveRegression(f), usRef: value, parentId: value === 'custom' ? f.parentId : '' }));
    }
  };

  // Sprint atual como padrão quando ainda não há uma escolhida
  useEffect(() => {
    if (!fields.iterationPath && meta.data?.iterations.length) {
      const cur = meta.data.iterations.find((i) => i.isCurrent);
      if (cur) setField('iterationPath', cur.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.data]);

  // Cronômetro enquanto o modelo gera
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    const big = list.filter((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    if (big.length) setError(`Imagem acima de ${MAX_IMAGE_MB} MB ignorada: ${big.map((f) => f.name).join(', ')}`);
    const ok = list.filter((f) => f.size <= MAX_IMAGE_MB * 1024 * 1024);
    const loaded = await Promise.all(
      ok.map(async (f, i) => ({
        name: f.name && f.name !== 'image.png' ? f.name : `evidencia-${Date.now()}-${i + 1}.png`,
        dataUrl: await fileToDataUrl(f),
        size: f.size,
      })),
    );
    setImages((prev) => [...prev, ...loaded].slice(0, 6));
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void addFiles(e.dataTransfer.files);
  };

  const generate = async () => {
    setError(null);
    setResult(null);
    setConfirming(false);
    setTitle('');
    setBody('');
    setView('edit');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGenerating(true);
    setStartedAt(Date.now());
    setElapsed(0);
    try {
      await api.generateBug(
        { description, images: images.map(({ name, dataUrl }) => ({ name, dataUrl })) },
        (full) => {
          const parts = splitGenerated(sanitizeMassaDeDados(full, description));
          setTitle(parts.title);
          setBody(parts.body);
        },
        ctrl.signal,
      );
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setGenerating(false);
      setStartedAt(null);
      abortRef.current = null;
    }
  };

  const usePasted = () => {
    const parts = splitGenerated(pasted);
    setTitle(parts.title);
    setBody(parts.body);
    setResult(null);
    setError(null);
    setView('edit');
  };

  const submit = async (validateOnly: boolean) => {
    setError(null);
    setSending(validateOnly ? 'validate' : 'create');
    try {
      const r = await api.createBug({
        ...fields,
        title,
        body,
        validateOnly,
        images: images.map(({ name, dataUrl }) => ({ name, dataUrl })),
      });
      setResult(r);
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(null);
    }
  };

  const resetAll = () => {
    setDescription('');
    setPasted('');
    setImages([]);
    setTitle('');
    setBody('');
    setResult(null);
    setError(null);
    setConfirming(false);
    // Mantém a US/Regressão escolhida (normalmente o próximo bug é do mesmo contexto)
    setFieldsState((f) => ({ ...f, relatedIds: '' }));
  };

  const prefix = titlePrefix(fields.stageIntroduced || 'PRO', fields.channel, fields.origin);
  const missing = [
    !title.trim() && 'Título',
    !body.trim() && 'Conteúdo do bug',
    !fields.severity && 'Severidade',
    !fields.stageIntroduced && 'Ambiente',
    !fields.areaPath && 'Area Path',
    !fields.iterationPath && 'Iteration',
  ].filter(Boolean) as string[];
  const previewHtml = useMemo(
    () => bugBodyToHtml(body, images.map((i) => ({ url: i.dataUrl, name: i.name }))),
    [body, images],
  );
  const hasDraft = !!(title || body);

  return (
    <>
      <PageHeader title="Bugs" subtitle="Descreva o problema, revise o bug gerado e confirme a criação no Azure DevOps" status={status} />

      <div className="card filter-bar ai-bar">
        <span className="ai-privacy">
          <Lock size={14} /> IA local via Ollama: nada sai da sua máquina
        </span>
        {meta.loading && !ai ? (
          <span className="muted small">Verificando IA…</span>
        ) : aiReady ? (
          <span className="badge tone-ok">
            <CheckCircle2 size={13} /> {ai!.model} pronto
          </span>
        ) : ai?.running ? (
          <span className="badge tone-warn" title={`Rode no terminal: ollama pull ${ai.model}`}>
            Modelo não baixado · ollama pull {ai.model}
          </span>
        ) : (
          <span className="badge tone-bad" title="Instale e abra o Ollama (ollama.com)">
            Ollama não está rodando
          </span>
        )}
        <button className="btn icon push-right" onClick={meta.reload} title="Verificar de novo">
          <RotateCw size={16} className={meta.loading ? 'spin' : ''} />
        </button>
      </div>

      {meta.error && <ErrorBox message={meta.error} onRetry={meta.reload} />}

      {result && !result.validateOnly ? (
        <div className="card bug-success">
          <CheckCircle2 size={36} />
          <h3>Bug criado no Azure DevOps</h3>
          <p>
            {result.url ? (
              <a href={result.url} target="_blank" rel="noreferrer">
                #{result.id} <ExternalLink size={13} />
              </a>
            ) : (
              <b>#{result.id}</b>
            )}{' '}
            · {result.title}
          </p>
          <p className="muted small">{result.attachments} evidência(s) anexada(s)</p>
          <button className="btn primary" onClick={resetAll}>
            <Bug size={16} /> Criar outro bug
          </button>
        </div>
      ) : (
        <div className="page-grid">
          <div className="stack">
            <Card
              title="1. Descreva o bug"
              extra={
                <div className="segmented small-seg">
                  <button type="button" className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}>
                    <Sparkles size={13} /> Gerar com IA
                  </button>
                  <button type="button" className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}>
                    <ClipboardPaste size={13} /> Colar texto pronto
                  </button>
                </div>
              }
            >
              {mode === 'ai' ? (
                <textarea
                  className="bug-textarea"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onPaste={onPaste}
                  placeholder="Explique brevemente o bug: onde aconteceu, o que você fez, a mensagem exibida, a causa (se souber) e qualquer observação. Você pode colar prints aqui com Ctrl+V."
                />
              ) : (
                <textarea
                  className="bug-textarea mono"
                  rows={8}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  onPaste={onPaste}
                  placeholder={'Cole aqui o bug gerado pelo agente do Copilot (com 🐞 Título do Bug, 📝 Descrição do Problema, …)'}
                />
              )}

              <div
                className={`dropzone ${dragOver ? 'over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInput.current?.click()}
                role="button"
                tabIndex={0}
              >
                <ImagePlus size={20} />
                <span>
                  <b>Evidências:</b> arraste os prints, clique para escolher ou cole com Ctrl+V (até 6)
                </span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {images.length > 0 && (
                <div className="thumbs">
                  {images.map((img, i) => (
                    <figure key={i}>
                      <img src={img.dataUrl} alt={img.name} />
                      <figcaption title={img.name}>{img.name}</figcaption>
                      <button type="button" onClick={() => setImages((p) => p.filter((_, j) => j !== i))} aria-label="Remover">
                        <X size={13} />
                      </button>
                    </figure>
                  ))}
                </div>
              )}

              <div className="bug-actions">
                {mode === 'ai' ? (
                  generating ? (
                    <button className="btn" onClick={() => abortRef.current?.abort()}>
                      <Square size={14} /> Parar ({elapsed}s)
                    </button>
                  ) : (
                    <button
                      className="btn primary"
                      onClick={generate}
                      disabled={!aiReady || (!description.trim() && !images.length)}
                      title={!aiReady ? 'O Ollama com o modelo precisa estar rodando' : undefined}
                    >
                      <Sparkles size={16} /> {hasDraft ? 'Gerar de novo' : 'Gerar bug'}
                    </button>
                  )
                ) : (
                  <button className="btn primary" onClick={usePasted} disabled={!pasted.trim()}>
                    <ClipboardPaste size={16} /> Usar este texto
                  </button>
                )}
                {generating && (
                  <span className="muted small">
                    <Loader2 size={13} className="spin" /> Gerando localmente… na CPU pode levar 1 a 3 minutos
                  </span>
                )}
                {!generating && mode === 'ai' && !aiReady && (
                  <span className="muted small">Enquanto o Ollama não está pronto, use "Colar texto pronto".</span>
                )}
              </div>
            </Card>

            <Card
              title="2. Revise o bug"
              extra={
                hasDraft && (
                  <div className="segmented small-seg">
                    <button type="button" className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>
                      <PencilLine size={13} /> Editar
                    </button>
                    <button type="button" className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>
                      <Eye size={13} /> Como vai ficar
                    </button>
                  </div>
                )
              }
            >
              {!hasDraft && !generating ? (
                <p className="muted bug-empty">O bug gerado aparece aqui para você revisar e ajustar antes de criar.</p>
              ) : (
                <>
                  <label className="field-label">Título</label>
                  <div className="title-row">
                    <span className="title-prefix">{prefix}</span>
                    <input
                      className="bug-input"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setConfirming(false);
                      }}
                      placeholder="Título do bug"
                    />
                  </div>
                  {view === 'edit' ? (
                    <textarea
                      className="bug-textarea body"
                      rows={22}
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                        setConfirming(false);
                      }}
                      readOnly={generating}
                    />
                  ) : (
                    <div className="bug-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="stack">
            <Card title="3. Campos do Azure DevOps">
              <div className="template-box">
                <div className="template-row">
                  <Layers size={15} />
                  <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} aria-label="Modelo">
                    <option value="">Aplicar um modelo…</option>
                    <optgroup label="Prontos">
                      {BUILTIN_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                    {!!templates.data?.length && (
                      <optgroup label="Meus modelos">
                        {templates.data.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {templates.data?.some((t) => t.id === templateId) && (
                    <button type="button" className="btn icon" onClick={removeTemplate} title="Excluir este modelo">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {savingName === null ? (
                  <button type="button" className="btn small ghost" onClick={() => setSavingName(suggestName())}>
                    <Save size={14} /> Salvar campos atuais como modelo
                  </button>
                ) : (
                  <div className="template-row wrap">
                    <input
                      autoFocus
                      value={savingName}
                      onChange={(e) => setSavingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
                      placeholder="Nome do modelo, ex.: US #3428853 - Pagamento boleto"
                    />
                    <button type="button" className="btn small primary" onClick={saveTemplate} disabled={!savingName.trim()}>
                      Salvar
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => setSavingName(null)}>
                      Cancelar
                    </button>
                  </div>
                )}
                {templateMsg && <span className="muted small">{templateMsg}</span>}
              </div>
              <div className="form-grid">
                <div className="full origin-field">
                  <span>Origem do bug *</span>
                  <div className="segmented">
                    {ORIGINS.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={fields.origin === o ? 'active' : ''}
                        onClick={() => setField('origin', o)}
                      >
                        {o === 'INTERNO' ? 'Interno' : 'Externo'}
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  Ambiente (Stage Introduced) *
                  <select value={fields.stageIntroduced} onChange={(e) => setField('stageIntroduced', e.target.value)}>
                    {STAGES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Canal
                  <select value={fields.channel} onChange={(e) => setField('channel', e.target.value)}>
                    <option value="">Nenhum</option>
                    <option value="CORBAN">CORBAN</option>
                    <option value="AGÊNCIA">AGÊNCIA</option>
                  </select>
                </label>
                <label>
                  Severidade *
                  <select value={fields.severity} onChange={(e) => setField('severity', e.target.value)}>
                    <option value="">Selecione…</option>
                    {SEVERITIES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Defect Type
                  <select value={fields.defectType} onChange={(e) => setField('defectType', e.target.value)}>
                    <option value="">—</option>
                    {DEFECT_TYPES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Area Path *
                  <input
                    list="bug-areas"
                    value={fields.areaPath}
                    onChange={(e) => setField('areaPath', e.target.value)}
                    placeholder="Digite para buscar…"
                  />
                  <datalist id="bug-areas">
                    {meta.data?.areas.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </label>
                <label className="full">
                  Iteration *
                  <input
                    list="bug-iterations"
                    value={fields.iterationPath}
                    onChange={(e) => setField('iterationPath', e.target.value)}
                    placeholder="Digite para buscar…"
                  />
                  <datalist id="bug-iterations">
                    {meta.data?.iterations.map((i) => (
                      <option key={i.path} value={i.path}>
                        {i.isCurrent ? 'atual' : ''}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label className="full">
                  Stage Found
                  <select value={fields.stageFound} onChange={(e) => setField('stageFound', e.target.value)}>
                    <option value="">—</option>
                    {STAGES_FOUND.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Tags <span className="muted">(separadas por ;)</span>
                  <input value={fields.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="Ex.: TREM 10; Formalização" />
                </label>
                <label className="full">
                  Test Case(s) relacionado(s)
                  <input value={fields.relatedIds} onChange={(e) => setField('relatedIds', e.target.value)} placeholder="Ex.: 3689271" />
                </label>
                <label className="full">
                  User Story (pai)
                  <select value={fields.usRef} onChange={(e) => chooseUs(e.target.value)}>
                    <option value="">Nenhuma</option>
                    <optgroup label="Regressão (sem US pai)">
                      <option value="reg:HML">Regressão HML</option>
                      <option value="reg:HFX">Regressão HFX</option>
                    </optgroup>
                    <optgroup label={usIds.length ? 'US da aba User Stories' : 'Nenhuma US na aba User Stories'}>
                      {usIds.map((id) => {
                        const us = usList.data?.find((u) => u.id === id);
                        return (
                          <option key={id} value={`us:${id}`}>
                            #{id}
                            {us ? ` - ${us.title}` : usList.loading ? ' (carregando…)' : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                    <option value="custom">Outro ID…</option>
                  </select>
                  {fields.usRef === 'custom' && (
                    <input value={fields.parentId} onChange={(e) => setField('parentId', e.target.value)} placeholder="ID da US, ex.: 3253228" />
                  )}
                </label>
              </div>
            </Card>

            <Card title="4. Confirmar">
              {error && <div className="bug-error">{error}</div>}
              {result?.validateOnly && (
                <div className="bug-ok">
                  <ShieldCheck size={16} /> Validação OK: o Azure DevOps aceitaria este bug. Nada foi criado.
                </div>
              )}
              {missing.length > 0 ? (
                <p className="muted small">Falta preencher: {missing.join(', ')}.</p>
              ) : (
                <p className="small bug-final-title">
                  <b>{prefix}</b> {title}
                </p>
              )}

              {confirming ? (
                <div className="confirm-box">
                  <p>
                    Criar este bug no Azure DevOps em <b>{fields.areaPath}</b> com {images.length} evidência(s)?
                  </p>
                  <div className="bug-actions">
                    <button className="btn primary" onClick={() => submit(false)} disabled={!!sending}>
                      {sending === 'create' ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Sim, criar bug
                    </button>
                    <button className="btn ghost" onClick={() => setConfirming(false)} disabled={!!sending}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bug-actions column">
                  <button
                    className="btn primary wide"
                    onClick={() => setConfirming(true)}
                    disabled={missing.length > 0 || generating || !!sending}
                  >
                    <Bug size={16} /> Confirmar criação do bug
                  </button>
                  <button
                    className="btn ghost wide"
                    onClick={() => submit(true)}
                    disabled={missing.length > 0 || generating || !!sending}
                    title="Confere campos e permissões no Azure DevOps sem criar o bug"
                  >
                    {sending === 'validate' ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} Só validar (não cria)
                  </button>
                  {hasDraft && (
                    <button className="btn ghost wide" onClick={resetAll} disabled={generating || !!sending}>
                      <Trash2 size={15} /> Limpar tudo
                    </button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
