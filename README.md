# Clara Data Catalog — Frontend

Interface web do [Clara Data Catalog](../clara-data-catalog): descoberta de dados em linguagem de
negócio, perguntas com respostas fundamentadas, curadoria assistida por IA com revisão humana e
administração de fontes. Projeto **isolado**: não compartilha código com o backend; a integração
é só o contrato HTTP.

## Rodar

Pré-requisito: o backend em execução (`docker compose up -d` no repositório `clara-data-catalog`).

**Desenvolvimento** (Node ≥ 20.19):

```bash
npm install
npm run dev            # http://127.0.0.1:5173 — o Vite repassa /api para http://127.0.0.1:8000
```

Para outro endereço de API, crie `.env` a partir de `.env.example` e ajuste `CLARA_API_URL`.

**Docker** (Nginx servindo o build, na mesma rede do backend):

```bash
docker compose up -d --build   # http://127.0.0.1:3000
```

Variáveis: `CLARA_WEB_PORT` (padrão 3000), `CLARA_BACKEND_NETWORK` (padrão `clara_default`, a rede
criada pelo compose do backend) e `CLARA_API_UPSTREAM` (padrão `http://api:8000`).

Entre com um usuário de demonstração do seed do backend (ex.: `joao.consumidor`, `carlos.curador`,
`bia.aprovadora`, `ana.admin`; no domínio produção, `carla.curadora`, `paulo.aprovador` e
`lucas.producao`). Os papéis vêm do backend (`role_bindings`), não do frontend.

## Verificar

```bash
npm run check                                       # typecheck + lint + testes
npm test                                            # testes de unidade e de componentes
CLARA_API_URL=http://127.0.0.1:8000 npm run contract   # contrato contra o openapi.json real
npm run build
```

O **teste de contrato** confere, contra o backend no ar, que cada endpoint consumido existe com o
mesmo método, que os enums da UI (visibilidade, confiança, decisões…) coincidem com os do backend e
que os campos enviados na revisão existem. Se o backend mudar o contrato, ele falha.

## Como se conecta ao backend

- O navegador fala sempre com a **mesma origem** em `/api`. Em desenvolvimento o proxy do Vite e,
  em produção, o Nginx repassam para a API. O backend não precisa de CORS nem de alteração.
- Identidade: interface `IdentityProvider`. Hoje só existe `DevHeaderIdentity`, que envia
  `X-Clara-User` — aceito pelo backend **apenas em dev/test**. Produção exige um provedor real
  (OIDC/Entra ID) implementando a mesma interface; nenhuma tela muda.
- Operações longas (sincronizar, gerar rascunho, aplicar revisão) devolvem `job_id`;
  `useJobTracker` acompanha até o fim e permite cancelar.
- Corpo JSON sempre em UTF-8 (acentos funcionam, diferente do `curl` no `cmd` do Windows).

## Arquitetura

```
src/
  core/        contratos e composição (HttpClient, IdentityProvider, ApiError, config, services)
  api/         um serviço por área do backend + catálogo de endpoints + tipos + queryKeys
  features/    search · cards · curation · demands · assets · admin · session (página, hooks, componentes)
  shared/      UI acessível (primitives, states, statusBadges, notifications), jobs, format
  app/         rotas, shell (navegação por papel), provedores
  styles/      tokens de design (tema claro/escuro) e base global
```

Pilha: React 19, React Router 7 (rotas com carregamento sob demanda), TanStack Query 5 (estado do
servidor e cache), TypeScript 5.9 estrito, Vite 7, Vitest 3 + Testing Library, ESLint 10.

### SOLID na prática

| Princípio | Onde |
|---|---|
| Responsabilidade única | Página só compõe; hooks só buscam/alteram dados; serviços só traduzem chamadas; `draftEdits.ts` só monta edições (função pura); componentes de UI não conhecem a API. |
| Aberto/fechado | Novo endpoint = entrada em `api/endpoints.ts` + método no serviço; novo estado de domínio = linha em `statusBadges.tsx`; nova página = rota em `app/routes.tsx` e item em `app/navigation.ts`. |
| Substituição de Liskov | Qualquer `HttpClient` (o `fetch` real ou o `FakeHttpClient` dos testes) e qualquer `IdentityProvider` funcionam no lugar do outro. |
| Segregação de interfaces | `DiscoveryApi`, `CurationApi`, `AssetsApi` e `OperationsApi` são separados; cada tela depende só do que usa. |
| Inversão de dependência | Telas recebem serviços por contexto (`useServices`); só `core/services.tsx` conhece implementações concretas. O ESLint proíbe importar `FetchHttpClient` fora da raiz de composição. |

