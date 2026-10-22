// @ts-check
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const wiki = require("./wiki");

const posix = (p) => p.split(path.sep).join("/");
const caminhoCodificado = (p) => p.split("/").map(encodeURIComponent).join("/");

/** @param {string} raiz */
function listarDocumentos(raiz) {
  const specs = path.join(raiz, "specs");
  if (!fs.existsSync(specs)) throw new Error("Não foi encontrada a pasta specs/");
  const features = lib.listarFeatures(raiz).map((nome) => {
    const dir = path.join(specs, nome);
    /** @type {string[]} */
    const arquivos = [];
    const visitar = (p) => {
      for (const item of fs.readdirSync(p, { withFileTypes: true })) {
        const alvo = path.join(p, item.name);
        if (item.isDirectory()) visitar(alvo);
        else if (item.isFile() && item.name.endsWith(".md")) arquivos.push(alvo);
      }
    };
    visitar(dir);
    arquivos.sort();
    const trilha = lib.trilha(dir);
    const documentos = arquivos.map((origemAbsoluta) => {
      const rel = posix(path.relative(dir, origemAbsoluta));
      const markdown = fs.readFileSync(origemAbsoluta, "utf8");
      const tipo = tipoDoDocumento(rel);
      return { origem: posix(path.relative(raiz, origemAbsoluta)), rel, destino: `${nome}/${rel.slice(0, -2)}html`, titulo: titulo(markdown, rel), markdown, tipo, passo: trilha.find((p) => p.passo === tipo)?.titulo || null };
    });
    const atual = trilha.find((p) => p.estado === "atual");
    return { nome, passoAtual: atual?.titulo || "", documentos };
  });
  const constituicaoAbsoluta = path.join(raiz, ".specify", "memory", "constitution.md");
  let constituicao = null;
  if (fs.existsSync(constituicaoAbsoluta)) {
    const markdown = fs.readFileSync(constituicaoAbsoluta, "utf8");
    constituicao = { origem: ".specify/memory/constitution.md", rel: "", destino: "constituicao.html", titulo: titulo(markdown, "constitution.md"), markdown, tipo: null };
  }
  return { features, constituicao };
}

const titulo = (markdown, nome) => /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || path.posix.basename(nome);

/** @param {string} deDestino @param {string} paraDestino */
function href(deDestino, paraDestino) {
  const rel = path.posix.relative(path.posix.dirname(paraDestino), deDestino) || path.posix.basename(deDestino);
  return caminhoCodificado(rel);
}

function tipoDoDocumento(rel) {
  for (const [chave, passo] of Object.entries(wiki.PASSOS)) {
    if (passo.gera.some((item) => {
      const prefixo = item.split(" (")[0];
      return prefixo.endsWith("/") ? rel.startsWith(prefixo) : rel === prefixo;
    })) return chave;
  }
  return null;
}

const ICONES = {
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  casa: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  livro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  pasta: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  ramo: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  passos: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  alvo: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  banco: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
};
const svg = (nome, classe = "ico") => `<svg class="${classe}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;
const dataSvg = (corpo) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`)}")`;

function menu(features, constituicao, destinoAtual) {
  const link = (destino, conteudo, classe = "") => {
    const ativo = destino === destinoAtual;
    return `<a class="${classe}${ativo ? " ativo" : ""}" href="${lib.esc(href(destino, destinoAtual))}"${ativo ? ' aria-current="page"' : ""}>${conteudo}</a>`;
  };
  const topo = [link("index.html", `${svg("casa")}Início`)];
  if (constituicao) topo.push(link(constituicao.destino, `${svg("livro")}${lib.esc(constituicao.titulo)}`));
  const grupos = features.map((feature) => {
    const docs = feature.documentos.length
      ? feature.documentos.map((doc) => link(doc.destino, lib.esc(doc.rel), "arquivo")).join("")
      : `<span class="vazio">sem documentos</span>`;
    return `<details open><summary>${lib.esc(feature.nome)}</summary>${docs}</details>`;
  });
  return `<nav class="lateral" aria-label="Documentos"><div class="secao-nav">${svg("doc")}Documentação</div>${topo.join("")}<div class="secao-nav especificacoes">${svg("pasta")}Especificações</div><label class="filtro">${svg("busca")}<input type="search" id="filtro" placeholder="Buscar arquivos..." aria-label="Filtrar arquivos"></label>${grupos.join("")}</nav>`;
}

