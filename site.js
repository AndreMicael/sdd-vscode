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

function menu(features, constituicao, destinoAtual) {
  const itens = [`<li><a href="${lib.esc(href("index.html", destinoAtual))}">Início</a></li>`];
  if (constituicao) itens.push(`<li><a href="${lib.esc(href(constituicao.destino, destinoAtual))}">${lib.esc(constituicao.titulo)}</a></li>`);
  for (const feature of features) {
    const docs = feature.documentos.length
      ? feature.documentos.map((doc) => `<li><a href="${lib.esc(href(doc.destino, destinoAtual))}">${lib.esc(doc.rel)}</a></li>`).join("")
      : `<li class="vazio">sem documentos</li>`;
    itens.push(`<li><strong>${lib.esc(feature.nome)}</strong><ul>${docs}</ul></li>`);
  }
  return `<nav><input type="search" aria-label="Buscar"><div id="resultados-busca"></div><ul>${itens.join("")}</ul></nav>`;
}

function normalizaScript() {
  return `(s) => String(s).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")`;
}

function pagina({ titulo, menu: menuHtml, corpo, raizRel }) {
  const buscaScript = `${raizRel}busca.js`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${lib.esc(titulo)}</title><style>body{font-family:system-ui,sans-serif;display:flex;gap:2rem;max-width:1200px;margin:auto;padding:1rem;color:#222}nav{width:18rem;flex:none}nav ul{padding-left:1.2rem}nav li{margin:.35rem 0}.vazio{color:#777;font-style:italic}main{min-width:0;flex:1}a{color:#06c}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3rem}input[type=checkbox]{margin-right:.4rem}#resultados-busca{margin:.5rem 0}.indice{float:right;width:14rem;margin:0 0 1rem 1.5rem;padding-left:1rem;border-left:1px solid #ddd}@media(max-width:900px){.indice{float:none;width:auto;margin:0 0 1rem;padding:0;border:0}}</style></head><body><aside>${menuHtml}</aside><main><h1>${lib.esc(titulo)}</h1>${corpo}</main><script src="${lib.esc(buscaScript)}"></script><script>
const normaliza=${normalizaScript()};
const entrada=document.querySelector('input[type="search"]');
const resultados=document.getElementById("resultados-busca");
entrada.addEventListener("input",()=>{resultados.replaceChildren();const termo=normaliza(entrada.value.trim());if(!termo)return;const achados=(window.SDD_BUSCA||[]).filter(x=>x.texto.includes(termo));if(!achados.length){const vazio=document.createElement("p");vazio.textContent="Nenhum documento encontrado";resultados.append(vazio);return;}const lista=document.createElement("ul");for(const item of achados){const li=document.createElement("li");const a=document.createElement("a");a.href=${JSON.stringify(raizRel)}+item.url.split("/").map(encodeURIComponent).join("/");a.textContent=item.titulo;li.append(a);lista.append(li);}resultados.append(lista);});
</script></body></html>`;
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
    const limpo = texto.replace(/<[^>]*>/g, "").trim();
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
    let html = await render(doc.markdown);
    if (typeof html !== "string") throw new Error("o renderizador de Markdown não respondeu");
    // O renderizador do VS Code põe atributos no <li> (data-line, class) e às vezes um <p> dentro.
    html = html.replace(/(<li\b[^>]*>\s*(?:<p\b[^>]*>)?)\[([ xX])\]\s*/g, (_, abre, marca) => `${abre}<input type="checkbox" disabled${marca === " " ? "" : " checked"}> `);
    html = reescreverLinks(html, doc, destinos);
    const toc = indice(html);
    const tipo = doc.tipo ? wiki.PASSOS[doc.tipo] : null;
    const caixa = tipo ? `<section class="tipo"><strong>${lib.esc(tipo.resumo)}</strong><p>Gerado por: ${lib.esc(doc.passo ? `${doc.passo} (${tipo.comando})` : tipo.comando)}</p><p>Quando ler: ${lib.esc(tipo.quando)}</p></section>` : "";
    const destino = doc.destino;
    const rel = path.posix.dirname(destino) === "." ? "" : "../".repeat(destino.split("/").length - 1);
    saida.set(destino, pagina({ titulo: doc.titulo, menu: menu(dados.features, dados.constituicao, destino), corpo: `${caixa}${toc.toc}<article>${toc.html}</article>`, raizRel: rel }));
  }
  const indexCorpo = `<p>Documentação das features do projeto.</p><ul>${dados.features.map((f) => `<li><a href="${lib.esc(href(f.documentos[0]?.destino || "index.html", "index.html"))}">${lib.esc(f.nome)}</a> — ${lib.esc(f.passoAtual)}${f.documentos.length ? "" : " (sem documentos)"}</li>`).join("")}</ul>${dados.constituicao ? `<p><a href="constituicao.html">${lib.esc(dados.constituicao.titulo)}</a></p>` : ""}`;
  saida.set("index.html", pagina({ titulo: "Documentação SDD", menu: menu(dados.features, dados.constituicao, "index.html"), corpo: indexCorpo, raizRel: "" }));
  const faltante = `<p id="mensagem-nao-encontrado"></p><script>const doc=new URLSearchParams(location.search).get("doc")||"";document.getElementById("mensagem-nao-encontrado").textContent="Documento não encontrado: "+doc;</script>`;
  saida.set("nao-encontrado.html", pagina({ titulo: "Documento não encontrado", menu: menu(dados.features, dados.constituicao, "nao-encontrado.html"), corpo: faltante, raizRel: "" }));
  // shortcut: busca linear por substring, trocar por índice invertido se passar de alguns MB.
  const busca = todos.map((d) => ({ titulo: d.titulo, url: d.destino, texto: d.markdown.replace(/[`*_#>\[\]()]/g, " ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }));
  saida.set("busca.js", `window.SDD_BUSCA = ${JSON.stringify(busca).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")};`);
  return saida;
}

module.exports = { listarDocumentos, href, tipoDoDocumento, reescreverLinks, indice, gerarSite };
