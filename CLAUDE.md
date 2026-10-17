# App "Preços" — instruções para o Claude

**Antes de qualquer alteração, leia o `ARQUITETURA.md` inteiro.** Ele descreve os dados, o motor de custo, a navegação, os padrões visuais e o backup. Se o código divergir do documento, o código vale: corrija o documento no mesmo commit.

Se a skill `versao-app-precos` estiver disponível, **carregue-a antes de começar qualquer versão** (desenvolver, testar ou publicar): ela traz o passo a passo completo. Se não estiver, siga o resumo abaixo.

## Fluxo de versão (resumo)

- Uma branch por versão (`v1_NN`). Toda versão incrementa o número, mesmo que pequena.
- Trocar **juntos** `APP_VERSION` (`index.html`) e `CACHE` (`sw.js`, formato `precos-vX_YY`).
- Antes de entregar: extrair o JS e rodar `node --check`; smoke test com Playwright; conferir que o dado novo vai e volta no backup `.json`.
- **Só mergear na `main` (ff-only) quando o usuário disser "pode publicar"**, porque a `main` publica o app instalado. Lembrar do backup `.json` antes.
- Depois de publicar, criar a branch da próxima versão.

## Regras que não podem quebrar

- Nunca perder o histórico do usuário: mudança de esquema exige migração sem perda e novo `DB_VERSION`.
- Chave nova de `localStorage` começa com `precario_` (senão fica fora do backup).
- Reaproveitar helpers e padrões de UI antes de criar algo novo.
- Manter o HTML único. Confirmar antes de qualquer exclusão.

## Sobre o usuário

Não conhece GitHub: conduza o fluxo de Git por ele e explique em português simples. Usa o plano gratuito com limite de uso: prefira entregas em pedaços por sessão, salvo quando uma versão maior compensar.
