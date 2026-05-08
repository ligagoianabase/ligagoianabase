import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {

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

const nomeTime = t => typeof t === "object"
  ? (t?.nome || t?.nomeTime || "")
  : (t || "");

const logoTime = t => typeof t === "object"
  ? (t?.logo || t?.escudo || "logo-liga.jfif")
  : "logo-liga.jfif";

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

  return (
    j?.sumulaFinalizada === true ||
    norm(j?.status) === "finalizado" ||
    sumulaFinalizada(s)
  );
}

function campItem(x){
  return x?.campeonatoId || x?.campeonato || x?.campeonatoNome || "";
}

function catItem(x){
  return x?.categoria || "";
}

function filtroCamp(){
  return $("filtroCampeonato")?.value || "";
}

function filtroCat(){
  return $("filtroCategoria")?.value || "";
}

function passaFiltro(x){
  if(filtroCamp() && norm(campItem(x)) !== norm(filtroCamp())) return false;
  if(filtroCat() && norm(catItem(x)) !== norm(filtroCat())) return false;
  return true;
}

function jogosFiltrados(){
  return jogos.filter(passaFiltro);
}

function sumulasFiltradas(){
  return sumulas
    .filter(s => sumulaFinalizada(s))
    .filter(passaFiltro);
}

function escudoPorNome(nome){
  const t = times.find(x =>
    norm(x.nome) === norm(nome) ||
    norm(x.timeNome) === norm(nome)
  );

  return t?.logo || t?.escudo || "logo-liga.jfif";
}

function fotoJogador(nome){
  const j = jogadores.find(x => norm(x.nome) === norm(nome));

  return (
    j?.foto ||
    j?.imagem ||
    j?.avatar ||
    "logo-liga.jfif"
  );
}

function partidaBase(j){
  const s = getSumula(j.id) || j;

  return {
    id: j.id,
    campeonato: s.campeonato || j.campeonato || "",
    campeonatoId: s.campeonatoId || j.campeonatoId || "",
    categoria: s.categoria || j.categoria || "",
    temporada: s.temporada || j.temporada || "",
    rodada: s.rodada || j.rodada || "",
    data: s.data || s.dataHora || j.data || "",
    local: s.local || j.local || "",
    arbitro: s.arbitro || j.arbitro || "",
    timeA: s.timeA || j.timeA,
    timeB: s.timeB || j.timeB,
    golsA: Number(s.golsA ?? 0),
    golsB: Number(s.golsB ?? 0),
    gols: s.gols || [],
    cartoes: s.cartoes || [],
    assistencias: s.assistencias || [],
    finalizado: finalizado(j)
  };
}

function partidasFinalizadas(){
  return jogosFiltrados()
    .filter(finalizado)
    .map(partidaBase)
    .sort((a,b)=>dataValor(a.data)-dataValor(b.data));
}

function baseTime(nome,logo){
  return {
    nome,
    logo,
    pontos:0,
    jogos:0,
    vitorias:0,
    empates:0,
    derrotas:0,
    golsPro:0,
    golsContra:0,
    saldo:0,
    aproveitamento:0,
    forma:[]
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

    if(!mapa[A]){
      mapa[A] = baseTime(A,logoTime(p.timeA));
    }

    if(!mapa[B]){
      mapa[B] = baseTime(B,logoTime(p.timeB));
    }

    const rA = atualizarStats(
      p.golsA,
      p.golsB,
      mapa[A]
    );

    const rB = atualizarStats(
      p.golsB,
      p.golsA,
      mapa[B]
    );

    mapa[A].forma.unshift(rA);
    mapa[B].forma.unshift(rB);

    mapa[A].forma = mapa[A].forma.slice(0,5);
    mapa[B].forma = mapa[B].forma.slice(0,5);
  });

  return Object.values(mapa)
    .map(t=>{

      t.saldo = t.golsPro - t.golsContra;

      t.aproveitamento = t.jogos
        ? Math.round((t.pontos/(t.jogos*3))*100)
        : 0;

      return t;
    })
    .sort((a,b)=>
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

    const id = x.id && x.nome
      ? x.id
      : campItem(x);

    const nome =
      x.nome ||
      x.campeonato ||
      x.campeonatoNome ||
      id;

    if(id && nome){
      camps.set(id,nome);
    }
  });

  $("filtroCampeonato").innerHTML =
    `<option value="">Todos os campeonatos</option>` +
    [...camps.entries()]
      .map(([id,n])=>
        `<option value="${id}">${n}</option>`
      )
      .join("");

  if([...camps.keys()].includes(campAtual)){
    $("filtroCampeonato").value = campAtual;
  }

  const cats = new Set();

  [...jogos,...sumulas].forEach(x=>{

    if(
      (
        !filtroCamp() ||
        norm(campItem(x)) === norm(filtroCamp())
      )
      &&
      x.categoria
    ){
      cats.add(x.categoria);
    }
  });

  $("filtroCategoria").innerHTML =
    `<option value="">Todas categorias</option>` +
    [...cats]
      .sort()
      .map(c=>`<option value="${c}">${c}</option>`)
      .join("");

  if([...cats].includes(catAtual)){
    $("filtroCategoria").value = catAtual;
  }
}

