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

function filtroCamp(){
  return $("filtroCampeonato").value;
}

function filtroCat(){
  return $("filtroCategoria").value;
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
  return sumulas.filter(s => sumulaFinalizada(s)).filter(passaFiltro);
}

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
    casa:{
      pontos:0,
      jogos:0,
      vitorias:0,
      empates:0,
      derrotas:0,
      golsPro:0,
      golsContra:0,
      saldo:0,
      aproveitamento:0
    },
    fora:{
      pontos:0,
      jogos:0,
      vitorias:0,
      empates:0,
      derrotas:0,
      golsPro:0,
      golsContra:0,
      saldo:0,
      aproveitamento:0
    },
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

  if([...camps.keys()].includes(campAtual)){
    $("filtroCampeonato").value = campAtual;
  }

  const cats = new Set();

  [...jogos,...sumulas].forEach(x=>{
    if((!filtroCamp() || norm(campItem(x)) === norm(filtroCamp())) && x.categoria){
      cats.add(x.categoria);
    }
  });

  $("filtroCategoria").innerHTML =
    `<option value="">Todas categorias</option>` +
    [...cats].sort().map(c=>`<option value="${c}">${c}</option>`).join("");

  if([...cats].includes(catAtual)){
    $("filtroCategoria").value = catAtual;
  }
}

