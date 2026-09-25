# Missão Coimbra

Abre `index.html` com um duplo clique, num navegador. Não é necessário instalar nada nem iniciar um servidor.

Mantém o HTML junto dos ficheiros JavaScript, `style.css` e das pastas `images` e `vendor`. Para levar o passeio para outro computador, copia a pasta completa.

O roteiro incluído abre sem internet. Os mapas e as ligações para fontes precisam de ligação à internet. O progresso fica neste navegador quando o armazenamento local está disponível; alguns navegadores limitam esta funcionalidade para ficheiros locais.

## Alterar o roteiro

1. Edita e guarda `dados.json`.
2. Abre `index.html` e carrega em **Carregar roteiro**, no rodapé.
3. Seleciona o JSON e escolhe **Usar este roteiro e recomeçar**.

O navegador não lê automaticamente alterações a ficheiros vizinhos quando o HTML abre diretamente. Por isso, o HTML inclui uma cópia do roteiro e a seleção do JSON permite atualizar essa cópia para este navegador. Importar um roteiro reinicia o progresso. Se o navegador bloquear o armazenamento, a importação vale apenas enquanto a página estiver aberta.

**Restaurar roteiro incluído e recomeçar** volta à versão incluída no HTML.

O percurso tem 12 paragens e 3,3 km. Em cada paragem há uma pergunta, a explicação com fonte e a opção de guardar uma fotografia. Cada pessoa participa no seu dispositivo; não há pontuações nem sincronização entre dispositivos.

## Verificação técnica

`node --test tests/ficheiro-local.test.cjs` verifica o carregamento sem servidor, o JSON incorporado, a importação e o funcionamento sem armazenamento local.

## Fotografias e cartão

Depois de responder à pergunta de uma paragem aparece **Tirar fotografia** (ou **escolher da galeria**). A fotografia fica guardada logo e o percurso continua; nada é gerado durante o caminho. Há uma fotografia por paragem: é possível trocá-la ou removê-la, e voltar a paragens anteriores tocando nos pontos da barra de progresso.

O cartão só é criado quando se carrega em **Terminar e criar o cartão**, na última paragem. É um PNG de 1080 × 1920 píxeis (formato de story): as paragens aparecem nas posições reais do mapa, ligadas como uma rede elétrica, com o Mondego, a silhueta da Alta iluminada, a data, a distância e o tempo decorrido. As fotografias ocupam os nós da rede; as paragens sem fotografia aparecem como nós pequenos numerados. No ecrã final é possível acrescentar ou trocar fotografias e o cartão é redesenhado. Em telemóveis compatíveis aparece **Partilhar cartão**; **Guardar cartão** descarrega o PNG.

As imagens são reduzidas para um máximo de 1600 píxeis e guardadas em IndexedDB, apenas neste navegador e dispositivo. Nada é enviado para o GitHub. Limpar os dados do site ou usar navegação privada pode apagar as cópias locais; guarda o cartão antes de recomeçar.

Após editar CSS, dados ou JavaScript, executa `python3 tools/atualizar-html.py` para atualizar o HTML que inclui esses recursos.