### Feito para quem não é técnico

- **Três formas de explorar**: buscar (com sugestões enquanto digita), perguntar (com exemplos
  vindos das próprias fichas) e navegar por domínio e assunto, sem precisar saber o que digitar.
- **Nunca termina sem caminho**: pedidos de valor ("quanto vendemos?") mostram a ficha e o
  responsável; perguntas vagas oferecem opções ("É este"); sem resultado, há "Pedir ajuda a um
  curador".
- **Glossário visível**: a busca diz o que entendeu ("Também procurei por: faturamento").
- **Fichas em linguagem simples**: "Em poucas palavras" e "Perguntas que esta ficha ajuda a
  responder" aparecem antes dos detalhes técnicos.
- **Sem jargão para quem só consulta**: nome técnico, revisões, versões e tipos de coluna ficam em
  "Detalhes técnicos" (recolhido) para quem não lê metadados; confiança e visibilidade são
  explicadas em texto visível, não só no tooltip.
- **Corrigir sem IA**: curadores veem "Editar ficha" na ficha publicada; abre uma revisão com o
  conteúdo aprovado atual (sem gerar texto), que sugere mudança "editorial" para manter o selo.
- **Ciclo de melhoria**: "Isso ajudou?" e pedidos de ajuda alimentam a tela **Demandas dos
  usuários**, onde curadores veem o que mais se procura sem resposta e ensinam o glossário com um clique.

### Painel de governança

`/governanca` (curadores, aprovadores e administradores) cruza **procura** com **qualidade de
catalogação**: saúde do catálogo (cobertura de fichas, certificação, pontuação média), uso no
período (buscas, perguntas, fichas abertas, taxa sem resposta), frequência de interação por dia,
lacunas mais comuns, prioridades de curadoria (procuradas e mal documentadas), mais e menos
procuradas, bem e pouco catalogadas, e a visão por fonte de dados ou domínio. A pontuação e a
privacidade (contagens agregadas, sem identificar quem consultou) são explicadas na própria tela
e definidas no ADR 0014 do backend. Os gráficos são SVG próprios: cores de série validadas para
daltonismo no claro e no escuro, legenda, tooltip por teclado e a mesma informação em tabela.

### UX e acessibilidade

- Estados explícitos em toda consulta (carregando, vazio, erro com "tentar de novo").
- Status sempre com **texto e cor** (confiança, visibilidade, situação da tarefa, nível de evidência).
- Rótulos associados a campos, mensagens de erro com `role="alert"`, avisos em `aria-live`,
  link "Ir para o conteúdo", foco visível, tema escuro automático, `prefers-reduced-motion`.
- A UI explica regras do domínio onde elas importam: fichas não certificadas, revisão pendente após
  mudança na origem, evidências como conteúdo não confiável, indícios de dados pessoais que não são
  parecer LGPD, responsável que nunca é definido pela IA.
- Concorrência otimista: a revisão envia a revisão e a versão técnica exibidas; se mudaram (409), a
  tela explica e recarrega.

## Autorização

A navegação e os botões usam um espelho das políticas do backend (`core/auth/permissions.ts`)
**apenas para orientar a interface**. Quem autoriza é sempre o backend; recursos sem permissão
respondem 404, e a UI mostra uma mensagem neutra. O cache é descartado ao trocar de usuário.

## Limites atuais

- Identidade de desenvolvimento apenas (sem OIDC/Entra ID).
- A tela de fontes cadastra fontes novas (Databricks só com host e credencial: a Clara encontra o
  SQL Warehouse ou pede a escolha, testa e descobre a origem), seleciona o que publicar numa árvore
  catálogo → schema → tabela, com filtros de tipo (gerenciada, externa, view...) e formato (Delta,
  Parquet...), testa, sincroniza e importa arquivos. Editar conexão, credencial, agenda ou limites de uma fonte existente ainda é
  pela API (`POST /sources` com o mesmo `id` substitui a configuração).
- Edição de rascunho cobre os campos principais (nome, descrição, assunto, granularidade,
  sinônimos, limitações); significados de coluna são revisados pela regeneração ou pela API.
- Sem testes ponta a ponta em navegador real (Playwright) — os testes de componentes usam jsdom.
