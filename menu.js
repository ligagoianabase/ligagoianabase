import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

export function renderMenu(paginaAtual = "") {
  const menuAntigo = document.querySelector(".site-header");

  if (menuAntigo) {
    menuAntigo.remove();
  }

  document.body.insertAdjacentHTML("afterbegin", `
    <header class="site-header">

      <div class="header-top">
        <div class="header-title">
          LIGA GOIANA DE FUTEBOL DE BASE
        </div>

        <div class="user-area" id="userArea">
          <a href="login.html" class="login-topo">Login</a>
        </div>
      </div>

      <div class="nav-bar">
        <nav class="menu">

          <a href="index.html" class="${paginaAtual === "inicio" ? "ativo" : ""}">
            Início
          </a>

          <div class="menu-dropdown">
            <a href="campeonatos.html" class="${paginaAtual === "campeonatos" ? "ativo" : ""}">
              Campeonatos
            </a>

            <div class="submenu">
              <a href="campeonatos.html">Todos os campeonatos</a>
              <a href="classificacao.html">Classificação</a>
              <a href="artilharia.html">Artilharia</a>
              <a href="categorias.html">Categoria</a>
              <a href="cartoes.html">Cartões</a>
              <a href="suspensos.html">Suspensos</a>
              <a href="regulamentos.html">Regulamentos</a>
            </div>
          </div>

          <a href="tabela.html" class="${paginaAtual === "tabela" ? "ativo" : ""}">
            Tabela
          </a>

          <a href="jogos.html" class="${paginaAtual === "jogos" ? "ativo" : ""}">
            Jogos
          </a>

          <div class="menu-dropdown">
            <a href="times.html" class="${paginaAtual === "participantes" ? "ativo" : ""}">
              Participantes
            </a>

            <div class="submenu">
              <a href="times.html">Equipes/Times</a>
              <a href="tecnicos.html">Técnicos</a>
              <a href="jogadores.html">Jogadores</a>
              <a href="arbitros.html">Árbitros</a>
              <a href="assistente.html">Assistente</a>
              <a href="fotografos.html">Fotógrafos</a>
            </div>
          </div>

          <a href="times.html" class="${paginaAtual === "times" ? "ativo" : ""}">
            Times
          </a>

          <a href="tecnicos.html" class="${paginaAtual === "tecnicos" ? "ativo" : ""}">
            Técnicos
          </a>

          <a href="jogadores.html" class="${paginaAtual === "jogadores" ? "ativo" : ""}">
            Jogadores
          </a>

          <a href="arbitros.html" class="${paginaAtual === "arbitros" ? "ativo" : ""}">
            Árbitros
          </a>

          <a href="assistente.html" class="${paginaAtual === "assistente" || paginaAtual === "assistentes" ? "ativo" : ""}">
            Assistente
          </a>

          <a href="sumulas.html" class="${paginaAtual === "sumulas" || paginaAtual === "sumula" ? "ativo" : ""}">
            Súmula
          </a>

          <a href="noticias.html" class="${paginaAtual === "noticias" ? "ativo" : ""}">
            Notícias
          </a>

          <a href="login.html" id="btnLoginMenu" class="${paginaAtual === "login" ? "ativo" : ""}">
            Login
          </a>

          <a href="admin.html" id="btnAdminMenu" class="admin-menu-link" style="display:none;">
            Painel ADM
          </a>

        </nav>
      </div>

    </header>
  `);

  controlarUsuarioMenu();
}

async function controlarUsuarioMenu() {
  const userArea = document.getElementById("userArea");
  const btnAdminMenu = document.getElementById("btnAdminMenu");
  const btnLoginMenu = document.getElementById("btnLoginMenu");

  if (!userArea) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      userArea.innerHTML = `<a href="login.html" class="login-topo">Login</a>`;

      if (btnAdminMenu) {
        btnAdminMenu.style.display = "none";
      }

      if (btnLoginMenu) {
        btnLoginMenu.style.display = "inline-flex";
      }

      return;
    }

    let nomeUsuario = user.displayName || user.email || "Usuário";
    let podeVerAdmin = false;

    try {
      const refUsuario = doc(db, "usuarios", user.uid);
      const snapUsuario = await getDoc(refUsuario);

      if (snapUsuario.exists()) {
        const dados = snapUsuario.data();

        nomeUsuario =
          dados.nome ||
          dados.nomeCompleto ||
          dados.apelido ||
          nomeUsuario;

        const tipo = String(dados.tipo || dados.perfil || dados.funcao || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        const aprovado =
          dados.aprovado === true ||
          dados.status === "aprovado";

        const autorizado =
          dados.autorizado === true ||
          dados.liberado === true;

        podeVerAdmin =
          (tipo === "admin" || tipo === "arbitro") &&
          aprovado &&
          autorizado;
      }
    } catch (erro) {
      console.error("Erro ao verificar permissões do usuário:", erro);
    }

    userArea.innerHTML = `
      <span class="usuario-logado">${nomeUsuario}</span>
      <button type="button" class="btn-sair" id="btnSairMenu">Sair</button>
    `;

    const btnSairMenu = document.getElementById("btnSairMenu");

    if (btnSairMenu) {
      btnSairMenu.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
      });
    }

    if (btnLoginMenu) {
      btnLoginMenu.style.display = "none";
    }

    if (btnAdminMenu) {
      btnAdminMenu.style.display = podeVerAdmin ? "inline-flex" : "none";
    }
  });
}
