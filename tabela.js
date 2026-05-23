import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

let jogos = [];
let sumulas = [];
let jogadores = [];
let times = [];
let campeonatos = [];
let historico = [];
let abaAtual = "detalhes";
let salvandoOficial = false;
let timerSalvarOficial = null;

const $ = id => document.getElementById(id);

const norm = txt =>
  String(txt || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const slug = txt =>
  norm(txt)
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"") || "geral";

const nomeTime = t => typeof t === "object" ? (t?.nome || t?.nomeTime || "") : (t || "");
const logoTime = t => typeof t === "object" ? (t?.logo || t?.escudo || "logo-liga.jfif") : "logo-liga.jfif";

const dataValor = v => {
  try{
    return v?.toDate ? v.toDate() : new Date(v || 0);
  }catch{
    return new Date(0);
  }
};

function getSumula(id){
  return sumulas.find(s => s.id === id || s.jogoId === id) || null;
}

function sumulaFinalizada(s){
  return !!s && (
    s.sumulaFinalizada === true ||
    s.publica === true ||
    s.publico === true ||
    norm(s.status) === "finalizado" ||
    norm(s.sumulaStatus) === "finalizada"
  );
}

function finalizado(j){
  const s = getSumula(j.id);
  return j?.sumulaFinalizada === true || norm(j?.status) === "finalizado" || sumulaFinalizada(s);
}

function campItem(x){
  return x?.campeonatoId || x?.campeonato || x?.campeonatoNome || "";
}

function catItem(x){
  return x?.categoria || "";
}

function filtroCamp(){ return $("filtroCampeonato")?.value || ""; }
function filtroCat(){ return $("filtroCategoria")?.value || ""; }
function filtroGrupo(){ return $("filtroGrupo")?.value || ""; }

function campeonatoAtual(){
  const f = filtroCamp();
  if(!f) return null;
  return campeonatos.find(c => c.id === f || norm(c.nome) === norm(f) || norm(c.campeonato) === norm(f)) || null;
}

function grupoItem(x){
  return x?.grupo || x?.grupoNome || x?.chaveGrupo || x?.grupoCampeonato || "";
}

function grupoPorConfiguracao(time,categoria,campeonatoRef=null){
  const nome = nomeTime(time);
  if(!nome) return "";

  const camp = campeonatoRef || campeonatoAtual();
  const cfg = camp?.configuracaoGrupos || camp?.grupos || null;
  if(!cfg) return "";

  const cats = cfg.categorias || cfg;
  const catObj = cats?.[categoria] || cats?.[String(categoria || "").replace("-", " ")] || null;
  const grupos = catObj?.grupos || catObj || null;
  if(!grupos || typeof grupos !== "object") return "";

  for(const [grupo,lista] of Object.entries(grupos)){
    const timesLista = Array.isArray(lista) ? lista : [];
    if(timesLista.some(t => norm(nomeTime(t) || t) === norm(nome))){
      return grupo;
    }
  }

  return "";
}

function grupoPartida(p){
  return grupoItem(p) || grupoPorConfiguracao(p.timeA,p.categoria) || grupoPorConfiguracao(p.timeB,p.categoria) || "";
}

function passaFiltroGrupoPartida(p){
  return !filtroGrupo() || norm(grupoPartida(p)) === norm(filtroGrupo());
}

function passaFiltro(x){
  if(filtroCamp() && norm(campItem(x)) !== norm(filtroCamp())) return false;
  if(filtroCat() && norm(catItem(x)) !== norm(filtroCat())) return false;
  return true;
}

function jogosFiltrados(){ return jogos.filter(passaFiltro); }
function sumulasFiltradas(){ return sumulas.filter(s => sumulaFinalizada(s)).filter(passaFiltro); }

function escudoPorNome(nome){
  const t = times.find(x => norm(x.nome) === norm(nome) || norm(x.timeNome) === norm(nome));
  return t?.logo || t?.escudo || "logo-liga.jfif";
}

function fotoJogador(nome){
  const j = jogadores.find(x => norm(x.nome) === norm(nome));
  return j?.foto || j?.imagem || j?.avatar || "logo-liga.jfif";
}

function partidaBase(j){
  const s = getSumula(j.id) || j;

  return {
    id: j.id,
    campeonato: s.campeonato || j.campeonato || j.campeonatoNome || "",
    campeonatoId: s.campeonatoId || j.campeonatoId || s.campeonato || j.campeonato || "",
    categoria: s.categoria || j.categoria || "",
    temporada: s.temporada || j.temporada || "",
    rodada: s.rodada || j.rodada || j.fase || "",
    data: s.data || s.dataHora || j.data || j.dataHora || "",
    local: s.local || s.campo || j.local || j.campo || "",
    arbitro: s.arbitro || j.arbitro || "",
    timeA: s.timeA || j.timeA,
    timeB: s.timeB || j.timeB,
    golsA: Number(s.placar?.A ?? s.placar?.timeA ?? s.golsA ?? j.golsA ?? 0),
    golsB: Number(s.placar?.B ?? s.placar?.timeB ?? s.golsB ?? j.golsB ?? 0),
    gols: s.gols || j.gols || [],
    cartoes: s.cartoes || j.cartoes || [],
    assistencias: s.assistencias || j.assistencias || [],
    finalizado: finalizado(j),
    grupo: s.grupo || s.grupoNome || j.grupo || j.grupoNome || j.chaveGrupo || "",
    fase: s.fase || j.fase || s.etapa || j.etapa || s.rodada || j.rodada || "",
    penaltisA: s.penaltisA ?? s.penaltiA ?? j.penaltisA ?? j.penaltiA,
    penaltisB: s.penaltisB ?? s.penaltiB ?? j.penaltisB ?? j.penaltiB,
    logoA: s.logoA || s.logoTimeA || j.logoA || j.logoTimeA || "",
    logoB: s.logoB || s.logoTimeB || j.logoB || j.logoTimeB || ""
  };
}

