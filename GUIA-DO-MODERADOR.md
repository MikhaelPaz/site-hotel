# Guia do moderador — Hotel de Trânsito “Montanhas de Minas”

## O que está sendo entregue

Código-fonte completo da versão atual do site do 12º Batalhão de Infantaria de Montanha, imagens usadas na página, regras de cálculo, painel de reservas e estrutura do banco. O projeto pode ser editado em um editor de código, sem depender desta conversa.

O painel atual administra reservas; ainda não é um editor visual dos textos, imagens ou tarifas. Para essas alterações, o moderador precisa editar os arquivos abaixo ou contar com alguém com conhecimentos básicos de desenvolvimento web.

## Arquivos para alterar

| Informação | Arquivo no projeto |
|---|---|
| Nome do hotel, descrição, telefone, e-mail exibido, endereço e horários | `app/hotel.tsx` |
| Imagem de cabeçalho, logo e foto do hotel | `public/images/` e referências em `app/hotel.tsx` |
| Título da aba do navegador | `app/layout.tsx` |
| Cores, fontes, tamanho das imagens e adaptação ao celular | `app/globals.css` |
| Campos da solicitação, acompanhantes e pedido de camas | `app/booking-form.tsx` |
| Diárias, acréscimos, capacidade, limite de permanência e antecedência | `lib/rules.ts` |
| Tela de administração e ações da recepção | `app/equipe/staff.tsx` |
| Permissão de acesso da equipe | `lib/server.ts` |
| Gravação, aprovação, conflitos e atualização das reservas | `app/api/reservas/route.ts` |
| Estrutura do banco de dados | `db/schema.ts` e `drizzle/` |

Para trocar uma foto, salve o novo arquivo em `public/images/` e altere o caminho `src` correspondente. Preserve o texto alternativo `alt`, que descreve a imagem para leitores de tela. A logo e as duas fotos em uso foram fornecidas pelo responsável pelo projeto. Imagens antigas presentes na pasta não são necessariamente utilizadas na página.

Para trocar o telefone ou e-mail, altere tanto o texto exibido quanto o destino do link (`tel:` ou `mailto:`). O e-mail de contato não controla o acesso ao painel.

## Abrir no computador do moderador

1. Extraia todo o ZIP em uma pasta própria, fora de outro projeto.
2. Instale Node.js 22.13 ou superior, com npm. A construção desta versão foi verificada com Node.js 24.
3. Abra a pasta extraída no editor de código e um terminal nessa pasta.
4. Execute:

```sh
npm ci
npm run dev
```

Abra o endereço local exibido pelo terminal. Mantenha esse terminal em execução enquanto usa a prévia. Salve as alterações no editor e atualize o navegador se necessário. O endereço `localhost` funciona somente no computador que está executando o projeto.

Não inclua `node_modules` em cópias de entrega: `npm ci` reinstala as versões declaradas em `package-lock.json`.

## Banco de dados local para testar solicitações

A cópia não contém hóspedes, reservas reais nem o banco de testes. Para preparar um banco local vazio, execute uma vez:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_foamy_roughhouse.sql

node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_guests.sql

npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file=drizzle/0002_users.sql

npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file=drizzle/0003_username.sql