function atualizarHero(){
  const tabela = calcularTabela();
  const partidas = partidasFinalizadas();
  const gols = partidas.reduce((s,p)=>s + p.golsA + p.golsB,0);
  const camp = campeonatos.find(x => x.id === filtroCamp() || norm(x.nome) === norm(filtroCamp()));

  $("heroTitulo").innerText = camp?.nome || filtroCamp() || "Tabela da Competição";

  $("heroSub").innerText = filtroCat()
    ? `Categoria ${filtroCat()}`
    : "Classificação, jogos e estatísticas geradas automaticamente pelas súmulas finalizadas.";

  $("heroTagCategoria").innerText = `Categoria: ${filtroCat() || "Todas"}`;
  $("heroTagJogos").innerText = `Jogos finalizados: ${partidas.length}`;
  $("heroTagTimes").innerText = `Times: ${tabela.length}`;
  $("heroTagGols").innerText = `Gols: ${gols}`;
  $("heroLogo").src = camp?.logo || camp?.escudo || "logo-liga.jfif";
  $("tituloTabela").innerText = `Tabela${filtroCat() ? " - " + filtroCat() : ""}`;
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

/* ================= SWIPE MOBILE ================= */
function tabelaMobileSwipe(lista){

  const paginas = [
    { nome:"Base", campos:["pontos","jogos","vitorias","empates","derrotas"] },
    { nome:"Gols", campos:["golsPro","golsContra","saldo"] },
    { nome:"%", campos:["aproveitamento"] }
  ];

  return `
    <div class="swipe-container">

      <div class="swipe-header">
        <div>#</div>
        <div>Time</div>
        <div class="swipe-title">← Deslize →</div>
      </div>

      <div class="swipe-body">
        ${lista.map((t,i)=>`
          <div class="swipe-row">
            <div class="swipe-pos">${medalha(i)}</div>

            <div class="swipe-team">
              <img src="${t.logo}" class="escudo">
              ${t.nome}
            </div>

            <div class="swipe-cards">
              ${paginas.map(p=>`
                <div class="swipe-card">
                  ${p.campos.map(c=>`
                    <div class="swipe-item">
                      <strong>${c.replace("gols","").toUpperCase()}</strong>
                      <span>${t[c] || 0}${c==="aproveitamento"?"%":""}</span>
                    </div>
                  `).join("")}
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>

    </div>
  `;
}

/* ================= CSS SWIPE ================= */
function aplicarCssSwipe(){
  if(document.getElementById("cssSwipe")) return;

  const css = document.createElement("style");
  css.id = "cssSwipe";

  css.innerHTML = `
    .swipe-container{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .swipe-header{
      display:grid;
      grid-template-columns:40px 1fr 120px;
      font-weight:900;
      color:var(--gold);
      padding:0 6px;
    }

    .swipe-body{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .swipe-row{
      display:grid;
      grid-template-columns:40px 1fr;
      gap:8px;
      background:linear-gradient(180deg, rgba(16,42,82,.96), rgba(8,23,44,.97));
      padding:10px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.08);
    }

    .swipe-pos{
      font-weight:900;
      display:flex;
      align-items:center;
      justify-content:center;
    }

    .swipe-team{
      display:flex;
      align-items:center;
      gap:6px;
      font-weight:900;
    }

    .swipe-cards{
      grid-column:1/-1;
      display:flex;
      overflow-x:auto;
      gap:10px;
      scroll-snap-type:x mandatory;
      padding-top:8px;
    }

    .swipe-card{
      min-width:220px;
      background:#0d2a52;
      border-radius:10px;
      padding:10px;
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:6px;
      scroll-snap-align:start;
    }

    .swipe-item{
      background:rgba(255,255,255,.05);
      padding:6px;
      border-radius:6px;
      text-align:center;
    }

    .swipe-item strong{
      display:block;
      font-size:10px;
      color:var(--gold);
    }

    .swipe-item span{
      font-size:13px;
      font-weight:900;
    }
  `;

  document.head.appendChild(css);
}

/* ================= TABELA ================= */
function tabelaHTML(lista,modo="geral"){

  if(window.innerWidth <= 900){
    aplicarCssSwipe();
    return tabelaMobileSwipe(lista);
  }

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
          <div class="col">%</div>
          <div class="col-wide">Desempenho</div>
        </div>

        ${lista.map((t,i)=>{
          const x = modo === "casa" ? t.casa : modo === "fora" ? t.fora : t;

          return `
            <div class="${rowClasse(i)}">
              <div class="col-pos">${medalha(i)}</div>

              <div class="col-time">
                <div class="team">
                  <img class="escudo" src="${t.logo}">
                  ${t.nome}
                </div>
              </div>

              <div class="col">${x.pontos}</div>
              <div class="col">${x.jogos}</div>
              <div class="col">${x.vitorias}</div>
              <div class="col">${x.empates}</div>
              <div class="col">${x.derrotas}</div>
              <div class="col">${x.golsPro}</div>
              <div class="col">${x.golsContra}</div>
              <div class="col">${x.saldo}</div>
              <div class="col">${x.aproveitamento}%</div>
              <div class="col-wide">${formaHTML(t.forma)}</div>
            </div>
          `;
        }).join("")}

      </div>
    </div>
  `;
}

/* ================= RENDER ================= */
function renderClassificacao(){
  const lista = calcularTabela();

  $("areaTabela").innerHTML = lista.length
    ? tabelaHTML(lista,"geral")
    : `<div class="vazio">Nenhum jogo finalizado.</div>`;
}

/* ================= ABAS ================= */
window.trocarAba = (nome,btn)=>{
  abaAtual = nome;

  document.querySelectorAll(".aba").forEach(b=>b.classList.remove("ativa"));
  btn.classList.add("ativa");

  atualizarTela();
};

function atualizarTela(){
  atualizarHero();

  if(abaAtual === "detalhes") renderDetalhes();
  if(abaAtual === "classificacao") renderClassificacao();
  if(abaAtual === "casaFora") renderCasaFora();
  if(abaAtual === "jogos") renderJogos();
  if(abaAtual === "estatisticasTimes") renderEstatisticasTimes();
  if(abaAtual === "artilharia") renderArtilharia();
  if(abaAtual === "assistencias") renderAssistencias();
  if(abaAtual === "cartoes") renderCartoes();
  if(abaAtual === "suspensos") renderSuspensos();
  if(abaAtual === "historico") renderHistorico();
}

/* ================= LISTENERS ================= */
$("filtroCampeonato").addEventListener("change",()=>{
  preencherFiltros();
  atualizarTela();
});

$("filtroCategoria").addEventListener("change", atualizarTela);

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