function partidasFinalizadas(){
  return jogosFiltrados()
    .filter(finalizado)
    .map(partidaBase)
    .filter(passaFiltroGrupoPartida)
    .sort((a,b) => dataValor(a.data) - dataValor(b.data));
}

function todasPartidasFinalizadas(){
  return jogos
    .filter(finalizado)
    .map(partidaBase)
    .sort((a,b) => dataValor(a.data) - dataValor(b.data));
}

function baseTime(nome, logo){
  return {
    nome,
    logo: logo || escudoPorNome(nome),
    pontos:0,jogos:0,vitorias:0,empates:0,derrotas:0,golsPro:0,golsContra:0,saldo:0,aproveitamento:0,
    forma:[],
    casa:{pontos:0,jogos:0,vitorias:0,empates:0,derrotas:0,golsPro:0,golsContra:0,saldo:0,aproveitamento:0},
    fora:{pontos:0,jogos:0,vitorias:0,empates:0,derrotas:0,golsPro:0,golsContra:0,saldo:0,aproveitamento:0},
    cleanSheets:0,
    cartoesAmarelos:0,
    cartoesVermelhos:0
  };
}

function atualizarStats(gp,gc,alvo){
  alvo.jogos++;
  alvo.golsPro += gp;
  alvo.golsContra += gc;
  alvo.saldo = alvo.golsPro - alvo.golsContra;

  let resultado = "E";

  if(gp > gc){
    alvo.vitorias++;
    alvo.pontos += 3;
    resultado = "V";
  }else if(gp < gc){
    alvo.derrotas++;
    resultado = "D";
  }else{
    alvo.empates++;
    alvo.pontos++;
  }

  return resultado;
}

function calcularTabela(){
  const mapa = {};

  partidasFinalizadas().forEach(p=>{
    const A = nomeTime(p.timeA);
    const B = nomeTime(p.timeB);
    if(!A || !B) return;

    if(!mapa[A]) mapa[A] = baseTime(A, logoTime(p.timeA));
    if(!mapa[B]) mapa[B] = baseTime(B, logoTime(p.timeB));

    const rA = atualizarStats(p.golsA,p.golsB,mapa[A]);
    const rB = atualizarStats(p.golsB,p.golsA,mapa[B]);

    atualizarStats(p.golsA,p.golsB,mapa[A].casa);
    atualizarStats(p.golsB,p.golsA,mapa[B].fora);

    mapa[A].forma.unshift(rA);
    mapa[B].forma.unshift(rB);
    mapa[A].forma = mapa[A].forma.slice(0,5);
    mapa[B].forma = mapa[B].forma.slice(0,5);

    if(p.golsB === 0) mapa[A].cleanSheets++;
    if(p.golsA === 0) mapa[B].cleanSheets++;

    p.cartoes.forEach(c=>{
      const alvo =
        norm(c.time) === "a" || norm(c.timeNome) === norm(A) ? mapa[A] :
        norm(c.time) === "b" || norm(c.timeNome) === norm(B) ? mapa[B] : null;

      if(!alvo) return;
      if(c.tipo === "amarelo") alvo.cartoesAmarelos++;
      if(c.tipo === "vermelho") alvo.cartoesVermelhos++;
    });
  });

  return Object.values(mapa).map(t=>{
    t.saldo = t.golsPro - t.golsContra;
    t.aproveitamento = t.jogos ? Math.round((t.pontos / (t.jogos * 3)) * 100) : 0;

    ["casa","fora"].forEach(k=>{
      t[k].saldo = t[k].golsPro - t[k].golsContra;
      t[k].aproveitamento = t[k].jogos ? Math.round((t[k].pontos / (t[k].jogos * 3)) * 100) : 0;
    });

    return t;
  }).sort((a,b)=>
    b.pontos - a.pontos ||
    b.vitorias - a.vitorias ||
    b.saldo - a.saldo ||
    b.golsPro - a.golsPro
  );
}

function preencherFiltros(){
  if(!$("filtroCampeonato") || !$("filtroCategoria")) return;

  const campAtual = filtroCamp();
  const catAtual = filtroCat();
  const camps = new Map();

  [...campeonatos,...jogos,...sumulas].forEach(x=>{
    const id = x.id && x.nome ? x.id : campItem(x);
    const nome = x.nome || x.campeonato || x.campeonatoNome || id;
    if(id && nome) camps.set(id,nome);
  });

  $("filtroCampeonato").innerHTML =
    `<option value="">Todos os campeonatos</option>` +
    [...camps.entries()].map(([id,n])=>`<option value="${id}">${n}</option>`).join("");

  if([...camps.keys()].includes(campAtual)) $("filtroCampeonato").value = campAtual;

  const cats = new Set();

  [...jogos,...sumulas].forEach(x=>{
    if((!filtroCamp() || norm(campItem(x)) === norm(filtroCamp())) && x.categoria){
      cats.add(x.categoria);
    }
  });

  $("filtroCategoria").innerHTML =
    `<option value="">Todas categorias</option>` +
    [...cats].sort().map(c=>`<option value="${c}">${c}</option>`).join("");

  if([...cats].includes(catAtual)) $("filtroCategoria").value = catAtual;

  if($("filtroGrupo")){
    const grupoAtual = filtroGrupo();
    const grupos = new Set();

    jogos
      .filter(x => !filtroCamp() || norm(campItem(x)) === norm(filtroCamp()))
      .map(partidaBase)
      .forEach(p=>{
        const g = grupoPartida(p);
        if(g) grupos.add(g);
      });

    $("filtroGrupo").innerHTML =
      `<option value="">Todos os grupos</option>` +
      [...grupos].sort().map(g=>`<option value="${g}">${g}</option>`).join("");

    if([...grupos].includes(grupoAtual)) $("filtroGrupo").value = grupoAtual;
  }
}