function normalizaScript() {
  return `(s) => String(s).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")`;
}

const ESCURO = "--fundo:#12151b;--painel:#0d1015;--texto:#e5e7eb;--suave:#9ca3af;--borda:#262c36;--hover:#1b2029;--primaria:#60a5fa;--primaria-fundo:#172440;--info-fundo:#14213a;--alerta-fundo:#2a1d10;--alerta-borda:#8a5320;--sucesso:#22c55e;--sucesso-fundo:#0f2418;--sucesso-borda:#24613b;--roxo:#a78bfa;--roxo-fundo:#1d1830;--roxo-borda:#4c3d8f;--cinza-fundo:#151a22";
const CSS = `:root{--fundo:#f8f9fb;--painel:#fff;--texto:#1f2937;--suave:#6b7280;--borda:#e5e7eb;--hover:#eef0f4;--primaria:#2563eb;--primaria-fundo:#eaf1ff;--info-fundo:#eaf2fe;--alerta-fundo:#fff7ed;--alerta-borda:#fdba74;--sucesso:#16a34a;--sucesso-fundo:#f0fdf4;--sucesso-borda:#86efac;--roxo:#7c3aed;--roxo-fundo:#f5f3ff;--roxo-borda:#c4b5fd;--cinza-fundo:#f9fafb;color-scheme:light}
:root[data-theme=dark]{${ESCURO};color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;font:14px/1.6 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--texto);background:var(--painel);counter-reset:hist}
a{color:var(--primaria);text-decoration:none}a:hover{text-decoration:underline}
.ico{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.topo{position:sticky;top:0;z-index:10;height:56px;display:flex;align-items:center;gap:24px;padding:0 20px;background:var(--painel);border-bottom:1px solid var(--borda)}
.marca{display:flex;align-items:center;gap:10px;width:236px;font-weight:700;font-size:16px;color:var(--texto)}.marca:hover{text-decoration:none}
.logo{width:30px;height:30px;padding:6px;border-radius:8px;background:var(--primaria);stroke:#fff}
.busca{position:relative;flex:1;max-width:420px;margin:0 auto}
.busca>.ico,.filtro>.ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--suave)}
input[type=search]{width:100%;height:34px;padding:0 10px 0 32px;border:1px solid var(--borda);border-radius:8px;background:var(--cinza-fundo);color:var(--texto);font:inherit;font-size:13px}
input[type=search]:focus{outline:2px solid var(--primaria);outline-offset:-1px}
#resultados-busca{position:absolute;top:40px;left:0;right:0;max-height:60vh;overflow:auto;padding:6px;background:var(--painel);border:1px solid var(--borda);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
#resultados-busca:empty{display:none}#resultados-busca ul{list-style:none;margin:0;padding:0}
#resultados-busca a,#resultados-busca p{display:block;margin:0;padding:6px 10px;border-radius:6px}#resultados-busca a:hover{background:var(--primaria-fundo);text-decoration:none}
#tema{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--borda);border-radius:8px;background:var(--painel);color:var(--texto);cursor:pointer}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr)}
.lado{position:sticky;top:56px;height:calc(100vh - 56px);overflow:auto;padding:16px 12px;background:var(--fundo);border-right:1px solid var(--borda)}
.lateral a,.secao-nav{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:6px;color:var(--texto)}
.lateral a:hover{background:var(--hover);text-decoration:none}
.secao-nav{font-weight:600}.especificacoes{margin-top:6px;background:var(--primaria-fundo);color:var(--primaria)}
.lateral a.ativo{background:var(--primaria-fundo);color:var(--primaria);font-weight:600}
.filtro{position:relative;display:block;margin:10px 0 12px}
.lateral details{margin:6px 0}
.lateral summary{display:flex;align-items:center;gap:6px;padding:6px 4px;font-weight:600;font-size:13px;cursor:pointer;list-style:none}
.lateral summary::-webkit-details-marker{display:none}
.lateral summary::before{content:"";width:6px;height:6px;margin:0 4px;border:solid var(--suave);border-width:0 1.5px 1.5px 0;transform:rotate(-45deg);transition:transform .15s}
.lateral details[open]>summary::before{transform:rotate(45deg)}
.lateral .arquivo{padding:5px 10px 5px 26px;font-size:13px;color:var(--suave)}
.lateral .arquivo::before{content:"";width:14px;height:14px;flex:none;background:currentColor;-webkit-mask:${dataSvg(ICONES.doc)} center/contain no-repeat;mask:${dataSvg(ICONES.doc)} center/contain no-repeat}
.vazio{display:block;padding:4px 26px;color:var(--suave);font-style:italic;font-size:13px}
main{display:flex;gap:32px;min-width:0;padding:20px 32px 64px}
.conteudo{flex:1;min-width:0;max-width:820px}
.migalhas{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.5px;color:var(--suave)}.migalhas a{color:var(--suave)}
h1{margin:16px 0 6px;font-size:26px;line-height:1.25;letter-spacing:-.01em}
.subtitulo{margin:0 0 14px;color:var(--suave);font-size:15px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--borda);border-radius:8px;font-size:12.5px}
.ponto{width:9px;height:9px;border-radius:50%;background:var(--sucesso)}
.visao{display:flex;gap:12px;margin-bottom:28px;padding:14px 16px;border-radius:8px;background:var(--info-fundo);border-left:4px solid var(--primaria);scroll-margin-top:72px}
.visao>.ico{width:20px;height:20px;margin-top:2px;color:var(--primaria)}.visao strong{color:var(--primaria)}.visao p{margin:2px 0 0}
article h2{margin:32px 0 10px;font-size:20px}article h3{margin:22px 0 8px;font-size:15.5px}article h4{scroll-margin-top:72px}
article h2,article h3{display:flex;align-items:center;gap:10px;scroll-margin-top:72px}
article h2 .ico{width:20px;height:20px;color:var(--primaria)}article h3 .ico{width:17px;height:17px;color:var(--primaria)}
article .alerta .ico{color:#f59e0b}article .sucesso .ico{color:var(--sucesso)}article .premissa .ico{color:var(--roxo)}
.corpo>:first-child{margin-top:0}.corpo>:last-child{margin-bottom:0}
.nota,.historia{margin:14px 0;padding:14px 18px;border:1px solid var(--borda);border-radius:10px}
.nota{background:var(--cinza-fundo)}.nota h3{margin-top:0;font-size:14px}
.historia{position:relative;padding:18px 20px 18px 66px;counter-increment:hist}
.historia h3{justify-content:space-between;margin:0 0 6px}
.historia h3::before{content:counter(hist);position:absolute;left:18px;top:16px;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--primaria-fundo);color:var(--primaria);font-weight:700}
.prioridade{flex:none;padding:2px 10px;border-radius:6px;background:var(--primaria-fundo);color:var(--primaria);font-size:12px;font-weight:600}
.historia ol{list-style:none;counter-reset:cen;padding:10px 12px;border-radius:8px;background:var(--cinza-fundo)}
.historia ol>li{position:relative;margin:6px 0;padding-left:30px;font-size:13.5px;counter-increment:cen}
.historia ol>li::before{content:counter(cen);position:absolute;left:0;top:1px;width:20px;height:20px;display:grid;place-items:center;border-radius:50%;background:var(--primaria-fundo);color:var(--primaria);font-size:11px;font-weight:700}
.historia hr{display:none}
.alerta .corpo,.sucesso .corpo,.premissa .corpo,.requisitos .corpo{padding:12px 18px;border:1px solid var(--borda);border-radius:10px}
.alerta .corpo{background:var(--alerta-fundo);border-color:var(--alerta-borda)}
.sucesso .corpo{background:var(--sucesso-fundo);border-color:var(--sucesso-borda)}
.premissa .corpo{background:var(--roxo-fundo);border-color:var(--roxo-borda)}
.requisitos ul,.sucesso ul{list-style:none;padding:0}
.requisitos li,.sucesso li{position:relative;margin:7px 0;padding-left:24px}
.requisitos li::before{content:"›";position:absolute;left:4px;color:var(--suave);font-weight:700}
.sucesso li::before{content:"";position:absolute;left:0;top:3px;width:16px;height:16px;border-radius:50%;background:var(--sucesso) ${dataSvg('<path d="M20 6 9 17l-5-5" stroke="white" stroke-width="3"/>')} center/10px no-repeat}
.id{display:inline-block;margin-right:6px;padding:1px 7px;border-radius:5px;background:var(--primaria-fundo);color:var(--primaria);font:600 12px ui-monospace,Consolas,monospace}
.sucesso .id{background:none;color:var(--texto)}
code{padding:1px 4px;border:1px solid var(--borda);border-radius:4px;background:var(--cinza-fundo);font:12.5px ui-monospace,Consolas,monospace}
pre{overflow:auto;padding:12px;border:1px solid var(--borda);border-radius:8px;background:var(--cinza-fundo)}pre code{padding:0;border:0}
table{display:block;overflow:auto;margin:12px 0;border-collapse:collapse;font-size:13px}th,td{padding:6px 10px;border:1px solid var(--borda);text-align:left}th{background:var(--cinza-fundo)}
blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--borda);color:var(--suave)}
input[type=checkbox]{margin-right:.4rem}
.indice{flex:none;align-self:flex-start;position:sticky;top:76px;width:220px;max-height:calc(100vh - 96px);overflow:auto;padding:14px 10px;border:1px solid var(--borda);border-radius:10px;font-size:12.5px}
.indice strong{display:block;margin:0 0 8px 8px;font-size:14px}.indice ul{list-style:none;margin:0;padding:0}
.indice a{display:block;padding:4px 8px;border-radius:6px;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.indice a::before{content:"› ";color:var(--suave)}.indice a:hover{background:var(--hover);text-decoration:none}
.indice .nivel-2 a{font-weight:600}.indice .nivel-3 a{padding-left:20px;color:var(--suave)}.indice .nivel-4 a{padding-left:32px;color:var(--suave)}
.indice a.ativo{background:var(--primaria-fundo);color:var(--primaria);box-shadow:inset 2px 0 var(--primaria)}
.cartoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:18px 0}
.cartao{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--borda);border-radius:10px;color:var(--texto)}.cartao:hover{border-color:var(--primaria);text-decoration:none}.cartao small{color:var(--suave)}
@media(max-width:1200px){main{flex-direction:column-reverse;gap:16px}.indice{position:static;width:auto;max-height:none}}
@media(max-width:820px){.layout{display:block}.lado{position:static;height:auto;border-right:0;border-bottom:1px solid var(--borda)}.topo{gap:12px;padding:0 16px}.marca{width:auto}.marca span{display:none}main{padding:16px}}`;

