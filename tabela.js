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

function dataISO(v){
  const d = dataValor(v);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function numero(v){
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

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
  const j = jogadores.find(x => norm(x.nome) === norm(nome) || norm(x.nomeCompleto) === norm(nome));
  return j?.foto || j?.fotoPerfil || j?.imagem || j?.avatar || "logo-liga.jfif";
}

function jogadorPorNome(nome){
  return jogadores.find(x => norm(x.nome) === norm(nome) || norm(x.nomeCompleto) === norm(nome)) || null;
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
    timeAId: s.timeAId || j.timeAId || j.mandanteId || j.timeMandanteId || s.mandanteId || "",
    timeBId: s.timeBId || j.timeBId || j.visitanteId || j.timeVisitanteId || s.visitanteId || "",
    golsA: Number(s.placar?.A ?? s.placar?.timeA ?? s.golsA ?? j.golsA ?? 0),
    golsB: Number(s.placar?.B ?? s.placar?.timeB ?? s.golsB ?? j.golsB ?? 0),
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

function todasPartidasFinalizadas(){
  return jogos
    .filter(finalizado)
    .map(partidaBase)
    .sort((a,b) => dataValor(a.data) - dataValor(b.data));
}

function baseTime(nome, logo, id=""){
  return {
    id,
    nome,
    logo: logo || escudoPorNome(nome),
    pontos:0,
    jogos:0,
    vitorias:0,
    empates:0,
    derrotas:0,
    golsPro:0,
    golsContra:0,
    saldo:0,
    aproveitamento:0,
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

function aplicarCartoesTime(p,mapa,A,B){
  p.cartoes.forEach(c=>{
    const alvo =
      norm(c.time) === "a" || norm(c.timeNome) === norm(A) || norm(c.equipe) === norm(A) ? mapa[A] :
      norm(c.time) === "b" || norm(c.timeNome) === norm(B) || norm(c.equipe) === norm(B) ? mapa[B] : null;

    if(!alvo) return;

    const tipo = norm(c.tipo || c.cartao || c.cor);
    if(tipo.includes("amarelo")) alvo.cartoesAmarelos++;
    if(tipo.includes("vermelho")) alvo.cartoesVermelhos++;
  });
}

function calcularTabela(partidas = partidasFinalizadas()){
  const mapa = {};

  partidas.forEach(p=>{
    const A = nomeTime(p.timeA);
    const B = nomeTime(p.timeB);
    if(!A || !B) return;

    if(!mapa[A]) mapa[A] = baseTime(A, logoTime(p.timeA), p.timeAId);
    if(!mapa[B]) mapa[B] = baseTime(B, logoTime(p.timeB), p.timeBId);

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

    aplicarCartoesTime(p,mapa,A,B);
  });

  return Object.values(mapa).map(t=>{
    t.saldo = t.golsPro - t.golsContra;
    t.aproveitamento = t.jogos ? Math.round((t.pontos / (t.jogos * 3)) * 100) : 0