function atualizarHero(){
  if(!$("heroTitulo")) return;

  const tabela = calcularTabela();
  const partidas = partidasFinalizadas();
  const gols = partidas.reduce((s,p)=>s + p.golsA + p.golsB,0);
  const camp = campeonatos.find(x => x.id === filtroCamp() || norm(x.nome) === norm(filtroCamp()));

  $("heroTitulo").innerText = camp?.nome || filtroCamp() || "Tabela da Competição";
  $("heroSub").innerText = `${filtroCat() ? "Categoria " + filtroCat() : "Classificação, jogos e estatísticas geradas automaticamente pelas súmulas finalizadas."}${filtroGrupo() ? " • " + filtroGrupo() : ""}`;
  $("heroTagCategoria").innerText = `Categoria: ${filtroCat() || "Todas"}`;
  $("heroTagJogos").innerText = `Jogos finalizados: ${partidas.length}`;
  $("heroTagTimes").innerText = `Times: ${tabela.length}`;
  $("heroTagGols").innerText = `Gols: ${gols}`;
  $("heroLogo").src = camp?.logo || camp?.escudo || "logo-liga.jfif";
  $("tituloTabela").innerText = `Tabela${filtroCat() ? " - " + filtroCat() : ""}${filtroGrupo() ? " - " + filtroGrupo() : ""}`;
}

function formaHTML(arr){
  return `<div class="forma">${(arr || []).map(f=>`<span class="f-${f.toLowerCase()}">${f}</span>`).join("")}</div>`;
}

function medalha(i){
  if(i === 0) return "🥇";
  if(i === 1) return "🥈";
  if(i === 2) return "🥉";
  return i + 1;
}

function rowClasse(i){
  if(i === 0) return "row top1";
  if(i === 1) return "row top2";
  if(i === 2) return "row top3";
  return "row";
}

