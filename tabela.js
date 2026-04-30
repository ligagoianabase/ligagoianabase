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

const nomeTime = t => typeof t === "object" ? (t?.nome || "") : (t || "");
const logoTime = t => typeof t === "object" ? (t?.logo || t?.escudo || "logo-liga.jfif") : "logo-liga.jfif";
const dataValor = v => v?.toDate ? v.toDate() : new Date(v || 0);

function getSumula(id){
  return sumulas.find(s => s.id === id || s.jogoId === id) || null;
}

function finalizado(j){
  return j.sumulaFinalizada === true || norm(j.status) === "finalizado" || !!getSumula(j.id);
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
  const c = filtroCamp();
  const cat = filtroCat();

  if(c && norm(campItem(x)) !== norm(c)) return false;
  if(cat && norm(catItem(x)) !== norm(cat)) return false;

  return true;
}

function jogosFiltrados(){
  return jogos.filter(passaFiltro);
}

function sumulasFiltradas(){
  return sumulas.filter(passaFiltro);
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
    pontos: 0,
    jogos: 0,
    vitorias: 0,
    empates: 0,
    derrotas: 0,
    golsPro: 0,
    golsContra: 0,
    saldo: 0,
    aproveitamento: 0,
    forma: [],
    casa: {
      pontos: 0,
      jogos: 0,
      vitorias: 0,
      empates: 0,
      derrotas: 0,
      golsPro: 0,
      golsContra: 0,
      saldo: 0,
      aproveitamento: 0
    },
    fora: {
      pontos: 0,
      jogos: 0,
      vitorias: 0,
      empates: 0,
      derrotas: 0,
      golsPro: 0,
      golsContra: 0,
      saldo: 0,
      aproveitamento: 0
    },
    cleanSheets: 0,
    cartoesAmarelos: 0,
    cartoesVermelhos: 0
  };
}

function atualizarStats(gp, gc, alvo){
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

  partidasFinalizadas().forEach(p => {
    const A = nomeTime(p.timeA);
    const B = nomeTime(p.timeB);

    if(!A || !B) return;

    if(!mapa[A]) mapa[A] = baseTime(A, logoTime(p.timeA));
    if(!mapa[B]) mapa[B] = baseTime(B, logoTime(p.timeB));

    const rA = atualizarStats(p.golsA, p.golsB, mapa[A]);
    const rB = atualizarStats(p.golsB, p.golsA, mapa[B]);

    atualizarStats(p.golsA, p.golsB, mapa[A].casa);
    atualizarStats(p.golsB, p.golsA, mapa[B].fora);

    mapa[A].forma.unshift(rA);
    mapa[B].forma.unshift(rB);

    mapa[A].forma = mapa[A].forma.slice(0, 5);
    mapa[B].forma = mapa[B].forma.slice(0, 5);

    if(p.golsB === 0) mapa[A].cleanSheets++;
    if(p.golsA === 0) mapa[B].cleanSheets++;

    p.cartoes.forEach(c => {
      const alvo =
        norm(c.time) === "a" || norm(c.timeNome) === norm(A)
          ? mapa[A]
          : norm(c.time) === "b" || norm(c.timeNome) === norm(B)
            ? mapa[B]
            : null;

      if(!alvo) return;

      if(c.tipo === "amarelo") alvo.cartoesAmarelos++;
      if(c.tipo === "vermelho") alvo.cartoesVermelhos++;
    });
  });

  return Object.values(mapa).map(t => {
    t.saldo = t.golsPro - t.golsContra;
    t.aproveitamento = t.jogos ? Math.round((t.pontos / (t.jogos * 3)) * 100) : 0;

    t.casa.saldo = t.casa.golsPro - t.casa.golsContra;
    t.fora.saldo = t.fora.golsPro - t.fora.golsContra;

    t.casa.aproveitamento = t.casa.jogos ? Math.round((t.casa.pontos / (t.casa.jogos * 3)) * 100) : 0;
    t.fora.aproveitamento = t.fora.jogos ? Math.round((t.fora.pontos / (t.fora.jogos * 3)) * 100) : 0;

    return t;
  }).sort((a,b) =>
    b.pontos - a.pontos ||
    b.vitorias - a.vitorias ||
    b.saldo - a.saldo ||
    b.golsPro - a.golsPro
  );
}

