# ARQUITETURA.md — App "Preços"

Documento de referência para quem for mexer no código (Claude ou pessoa). Ler inteiro antes de começar uma versão nova. Conferido contra o código da v1_70 em 2026-10-23; se algo aqui divergir do `index.html`, o código vale e este documento deve ser corrigido.

---

## 1. O que é

App 100% offline para registrar preços de itens e, sobre eles, gerenciar receitas, preparos, transformações e listas de compras.

- HTML único (`index.html`), sem servidor, sem dependências externas.
- Dados no IndexedDB do celular.
- PWA instalado pelo Chrome, publicado no GitHub Pages (branch `main`, raiz).
- Hoje: ~146 itens, ~610 preços. **O histórico do usuário não pode ser perdido em nenhuma versão.**

## 2. Arquivos do repositório

| Arquivo | Função |
|---|---|
| `index.html` | Todo o app (HTML + CSS + JS). Manter único. |
| `sw.js` | Service worker (cache offline, timeout de rede de 3 s). |
| `manifest.webmanifest` | Manifesto do PWA. |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Ícones. |
| `ARQUITETURA.md` | Este documento. |

## 3. Regras de ouro (não quebrar)

1. **Nunca perder dados.** Mudança de esquema exige migração sem perda e incremento de `DB_VERSION`.
2. **Todo dado novo precisa entrar no backup completo `.json`.** O backup é genérico: exporta *todos* os stores do banco e todas as chaves de `localStorage` que começam com `precario_`. Logo: store novo e campo novo em registro existente entram sozinhos; **chave nova de `localStorage` deve começar com `precario_`**, senão fica fora do backup. Dado guardado em qualquer outro lugar (variável, cache, outra chave) é perdido na restauração.
3. **Reaproveitar antes de criar:** mesmo picker, mesma máscara de quantidade/dinheiro, mesmos helpers. Padronizar tem prioridade sobre fazer rápido.
4. **HTML único.** Não dividir em vários arquivos.
5. **Toda versão incrementa o número** (`v1_NN`), mesmo que pequena.
6. **Confirmação antes de qualquer exclusão.** Diálogos próprios (o nativo mostra o endereço do site).
7. **Nunca mostrar custo zero quando faltar dado:** mostrar o motivo (sem preço, sem conversão, referência circular).

## 4. Versão e publicação

- A cada versão, trocar **juntos**: `APP_VERSION` (em `index.html`) e `CACHE` (em `sw.js`, formato `precos-vX_YY`).
- Fluxo com Git: uma branch por versão; commit; push com `-u`; **só mergear na `main` (ff-only) quando o usuário disser "pode publicar"**, porque a `main` publica o app instalado.
- Lembrar o usuário de fazer **backup `.json` antes de publicar**.
- Depois de publicar, criar a branch da próxima versão.
- A tela "Sobre" mostra a versão instalada.

## 5. Verificação antes de entregar

1. Extrair o JS do `index.html` e rodar `node --check`.
2. Smoke test com Playwright (chromium, `file://`): semear dados via `putRecord` + `reloadAll`, navegar, voltar com `page.go_back()`.
3. Quando mexer em preparo, comparar as telas com o backup real do usuário.
4. Conferir que o dado novo aparece no backup e volta na importação (store novo precisa existir no `onupgradeneeded` para ser restaurado; a importação ignora stores que o banco não conhece).

## 6. Dados (IndexedDB)

`DB_VERSION = 10`. Todos os stores usam `{keyPath:'id', autoIncrement:true}` e são criados em `onupgradeneeded` com `if(!contains)`. Acesso via `getAll`, `putRecord(store,obj)`, `deleteRecord`, `reloadAll()` (recarrega as variáveis globais, ex.: `LISTAS`, `TRANSFORMACOES`).

Stores:

- **Preços:** `categorias`, `subcategorias`, `itens`, `locais`, `precos`, `duplicatas_ignoradas`, `tags`.
- **Medidas:** `unidades`, `conversoes`, `estados` (cru, cozido, assado...).
- **Agrupamento de itens:** `grupos_itens`, `grupo_itens_membros`.
- **Receitas:** `receita_categorias`, `receita_subcategorias`, `equipamentos`, `receitas`, `receita_ingredientes`, `receita_etapas`.
- **Preparos:** `receita_preparos`, `preparo_ingredientes`, `preparo_etapas`.
- **Transformações:** `transformacoes`.
- **Listas de compras:** `listas_compras` (`nome`, `descricao`, `criadaEm`), `lista_compras_itens`.
- **Importação de receitas:** `importacao_equivalencias` (`tipo` = `item`|`unidade`|`estado`|`categoria`, `chave` = nome normalizado do arquivo, `alvoId`): ligações escolhidas à mão na conferência, reaproveitadas nas próximas importações.

