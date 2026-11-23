# 🎮 TapBit: A Academia dos Guardiões Digitais — Game Design Document

## 1. Visão geral
- **Gênero:** Puzzle-Arcade Educativo / Cálculo Rápido.
- **Público:** 5º ano do Ensino Fundamental (10 a 11 anos).
- **Plataforma:** Web mobile (link ou QR Code), também no PC.
- **Orientação:** retrato (vertical), para jogar com uma ou duas mãos.
- **Objetivo pedagógico:** valor posicional na base 2 (1, 2, 4, 8, 16); converter decimal ↔ binário (0 a 31); associar binário a letras.

## 2. Narrativa
Dentro de cada smartphone existe a **Cidade de Silício**, movida a núcleos de energia que só entendem Ligado (1) e Desligado (0).
Vírus chamados **Glitches** mandam asteroides de dados corrompidos. O aluno é um **Guardião Digital** e controla os
**Canhões de Bits (16 | 8 | 4 | 2 | 1)** para neutralizar cada ameaça antes que ela atinja o escudo.

## 3. Mecânicas
- **Painel de Bits:** 5 interruptores na base da tela, 16 à esquerda e 1 à direita.
  Desligado: escuro, bateria vazia, 0. Ligado: neon, raio, 1, vibração curta e nota ascendente.
- **Loop:** ameaça desce com um número → o aluno liga os bits → disparo.
  - **Iniciante:** dispara sozinho quando a soma bate.
  - **Desafio:** botão **DISPARAR** confirma (evita tentativa e erro).
- **Erro construtivo:** o laser rebate sem destruir o escudo e mostra "Você enviou 14, o alvo era 13 · Passou 1".

## 4. Campanha (4 setores × 5 fases)
| Setor | Nome | Desafio | Apoio visual |
|---|---|---|---|
| 1 | Laboratório de Energia | 1 a 15, 4 bits, sem tempo | valores 8/4/2/1 e soma ao vivo |
| 2 | Chuva de Meteoros | bit 16 liberado, 1 a 31 caindo (até 3 ao mesmo tempo) | valores visíveis, soma escondida |
| 3 | Invasão Hacker | drone mostra o binário, aluno escolhe entre 3 números | valores embaixo dos dígitos nas 3 primeiras fases |
| 4 | Decifrador Secreto | chefes: binário → letra para formar palavras (SOL, PAZ, LUA…) | mini-tabela A=1…Z=26 na lateral |

As alternativas erradas do Setor 3 imitam erros comuns: ler o código de trás para frente ou trocar um bit.

## 5. Gamificação
- **Overdrive:** 3 acertos seguidos → bordas douradas, som especial, pontos ×2.
- **Pulso PEM:** a cada 5 acertos seguidos (máx. 3), limpa a tela.
- **Estrelas (até 3) por precisão:** acertos ÷ tentativas; nas fases de montar, toques desnecessários também pesam.
- **Byte-Coins** → **Oficina de Skins:** robôs (Bitinho, Volt, Pixel, Nébula, Brasa, Glitchy),
  lasers (Ciano, Plasma, Pixel-art, Arco-íris) e botões (Neon, Fliperama, Futurista, Blocos).
- **Ofensiva diária** e **3 missões por dia** (ex.: "Acerte 10 números ímpares" — ímpar sempre liga o bit 1).
- **Missão Relâmpago:** 1 minuto com regra do dia (ímpares, pares, 16 a 31, até 15, misturados).
- **Ranking da Sala:** código criado pelo professor; mostra só os 5 melhores do dia.

## 6. Arte, UX e áudio
- Cyber-Cartum: formas arredondadas, contorno escuro grosso, neon ciano/verde, rosa dos Glitches, dourado das recompensas.
- Tutorial de 15 s só com mão animada, setas e números.
- Música suave gerada no navegador só nos menus; durante as partidas, apenas efeitos sonoros (cada bit é uma nota da escala pentatônica, no clima de cada setor).
- Cada bit toca uma nota da pentatônica (1=Dó, 2=Ré, 4=Mi, 8=Sol, 16=Lá).

## 7. Técnica
HTML5 + CSS + JavaScript puro (canvas), sem build, hospedado no GitHub Pages.
Progresso no localStorage; ranking em Supabase com acesso só por funções (`supabase/tapbit.sql`).
