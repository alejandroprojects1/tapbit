# ⚡ TapBit: A Academia dos Guardiões Digitais

Jogo educativo para o **5º ano**: ligue os bits **16 | 8 | 4 | 2 | 1** para montar números de 0 a 31,
leia códigos binários e decifre letras para proteger a Cidade de Silício dos Glitches.

Roda no navegador do celular (em pé) ou do computador, sem instalar nada.

## Como jogar
- **Toque nos bits** para ligar (1) ou desligar (0). A soma dos bits ligados precisa ser igual ao número do meteoro.
- **Modo Iniciante:** o canhão dispara sozinho quando a soma está certa.
- **Modo Desafio:** monte o número e aperte **DISPARAR**. Se errar, o laser rebate e o jogo mostra quanto faltou ou passou.
- **PC:** teclas `1` a `5` ligam os bits (16 → 1), `Enter` dispara, `0` zera e `E` usa o Pulso PEM.

## O que tem no jogo
| Setor | Fase | O que treina |
|---|---|---|
| 1 | Laboratório de Energia | 1 a 15 com 4 bits, sem tempo, soma ao vivo |
| 2 | Chuva de Meteoros | 1 a 31 com 5 bits, meteoros caindo, soma escondida |
| 3 | Invasão Hacker | o drone mostra o binário e o aluno escolhe entre 3 números |
| 4 | Decifrador Secreto | chefes: binário → letra (A=1, B=2…) para formar SOL, PAZ, LUA… |

- **Combo e Overdrive:** 3 acertos seguidos ativam o Overdrive (bordas douradas, música mais rápida, pontos ×2).
- **Pulso PEM:** a cada 5 acertos seguidos; limpa a tela numa emergência.
- **Estrelas** (até 3) pela **precisão**: erros e liga-desliga de bits à toa contam.
- **Byte-Coins** para a **Oficina de Skins**: robôs, cores de laser e temas dos botões.
- **Missões diárias** e **ofensiva (dias seguidos)**, iguais para a turma inteira no mesmo dia.
- **Missão Relâmpago:** 1 minuto, com uma regra diferente por dia (ímpares, pares, gigantes…).
- **Ranking da Sala:** o professor cria um código; só aparecem os **5 melhores do dia**.
- Tutorial de 15 segundos só com setas e números; sons em escala pentatônica (cada bit é uma nota).

O progresso fica salvo no próprio aparelho (localStorage).

## Publicar (GitHub Pages)
1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main`, pasta **/ (root)** e clique em **Save**.
3. Em alguns minutos o jogo abre em `https://<usuario>.github.io/tapbit/`.

> O GitHub Pages em contas gratuitas só funciona com repositório **público**
> (**Settings → General → Danger Zone → Change visibility**).

## Ligar o Ranking da Sala (Supabase)
O endereço e a chave pública do Supabase ficam em `js/config.js` (hoje, o mesmo projeto usado pelo Turtle Race).
1. No Supabase, abra **SQL Editor**, cole o conteúdo de `supabase/tapbit.sql` e clique em **Run**.
2. Pronto. No jogo: **Sala → Sou professor(a) → Criar sala** mostra o código e um QR Code do jogo.

Os alunos só conseguem ver o top 5 do dia de uma sala cujo código conhecem; a tabela não pode ser lida diretamente.
Sem o SQL, o jogo funciona normalmente e a tela da Sala avisa que o ranking ainda não foi ligado.

## Estrutura
```
index.html          todas as telas
css/style.css       visual (Cyber-Cartum) e temas dos botões
js/store.js         progresso salvo no aparelho
js/audio.js         efeitos e música chiptune (Web Audio)
js/robot.js         robôs-avatar desenhados em canvas
js/levels.js        os 4 setores, 20 fases e a Missão Relâmpago
js/missions.js      missões diárias
js/shop.js          Oficina de Skins e estilos de laser
js/game.js          motor do jogo (canvas, Painel de Bits, combo, PEM)
js/sala.js          Ranking da Sala (Supabase) e QR Code
js/tutorial.js      tutorial de 15 segundos
js/main.js          menus e fluxo entre telas
supabase/tapbit.sql tabelas e funções do ranking
docs/GDD.md         documento de design
```