function pagina({ titulo, subtitulo = "", migalhas = [], chips = "", menu: menuHtml, corpo, toc = "", raizRel }) {
  const buscaScript = `${raizRel}busca.js`;
  const trilha = [`<a href="${raizRel}index.html" aria-label="Início">${svg("casa")}</a>`, ...migalhas.map(lib.esc)].join("<span>›</span>");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${lib.esc(titulo)}</title><script>try{const t=localStorage.getItem("sdd-tema");if(t)document.documentElement.dataset.theme=t}catch{}</script><style>${CSS}</style></head><body><header class="topo"><a class="marca" href="${raizRel}index.html">${svg("doc", "ico logo")}<span>Documentação SDD</span></a><div class="busca">${svg("busca")}<input type="search" id="busca" placeholder="Buscar na documentação..." aria-label="Buscar"><div id="resultados-busca"></div></div><button id="tema" type="button" aria-label="Alternar tema claro ou escuro">${svg("sol")}</button></header><div class="layout"><aside class="lado">${menuHtml}</aside><main><div class="conteudo"><div class="migalhas">${trilha}</div><h1>${lib.esc(titulo)}</h1>${subtitulo ? `<p class="subtitulo">${lib.esc(subtitulo)}</p>` : ""}${chips ? `<div class="chips">${chips}</div>` : ""}${corpo}</div>${toc}</main></div><script src="${lib.esc(buscaScript)}"></script><script>
const normaliza=${normalizaScript()};
const entrada=document.getElementById("busca");
const resultados=document.getElementById("resultados-busca");
entrada.addEventListener("input",()=>{resultados.replaceChildren();const termo=normaliza(entrada.value.trim());if(!termo)return;const achados=(window.SDD_BUSCA||[]).filter(x=>x.texto.includes(termo));if(!achados.length){const vazio=document.createElement("p");vazio.textContent="Nenhum documento encontrado";resultados.append(vazio);return;}const lista=document.createElement("ul");for(const item of achados){const li=document.createElement("li");const a=document.createElement("a");a.href=${JSON.stringify(raizRel)}+item.url.split("/").map(encodeURIComponent).join("/");a.textContent=item.titulo;li.append(a);lista.append(li);}resultados.append(lista);});
const filtro=document.getElementById("filtro");
filtro.addEventListener("input",()=>{const t=normaliza(filtro.value.trim());for(const a of document.querySelectorAll(".lateral .arquivo"))a.hidden=!!t&&!normaliza(a.textContent).includes(t);for(const d of document.querySelectorAll(".lateral details"))d.hidden=!!t&&!d.querySelector(".arquivo:not([hidden])");});
document.getElementById("tema").addEventListener("click",()=>{const r=document.documentElement;const escuro=r.dataset.theme==="dark";r.dataset.theme=escuro?"light":"dark";try{localStorage.setItem("sdd-tema",r.dataset.theme)}catch{}});
const links=[...document.querySelectorAll(".indice a")];
if(links.length&&"IntersectionObserver" in window){const marca=(id)=>links.forEach(a=>a.classList.toggle("ativo",a.getAttribute("href")==="#"+id));const obs=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){marca(e.target.id);break;}},{rootMargin:"0px 0px -70% 0px"});for(const a of links){const h=a.getAttribute("href").slice(1);let el=document.getElementById(h);try{el=el||document.getElementById(decodeURIComponent(h))}catch{}if(el)obs.observe(el);}}
</script></body></html>`;
}

// Cabeçalho do Spec Kit (**Status**: Draft etc.) vira chips no topo da página.
const ROTULOS = { status: "Status", "feature branch": "Branch", branch: "Branch", created: "Criado em", date: "Criado em" };
function metadados(markdown) {
  const fim = markdown.search(/^##\s/m);
  const cabeca = fim < 0 ? markdown : markdown.slice(0, fim);
  /** @type {[string, string][]} */
  const chips = [];
  const limpa = cabeca.replace(/^\*\*[^*\n]+\*\*:.*$/gm, (linha) => {
    let todos = true;
    for (const parte of linha.split(" | ")) {
      const m = /^\*\*([^*]+)\*\*:\s*(.+)$/.exec(parte.trim());
      const rotulo = m && ROTULOS[m[1].toLowerCase()];
      if (rotulo) chips.push([rotulo, m[2].replace(/`/g, "").trim()]);
      else todos = false;
    }
    return todos ? "" : linha;
  });
  return { chips, markdown: limpa + (fim < 0 ? "" : markdown.slice(fim)) };
}

