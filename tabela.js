import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

let jogos = [];
let sumulas = [];
let jogadores = [];
let times = [];
let campeonatos = [];
let historico = [];
let abaAtual = "detalhes";

const $ = id => document.getElementById(id);

const norm = txt =>
  String(txt || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const nomeTime = t => typeof t === "object" ? (t?.nome || t?.nomeTime || "") : (t || "");
const logoTime = t => typeof t === "object" ? (t?.logo || t?.escudo || "logo-liga.jfif") : "logo-liga.jfif";
const dataValor = v => v?.toDate ? v.toDate() : new Date(v || 0);

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
  return j.sumulaFinalizada === true || norm(j.status) === "finalizado" || sumulaFinalizada(s);
}

function campItem(x){
  return x.campeonatoId || x.campeonato || x.campeonatoNome || "";
}

function catItem(x){
  return x.categoria || "";
}

function filtroCamp(){ return $("filtroCampeonato").value; }
function filtroCat(){ return $("filtroCategoria").value; }

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
    golsA: Number(s.placar?.A ?? s.golsA ?? j.golsA ?? 0),
    golsB: Number(s.placar?.B ?? s.golsB ?? j.golsB ?? 0),
    gols: s.gols || j.gols || [],
    cartoes: s.cartoes || j.cartoes || [],
    assistencias: s.assistencias || j.assistencias || [],
    finalizado: finalizado(j)
  };
}

function partidasFinalizadas(){
  return jogosFiltrados()
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

/* ===================== SCROLL LATERAL MOBILE ===================== */
function ativarScrollTabela(){
  const box = document.querySelector(".box-tabela");
  if(!box) return;

  let isDown = false;
  let startX;
  let scrollLeft;

  box.addEventListener("touchstart", (e)=>{
    isDown = true;
    startX = e.touches[0].pageX - box.offsetLeft;
    scrollLeft = box.scrollLeft;
  });

  box.addEventListener("touchmove", (e)=>{
    if(!isDown) return;
    const x = e.touches[0].pageX - box.offsetLeft;
    const walk = (x - startX) * 1.3;
    box.scrollLeft = scrollLeft - walk;
  });

  box.addEventListener("touchend", ()=>{
    isDown = false;
  });
}

/* ===================== RENDER ===================== */

function renderClassificacao(){
  const lista = calcularTabela();
  $("areaTabela").innerHTML = lista.length ? tabelaHTML(lista,"geral") : `<div class="vazio">Nenhum jogo finalizado.</div>`;
  setTimeout(ativarScrollTabela,100);
}

function renderCasaFora(){
  const lista = calcularTabela();

  $("areaTabela").innerHTML = `
    <div class="sub-abas">
      <button class="sub-aba ativa" onclick="renderTabelaCasaFora('casa',this)">Casa</button>
      <button class="sub-aba" onclick="renderTabelaCasaFora('fora',this)">Fora</button>
    </div>
    <div id="subArea">${tabelaHTML(lista,"casa")}</div>
  `;
  setTimeout(ativarScrollTabela,100);
}

window.renderTabelaCasaFora = (modo,btn)=>{
  document.querySelectorAll(".sub-aba").forEach(b=>b.classList.remove("ativa"));
  btn.classList.add("ativa");
  const lista = calcularTabela();
  $("subArea").innerHTML = tabelaHTML(lista,modo);
  setTimeout(ativarScrollTabela,100);
};
