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

function sumulaFinalizada(s){
  return !!s && (
    s.sumulaFinalizada === true ||
    s.publica === true ||
    s.publico === true ||
    norm(s.status) === "finalizado"
  );
}

function getSumula(id){
  return sumulas.find(s => s.id === id || s.jogoId === id);
}

function finalizado(j){
  const s = getSumula(j.id);
  return (
    j.sumulaFinalizada === true ||
    norm(j.status) === "finalizado" ||
    sumulaFinalizada(s)
  );
}

function partidasFinalizadas(){
  return jogos.filter(finalizado);
}

function rankingGols(){
  const mapa = {};

  sumulas
    .filter(sumulaFinalizada)
    .forEach(s => {
      (s.gols || []).forEach(g => {

        const nome = g.nome || g.jogador;
        if(!nome) return;

        if(!mapa[nome]){
          mapa[nome] = {
            nome,
            time: g.timeNome || g.time || "",
            gols: 0
          };
        }

        mapa[nome].gols++;
      });
    });

  return Object.values(mapa)
    .sort((a,b)=>b.gols-a.gols);
}

function rankingAssistencias(){
  const mapa = {};

  sumulas
    .filter(sumulaFinalizada)
    .forEach(s => {

      (s.assistencias || []).forEach(a => {

        const nome = a.nome || a.jogador;
        if(!nome) return;

        if(!mapa[nome]){
          mapa[nome] = {
            nome,
            time: a.timeNome || a.time || "",
            assistencias: 0
          };
        }

        mapa[nome].assistencias++;
      });

    });

  return Object.values(mapa)
    .sort((a,b)=>b.assistencias-a.assistencias);
}

function rankingCartoes(){
  const mapa = {};

  sumulas
    .filter(sumulaFinalizada)
    .forEach(s => {

      (s.cartoes || []).forEach(c => {

        const nome = c.nome || c.jogador;
        if(!nome) return;

        if(!mapa[nome]){
          mapa[nome] = {
            nome,
            time: c.timeNome || c.time || "",
            amarelos: 0,
            vermelhos: 0
          };
        }

        if(c.tipo === "amarelo"){
          mapa[nome].amarelos++;
        }

        if(c.tipo === "vermelho"){
          mapa[nome].vermelhos++;
        }

      });

    });

  return Object.values(mapa)
    .sort((a,b)=>
      (b.amarelos + b.vermelhos)
      -
      (a.amarelos + a.vermelhos)
    );
}

function renderArtilharia(){

  const lista = rankingGols();

  $("areaTabela").innerHTML = `
    <div class="ranking-lista ranking-3">
      ${lista.map((j,i)=>`
        <article class="ranking-card">
          <div class="ranking-top">
            <div class="player-box">
              <div class="pos">${i+1}</div>
              <div class="player-info">
                <strong>${j.nome}</strong>
                <small>${j.time}</small>
              </div>
            </div>

            <div class="numero-destaque">
              ${j.gols}
              <small>gols</small>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderAssistencias(){

  const lista = rankingAssistencias();

  $("areaTabela").innerHTML = `
    <div class="ranking-lista ranking-3">
      ${lista.map((j,i)=>`
        <article class="ranking-card">
          <div class="ranking-top">
            <div class="player-box">
              <div class="pos">${i+1}</div>
              <div class="player-info">
                <strong>${j.nome}</strong>
                <small>${j.time}</small>
              </div>
            </div>

            <div class="numero-destaque">
              ${j.assistencias}
              <small>assist.</small>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCartoes(){

  const lista = rankingCartoes();

  $("areaTabela").innerHTML = `
    <div class="ranking-lista ranking-3">
      ${lista.map(j=>`
        <article class="ranking-card cartao-card">
          <div class="ranking-top">
            <div class="player-box">
              <div class="player-info">
                <strong>${j.nome}</strong>
                <small>${j.time}</small>
              </div>
            </div>

            <div class="cartao-numeros">
              <div class="cartao-num">🟨 ${j.amarelos}</div>
              <div class="cartao-num">🟥 ${j.vermelhos}</div>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

window.trocarAba = (nome,btn)=>{

  abaAtual = nome;

  document.querySelectorAll(".aba")
    .forEach(b=>b.classList.remove("ativa"));

  btn.classList.add("ativa");

  atualizarTela();
};

function atualizarTela(){

  if(abaAtual === "artilharia"){
    renderArtilharia();
  }

  if(abaAtual === "assistencias"){
    renderAssistencias();
  }

  if(abaAtual === "cartoes"){
    renderCartoes();
  }
}

onSnapshot(collection(db,"jogos"),snap=>{
  jogos = snap.docs.map(d=>({id:d.id,...d.data()}));
});

onSnapshot(collection(db,"sumulas"),snap=>{
  sumulas = snap.docs.map(d=>({id:d.id,...d.data()}));
});

onSnapshot(collection(db,"jogadores"),snap=>{
  jogadores = snap.docs.map(d=>({id:d.id,...d.data()}));
});

onSnapshot(collection(db,"times"),snap=>{
  times = snap.docs.map(d=>({id:d.id,...d.data()}));
});

onSnapshot(collection(db,"campeonatos"),snap=>{
  campeonatos = snap.docs.map(d=>({id:d.id,...d.data()}));
});
