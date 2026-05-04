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

// ===================== MOBILE SCROLL NATURAL =====================
function ativarScrollTabela(){
  const box = document.querySelector(".box-tabela");
  if(!box) return;

  let startX, scrollLeft, isDown=false;

  box.addEventListener("touchstart", e=>{
    isDown = true;
    startX = e.touches[0].pageX - box.offsetLeft;
    scrollLeft = box.scrollLeft;
  });

  box.addEventListener("touchmove", e=>{
    if(!isDown) return;
    const x = e.touches[0].pageX - box.offsetLeft;
    const walk = (x - startX) * 1.2;
    box.scrollLeft = scrollLeft - walk;
  });

  box.addEventListener("touchend", ()=> isDown=false);
}

// ===================== HELPERS =====================

const nomeTime = t => typeof t === "object" ? (t?.nome || "") : (t || "");
const logoTime = t => typeof t === "object" ? (t?.logo || t?.escudo || "logo-liga.jfif") : "logo-liga.jfif";
const dataValor = v => v?.toDate ? v.toDate() : new Date(v || 0);

function getSumula(id){
  return sumulas.find(s => s.id === id || s.jogoId === id) || null;
}

function finalizado(j){
  const s = getSumula(j.id);
  return j.sumulaFinalizada || norm(j.status)==="finalizado" || s?.sumulaFinalizada;
}

// ===================== TABELA =====================

function calcularTabela(){
  const mapa = {};

  jogos.filter(finalizado).forEach(j=>{
    const s = getSumula(j.id) || j;

    const A = nomeTime(s.timeA);
    const B = nomeTime(s.timeB);

    if(!mapa[A]) mapa[A] = base(A,s.timeA);
    if(!mapa[B]) mapa[B] = base(B,s.timeB);

    const gA = Number(s.golsA || 0);
    const gB = Number(s.golsB || 0);

    atualizar(mapa[A],gA,gB);
    atualizar(mapa[B],gB,gA);
  });

  return Object.values(mapa).sort((a,b)=> b.pontos-a.pontos || b.saldo-a.saldo);
}

function base(nome,obj){
  return {
    nome,
    logo: logoTime(obj),
    pontos:0,jogos:0,vitorias:0,empates:0,derrotas:0,golsPro:0,golsContra:0,saldo:0,
    forma:[]
  };
}

function atualizar(t,gp,gc){
  t.jogos++;
  t.golsPro+=gp;
  t.golsContra+=gc;
  t.saldo=t.golsPro-t.golsContra;

  if(gp>gc){t.vitorias++;t.pontos+=3;t.forma.unshift("V")}
  else if(gp<gc){t.derrotas++;t.forma.unshift("D")}
  else{t.empates++;t.pontos++;t.forma.unshift("E")}

  t.forma=t.forma.slice(0,5);
}

// ===================== CLASSIFICAÇÃO =====================

function tabelaHTML(lista){
  return `
  <div class="box-tabela">
    <div class="table">
      <div class="row header">
        <div class="col-pos">#</div>
        <div class="col-time">Time</div>
        <div class="col">P</div>
        <div class="col">J</div>
        <div class="col">V</div>
        <div class="col">E</div>
        <div class="col">D</div>
        <div class="col">GP</div>
        <div class="col">GC</div>
        <div class="col">SG</div>
        <div class="col-wide">Desempenho</div>
      </div>

      ${lista.map((t,i)=>`
        <div class="row ${i<3 ? "top"+(i+1) : ""}">
          <div class="col-pos">${i+1}</div>
          <div class="col-time">
            <div class="team">
              <img class="escudo" src="${t.logo}">
              ${t.nome}
            </div>
          </div>
          <div class="col">${t.pontos}</div>
          <div class="col">${t.jogos}</div>
          <div class="col">${t.vitorias}</div>
          <div class="col">${t.empates}</div>
          <div class="col">${t.derrotas}</div>
          <div class="col">${t.golsPro}</div>
          <div class="col">${t.golsContra}</div>
          <div class="col">${t.saldo}</div>
          <div class="col-wide">${forma(t.forma)}</div>
        </div>
      `).join("")}
    </div>
  </div>`;
}