function atualizarHero(){

  if(!$("heroTitulo")) return;

  const tabela = calcularTabela();

  const partidas = partidasFinalizadas();

  const gols = partidas.reduce(
    (s,p)=>s+p.golsA+p.golsB,
    0
  );

  $("heroTitulo").innerText =
    filtroCamp() || "Tabela da Competição";

  $("heroSub").innerText =
    filtroCat()
      ? `Categoria ${filtroCat()}`
      : "Classificação automática.";

  $("heroTagJogos").innerText =
    `Jogos: ${partidas.length}`;

  $("heroTagTimes").innerText =
    `Times: ${tabela.length}`;

  $("heroTagGols").innerText =
    `Gols: ${gols}`;
}

function formaHTML(arr){
  return `
    <div class="forma">
      ${(arr || [])
        .map(f=>
          `<span class="f-${f.toLowerCase()}">${f}</span>`
        )
        .join("")}
    </div>
  `;
}

function medalha(i){
  if(i===0) return "🥇";
  if(i===1) return "🥈";
  if(i===2) return "🥉";
  return i+1;
}

function renderClassificacao(){

  if(!$("areaTabela")) return;

  const lista = calcularTabela();

  $("areaTabela").innerHTML = lista.length
    ? `
      <div class="box-tabela">
        <div class="table">

          <div class="row header">
            <div>#</div>
            <div>Time</div>
            <div>P</div>
            <div>J</div>
            <div>V</div>
            <div>E</div>
            <div>D</div>
            <div>GP</div>
            <div>GC</div>
            <div>SG</div>
            <div>%</div>
          </div>

          ${lista.map((t,i)=>`
            <div class="row">
              <div>${medalha(i)}</div>

              <div class="team">
                <img
                  class="escudo"
                  src="${t.logo}"
                  onerror="this.src='logo-liga.jfif'"
                >
                ${t.nome}
              </div>

              <div>${t.pontos}</div>
              <div>${t.jogos}</div>
              <div>${t.vitorias}</div>
              <div>${t.empates}</div>
              <div>${t.derrotas}</div>
              <div>${t.golsPro}</div>
              <div>${t.golsContra}</div>
              <div>${t.saldo}</div>
              <div>${t.aproveitamento}%</div>
            </div>
          `).join("")}

        </div>
      </div>
    `
    : `<div class="vazio">Nenhum jogo finalizado.</div>`;
}

function atualizarTela(){

  atualizarHero();

  renderClassificacao();
}

if($("filtroCampeonato")){
  $("filtroCampeonato").addEventListener("change",()=>{
    preencherFiltros();
    atualizarTela();
  });
}

if($("filtroCategoria")){
  $("filtroCategoria").addEventListener("change",()=>{
    atualizarTela();
  });
}

function ouvir(nome,setter,refreshFiltro=false){

  onSnapshot(collection(db,nome),snap=>{

    setter(
      snap.docs.map(d=>({
        id:d.id,
        ...d.data()
      }))
    );

    if(refreshFiltro){
      preencherFiltros();
    }

    atualizarTela();
  });
}

ouvir("jogos",v=>jogos=v,true);
ouvir("sumulas",v=>sumulas=v,true);
ouvir("jogadores",v=>jogadores=v);
ouvir("times",v=>times=v);
ouvir("campeonatos",v=>campeonatos=v,true);
ouvir("historico",v=>historico=v);

});