function ordenarLista(lista){
  return lista.sort((a,b) =>
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

  [...campeonatos, ...jogos, ...sumulas].forEach(x => {
    const id = x.id && x.nome ? x.id : campItem(x);
    const nome = x.nome || x.campeonato || x.campeonatoNome || id;

    if(id && nome) camps.set(id, nome);
  });

  $("filtroCampeonato").innerHTML =
    `<option value="">Todos os campeonatos</option>` +
    [...camps.entries()].map(([id,n]) => `<option value="${id}">${n}</option>`).join("");

  if([...camps.keys()].includes(campAtual)){
    $("filtroCampeonato").value = campAtual;
  }

  const cats = new Set();

  [...jogos, ...sumulas].forEach(x => {
    if((!filtroCamp() || norm(campItem(x)) === norm(filtroCamp())) && x.categoria){
      cats.add(x.categoria);
    }
  });

  $("filtroCategoria").innerHTML =
    `<option value="">Todas categorias</option>` +
    [...cats].sort().map(c => `<option value="${c}">${c}</option>`).join("");

  if([...cats].includes(catAtual)){
    $("filtroCategoria").value = catAtual;
  }
}

function atualizarHero(){
  const tabela = calcularTabela();
  const partidas = partidasFinalizadas();
  const gols = partidas.reduce((s,p) => s + p.golsA + p.golsB, 0);

  $("heroTitulo").innerText = filtroCamp() || "Tabela da Competição";

  $("heroSub").innerText = filtroCat()
    ? `Categoria ${filtroCat()}`
    : "Classificação, jogos e estatísticas geradas automaticamente pelas súmulas finalizadas.";

  $("heroTagCategoria").innerText = `Categoria: ${filtroCat() || "Todas"}`;
  $("heroTagJogos").innerText = `Jogos finalizados: ${partidas.length}`;
  $("heroTagTimes").innerText = `Times: ${tabela.length}`;
  $("heroTagGols").innerText = `Gols: ${gols}`;

  const c = campeonatos.find(x => x.id === filtroCamp() || norm(x.nome) === norm(filtroCamp()));

  $("heroLogo").src = c?.logo || c?.escudo || "logo-liga.jfif";

  $("tituloTabela").innerText =
    `Tabela${filtroCat() ? " - " + filtroCat() : ""}${filtroCamp() ? " | " + filtroCamp() : ""}`;
}

function formaHTML(arr){
  return `<div class="forma">${(arr || []).map(f => `<span class="f-${f.toLowerCase()}">${f}</span>`).join("")}</div>`;
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

function tabelaHTML(lista, modo = "geral"){
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
          <div class="col-wide">Forma</div>
        </div>

        ${lista.map((t,i) => {
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
  const gols = partidas.reduce((s,p) => s + p.golsA + p.golsB, 0);

  const amarelos = sumulasFiltradas().reduce((s,x) =>
    s + (x.cartoes || []).filter(c => c.tipo === "amarelo").length, 0
  );

  const vermelhos = sumulasFiltradas().reduce((s,x) =>
    s + (x.cartoes || []).filter(c => c.tipo === "vermelho").length, 0
  );

  $("areaTabela").innerHTML = `
    <div class="cards-resumo">
      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-trophy"></i></div>
        <strong>Líder</strong>
        <span>${tabela[0]?.nome || "-"}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-shield"></i></div>
        <strong>Times</strong>
        <span>${tabela.length}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-calendar-check"></i></div>
        <strong>Jogos finalizados</strong>
        <span>${partidas.length}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-futbol"></i></div>
        <strong>Gols</strong>
        <span>${gols}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-square"></i></div>
        <strong>Amarelos</strong>
        <span>${amarelos}</span>
      </div>

      <div class="card-resumo">
        <div class="card-resumo-icon"><i class="fa-solid fa-square"></i></div>
        <strong>Vermelhos</strong>
        <span>${vermelhos}</span>
      </div>
    </div>
  `;
}

function renderClassificacao(){
  const lista = calcularTabela();

  $("areaTabela").innerHTML = lista.length
    ? tabelaHTML(lista, "geral")
    : `<div class="vazio">Nenhum jogo finalizado.</div>`;
}

function renderCasaFora(){
  const lista = calcularTabela();

  $("areaTabela").innerHTML = `
    <div class="sub-abas">
      <button class="sub-aba ativa" onclick="renderTabelaCasaFora('casa',this)">Casa</button>
      <button class="sub-aba" onclick="renderTabelaCasaFora('fora',this)">Fora</button>
    </div>

    <div id="subArea">
      ${tabelaHTML(
        [...lista].sort((a,b) =>
          (b.casa.pontos || 0) - (a.casa.pontos || 0) ||
          (b.casa.saldo || 0) - (a.casa.saldo || 0)
        ),
        "casa"
      )}
    </div>
  `;
}

window.renderTabelaCasaFora = (modo, btn) => {
  document.querySelectorAll(".sub-aba").forEach(b => b.classList.remove("ativa"));
  btn.classList.add("ativa");

  const lista = calcularTabela();

  const ordenada = [...lista].sort((a,b) =>
    (b[modo].pontos || 0) - (a[modo].pontos || 0) ||
    (b[modo].saldo || 0) - (a[modo].saldo || 0)
  );

  $("subArea").innerHTML = tabelaHTML(ordenada, modo);
};

function renderJogos(){
  const lista = jogosFiltrados().map(partidaBase);

  if(!lista.length){
    $("areaTabela").innerHTML = `<div class="vazio">Nenhum jogo encontrado.</div>`;
    return;
  }

  $("areaTabela").innerHTML = `
    <div class="lista-grid">
      ${lista.map(p => `
        <article class="card-item">
          <div class="card-top">
            <div class="card-icon">
              <i class="fa-solid fa-calendar-days"></i>
            </div>

            <div class="status-tag ${p.finalizado ? "status-finalizado" : "status-agendado"}">
              ${p.finalizado ? "Finalizado" : "Agendado"}
            </div>
          </div>

          <div class="times-linha">
            <div class="time-box">
              <img class="escudo" src="${logoTime(p.timeA)}" onerror="this.src='logo-liga.jfif'">
              <span>${nomeTime(p.timeA)}</span>
            </div>

            <div class="placar">${p.finalizado ? `${p.golsA} x ${p.golsB}` : "x"}</div>

            <div class="time-box visitante">
              <span>${nomeTime(p.timeB)}</span>
              <img class="escudo" src="${logoTime(p.timeB)}" onerror="this.src='logo-liga.jfif'">
            </div>
          </div>

          <div class="info-item">
            <strong>${p.campeonato || "-"}</strong><br>
            ${p.categoria || "-"}<br>
            ${p.data || "-"}<br>
            ${p.local || "-"}
          </div>

          ${
            p.finalizado
              ? `<a class="btn-ver" href="sumula-publica.html?id=${p.id}">
                  <i class="fa-solid fa-file-lines"></i> Ver Súmula
                </a>`
              : ""
          }
        </article>
      `).join("")}
    </div>
  `;
}

function rankingGols(){
  const mapa = {};

  sumulasFiltradas().forEach(s => {
    (s.gols || []).forEach(g => {
      const nome = g.nome || g.jogador;
      if(!nome) return;

      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time: g.timeNome || g.time || "",
          valor: 0
        };
      }

      mapa[nome].valor++;
    });
  });

  return Object.values(mapa).sort((a,b) => b.valor - a.valor);
}

function rankingAssist(){
  const mapa = {};

  sumulasFiltradas().forEach(s => {
    (s.assistencias || []).forEach(a => {
      const nome = a.nome || a.jogador;
      if(!nome) return;

      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time: a.timeNome || a.time || "",
          valor: 0
        };
      }

      mapa[nome].valor++;
    });

    (s.gols || []).forEach(g => {
      const nome = g.assistencia || g.assistente;
      if(!nome) return;

      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time: g.timeNome || g.time || "",
          valor: 0
        };
      }

      mapa[nome].valor++;
    });
  });

  return Object.values(mapa).sort((a,b) => b.valor - a.valor);
}

