export function renderMenu(paginaAtual = ""){

  document.body.insertAdjacentHTML("afterbegin", `
    
    <header class="site-header">

      <div class="header-top">
        <div class="header-title">
          LIGA GOIANA DE FUTEBOL DE BASE
        </div>
      </div>

      <div class="nav-bar">
        <nav class="menu">

          <a href="index.html" class="${paginaAtual === 'inicio' ? 'ativo' : ''}">Início</a>
          <a href="campeonatos.html" class="${paginaAtual === 'campeonatos' ? 'ativo' : ''}">Campeonatos</a>
          <a href="tabela.html" class="${paginaAtual === 'tabela' ? 'ativo' : ''}">Tabela</a>
          <a href="jogos.html" class="${paginaAtual === 'jogos' ? 'ativo' : ''}">Jogos</a>
          <a href="times.html" class="${paginaAtual === 'times' ? 'ativo' : ''}">Times</a>
          <a href="tecnicos.html" class="${paginaAtual === 'tecnicos' ? 'ativo' : ''}">Técnicos</a>
          <a href="jogadores.html" class="${paginaAtual === 'jogadores' ? 'ativo' : ''}">Jogadores</a>
          <a href="arbitros.html" class="${paginaAtual === 'arbitros' ? 'ativo' : ''}">Árbitros</a>
          <a href="assistentes.html" class="${paginaAtual === 'assistentes' ? 'ativo' : ''}">Assistente</a>
          <a href="sumula-publica.html" class="${paginaAtual === 'sumula' ? 'ativo' : ''}">Súmula</a>
          <a href="noticias.html" class="${paginaAtual === 'noticias' ? 'ativo' : ''}">Notícias</a>
          <a href="login.html" class="${paginaAtual === 'login' ? 'ativo' : ''}">Login</a>

        </nav>
      </div>

    </header>

  `);

}