npm run dev
```

Não reaplique essa migração em um banco que já tenha a tabela criada. O banco local serve para testes e não é enviado junto com os arquivos do site.

A simulação de login local usa `seedy@sites.test`. Qualquer usuário autenticado pode acessar o painel e gerenciar reservas, inclusive a conta simulada local.

## Regras implementadas

- Cada reserva ocupa o quarto inteiro.
- Q02 e Q03: hospedagem geral. Q01: pedidos do Comandante ou Chefe da Comunicação Social. Q04: Pacientes D Sau.
- Os nomes dos quartos e o inventário de camas não aparecem na área pública.
- Hospedagem geral: de 0 a 1 cama de casal e de 0 a 2 camas de solteiro, com pelo menos uma cama selecionada. Pacientes D Sau: sem cama de casal, de 1 a 3 camas de solteiro. Ao trocar a finalidade, as opções se ajustam automaticamente. A equipe confere o atendimento antes de aprovar. O formulário aceita até 3 pessoas por reserva.
- O intervalo entre entrada e saída deve ser de 1 a 20 dias. O campo de saída limita as datas e é limpo quando uma mudança da entrada torna a saída inválida. A expressão “Até 20 diárias” foi retirada do aviso, mas a regra continua ativa. A entrada deve ficar entre o dia do acesso e a mesma data do mês seguinte, usando o fuso de Belo Horizonte. Quando o mês seguinte não tem o mesmo dia, vale o último dia daquele mês. Exemplo: 31/01 → 28/02 (ou 29/02 em ano bissexto).
- A data é validada no campo e no servidor; a aprovação não permite sobreposição de reservas confirmadas no mesmo quarto.
- Tarifas categoria C: 60, 50, 45, 40 e 70 reais, conforme enquadramento. Acréscimos: 25% por dependente pagante e 50% por adicional sem dependência. Crianças até 6 anos com pais/responsável são isentas.
- Referência de casal de militares e equivalência de servidor civil exigem conferência administrativa.
- Redução por saúde depende de parecer social informado pela equipe; não decorre automaticamente da ocupação do Q04. Conferir a abrangência ao grupo antes de aplicar.

Ao alterar regras, mantenha coerentes o formulário, a validação em `lib/rules.ts` e as ações administrativas em `app/api/reservas/route.ts`.

## Verificar antes de disponibilizar uma alteração

```sh
npx tsc --noEmit
npm run build
```

Confira a página no computador e no celular. Teste uma solicitação fictícia no banco local, incluindo data limite, acompanhantes e pedido de camas. Em mudanças de regras ou autenticação, peça revisão técnica antes de usar com reservas reais.

## Publicação e independência

A versão entregue funciona como prévia local. A publicação online não foi concluída: o componente Sites de publicação ficou indisponível no ambiente original.

O código é editável independentemente do Codex, mas o funcionamento online depende de hospedagem, banco D1 e autenticação. O arquivo `.openai/hosting.json` contém a identificação do projeto Sites original e o vínculo lógico `DB`; ele não é uma senha e não concede acesso à conta. Para publicar nesse projeto, o moderador precisará ser autorizado pelo proprietário da conta/plataforma.

Se for escolhida outra hospedagem, um desenvolvedor deverá adaptar a configuração e a autenticação. `app/chatgpt-auth.ts` confia na identidade autenticada que a plataforma encaminha. Esses cabeçalhos não podem ser aceitos diretamente de visitantes na internet em uma implantação própria. Também será preciso configurar o banco, aplicar as migrações e estabelecer backup e recuperação de dados.

O painel exige login, mas não restringe o acesso por e-mail. A API mantém essa exigência para listar e alterar reservas e registra o e-mail real de quem fez a alteração.

## Limites da versão atual

- Pedidos recebidos por e-mail são registrados manualmente no painel. Não existe integração automática com a caixa postal nem envio automático de confirmações.
- PIX/PagTesouro e GRU são tratados fora do site. O painel registra o acompanhamento e a conferência do pagamento; não emite guias nem processa transações.
- O painel não oferece edição visual dos conteúdos ou tarifas.
- A compilação, validação de tipos, cálculos, limites e gravação de solicitações locais foram verificadas. O fluxo administrativo autenticado completo ainda precisa ser validado no ambiente hospedado com uma conta autenticada.

## Conteúdo da entrega

O ZIP inclui este guia, código, imagens e migração. Não inclui credenciais, tokens, dependências instaladas, arquivos temporários ou banco de dados. Preserve uma cópia antes de fazer alterações.

## Atualizações incluídas neste pacote

- Nome no cabeçalho: Hotel de Trânsito “Montanhas de Minas”.
- Denominação: 12º BI Mth — 12º Batalhão de Infantaria de Montanha.
- Logo ao lado do nome, composição fotográfica no cabeçalho e fotografia do hotel fornecidas pelo usuário. Textos incorporados às imagens permanecem como nos arquivos originais.
- Finalidades públicas: Hospedagem geral e Pacientes D Sau.
- Observação completa sobre o benefício do SSEx, parecer social SAS/RM ou SAS/Gu e cobertura pelo SASEx, exibida ao selecionar Pacientes D Sau.
- Antecedência máxima de um mês, calculada a partir do dia do acesso no fuso de Belo Horizonte; atualização do limite quando a página recupera o foco e periodicamente enquanto está aberta.
- Permanência de até 20 dias, limitada no campo de saída e validada no servidor.
- Opções de camas específicas por finalidade, com validação no servidor.

O acesso local de demonstração não equivale a uma publicação online. A publicação continua pendente, conforme a seção “Publicação e independência”.



Atualização de aprovação: usuários autenticados podem aprovar hospedagem geral no Q01, Q02 ou Q03. Q04 permanece exclusivo para Pacientes D Sau. O controle de conflitos permanece ativo.


## Agenda do hotel (espelhada no painel)
Cada solicitação pendente mostra um quadro (iframe) do Google Agenda ht12bilmontanha@gmail.com, já posicionado no período solicitado. A conferência de disponibilidade dos quartos é feita visualmente pela equipe antes de aprovar.

- O site **não** consulta a API do Google e **não** bloqueia a aprovação com base na agenda. Não há credenciais do Google no servidor.
- É necessário entrar no Google, neste navegador, com uma conta autorizada a visualizar a agenda. O espelhamento não torna a agenda pública. Se o quadro não carregar, use "Abrir este período no Google Agenda".
- Aprovar no site não cria evento no Google Agenda; lembre-se de lançar a reserva na agenda conforme o procedimento da equipe.
- O site continua impedindo, de forma atômica, duas reservas "Aprovada"/"Hospedado" no mesmo quarto com datas sobrepostas entre as reservas feitas pelo próprio site. Conflitos com eventos lançados só na agenda dependem da conferência visual.

## Aba Hóspedes
Toda vez que uma reserva é registrada (pelo site ou pela aba "Registrar pedido"), o nome, o e-mail e o telefone de quem solicitou são gravados também no cadastro de hóspedes. A aba **Hóspedes** lista esse cadastro em ordem alfabética.

- **Pesquisa:** digite parte do nome, do e-mail ou do telefone. Não diferencia maiúsculas/minúsculas nem acentos, e o telefone pode ser digitado com ou sem parênteses e traços. Várias palavras refinam a busca (ex.: "maria gmail").
- **Histórico:** em cada hóspede, "Ver histórico de reservas" mostra as datas, o quarto e a situação de cada reserva dele.
- **Sem duplicados:** o hóspede é identificado pelo conjunto e-mail + nome. Quem reserva de novo com o mesmo e-mail e nome continua sendo um só registro, e o telefone é atualizado para o mais recente. Se o nome for escrito de outra forma (ex.: "Joao" e "João"), será criado outro registro.
- **Dados pessoais:** a lista só é entregue a quem está logado na área da equipe. As reservas recusadas e excluídas continuam com o hóspede no cadastro.

## Aba Controle orçamentário
É uma tabela com uma linha para cada reserva que já teve o **check-out registrado** (situação "Concluída"): nome completo, quantidade de hóspedes, check-in, check-out, valor pago e número de referência.

- **No check-out** (aba Reservas, botão "Registrar check-out") a equipe informa, além dos consumos e da forma de pagamento: o **Valor pago** (o sistema já sugere diárias com desconto + consumos, e pode ser corrigido) e o **Número de referência** (da GRU, do PIX etc.; texto livre, opcional). O valor pago é obrigatório quando o pagamento é marcado como conferido.
- **Corrigir depois:** enquanto o pagamento não estiver conferido, é possível voltar ao cartão da reserva e usar "Atualizar pagamento / consumos"; a tabela acompanha. Depois de conferido, a reserva é considerada fechada.
- **Coluna Pagamento:** "Conferido" ou "Pendente". Reservas sem valor informado mostram "—".
- **Pesquisa e exportação:** a busca procura por nome ou número de referência, e "Baixar CSV" baixa o que está na tela (abre direto no Excel).
- A quantidade de hóspedes é o solicitante mais dependentes, acompanhantes e crianças informados na reserva. Reservas concluídas antes desta função, com pagamento conferido, aparecem com o total calculado e sem número de referência.