function renderRanking(lista, label){
  $("areaTabela").innerHTML = lista.length
    ? `
      <div class="ranking-lista">
        ${lista.map((j,i) => `
          <article class="ranking-card ${i === 0 ? "lider-ranking" : ""}">
            <div class="ranking-top">
              <div class="player-box">
                <div class="pos">${medalha(i)}</div>
                <img src="${fotoJogador(j.nome)}" class="photo" onerror="this.src='logo-liga.jfif'">

                <div class="player-info">
                  <strong>${j.nome}</strong>
                  <small>${j.time || "Atleta"}</small>
                </div>
              </div>

              <div class="numero-destaque">
                ${j.valor}
                <small>${label}</small>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `
    : `<div class="vazio">Nada registrado.</div>`;
}

function renderArtilharia(){
  renderRanking(rankingGols(), "gol(s)");
}

function renderAssistencias(){
  renderRanking(rankingAssist(), "assist.");
}

function rankingCartoes(){
  const mapa = {};

  sumulasFiltradas().forEach(s => {
    (s.cartoes || []).forEach(c => {
      const nome = c.nome || c.jogador;
      if(!nome) return;

      if(!mapa[nome]){
        mapa[nome] = {
          nome,
          time: c.timeNome || c.time || "",
          amarelos: 0,
          vermelhos: 0,
          valor: 0
        };
      }

      if(c.tipo === "amarelo") mapa[nome].amarelos++;
      if(c.tipo === "vermelho") mapa[nome].vermelhos++;

      mapa[nome].valor = mapa[nome].amarelos + mapa[nome].vermelhos * 3;
    });
  });

  return Object.values(mapa).sort((a,b) => b.valor - a.valor);
}

function renderCartoes(){
  const lista = rankingCartoes();

  $("areaTabela").innerHTML = lista.length
    ? `
      <div class="ranking-lista">
        ${lista.map((j,i) => `
          <article class="ranking-card">
            <div class="ranking-top">
              <div class="player-box">
                <div class="pos">${medalha(i)}</div>
                <img src="${fotoJogador(j.nome)}" class="photo" onerror="this.src='logo-liga.jfif'">

                <div class="player-info">
                  <strong>${j.nome}</strong>
                  <small>${j.time || "Atleta"}</small>
                </div>
              </div>

              <div class="numero-destaque">
                🟨 ${j.amarelos}<br>
                🟥 ${j.vermelhos}
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `
    : `<div class="vazio">Nenhum cartão.</div>`;
}

function renderSuspensos(){
  const lista = rankingCartoes()
    .filter(j => j.vermelhos >= 1 || j.amarelos >= 3)
    .map(j => ({
      ...j,
      suspensao: j.vermelhos >= 1 ? 1 : 1
    }));

  $("areaTabela").innerHTML = lista.length
    ? `
      <div class="ranking-lista">
        ${lista.map((j,i) => `
          <article class="ranking-card">
            <div class="ranking-top">
              <div class="player-box">
                <div class="pos">${i + 1}</div>
                <img src="${fotoJogador(j.nome)}" class="photo" onerror="this.src='logo-liga.jfif'">

                <div class="player-info">
                  <strong>${j.nome}</strong>
                  <small>${j.time || "Atleta"}</small>
                </div>
              </div>

              <div class="numero-destaque">
                ${j.suspensao}
                <small>jogo suspenso</small>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `
    : `<div class="vazio">Nenhum suspenso automático.</div>`;
}

function renderArbitros(){
  const mapa = {};

  partidasFinalizadas().forEach(p => {
    if(!p.arbitro) return;

    if(!mapa[p.arbitro]){
      mapa[p.arbitro] = {
        nome: p.arbitro,
        jogos: 0,
        cartoes: 0
      };
    }

    mapa[p.arbitro].jogos++;
    mapa[p.arbitro].cartoes += (p.cartoes || []).length;
  });

  const lista = Object.values(mapa).sort((a,b) => b.jogos - a.jogos);

  $("areaTabela").innerHTML = lista.length
    ? `
      <div class="ranking-lista">
        ${lista.map((a,i) => `
          <article class="ranking-card">
            <div class="ranking-top">
              <div class="player-box">
                <div class="pos">${medalha(i)}</div>
                <img src="logo-liga.jfif" class="photo">

                <div class="player-info">
                  <strong>${a.nome}</strong>
                  <small>Árbitro</small>
                </div>
              </div>

              <div class="numero-destaque">
                ${a.jogos}
                <small>jogos</small>
                ${a.cartoes}
                <small>cartões</small>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    `
    : `<div class="vazio">Nenhum árbitro.</div>`;
}

function renderEstatisticasTimes(){
  const lista = calcularTabela();
  const ataque = [...lista].sort((a,b) => b.golsPro - a.golsPro);
  const defesa = [...lista].sort((a,b) => a.golsContra - b.golsContra);
  const clean = [...lista].sort((a,b) => b.cleanSheets - a.cleanSheets);
  const disciplina = [...lista].sort((a,b) =>
    (a.cartoesAmarelos + a.cartoesVermelhos * 3) -
    (b.cartoesAmarelos + b.cartoesVermelhos * 3)
  );

  $("areaTabela").innerHTML = `
    <div class="duplo">
      <div>${blocoTop("Melhor ataque", ataque, "golsPro", "gols")}</div>
      <div>${blocoTop("Melhor defesa", defesa, "golsContra", "sofridos")}</div>
      <div>${blocoTop("Clean sheets", clean, "cleanSheets", "jogos")}</div>
      <div>${blocoTop("Mais disciplinado", disciplina, "cartoesAmarelos", "amarelos")}</div>
    </div>
  `;
}

function blocoTop(titulo, lista, campo, label){
  return `
    <div class="ranking-card">
      <h3 style="color:var(--gold);margin-bottom:10px">${titulo}</h3>

      ${lista.slice(0,8).map((t,i) => `
        <div class="ranking-top" style="margin-bottom:8px">
          <div class="team">
            <span class="pos">${i + 1}</span>
            <img class="escudo" src="${t.logo}" onerror="this.src='logo-liga.jfif'">
            ${t.nome}
          </div>

          <strong>${t[campo] || 0} ${label}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderHistorico(){
  const docs = historico.filter(passaFiltro);
  const temporadas = {};

  partidasFinalizadas().forEach(p => {
    const temp = p.temporada || "Temporada atual";

    if(!temporadas[temp]){
      temporadas[temp] = {
        jogos: 0,
        gols: 0
      };
    }

    temporadas[temp].jogos++;
    temporadas[temp].gols += p.golsA + p.golsB;
  });

  $("areaTabela").innerHTML = `
    <div class="lista-grid">
      ${docs.map(h => `
        <div class="ranking-card">
          <h3 style="color:var(--gold)">${h.temporada || h.ano || "-"}</h3>
          <p>Campeão: <strong>${h.campeao || "-"}</strong></p>
          <p>Vice: <strong>${h.vice || "-"}</strong></p>
        </div>
      `).join("")}

      ${Object.entries(temporadas).map(([t,v]) => `
        <div class="ranking-card">
          <h3 style="color:var(--gold)">${t}</h3>
          <p>${v.jogos} jogos finalizados</p>
          <p>${v.gols} gols</p>
        </div>
      `).join("")}
    </div>
  `;
}

window.trocarAba = (nome, btn) => {
  abaAtual = nome;

  document.querySelectorAll(".aba").forEach(b => b.classList.remove("ativa"));
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
  if(abaAtual === "arbitros") renderArbitros();
  if(abaAtual === "historico") renderHistorico();
}

$("filtroCampeonato").addEventListener("change", () => {
  preencherFiltros();
  atualizarTela();
});

$("filtroCategoria").addEventListener("change", atualizarTela);

function ouvir(nome, setter, refreshFiltro = false){
  onSnapshot(collection(db, nome), snap => {
    setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));

    if(refreshFiltro) preencherFiltros();

    atualizarTela();
  });
}

ouvir("jogos", v => jogos = v, true);
ouvir("sumulas", v => sumulas = v, true);
ouvir("jogadores", v => jogadores = v);
ouvir("times", v => times = v);
ouvir("campeonatos", v => campeonatos = v, true);
ouvir("historico", v => historico = v);