function tabelaHTML(lista,modo="geral"){
  return `
    <div class="box-tabela" style="overflow-x:auto; -webkit-overflow-scrolling:touch; width:100%;">
      <div class="table" style="min-width:1100px;">
        <div class="row header">
          <div class="col-pos">#</div><div class="col-time">Time</div>
          <div class="col">P</div><div class="col">J</div><div class="col">V</div><div class="col">E</div><div class="col">D</div>
          <div class="col">GP</div><div class="col">GC</div><div class="col">SG</div><div class="col">%</div><div class="col-wide">Desempenho</div>
        </div>
        ${lista.map((t,i)=>{
          const x = modo === "casa" ? t.casa : modo === "fora" ? t.fora : t;
          return `
            <div class="${rowClasse(i)}">
              <div class="col-pos">${medalha(i)}</div>
              <div class="col-time">
                <div class="team">
                  <img class="escudo" src="${t.logo}" onerror="this.src='logo-liga.jfif'">
                  ${t.nome}
                </div>
              </div>
              <div class="col">${x.pontos || 0}</div>
              <div class="col">${x.jogos || 0}</div>
              <div class="col">${x.vitorias || 0}</div>
              <div class="col">${x.empates || 0}</div>
              <div class="col">${x.derrotas || 0}</div>
              <div class="col">${x.golsPro || 0}</div>
              <div class="col">${x.golsContra || 0}</div>
              <div class="col">${x.saldo || 0}</div>
              <div class="col">${x.aproveitamento || 0}%</div>
              <div class="col-wide">${modo === "geral" ? formaHTML(t.forma) : "-"}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderDetalhes(){
  const tabela = calcularTabela();
  const partidas = partidasFinalizadas();
  const gols = partidas.reduce((s,p)=>s + p.golsA + p.golsB,0);
  const amarelos = sumulasFiltradas().reduce((s,x)=>s + (x.cartoes || []).filter(c=>c.tipo === "amarelo").length,0);
  const vermelhos = sumulasFiltradas().reduce((s,x)=>s + (x.cartoes || []).filter(c=>c.tipo === "vermelho").length,0);

  $("areaTabela").innerHTML = `
    <div class="cards-resumo">
      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-ranking-star"></i></div>
        <strong>Top 3</strong>
        <div class="top3-list">
          ${tabela.slice(0,3).map((t,i)=>`<div>${i+1}º ${t.nome}</div>`).join("") || "<div>-</div>"}
        </div>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-shield-halved"></i></div>
        <strong>Times</strong>
        <span>${tabela.length}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-calendar-check"></i></div>
        <strong>Jogos</strong>
        <span>${partidas.length}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-futbol"></i></div>
        <strong>Gols</strong>
        <span>${gols}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-note-sticky"></i></div>
        <strong>Amarelos</strong>
        <span>${amarelos}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-rectangle-xmark"></i></div>
        <strong>Vermelhos</strong>
        <span>${vermelhos}</span>
      </div>
    </div>
  `;
}


function gruposDasPartidas(){
  const grupos = new Map();

  partidasFinalizadas().forEach(p=>{
    const grupo = grupoPartida(p) || "Geral";
    if(!grupos.has(grupo)) grupos.set(grupo,[]);
    grupos.get(grupo).push(p);
  });

  return [...grupos.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR"));
}

function renderClassificacaoPorGrupos(){
  const grupos = gruposDasPartidas();

  if(!grupos.length){
    $("areaTabela").innerHTML = `<div class="vazio">Nenhum jogo finalizado.</div>`;
    return true;
  }

  const temGrupoReal = grupos.length > 1 || (grupos[0] && grupos[0][0] !== "Geral");

  if(!temGrupoReal || filtroGrupo()){
    return false;
  }

  $("areaTabela").innerHTML = grupos.map(([grupo,partidas])=>{
    const tabela = calcularTabelaPorPartidas(partidas);
    return `
      <section style="margin-bottom:18px;">
        <h3 style="color:var(--gold);font-size:20px;margin:0 0 10px;font-weight:900;">${grupo}</h3>
        ${tabelaHTML(tabela,"geral")}
      </section>
    `;
  }).join("");

  return true;
}

function faseNormalizada(j){
  const f = norm(j.fase || j.rodada || j.etapa || "");
  if(f.includes("oitava")) return "Oitavas";
  if(f.includes("quarta")) return "Quartas";
  if(f.includes("semi")) return "Semifinal";
  if(f.includes("final")) return "Final";
  return "";
}

function ordemFase(f){
  const n = norm(f);
  if(n.includes("oitava")) return 1;
  if(n.includes("quarta")) return 2;
  if(n.includes("semi")) return 3;
  if(n.includes("final")) return 4;
  return 9;
}

function vencedorPartida(p){
  if(Number(p.golsA) > Number(p.golsB)) return nomeTime(p.timeA);
  if(Number(p.golsB) > Number(p.golsA)) return nomeTime(p.timeB);
  if(p.penaltisA !== undefined && p.penaltisB !== undefined){
    if(Number(p.penaltisA) > Number(p.penaltisB)) return nomeTime(p.timeA);
    if(Number(p.penaltisB) > Number(p.penaltisA)) return nomeTime(p.timeB);
  }
  return "";
}

function placarFase(p){
  if(!p.finalizado) return "x";
  let placar = `${Number(p.golsA || 0)} x ${Number(p.golsB || 0)}`;
  if(p.penaltisA !== undefined && p.penaltisB !== undefined && String(p.penaltisA) !== "" && String(p.penaltisB) !== ""){
    placar += ` <small>(${Number(p.penaltisA)} x ${Number(p.penaltisB)})</small>`;
  }
  return placar;
}

function renderFaseFinal(){
  const mataMata = jogosFiltrados()
    .map(partidaBase)
    .filter(passaFiltroGrupoPartida)
    .filter(p => faseNormalizada(p));

  if(!mataMata.length){
    $("areaTabela").innerHTML = `<div class="vazio">Nenhum jogo de fase final encontrado. Use fase/rodada como Oitavas, Quartas, Semifinal ou Final.</div>`;
    return;
  }

  const fases = new Map();
  mataMata.forEach(p=>{
    const fase = faseNormalizada(p);
    if(!fases.has(fase)) fases.set(fase,[]);
    fases.get(fase).push(p);
  });

  const htmlFases = [...fases.entries()]
    .sort((a,b)=>ordemFase(a[0])-ordemFase(b[0]))
    .map(([fase,lista])=>`
      <div class="ranking-card" style="min-width:250px;">
        <h3 style="color:var(--gold);margin-bottom:12px;text-align:center;">${fase}</h3>
        <div style="display:grid;gap:10px;">
          ${lista.sort((a,b)=>String(a.data||"").localeCompare(String(b.data||""))).map(p=>{
            const vencedor = vencedorPartida(p);
            return `
              <div style="background:rgba(8,28,54,.95);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px;">
                <div class="times-linha">
                  <div class="time-box">
                    <img class="escudo" src="${p.logoA || logoTime(p.timeA) || escudoPorNome(nomeTime(p.timeA))}" onerror="this.src='logo-liga.jfif'">
                    <span>${nomeTime(p.timeA) || "-"}</span>
                  </div>
                  <div class="placar">${placarFase(p)}</div>
                  <div class="time-box visitante">
                    <span>${nomeTime(p.timeB) || "-"}</span>
                    <img class="escudo" src="${p.logoB || logoTime(p.timeB) || escudoPorNome(nomeTime(p.timeB))}" onerror="this.src='logo-liga.jfif'">
                  </div>
                </div>
                <div class="info-item">
                  ${p.categoria || "-"} • ${p.data || "-"}<br>
                  ${vencedor ? `<strong>Vencedor:</strong> ${vencedor}` : "Aguardando resultado"}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `).join("");

  $("areaTabela").innerHTML = `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px;">
      <div style="display:flex;gap:12px;align-items:stretch;min-width:max-content;">
        ${htmlFases}
      </div>
    </div>
  `;
}

function renderClassificacao(){
  if(renderClassificacaoPorGrupos()) return;
  const lista = calcularTabela();
  $("areaTabela").innerHTML = lista.length ? tabelaHTML(lista,"geral") : `<div class="vazio">Nenhum jogo finalizado.</div>`;
}

function renderCasaFora(){
  const lista = calcularTabela();

  $("areaTabela").innerHTML = `
    <div class="sub-abas">
      <button class="sub-aba ativa" onclick="renderTabelaCasaFora('casa',this)">Casa</button>
      <button class="sub-aba" onclick="renderTabelaCasaFora('fora',this)">Fora</button>
    </div>
    <div id="subArea">${tabelaHTML([...lista].sort((a,b)=>(b.casa.pontos||0)-(a.casa.pontos||0)||(b.casa.saldo||0)-(a.casa.saldo||0)),"casa")}</div>
  `;
}

window.renderTabelaCasaFora = (modo,btn)=>{
  document.querySelectorAll(".sub-aba").forEach(b=>b.classList.remove("ativa"));
  btn.classList.add("ativa");
  const lista = calcularTabela();
  const ordenada = [...lista].sort((a,b)=>(b[modo].pontos||0)-(a[modo].pontos||0)||(b[modo].saldo||0)-(a[modo].saldo||0));
  $("subArea").innerHTML = tabelaHTML(ordenada,modo);
};

function renderJogos(){
  const lista = jogosFiltrados().map(partidaBase);

  if(!lista.length){
    $("areaTabela").innerHTML = `<div class="vazio">Nenhum jogo encontrado.</div>`;
    return;
  }

  $("areaTabela").innerHTML = `
    <div class="lista-grid">
      ${lista.map(p=>`
        <article class="card-item">
          <div class="card-top">
            <div class="card-icon"><i class="fa-solid fa-calendar-days"></i></div>
            <div class="status-tag ${p.finalizado ? "status-finalizado" : "status-agendado"}">${p.finalizado ? "Finalizado" : "Agendado"}</div>
          </div>
          <div class="times-linha">
            <div class="time-box"><img class="escudo" src="${logoTime(p.timeA)}" onerror="this.src='logo-liga.jfif'"><span>${nomeTime(p.timeA)}</span></div>
            <div class="placar">${p.finalizado ? `${p.golsA} x ${p.golsB}` : "x"}</div>
            <div class="time-box visitante"><span>${nomeTime(p.timeB)}</span><img class="escudo" src="${logoTime(p.timeB)}" onerror="this.src='logo-liga.jfif'"></div>
          </div>
          <div class="info-item"><strong>${p.campeonato || "-"}</strong><br>${p.categoria || "-"}${grupoPartida(p) ? " • " + grupoPartida(p) : ""}${p.fase ? " • " + p.fase : ""}<br>${p.data || "-"}<br>${p.local || "-"}</div>
          ${p.finalizado ? `<a class="btn-ver" href="sumula-publica.html?id=${p.id}"><i class="fa-solid fa-file-lines"></i> Ver Súmula</a>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function rankingGols(){
  const mapa = {};
  sumulasFiltradas().forEach(s=>{
    (s.gols || []).forEach(g=>{
      const nome = g.nome || g.jogador;
      if(!nome) return;
      if(!mapa[nome]) mapa[nome] = {nome,time:g.timeNome || g.time || "",valor:0};
      mapa[nome].valor++;
    });
  });
  return Object.values(mapa).sort((a,b)=>b.valor-a.valor);
}

function rankingAssist(){
  const mapa = {};
  sumulasFiltradas().forEach(s=>{
    (s.assistencias || []).forEach(a=>{
      const nome = a.nome || a.jogador;
      if(!nome) return;
      if(!mapa[nome]) mapa[nome] = {nome,time:a.timeNome || a.time || "",valor:0};
      mapa[nome].valor++;
    });
    (s.gols || []).forEach(g=>{
      const nome = g.assistencia || g.assistente;
      if(!nome) return;
      if(!mapa[nome]) mapa[nome] = {nome,time:g.timeNome || g.time || "",valor:0};
      mapa[nome].valor++;
    });
  });
  return Object.values(mapa).sort((a,b)=>b.valor-a.valor);
}

function renderRanking(lista,label){
  $("areaTabela").innerHTML = lista.length ? `
    <div class="ranking-lista ranking-3">
      ${lista.map((j,i)=>`
        <article class="ranking-card ${i === 0 ? "lider-ranking" : ""}">
          <div class="ranking-top">
            <div class="player-box">
              <div class="pos">${medalha(i)}</div>
              <img src="${fotoJogador(j.nome)}" class="photo" onerror="this.src='logo-liga.jfif'">
              <div class="player-info"><strong>${j.nome}</strong><small>${j.time || "Atleta"}</small></div>
            </div>
            <div class="numero-destaque">${j.valor}<small>${label}</small></div>
          </div>
        </article>
      `).join("")}
    </div>
  ` : `<div class="vazio">Nada registrado.</div>`;
}

function renderArtilharia(){ renderRanking(rankingGols(),"gol(s)"); }
function renderAssistencias(){ renderRanking(rankingAssist(),"assist."); }

function rankingCartoes(){
  const mapa = {};
  sumulasFiltradas().forEach(s=>{
    (s.cartoes || []).forEach(c=>{
      const nome = c.nome || c.jogador;
      if(!nome) return;
      if(!mapa[nome]) mapa[nome] = {nome,time:c.timeNome || c.time || "",amarelos:0,vermelhos:0,valor:0};
      if(c.tipo === "amarelo") mapa[nome].amarelos++;
      if(c.tipo === "vermelho") mapa[nome].vermelhos++;
      mapa[nome].valor = mapa[nome].amarelos + mapa[nome].vermelhos * 3;
    });
  });
  return Object.values(mapa).sort((a,b)=>b.valor-a.valor);
}

function renderCartoes(){
  const lista = rankingCartoes();

  $("areaTabela").innerHTML = lista.length ? `
    <div class="ranking-lista ranking-3">
      ${lista.map(j=>`
        <article class="ranking-card cartao-card">
          <div class="ranking-top">
            <div class="player-box">
              <img src="${fotoJogador(j.nome)}" class="photo" onerror="this.src='logo-liga.jfif'">
              <div class="player-info"><strong>${j.nome}</strong><small>${j.time || "Atleta"}</small></div>
            </div>
            <div class="cartao-numeros">
              <div class="cartao-num">🟨 ${j.amarelos}</div>
              <div class="cartao-num">🟥 ${j.vermelhos}</div>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  ` : `<div class="vazio">Nenhum cartão.</div>`;
}

function renderSuspensos(){
  const lista = rankingCartoes().filter(j=>j.vermelhos >= 1 || j.amarelos >= 3);

  $("areaTabela").innerHTML = lista.length ? `
    <div class="ranking-lista ranking-3">
      ${lista.map(j=>`
        <article class="ranking-card">
          <div class="ranking-top">
            <div class="player-box">
              <img src="${fotoJogador(j.nome)}" class="photo" onerror="this.src='logo-liga.jfif'">
              <div class="player-info"><strong>${j.nome}</strong><small>${j.time || "Atleta"}</small></div>
            </div>
            <div class="suspenso-badge">1 jogo</div>
          </div>
        </article>
      `).join("")}
    </div>
  ` : `<div class="vazio">Nenhum suspenso automático.</div>`;
}

function blocoTop(titulo,lista,campo,label){
  return `
    <div class="ranking-card">
      <h3 style="color:var(--gold);margin-bottom:10px">${titulo}</h3>
      ${lista.slice(0,8).map((t,i)=>`
        <div class="ranking-top" style="margin-bottom:8px">
          <div class="team"><span class="pos">${i + 1}</span><img class="escudo" src="${t.logo}" onerror="this.src='logo-liga.jfif'">${t.nome}</div>
          <strong>${t[campo] || 0} ${label}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderEstatisticasTimes(){
  const lista = calcularTabela();
  const ataque = [...lista].sort((a,b)=>b.golsPro-a.golsPro);
  const defesa = [...lista].sort((a,b)=>a.golsContra-b.golsContra);
  const clean = [...lista].sort((a,b)=>b.cleanSheets-a.cleanSheets);
  const disciplina = [...lista].sort((a,b)=>(a.cartoesAmarelos+a.cartoesVermelhos*3)-(b.cartoesAmarelos+b.cartoesVermelhos*3));

  $("areaTabela").innerHTML = `
    <div class="duplo">
      <div>${blocoTop("Melhor ataque",ataque,"golsPro","gols")}</div>
      <div>${blocoTop("Melhor defesa",defesa,"golsContra","sofridos")}</div>
      <div>${blocoTop("Clean sheets",clean,"cleanSheets","jogos")}</div>
      <div>${blocoTop("Mais disciplinado",disciplina,"cartoesAmarelos","amarelos")}</div>
    </div>
  `;
}

function renderHistorico(){
  const temporadas = {};

  partidasFinalizadas().forEach(p=>{
    const temp = p.temporada || "Temporada atual";
    if(!temporadas[temp]) temporadas[temp] = {jogos:0,gols:0};
    temporadas[temp].jogos++;
    temporadas[temp].gols += p.golsA + p.golsB;
  });

  $("areaTabela").innerHTML = `
    <div class="lista-grid">
      ${historico.filter(passaFiltro).map(h=>`
        <div class="ranking-card">
          <h3 style="color:var(--gold)">${h.temporada || h.ano || "-"}</h3>
          <p>Campeão: <strong>${h.campeao || "-"}</strong></p>
          <p>Vice: <strong>${h.vice || "-"}</strong></p>
        </div>
      `).join("")}
      ${Object.entries(temporadas).map(([t,v])=>`
        <div class="ranking-card">
          <h3 style="color:var(--gold)">${t}</h3>
          <p>${v.jogos} jogos finalizados</p>
          <p>${v.gols} gols</p>
        </div>
      `).join("")}
    </div>
  `;
}


function agruparOficial(){
  const grupos = new Map();

  todasPartidasFinalizadas().forEach(p=>{
    const key = `${p.campeonatoId || p.campeonato || "geral"}__${p.categoria || "geral"}__${grupoPartida(p) || "geral"}`;

    if(!grupos.has(key)){
      grupos.set(key,{
        campeonatoId:p.campeonatoId || "",
        campeonato:p.campeonato || "",
        categoria:p.categoria || "",
        grupo:grupoPartida(p) || "",
        partidas:[]
      });
    }

    grupos.get(key).partidas.push(p);
  });

  return [...grupos.values()];
}

function calcularTabelaPorPartidas(partidas){
  const mapa = {};

  partidas.forEach(p=>{
    const A = nomeTime(p.timeA);
    const B = nomeTime(p.timeB);
    if(!A || !B) return;

    if(!mapa[A]) mapa[A] = baseTime(A, logoTime(p.timeA));
    if(!mapa[B]) mapa[B] = baseTime(B, logoTime(p.timeB));

    const rA = atualizarStats(p.golsA,p.golsB,mapa[A]);
    const rB = atualizarStats(p.golsB,p.golsA,mapa[B]);

    atualizarStats(p.golsA,p.golsB,mapa[A].casa);
    atualizarStats(p.golsB,p.golsA,mapa[B].fora);

    mapa[A].forma.unshift(rA);
    mapa[B].forma.unshift(rB);
    mapa[A].forma = mapa[A].forma.slice(0,5);
    mapa[B].forma = mapa[B].forma.slice(0,5);

    if(p.golsB === 0) mapa[A].cleanSheets++;
    if(p.golsA === 0) mapa[B].cleanSheets++;

    p.cartoes.forEach(c=>{
      const alvo =
        norm(c.time) === "a" || norm(c.timeNome) === norm(A) ? mapa[A] :
        norm(c.time) === "b" || norm(c.timeNome) === norm(B) ? mapa[B] : null;

      if(!alvo) return;
      if(c.tipo === "amarelo") alvo.cartoesAmarelos++;
      if(c.tipo === "vermelho") alvo.cartoesVermelhos++;
    });
  });

  return Object.values(mapa).map(t=>{
    t.saldo = t.golsPro - t.golsContra;
    t.aproveitamento = t.jogos ? Math.round((t.pontos / (t.jogos * 3)) * 100) : 0;

    ["casa","fora"].forEach(k=>{
      t[k].saldo = t[k].golsPro - t[k].golsContra;
      t[k].aproveitamento = t[k].jogos ? Math.round((t[k].pontos / (t[k].jogos * 3)) * 100) : 0;
    });

    return t;
  }).sort((a,b)=>
    b.pontos - a.pontos ||
    b.vitorias - a.vitorias ||
    b.saldo - a.saldo ||
    b.golsPro - a.golsPro
  );
}

function sumulasDoGrupo(grupo){
  return sumulas
    .filter(s => sumulaFinalizada(s))
    .filter(s=>{
      const camp = s.campeonatoId || s.campeonato || s.campeonatoNome || "";
      const cat = s.categoria || "";

      const mesmoCamp =
        !grupo.campeonatoId ||
        norm(camp) === norm(grupo.campeonatoId) ||
        norm(camp) === norm(grupo.campeonato);

      const mesmaCat =
        !grupo.categoria ||
        norm(cat) === norm(grupo.categoria);

      return mesmoCamp && mesmaCat;
    });
}

function rankingGolsOficial(listaSumulas){
  const mapa = {};
  listaSumulas.forEach(s=>{
    (s.gols || []).forEach(g=>{
      const nome = g.nome || g.jogador || g.jogadorNome || g.nomeJogador;
      if(!nome) return;
      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time:g.timeNome || g.time || "",
          valor:0
        };
      }
      mapa[nome].valor += Number(g.quantidade || g.qtd || g.gols || 1);
    });
  });
  return Object.values(mapa).sort((a,b)=>b.valor-a.valor);
}

function rankingAssistOficial(listaSumulas){
  const mapa = {};

  listaSumulas.forEach(s=>{
    (s.assistencias || []).forEach(a=>{
      const nome = a.nome || a.jogador || a.jogadorNome || a.nomeJogador;
      if(!nome) return;
      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time:a.timeNome || a.time || "",
          valor:0
        };
      }
      mapa[nome].valor += Number(a.quantidade || a.qtd || a.assistencias || 1);
    });

    (s.gols || []).forEach(g=>{
      const nome = g.assistencia || g.assistente || g.assistenciaNome || g.nomeAssistente;
      if(!nome) return;
      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time:g.timeNome || g.time || "",
          valor:0
        };
      }
      mapa[nome].valor++;
    });
  });

  return Object.values(mapa).sort((a,b)=>b.valor-a.valor);
}

function rankingCartoesOficial(listaSumulas){
  const mapa = {};

  listaSumulas.forEach(s=>{
    (s.cartoes || []).forEach(c=>{
      const nome = c.nome || c.jogador || c.jogadorNome || c.nomeJogador;
      if(!nome) return;
      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time:c.timeNome || c.time || "",
          amarelos:0,
          vermelhos:0,
          valor:0
        };
      }

      if(c.tipo === "amarelo") mapa[nome].amarelos++;
      if(c.tipo === "vermelho") mapa[nome].vermelhos++;

      mapa[nome].valor = mapa[nome].amarelos + mapa[nome].vermelhos * 3;
    });
  });

  return Object.values(mapa).sort((a,b)=>b.valor-a.valor);
}

function suspensosOficial(listaSumulas){
  return rankingCartoesOficial(listaSumulas)
    .filter(j=>j.vermelhos >= 1 || j.amarelos >= 3)
    .map(j=>({
      ...j,
      jogosSuspensao:1,
      motivo:j.vermelhos >= 1 ? "Cartão vermelho" : "3 cartões amarelos"
    }));
}

function resumoOficialDoGrupo(grupo){
  const tabela = calcularTabelaPorPartidas(grupo.partidas);
  const listaSumulas = sumulasDoGrupo(grupo);

  const artilharia = rankingGolsOficial(listaSumulas);
  const assistencias = rankingAssistOficial(listaSumulas);
  const cartoes = rankingCartoesOficial(listaSumulas);
  const suspensos = suspensosOficial(listaSumulas);

  const gols = grupo.partidas.reduce((total,p)=>total + p.golsA + p.golsB,0);
  const lider = tabela[0] || null;
  const vice = tabela[1] || null;

  return {
    chave:`${slug(grupo.campeonatoId || grupo.campeonato)}-${slug(grupo.categoria || "geral")}`,
    campeonatoId:grupo.campeonatoId || "",
    campeonato:grupo.campeonato || "",
    categoria:grupo.categoria || "",
    grupo:grupo.grupo || "",
    jogosFinalizados:grupo.partidas.length,
    gols,
    times:tabela.length,

    lider:lider?.nome || "",
    vice:vice?.nome || "",

    artilheiro:artilharia[0]?.nome || "",
    golsArtilheiro:artilharia[0]?.valor || 0,

    assistente:assistencias[0]?.nome || "",
    assistenciasLider:assistencias[0]?.valor || 0,

    maisCartoes:cartoes[0]?.nome || "",
    suspensos:suspensos.length,

    tabela:tabela.map((t,i)=>({
      posicao:i+1,
      nome:t.nome,
      logo:t.logo,
      pontos:t.pontos,
      jogos:t.jogos,
      vitorias:t.vitorias,
      empates:t.empates,
      derrotas:t.derrotas,
      golsPro:t.golsPro,
      golsContra:t.golsContra,
      saldo:t.saldo,
      aproveitamento:t.aproveitamento,
      forma:t.forma,
      casa:t.casa,
      fora:t.fora,
      cleanSheets:t.cleanSheets,
      cartoesAmarelos:t.cartoesAmarelos,
      cartoesVermelhos:t.cartoesVermelhos
    })),

    artilharia:artilharia.map((x,i)=>({...x,posicao:i+1})),
    assistencias:assistencias.map((x,i)=>({...x,posicao:i+1})),
    cartoes:cartoes.map((x,i)=>({...x,posicao:i+1})),
    suspensosLista:suspensos.map((x,i)=>({...x,posicao:i+1})),

    partidas:grupo.partidas.map(p=>({
      jogoId:p.id,
      campeonatoId:p.campeonatoId,
      campeonato:p.campeonato,
      categoria:p.categoria,
      rodada:p.rodada,
      data:p.data || "",
      local:p.local,
      timeA:nomeTime(p.timeA),
      timeB:nomeTime(p.timeB),
      golsA:p.golsA,
      golsB:p.golsB,
      placar:`${p.golsA} x ${p.golsB}`
    }))
  };
}

async function salvarOficialFirestore(){
  if(salvandoOficial) return;

  const grupos = agruparOficial();
  if(!grupos.length) return;

  salvandoOficial = true;

  try{
    await setDoc(doc(db,"classificacao_oficial","resumo"),{
      atualizadoEm:serverTimestamp(),
      origem:"tabela.js",
      totalGrupos:grupos.length,
      totalJogos:todasPartidasFinalizadas().length
    },{merge:true});

    for(const grupo of grupos){
      const oficial = resumoOficialDoGrupo(grupo);

      await setDoc(doc(db,"classificacao_oficial",oficial.chave),{
        ...oficial,
        atualizadoEm:serverTimestamp()
      },{merge:true});

      await setDoc(doc(db,"historico_auto",oficial.chave),{
        campeonatoId:oficial.campeonatoId,
        campeonato:oficial.campeonato,
        categoria:oficial.categoria,
        grupo:oficial.grupo || "",
        jogosFinalizados:oficial.jogosFinalizados,
        gols:oficial.gols,
        campeao:oficial.lider,
        vice:oficial.vice,
        artilheiro:oficial.artilheiro,
        golsArtilheiro:oficial.golsArtilheiro,
        assistente:oficial.assistente,
        assistenciasLider:oficial.assistenciasLider,
        suspensos:oficial.suspensos,
        atualizadoEm:serverTimestamp()
      },{merge:true});

      for(const time of oficial.tabela){
        await setDoc(doc(db,"classificacao",`${oficial.chave}-${slug(time.nome)}`),{
          ...time,
          campeonatoId:oficial.campeonatoId,
          campeonato:oficial.campeonato,
          categoria:oficial.categoria,
          grupo:oficial.grupo || "",
          chaveTabela:oficial.chave,
          atualizadoAutomaticamente:true,
          atualizadoEm:serverTimestamp()
        },{merge:true});
      }

      for(const item of oficial.artilharia){
        await setDoc(doc(db,"artilharia_oficial",`${oficial.chave}-${slug(item.nome)}`),{
          ...item,
          campeonatoId:oficial.campeonatoId,
          campeonato:oficial.campeonato,
          categoria:oficial.categoria,
          atualizadoEm:serverTimestamp()
        },{merge:true});
      }

      for(const item of oficial.assistencias){
        await setDoc(doc(db,"assistencias_oficial",`${oficial.chave}-${slug(item.nome)}`),{
          ...item,
          campeonatoId:oficial.campeonatoId,
          campeonato:oficial.campeonato,
          categoria:oficial.categoria,
          atualizadoEm:serverTimestamp()
        },{merge:true});
      }

      for(const item of oficial.cartoes){
        await setDoc(doc(db,"cartoes_oficial",`${oficial.chave}-${slug(item.nome)}`),{
          ...item,
          campeonatoId:oficial.campeonatoId,
          campeonato:oficial.campeonato,
          categoria:oficial.categoria,
          atualizadoEm:serverTimestamp()
        },{merge:true});
      }

      for(const item of oficial.suspensosLista){
        await setDoc(doc(db,"suspensos_oficial",`${oficial.chave}-${slug(item.nome)}`),{
          ...item,
          campeonatoId:oficial.campeonatoId,
          campeonato:oficial.campeonato,
          categoria:oficial.categoria,
          atualizadoEm:serverTimestamp()
        },{merge:true});
      }
    }

  }catch(e){
    console.warn("Tabela calculada, mas não foi possível salvar a classificação oficial no Firestore.",e);
  }finally{
    salvandoOficial = false;
  }
}

function agendarSalvarOficial(){
  clearTimeout(timerSalvarOficial);

  timerSalvarOficial = setTimeout(()=>{
    salvarOficialFirestore();
  },1200);
}


window.trocarAba = (nome,btn)=>{
  abaAtual = nome;
  document.querySelectorAll(".aba").forEach(b=>b.classList.remove("ativa"));
  btn.classList.add("ativa");
  atualizarTela();
};

function atualizarTela(){
  if(!$("areaTabela")) return;

  atualizarHero();

  if(abaAtual === "detalhes") renderDetalhes();
  if(abaAtual === "classificacao") renderClassificacao();
  if(abaAtual === "casaFora") renderCasaFora();
  if(abaAtual === "jogos") renderJogos();
  if(abaAtual === "faseFinal") renderFaseFinal();
  if(abaAtual === "estatisticasTimes") renderEstatisticasTimes();
  if(abaAtual === "artilharia") renderArtilharia();
  if(abaAtual === "assistencias") renderAssistencias();
  if(abaAtual === "cartoes") renderCartoes();
  if(abaAtual === "suspensos") renderSuspensos();
  if(abaAtual === "historico") renderHistorico();

  agendarSalvarOficial();
}

if($("filtroCampeonato")){
  $("filtroCampeonato").addEventListener("change",()=>{
    preencherFiltros();
    atualizarTela();
  });
}

if($("filtroCategoria")){
  $("filtroCategoria").addEventListener("change",atualizarTela);
}

if($("filtroGrupo")){
  $("filtroGrupo").addEventListener("change",atualizarTela);
}

function ouvir(nome,setter,refreshFiltro=false){
  onSnapshot(collection(db,nome),snap=>{
    setter(snap.docs.map(d=>({id:d.id,...d.data()})));
    if(refreshFiltro) preencherFiltros();
    atualizarTela();
  });
}

ouvir("jogos",v=>jogos=v,true);
ouvir("sumulas",v=>sumulas=v,true);
ouvir("jogadores",v=>jogadores=v);
ouvir("times",v=>times=v);
ouvir("campeonatos",v=>campeonatos=v,true);
ouvir("historico",v=>historico=v);