function forma(arr){
  return `<div class="forma">${arr.map(f=>`
    <span class="f-${f.toLowerCase()}">${f}</span>
  `).join("")}</div>`;
}

// ===================== RANKINGS 3 POR LINHA =====================

function grid3(lista, render){
  return `<div class="ranking-lista" style="grid-template-columns:repeat(3,1fr)">
    ${lista.map(render).join("")}
  </div>`;
}

// ===================== ARTILHARIA =====================

function renderArtilharia(){
  const mapa = {};

  sumulas.forEach(s=>{
    (s.gols||[]).forEach(g=>{
      if(!mapa[g.nome]) mapa[g.nome]={nome:g.nome,valor:0,time:g.time};
      mapa[g.nome].valor++;
    });
  });

  const lista = Object.values(mapa).sort((a,b)=>b.valor-a.valor);

  $("areaTabela").innerHTML = grid3(lista,j=>`
    <div class="ranking-card">
      <div class="player-box">
        <img src="logo-liga.jfif" class="photo">
        <div><strong>${j.nome}</strong><small>${j.time}</small></div>
      </div>
      <div class="numero-destaque">${j.valor}</div>
    </div>
  `);
}

// ===================== CARTÕES BONITO =====================

function renderCartoes(){
  const mapa = {};

  sumulas.forEach(s=>{
    (s.cartoes||[]).forEach(c=>{
      if(!mapa[c.nome]) mapa[c.nome]={nome:c.nome,a:0,v:0};
      if(c.tipo==="amarelo") mapa[c.nome].a++;
      if(c.tipo==="vermelho") mapa[c.nome].v++;
    });
  });

  const lista = Object.values(mapa);

  $("areaTabela").innerHTML = grid3(lista,j=>`
    <div class="ranking-card">
      <strong>${j.nome}</strong>
      <div style="display:flex;justify-content:center;gap:10px;margin-top:8px">
        <span style="background:#7a5a00;padding:6px 10px;border-radius:8px">🟨 ${j.a}</span>
        <span style="background:#b42323;padding:6px 10px;border-radius:8px">🟥 ${j.v}</span>
      </div>
    </div>
  `);
}

// ===================== SUSPENSOS =====================

function renderSuspensos(){
  const lista = [];

  sumulas.forEach(s=>{
    (s.cartoes||[]).forEach(c=>{
      if(c.tipo==="vermelho"){
        lista.push(c);
      }
    });
  });

  $("areaTabela").innerHTML = grid3(lista,j=>`
    <div class="ranking-card">
      <strong>${j.nome}</strong>
      <small>Suspenso</small>
    </div>
  `);
}

// ===================== DETALHES =====================

function renderDetalhes(){
  const tabela = calcularTabela();

  $("areaTabela").innerHTML = `
  <div class="cards-resumo">
    <div class="card-resumo"><i class="fa-solid fa-trophy"></i><span>${tabela[0]?.nome||"-"}</span></div>
    <div class="card-resumo"><i class="fa-solid fa-futbol"></i><span>${tabela.length}</span></div>
  </div>`;
}

// ===================== ABA =====================

window.trocarAba = (nome,btn)=>{
  abaAtual = nome;
  document.querySelectorAll(".aba").forEach(b=>b.classList.remove("ativa"));
  btn.classList.add("ativa");
  atualizarTela();
};

function atualizarTela(){
  if(abaAtual==="detalhes") renderDetalhes();
  if(abaAtual==="classificacao"){
    $("areaTabela").innerHTML = tabelaHTML(calcularTabela());
    setTimeout(ativarScrollTabela,200);
  }
  if(abaAtual==="artilharia") renderArtilharia();
  if(abaAtual==="cartoes") renderCartoes();
  if(abaAtual==="suspensos") renderSuspensos();
}

// ===================== FIREBASE =====================

onSnapshot(collection(db,"jogos"),snap=>{
  jogos = snap.docs.map(d=>({id:d.id,...d.data()}));
  atualizarTela();
});

onSnapshot(collection(db,"sumulas"),snap=>{
  sumulas = snap.docs.map(d=>({id:d.id,...d.data()}));
  atualizarTela();
});
