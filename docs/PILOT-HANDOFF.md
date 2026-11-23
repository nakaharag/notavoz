# NotaVoz — handoff do piloto sintético

Esta mudança prepara uma instância única em Ubuntu 24.04 x86_64, 2 GB de RAM. Não houve push, publicação, provisionamento AWS, uso de credenciais reais nem registros de pacientes. O piloto deve usar somente pessoas, textos e gravações fictícias.

## Arquitetura e contrato

Internet → Caddy (TCP 80/443, HTTPS automático) → frontend nginx:3000 ou backend Nest:3000. Caddy preserva `/api`; Nest recebe `API_PREFIX=api`. React é compilado com `REACT_APP_API_URL=/api`. O Compose de produção é independente do Compose raiz/Coolify e de redes externas.

Backend e frontend não publicam portas. A rede `private` é interna. Caddy e backend têm uma segunda rede bridge para saída (ACME e OpenAI); isto não publica suas portas. Apenas Caddy recebe tráfego do host. O endpoint `/api/health` verifica acesso ao diretório de dados, sem chamar OpenAI ou gastar cota. A saúde do nginx e do Caddy também é verificada. Um container unhealthy não reinicia automaticamente: `restart: unless-stopped` cobre saída do processo, e a operação precisa monitorar saúde/disco.

Desenvolvimento continua com `docker compose -f docker-compose.dev.yml up --build`, frontend em localhost:3001 e endpoints Nest sem prefixo em localhost:3000. Credenciais de desenvolvimento existem somente fora de `NODE_ENV=production`. O Compose raiz legado agora exige credenciais explícitas também.

Contratos preservados:

- Login: `{token}`. JWT HS256 via `jsonwebtoken`, validade de 1 hora, issuer `notavoz`, audience `notavoz-web`, subject do usuário configurado; assinatura, algoritmo, expiração e emissão verificados.
- Transcrição: `{transcription}`, API oficial `/v1/audio/transcriptions`, `OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe` por padrão.
- Geração: `{correctedTranscript, summary}`, API oficial `/v1/responses`, `OPENAI_TEXT_MODEL=gpt-5.4-mini`, JSON Schema, `tools: []`, `tool_choice: none`, `store: false`.
- CRUD continua em JSON. PUT também aceita `correctedTranscript` e `summary` para salvar uma geração repetida a partir de um registro existente. `rawTranscript` permanece intacta no PUT.
- Sem Claude, fallback de provedor ou retry automático. O usuário decide quando repetir; cada retry pode gerar cobrança.