const ICONE_SECAO = { clarif: "calendario", cenarios: "pessoas", req: "passos", requisitos: "passos", entidades: "banco", alerta: "alerta", sucesso: "alvo", premissa: "doc" };
const classeDaSecao = (t, contexto) =>
  /user stor|historia/.test(t) ? "historia"
  : /edge case|casos? de borda/.test(t) ? "alerta"
  : /assumption|premissa/.test(t) ? "premissa"
  : /functional req|requisitos funcionais/.test(t) ? "requisitos"
  : /key entit|entidade/.test(t) ? "entidades"
  : /clarific|esclarec/.test(t) ? "clarif"
  : /success|sucesso/.test(t) ? "sucesso"
  : /user scen|cenario/.test(t) ? "cenarios"
  : /requirement|requisito/.test(t) ? "req"
  : /clarific|esclarec/.test(contexto) ? "nota"
  : /success|sucesso/.test(contexto) ? "sucesso" : "";

/** Agrupa cada h2/h3 com o conteúdo seguinte numa <section> com classe pelo assunto (histórias, casos de borda...). */
function secoes(html) {
  let contexto = "";
  return html.split(/(?=<h[23][\s>])/i).map((bloco) => {
    const m = /^<h([23])([^>]*)>([\s\S]*?)<\/h\1>/i.exec(bloco);
    if (!m) return bloco;
    const texto = m[3].replace(/<[^>]*>/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (m[1] === "2") contexto = texto;
    const tipo = classeDaSecao(texto, m[1] === "3" ? contexto : "");
    const titulo = tipo === "historia" ? m[3].replace(/\s*\((?:priority|prioridade):\s*(P\d+)\)/i, '</span><span class="prioridade">Prioridade: $1') : m[3];
    const icone = ICONE_SECAO[tipo] || (m[1] === "2" ? "hash" : "");
    const resto = bloco.slice(m[0].length).trim();
    return `<section class="sec ${tipo}"><h${m[1]}${m[2]}>${icone ? svg(icone) : ""}<span>${titulo}</span></h${m[1]}>${resto ? `<div class="corpo">${resto}</div>` : ""}</section>`;
  }).join("");
}

function reescreverLinks(html, doc, destinos) {
  return html.replace(/ href="([^"]+)"/g, (trecho, alvo) => {
    const [semFragmento, fragmento] = alvo.split("#", 2);
    if (!semFragmento.toLowerCase().endsWith(".md") || /^(?:[a-z]+:|\/|#)/i.test(semFragmento)) return trecho;
    let origem;
    try { origem = posix(path.posix.normalize(path.posix.join(path.posix.dirname(doc.origem), decodeURIComponent(semFragmento)))); } catch { return trecho; }
    const destino = destinos.get(origem);
    if (destino) return ` href="${lib.esc(href(destino, doc.destino))}${fragmento ? `#${caminhoCodificado(fragmento)}` : ""}"`;
    return ` href="${lib.esc(href("nao-encontrado.html", doc.destino))}?doc=${encodeURIComponent(origem)}"`;
  });
}