Fotos **não** têm store próprio: ficam como imagem redimensionada (data URL) no campo `foto` do próprio registro (`itens`, `categorias`, `receitas`...), e por isso já vão no backup `.json` (o `.csv` não leva fotos).

Configurações ficam em `localStorage` com prefixo `precario_cfg_*` (lidas por `loadConfig()`; padrões em `CONFIG_DEFAULTS`).

Campos relevantes já decididos:

- **Item:** `dimensaoReferencia` (`peso` | `volume` | `unidade`); a quantidade/unidade da embalagem fica em **cada lançamento de preço**, não no item. Regra de custo mínimo: `custoMinQtd` e `custoIndivQtd` (quantidades, não R$), `regraUnidadeId`, `regraPrioridade` (`'maior'` padrão, `'indivisivel'`, ...). Item de contagem: `convQtd` + `convUnidadeId` ("1 un = X g/ml"). Densidade: `densVolQtd`, `densVolUnId`, `densPesoQtd`, `densPesoUnId` (ex.: 100 ml = 92 g; só para itens de peso/volume). `foto`.
- **Preparo (`receita_preparos`):** `receitaId`, `data`, `escala`, `custoRealizado`, `pesoFinalReal`, `porcoesFinais`, `rodadaGrupos`, `rodadas`, `obs`, `fatorBase` (texto da base do fator, ex.: "alho 590 g"; zera se o fator for mexido à mão).
- **Ingrediente de preparo (`preparo_ingredientes`):** `quantidade` (prevista, somente leitura), `quantidadeReal`, `comentarioPreparo` (separado do `observacao` da receita), `transformacaoId` (liga a transformação ao preparo e, por ele, à receita).
- **Transformação:** item de origem, data, valor pago (vazio = preço médio), `layout` (`'padrao'` | `'cachorros'`; **ausente = `'cachorros'`**, ver `layoutDaTransformacao`). Layout padrão usa `etapas[]` com `pesoInicial`, `estadoInicialId`, `pesoFinal`, `estadoFinalId`; layout cachorros usa `rodadas`, cozido, caldo e purê.
- **Categoria de receita (`receita_categorias`):** `layoutTransformacao` (`'padrao'` | `'cachorros'`; ausente = `'padrao'`). O último layout usado fica em `CONFIG.transfLayoutUltimo`.
- **Migrações únicas:** marcadas por chave em `localStorage` (ex.: `precario_mig_layout_cat_v1`); devem ser idempotentes e, por terem prefixo `precario_`, entram no backup.

## 7. Motor de custo

- Recursivo: sub-receita = custo total ÷ rendimento.
- Protege contra referência circular e contra itens sem preço ou sem conversão (mostra o motivo).
- Rendimento %: bruto = líquido ÷ rendimento%.
- Custo mínimo/indivisibilidade: soma o mesmo item dentro da receita/preparo **antes** de aplicar a regra e depois rateia.
- Conversão peso↔volume via densidade do item (`densidadeDoItem`, `converterPesoVolumeDoItem`).
- Transformação: custo por unidade útil = valor pago ÷ (comprado − descarte) no layout cachorros; no layout padrão, valor pago ÷ peso final da última etapa.
- Exibição: custo por kg/L (não por g/ml); peso < 100 g com 2 casas, ≥ 100 g sem casas; dinheiro com 2 casas; milhar com ponto.

## 8. Preparo e lotes dos cachorros

Processo real (a cada 3–4 semanas): (1) cru → cozido; (2) cada ingrediente cozido é batido em purê, com ou sem caldo; (3) tudo junto em rodadas de liquidificador (máx. ~10 porções; rodadas de tamanho parecido, no máximo 2 tamanhos diferentes; capacidade fica na receita).

- Receita cadastrada por 1 porção com o item cozido.
- Nº de porções finais decidido pelo purê sem caldo; a referência por porção é a da receita padrão, ajustando g/porção para compensar ingrediente que rendeu menos (não é "purê ÷ porções"; tolerância ~10%).
- Caldo não tem custo. Custo por potinho conta só o usado; a sobra fica à parte.
- Usa-se o peso **real** de cada etapa na etapa seguinte.
- Helpers globais: `gp*`, `gpRodLinhas`, `gpCaldoPlanejado`.
- Novo preparo = mini-formulário (data + escala, com "quero produzir X" e modo "tenho X de um ingrediente"). `openPreparoForm` só serve para editar.

## 9. Navegação e camadas de UI