Referências verificadas: [Transcrições](https://developers.openai.com/api/docs/guides/speech-to-text), [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini). A conta usada na publicação ainda precisa ter acesso e cota para os dois modelos.

## Requisitos e placeholders da publicação

Preencher antes da publicação:

| Campo | Valor a fornecer |
|---|---|
| VM | `<VM_LIGHTSAIL_UBUNTU_24_04_AMD64_2GB>` |
| IPv4 estático / DNS | `<IP_ESTATICO>` e registros A de ambos os hosts |
| Domínio HTTPS | `<DOMINIO_DO_PILOTO>` |
| Host de redirecionamento | `<DOMINIO_WWW_DO_PILOTO>` (distinto do principal) |
| Usuário | `<USUARIO_DO_PILOTO>` |
| Senha | `<SENHA_ALEATORIA_16_OU_MAIS_CARACTERES>` |
| JWT | `<SEGREDO_ALEATORIO_32_BYTES_OU_MAIS>` |
| OpenAI | `<CHAVE_DE_PROJETO_COM_COTA_E_ACESSO_AOS_MODELOS>` |
| Release / anterior | `<TAG_IMUTAVEL_NOVA>` / `<TAG_IMUTAVEL_ANTERIOR>` |
| Backup / responsável | `<DESTINO_RESTRITO>` / `<RESPONSAVEL>` |

Requer Docker Engine com Compose v2 (>= 2.24.4 para o override do smoke), saída DNS/HTTPS, disco livre para imagens, build e dados, relógio sincronizado e firewall permitindo TCP 80/443; SSH restrito ao operador. Não expor 3000/3001. Não é necessário banco ou serviço AWS adicional. Emissão ACME exige domínio apontando corretamente para a VM, inclusive AAAA se existir. Domínios `.example.com` no exemplo não funcionam para publicação. DNS proxy deve permitir o desafio ACME; inicialmente use DNS direto. Nenhuma configuração de AWS/DNS foi executada nesta tarefa.

Runtime limitado a 960 MiB somando backend (768), frontend (64) e Caddy (128); o restante atende SO/Docker e overhead. Isso é um orçamento, não uma medição na VM. Builds usam mais memória que runtime: execute sequencialmente, sem tráfego, e reserve 2 GB de swap ou prefira construir fora da VM para `linux/amd64` e carregar as imagens. Limites de runtime do Compose não limitam os processos de build. Não foi criado swap ou outro recurso nesta tarefa.

Na VM, após copiar o checkout revisado (não copiar `node_modules`, `data`, `.env` ou áudios):

```sh
umask 077
cp -n .env.example .env
# Edite .env localmente, sem colar segredos no chat ou versioná-los.
openssl rand -hex 32  # use o resultado como JWT_SECRET
chmod 600 .env
# SEED_USERNAME/SEED_PASSWORD criam o primeiro usuário (8+ caracteres). Preencha o domínio e RELEASE_TAG.
docker compose -f docker-compose.prod.yml config --quiet
bash deploy.sh --prepare
# Alternativa: docker load < <ARQUIVO_DE_IMAGENS_AMD64> e pular --prepare.
bash deploy.sh --start
```

`config` sem `--quiet` pode imprimir segredos. O arquivo `.env` é só local. Containers recebem as credenciais em ambiente; administradores do Docker podem inspecioná-las. As imagens base usam tags de família (`node:22-alpine`, `nginx:alpine`, `caddy:2-alpine`); registre os digests efetivos na release e retenha imagens anteriores. Instalações de aplicação usam lockfiles obrigatórios e `--frozen-lockfile`.

Verificação com domínio real (substitua o placeholder antes de executar):

```sh
docker compose -f docker-compose.prod.yml ps
curl -fsS 'https://<DOMINIO_DO_PILOTO>/api/health'
curl -fsSI 'https://<DOMINIO_DO_PILOTO>/'
curl -s -o /dev/null -w '%{http_code}\n' 'https://<DOMINIO_DO_PILOTO>/api/records'
# Esperado: 401. Depois, login no navegador, áudio fictício, geração e CRUD.
```

Não use `-k` no domínio real. Verifique certificado, redirecionamento HTTP→HTTPS e acesso ao microfone via HTTPS. Antes de anunciar o piloto, faça uma transcrição curta fictícia usando a chave real e confirme os dois modelos; os testes automatizados desta mudança não validam acesso/cota da conta.

## Limites e tratamento de falhas

| Recurso | Limite |
|---|---|
| Upload | 1 arquivo; 10 MiB; sem campos extras; proxy com teto de 11 MB para multipart |
| Duração | 300 s verificados por amostras PCM decodificadas, sem confiar no MIME/metadados |
| Navegador | para a gravação aos 295 s |
| Conversão | 30 s, ffmpeg com 1 thread; excedeu: SIGKILL |
| OpenAI | 90 s por operação, incluindo leitura do corpo; AbortController |
| HTTP | headers Nest 15 s; requisição/inatividade 135 s; Caddy header upstream 125 s, escrita 140 s |
| Trabalho caro | 1 transcrição OU geração em andamento; excedente recebe 429, sem fila |
| Login | 5 tentativas/minuto por processo para a conta única, com Retry-After; não depende de X-Forwarded-For |
| Texto | 30 mil caracteres por campo; JSON HTTP 256 KiB; geração até 8192 tokens de saída |
| Memória/processos | heap Node 384 MiB; limites de memória, CPU e PIDs no Compose |
| Logs | 2 arquivos de 5 MiB por serviço; sem payloads clínicos ou áudio |

Áudio fica apenas em memória e pipes; não há cópia temporária em disco. ffmpeg só aceita o protocolo `pipe`, sem abrir URLs/arquivos fornecidos pelo áudio. Backend executa como usuário `node`, root filesystem somente leitura, capabilities removidas e tmpfs limitado. Registros são gravados com modo 0600; diretórios novos, 0700. Escrita de cada JSON usa rename atômico e descarte do temporário em `finally`.

Falhas de processamento OpenAI/ffmpeg retornam `code`, `message` e `retryable`, sem ecoar corpo do provedor. Validações de DTO, UUID e multipart usam os erros HTTP padrão do Nest (400/413). Credencial OpenAI é 502 com `PROVIDER_CREDENTIAL`, distinta do 401 de sessão local. Há códigos separados para rate limit (429), cota (502), modelo indisponível (502), timeout (504), entrada inválida (400), resposta cortada/inválida e recusa. A UI mostra a mensagem, preserva a transcrição bruta e permite retry da geração, inclusive em um registro salvo. Pode salvar a transcrição mesmo quando a geração falha. Erros não somem automaticamente. Expiração da sessão não limpa o texto em memória.

Rascunhos e áudio de retry ficam na memória do navegador: salvar o registro antes de fechar/recarregar a aba. A gravação não é armazenada no servidor. `store=false` desativa armazenamento da resposta de geração por esse parâmetro; não significa retenção zero de todos os dados/processamentos do provedor. Dados reais continuam fora do escopo deste piloto.

## Persistência, backup e rollback

Volumes do projeto `notavoz-pilot`:

- `notavoz-pilot_notavoz_data`: `/app/data`, índice e registros JSON. Não usar múltiplas réplicas; não há transação entre o arquivo de registro e o índice. Uma interrupção entre as duas gravações pode exigir reconciliação de backup.
- `notavoz-pilot_caddy_data`: certificados, chaves e estado ACME; preservar para evitar reemissão e limites ACME.
- `notavoz-pilot_caddy_config`: configuração persistida do Caddy.

`docker compose restart` e `down` sem `-v` preservam os volumes. Não executar `down -v` nem limpeza de volumes no piloto. Fixar o nome de projeto evita criar silenciosamente outro conjunto de dados.

Backup consistente dos dados, com pausa breve do backend (operador executa; pasta já existente e restrita):

```sh
docker compose -f docker-compose.prod.yml stop backend
umask 077
docker run --rm --network none \
  -v notavoz-pilot_notavoz_data:/source:ro \
  -v '<CAMINHO_ABSOLUTO_BACKUP>:/backup' alpine \
  tar czf /backup/notavoz-data-pre-release.tgz -C /source .
docker compose -f docker-compose.prod.yml start backend
```

Faça também backup dos dois volumes Caddy em uma janela de manutenção, parando Caddy durante a cópia. Restrinja, criptografe e teste restauração em volumes separados. Nunca armazene backup dentro de um contexto de build.

Rollback: manter o checkout/configuração anterior e as imagens `notavoz-backend:<TAG_ANTERIOR>` e `notavoz-frontend:<TAG_ANTERIOR>`. Após salvar backup, restaurar a configuração da release anterior em outro diretório (sem reset destrutivo), manter `name: notavoz-pilot` e os volumes, definir `RELEASE_TAG=<TAG_ANTERIOR>` no `.env` e executar:

```sh
docker compose -f docker-compose.prod.yml up -d --no-build --wait
```

Não executar `--prepare` no rollback, pois reconstruiria tags. Formato de registros é compatível com o existente; a release com contas em banco migra os registros JSON para o SQLite no primeiro boot (a pasta antiga vira `records.migrated-<data>`); faça backup antes e, para voltar a uma release anterior, restaure o volume do backup. Tokens anteriores ao JWT com issuer/audience serão invalidados e exigirão novo login. Se precisar restaurar dados, pare o backend, preserve o estado atual, extraia o backup aprovado no volume, mantenha UID/GID 1000 e valide saúde/CRUD antes de retomar. Rotacionar JWT_SECRET invalida todas as sessões.

## Testes reproduzíveis e evidência

Todos os exemplos são sintéticos. Os testes HTTP sobem Nest real e usam ffmpeg local; `fetch` é mockado para OpenAI. Diretórios de teste são criados com `mkdtemp` e removidos no teardown. Não se usa `backend/data` nos testes.

```sh
cd backend
pnpm install --frozen-lockfile
pnpm test:e2e --runInBand
pnpm test --runInBand
pnpm run build
cd ../frontend
pnpm install --frozen-lockfile
CI=true REACT_APP_API_URL=/api pnpm test --watchAll=false --runInBand
REACT_APP_API_URL=/api pnpm run build
cd ..
bash -n deploy.sh deploy/smoke.sh
```

Smoke Docker completo, quando o daemon estiver disponível, com Python 3 e curl instalados:

```sh
bash deploy/smoke.sh
```

Esse script usa projeto/volumes `notavoz-smoke`, credenciais fictícias, certificados locais Caddy e portas somente em loopback 8080/8443. O preload OpenAI é montado apenas pelo override `deploy/compose.smoke.yml`, nunca na imagem de produção. Verifica HTTPS, `/api`, autorização, login, transcrição sintética, geração, erro de modelo, CRUD e persistência após restart do container. Não chama ACME público nem OpenAI. O `-k` existe apenas para o certificado de teste local. Os containers são removidos no final, os volumes sintéticos são preservados para inspeção.

Resultados desta sessão (macOS arm64, Node 20.19.3; não é a VM alvo):

- Instalação dos lockfiles e builds locais concluídos.
- Backend: 16 testes de integração e 7 unitários aprovados; inclui JWT expirado/alterado/sem exp, claims incorretas, entrada/UUID, limites reais de áudio, resposta truncada, credencial/rate limit/cota/modelo/timeout, persistência após reinicializar Nest e CRUD.
- Frontend: 2 testes de login limitado e retry sem retranscrição aprovados; build `/api` concluído. Avisos existentes de React hooks/variável não utilizada, Browserslist antigo e depreciação `act` na biblioteca de teste.
- `docker compose config --quiet` passou em produção e no override smoke; shell scripts passaram em `bash -n`.
- `compose build` e `compose up --no-build` foram tentados e bloqueados: `Cannot connect to the Docker daemon at unix:///Users/gustavofreestar/.docker/run/docker.sock. Is the docker daemon running?` O erro de permissão inicial do Buildx foi rechecado fora do sandbox, confirmando indisponibilidade do daemon.
- O teste HTTP precisou rodar fora do sandbox por `listen EPERM`. Só abriu porta local e usou mocks.
- Não executados: containers, Caddy/ACME real, smoke Docker, persistência de volumes Docker, consumo/OOM em 2 GB, build/runtime linux/amd64 e acesso aos modelos com chave real. São os gates pendentes para publicação.

## Arquivos e limites de escopo

Infra: `docker-compose.prod.yml`, `Caddyfile`, Dockerfiles existentes, `.dockerignore` dos dois serviços, `.env.example`, `deploy.sh`, `deploy/compose.smoke.yml`, `deploy/openai-mock.cjs`, `deploy/smoke.sh`. Compose dev mantém desenvolvimento local; Compose legado perde credenciais de fallback em produção.

API: auth com biblioteca JWT e rate limit; configuração/prefixo/health; limites de trabalho/upload/DTOs; serviços OpenAI, fala e geração; remoção do serviço Claude; persistência com permissões e escrita atômica por arquivo. `package.json`/lockfile só mudam dependências necessárias à troca de auth/provedor. Imports relativos permitem executar `node dist/main.js` sem aliases de desenvolvimento.

UI: `frontend/src/App.js` preserva texto bruto, oferece retry, mostra falhas e limita gravação. Testes em `backend/test`, specs de serviços e `frontend/src/App.test.js`; tipos Jest habilitados no tsconfig. README aponta para este handoff.

O repositório estava limpo na primeira inspeção. Durante a tarefa surgiram alterações concorrentes; foram incorporadas, com snapshot anterior à integração em `/private/tmp/notavoz-concurrent-changes.patch`. Nenhum commit/push foi feito.

Limitações do piloto: contas em SQLite com registros por usuário, sem papéis de administrador (usuários são gerenciados por script na VM); JWT em localStorage; rate limit em memória reinicia junto do processo e pode causar indisponibilidade breve da conta; disco/quantidade de registros sem quota automatizada; índice JSON sem transação multiarquivo; backups/monitoramento operacionais ainda precisam ser configurados. Dependências legadas não passaram por atualização geral nesta mudança. O deploy é revisável e os testes locais passam, mas não deve ser declarado validado em Lightsail antes dos gates acima.

## Publicação em notavoz.com.br (2026-11-23)

- URL: https://notavoz.com.br. Release `d14027a-wt2da36de8` (base `d14027a` + alterações locais), projeto `notavoz-pilot` em `/opt/notavoz`, VM `54.207.75.227`. Imagens amd64: backend `3b3ed3f8eae1`, frontend `247134047486`, `caddy:2-alpine` `003a97808e78`.
- Operação só com o domínio principal: o bloco `www` foi removido do Caddyfile e `NOTAVOZ_WWW_DOMAIN` não é mais usada. `www` e `api` continuam na origem antiga (Cloudflare, com proxy).
- Swap de 2 GiB em `/swapfile` (persistente no fstab). A VM tem 909 MB de RAM.

### Reverter o DNS

Estado anterior na Cloudflare (zona `notavoz.com.br`), todos A, TTL Auto, Com proxy, conteúdo `145.223.27.154`: `@`, `www`, `api`. Sem AAAA e sem MX. Para voltar: editar o A de `@` para `145.223.27.154` e ativar o proxy. A origem antiga estava sem resposta (80/443/22) antes do corte.

### Parar a nova stack preservando os volumes

```sh
cd /opt/notavoz && sudo docker compose -f docker-compose.prod.yml stop
```

Religar com `sudo docker compose -f docker-compose.prod.yml up -d --no-build --wait`. Não usar `down -v` nem `--prepare`.

## Contas de usuário (SQLite)

Usuários e registros ficam em `/app/data/notavoz.db` (SQLite, WAL, modo 0600), no volume `notavoz-pilot_notavoz_data`. Senhas usam scrypt (N=2^15, r=8, p=1). Senha de conta: 8+ caracteres. A regra de 16 caracteres deixou de existir porque a conta única do `.env` foi removida; o rate limit de login é por usuário (5/min) mais teto global de 60/min.

- Primeiro boot: `SEED_USERNAME`/`SEED_PASSWORD` do `.env` criam o usuário se ele não existir (nunca sobrescrevem). `LEGACY_OWNER` (padrão `SEED_USERNAME`) recebe os registros JSON antigos na migração única. Depois do primeiro boot é possível apagar `SEED_PASSWORD` do `.env`.
- Gerenciar contas, sem expor a senha na linha de comando (lida de `NEW_PASSWORD` ou da primeira linha do stdin):

```sh
docker compose -f docker-compose.prod.yml exec backend node dist/cli/users.js list
docker compose -f docker-compose.prod.yml exec -T backend node dist/cli/users.js create <usuario>   # senha pelo stdin
docker compose -f docker-compose.prod.yml exec -T backend node dist/cli/users.js passwd <usuario>
docker compose -f docker-compose.prod.yml exec backend node dist/cli/users.js disable <usuario>
```

- Cada usuário só vê, edita e apaga os próprios registros (acesso a registro alheio responde 404). Usuário desativado perde o acesso mesmo com token válido.
- Backup: com o backend parado, tar do volume copia `notavoz.db` (e `-wal`/`-shm`, se houver). Com o backend ligado, nunca copiar só o `.db`.
- Limites: concorrência de transcrição/geração continua 1 no sistema inteiro (os usuários se enfileiram, excedente recebe 429); sem papel de administrador na API; tokens duram 1 h.
