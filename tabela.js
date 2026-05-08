window.trocarAba = (nome,btn)=>{

  abaAtual = nome;

  document.querySelectorAll(".aba")
    .forEach(b=>b.classList.remove("ativa"));

  btn.classList.add("ativa");

  if(nome === "detalhes"){
    renderDetalhes();
  }

  if(nome === "classificacao"){
    renderClassificacao();
  }

  if(nome === "casaFora"){
    renderCasaFora();
  }

  if(nome === "jogos"){
    renderJogos();
  }

  if(nome === "estatisticasTimes"){
    renderEstatisticasTimes();
  }

  if(nome === "artilharia"){
    renderArtilharia();
  }

  if(nome === "assistencias"){
    renderAssistencias();
  }

  if(nome === "cartoes"){
    renderCartoes();
  }

  if(nome === "suspensos"){
    renderSuspensos();
  }

  if(nome === "historico"){
    renderHistorico();
  }
};

function atualizarTela(){

  if(abaAtual === "detalhes"){
    renderDetalhes();
  }

  if(abaAtual === "classificacao"){
    renderClassificacao();
  }

  if(abaAtual === "casaFora"){
    renderCasaFora();
  }

  if(abaAtual === "jogos"){
    renderJogos();
  }

  if(abaAtual === "estatisticasTimes"){
    renderEstatisticasTimes();
  }

  if(abaAtual === "artilharia"){
    renderArtilharia();
  }

  if(abaAtual === "assistencias"){
    renderAssistencias();
  }

  if(abaAtual === "cartoes"){
    renderCartoes();
  }

  if(abaAtual === "suspensos"){
    renderSuspensos();
  }

  if(abaAtual === "historico"){
    renderHistorico();
  }
}