- **Pilha única `navStack`** (telas + modais). O botão voltar do celular desempilha; não sai do app.
- `camadaTopoAtiva()` devolve a camada do topo.
- Camadas (`criarCamada`) têm `dirty` / `salvando` / `confirmarDescarte`: sair de edição com alterações pede confirmação.
- **Só empilha** por atalhos dentro das telas. Barra inferior, itens do "Mais" e "← Voltar" do Mais são **raiz** e zeram a pilha: `switchView(name, {raiz:true})`.
- Barra inferior (`.tab-btn[data-view]`): Preços, Itens, Receitas, Transf., Gráfico, Boas, Mais. Categorias, Locais e demais telas ficam dentro do Mais.

## 10. Padrões visuais

Modos de leitura têm **3 estilos de texto**:

| Estilo | Classe | Uso |
|---|---|---|
| Título | `.view-heading` | Cabeçalhos de bloco |
| Texto normal | `.leitura` (14 px) | Conteúdo |
| Nota de rodapé | `.view-nota` / `.hint` / `.obs` (12 px, cinza) | Observações, custos, metas |

- Observações de item (da receita e comentário do preparo) são **sempre** nota de rodapé.
- Textos explicativos estáticos usam o ícone "?" que abre/fecha: `.ajuda-p`, `.ajuda-btn`, `.ajuda-txt`. Hints calculados ou vazios não.
- Helpers de UI compartilhados: `optionsHTML`, fábrica de camadas, `fatorPorIngredienteHTML/Attach`, picker de itens, máscaras de quantidade e dinheiro.
- Textareas crescem com o texto. Campo de busca tem ✕; filtros têm "✕ Limpar".

## 11. Backup

- Arquivo `.json` completo (`app:'precario'`, `versao:3`, `stores`, `configuracoes`), nome com hora: `precario_backup_AAAA-MM-DD_HHhMM.json`.
- Exportação genérica: percorre `db.objectStoreNames` e todas as chaves `precario_*` do `localStorage`; nada é listado à mão.
- Importação: **apaga os dados atuais** e substitui pelos do backup, só dos stores que o banco conhece. Backups antigos (só categorias, itens, locais e preços) mantêm receitas, preparos e transformações atuais.
- Há também exportação/importação `.csv` só de preços (sem fotos).
- **Importar receitas (.json)** (v1_70, bloco `IMPORTAR RECEITAS` no `index.html`, prefixo `imp*`): só **soma**, nunca apaga (diferente do restaurar backup). Formato `{formato:'precario-receitas', versao:1, receitas:[{nome, descricao, categoria, subcategoria, tags[], equipamentos[], rendimento:{quantidade,unidade}, tempoMin, fonte, observacoes, ingredientes:[{secao,nome,quantidade,unidade,estado,observacao}], etapas:[texto|{texto,tempoMin}]}]}`. Fluxo: `impMontarPlano` (entradas ÚNICAS de item/unidade/estado/categoria; casou = nome normalizado igual ou equivalência lembrada; sugestão por similaridade de tokens, **nunca aplicada sozinha**) → tela de conferência (`impAbrirConferencia`, nada gravado) → `impExecutar` grava tudo numa única transação (falhou = nada muda). Item sem correspondência só é criado se o usuário escolher "Criar novo"; "Ignorar" anota o ingrediente na observação da receita; unidade desconhecida → "sem unidade" guarda o texto original na observação; kg/L viram g/ml; receita com título já existente vem desmarcada; sub-receita e grupo de itens não são importados. O botão "Copiar instruções para IA" (`impInstrucoesIA`) monta o prompt com as listas atuais de itens, unidades, estados e categorias, para a IA usar os mesmos nomes.
- `navigator.storage.persist()` está ativo; Wake Lock nativo funciona no preparo.

## 12. Fora de escopo (decidido)

- Receita → lista de compras automática.
- Snapshots e análises avançadas de custo.
- Backup criptografado.
- Implementar toda a especificação v2.0 de receitas (é referência, não meta).

## 13. Pendências conhecidas

- Lista de compras: total estimado, sugestão de melhor local / agrupar, repetir/duplicar lista; atalho de volta do gráfico para a lista.
- Versionamento de receitas.
- Conversões un↔g, etapa B: sugerir média observada, nunca trocar sozinho.
- Variação de custo por estado (cru/cozido).
- Possível: aproximar a fonte dos metadados dos cards (12,5 px) da nota de rodapé (12 px); cards/listas e telas de edição ainda fora do padrão de leitura.

## 14. Armadilhas conhecidas

- O hook de "unpushed" pode reclamar quando o ref remoto local não atualiza: `git fetch origin <branch>:refs/remotes/origin/<branch>`.
- O celular já abriu o app via `content://`; por isso o HTML único é mantido.
- Chrome instalado como PWA: após publicar, o service worker só atualiza se `CACHE` mudou.

## 15. Como atualizar este documento

Ao fechar uma versão que altere esquema, helpers, regras de custo ou padrões de UI, atualizar a seção correspondente no mesmo commit.