function indice(html) {
  const usados = new Map();
  const toc = [];
  const atualizado = html.replace(/<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/gi, (total, nivel, atributos, texto) => {
    const entidades = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
    const limpo = texto.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => entidades[e]).trim();
    const existente = /\bid="([^"]+)"/.exec(atributos)?.[1];
    let id = existente || limpo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "secao";
    const n = (usados.get(id) || 0) + 1; usados.set(id, n); if (!existente && n > 1) id += `-${n}`;
    toc.push(`<li class="nivel-${nivel}"><a href="#${lib.esc(id)}">${lib.esc(limpo)}</a></li>`);
    return existente ? total : `<h${nivel}${atributos} id="${lib.esc(id)}">${texto}</h${nivel}>`;
  });
  return { html: atualizado, toc: toc.length ? `<aside class="indice"><strong>Índice</strong><ul>${toc.join("")}</ul></aside>` : "" };
}

/** @param {string} raiz @param {(md: string) => Promise<string> | string} render */
async function gerarSite(raiz, render) {
  const dados = listarDocumentos(raiz);
  const todos = dados.features.flatMap((f) => f.documentos).concat(dados.constituicao ? [dados.constituicao] : []);
  const destinos = new Map(todos.map((d) => [d.origem, d.destino]));
  const saida = new Map();
  saida.set(".gerado-pelo-sdd", "gerado por SDD\n");
  for (const doc of todos) {
    const meta = metadados(doc.markdown);
    let html = await render(meta.markdown);
    if (typeof html !== "string") throw new Error("o renderizador de Markdown não respondeu");
    html = html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, ""); // o título já vai no topo da página
    // O renderizador do VS Code põe atributos no <li> (data-line, class) e às vezes um <p> dentro.
    html = html.replace(/(<li\b[^>]*>\s*(?:<p\b[^>]*>)?)\[([ xX])\]\s*/g, (_, abre, marca) => `${abre}<input type="checkbox" disabled${marca === " " ? "" : " checked"}> `);
    html = reescreverLinks(html, doc, destinos);
    const toc = indice(html);
    html = secoes(toc.html.replace(/<strong>((?:N?FR|SC)-\d+)<\/strong>:?/g, '<span class="id">$1</span>'));
    const tipo = doc.tipo ? wiki.PASSOS[doc.tipo] : null;
    const caixa = tipo ? `<section class="visao" id="visao-geral">${svg("info")}<div><strong>Visão geral</strong><p>Gerado por: ${lib.esc(doc.passo ? `${doc.passo} (${tipo.comando})` : tipo.comando)}</p><p>Quando ler: ${lib.esc(tipo.quando)}</p></div></section>` : "";
    const feature = dados.features.find((f) => f.documentos.includes(doc));
    const icones = { Status: '<span class="ponto"></span>', Branch: svg("ramo"), "Criado em": svg("calendario") };
    const chips = meta.chips.map(([rotulo, valor]) => `<span class="chip">${icones[rotulo]}<b>${rotulo}:</b> ${lib.esc(valor)}</span>`);
    if (feature?.passoAtual) chips.push(`<span class="chip">${svg("passos")}<b>Passo atual:</b> ${lib.esc(feature.passoAtual)}</span>`);
    const tocHtml = caixa && toc.toc ? toc.toc.replace("<ul>", '<ul><li class="nivel-2"><a href="#visao-geral">Visão geral</a></li>') : toc.toc;
    const destino = doc.destino;
    const rel = path.posix.dirname(destino) === "." ? "" : "../".repeat(destino.split("/").length - 1);
    saida.set(destino, pagina({
      titulo: doc.titulo, subtitulo: tipo?.resumo, migalhas: feature ? ["Especificações", feature.nome, doc.rel] : [doc.titulo],
      chips: chips.join(""), menu: menu(dados.features, dados.constituicao, destino), corpo: `${caixa}<article>${html}</article>`, toc: tocHtml, raizRel: rel,
    }));
  }
  const cartoes = dados.features.map((f) => `<a class="cartao" href="${lib.esc(href(f.documentos[0]?.destino || "index.html", "index.html"))}"><strong>${lib.esc(f.nome)}</strong><span>${lib.esc(f.passoAtual)}</span><small>${f.documentos.length ? `${f.documentos.length} documentos` : "sem documentos"}</small></a>`).join("");
  const indexCorpo = `<div class="cartoes">${cartoes}</div>${dados.constituicao ? `<p><a href="constituicao.html">${lib.esc(dados.constituicao.titulo)}</a></p>` : ""}`;
  saida.set("index.html", pagina({ titulo: "Documentação SDD", subtitulo: "Documentação das features do projeto.", menu: menu(dados.features, dados.constituicao, "index.html"), corpo: indexCorpo, raizRel: "" }));
  const faltante = `<p id="mensagem-nao-encontrado"></p><script>const doc=new URLSearchParams(location.search).get("doc")||"";document.getElementById("mensagem-nao-encontrado").textContent="Documento não encontrado: "+doc;</script>`;
  saida.set("nao-encontrado.html", pagina({ titulo: "Documento não encontrado", menu: menu(dados.features, dados.constituicao, "nao-encontrado.html"), corpo: faltante, raizRel: "" }));
  // shortcut: busca linear por substring, trocar por índice invertido se passar de alguns MB.
  const busca = todos.map((d) => ({ titulo: d.titulo, url: d.destino, texto: d.markdown.replace(/[`*_#>\[\]()]/g, " ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }));
  saida.set("busca.js", `window.SDD_BUSCA = ${JSON.stringify(busca).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")};`);
  return saida;
}

module.exports = { listarDocumentos, href, tipoDoDocumento, reescreverLinks, indice, gerarSite };
