# Manual do Sistema — ISP Cobrança

Plataforma SaaS multi-empresa para automação de cobrança via WhatsApp, integrada ao seu ERP (SGP ou Hubsoft) e à Evolution API.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Acesso: login e cadastro](#2-acesso-login-e-cadastro)
3. [Dashboard](#3-dashboard)
4. [Clientes](#4-clientes)
5. [Growth](#5-growth)
6. [Cobranças](#6-cobranças)
7. [Inadimplência](#7-inadimplência)
8. [Workflow (templates de mensagem)](#8-workflow-templates-de-mensagem)
9. [Configurações](#9-configurações)
10. [Como o disparo automático funciona](#10-como-o-disparo-automático-funciona)
11. [Regras de proteção](#11-regras-de-proteção)
12. [Modo claro / modo escuro](#12-modo-claro--modo-escuro)

---

## 1. Visão geral

O sistema executa, de forma automatizada, o fluxo de cobrança de todos os clientes com fatura em aberto. Ele:

- Sincroniza clientes e faturas do ERP (SGP ou Hubsoft)
- Dispara mensagens via WhatsApp em 7 estágios (de 5 dias antes do vencimento até 14 dias depois)
- Valida em tempo real no ERP se a fatura já foi paga antes de enviar
- Respeita janela de envio, feriados, dias úteis e modo teste
- Registra tudo: quem recebeu, quando, status de entrega, erros

**Menu lateral** (da esquerda):

| Item | Função |
|------|--------|
| Dashboard | Indicadores e gráficos em tempo real |
| Clientes | Base de clientes sincronizada do ERP |
| Growth | Análises avançadas de crescimento e performance |
| Cobranças | Histórico de mensagens enviadas + botão de disparo manual |
| Inadimplência | Faturas vencidas agrupadas por cliente |
| Workflow | Personalização do texto das 7 mensagens |
| Configurações | Credenciais ERP, WhatsApp, dados da empresa, janela de envio |

No rodapé do menu ficam o toggle de modo claro/escuro e o botão Sair.

---

## 2. Acesso: login e cadastro

### Cadastro (primeiro acesso)
1. Acesse `/register`
2. Informe nome da empresa, CNPJ, e-mail, senha e telefone de suporte
3. Ao concluir, você é redirecionado para o login

### Login
1. Acesse `/login`
2. Informe e-mail e senha
3. Você cai direto no Dashboard

Cada empresa é isolada (multi-tenant). Nada do que você cadastra é visível para outras empresas.

---

## 3. Dashboard

Tela inicial após o login. Organizada em três blocos:

**a) KPIs principais (4 cartões)**
- Clientes Ativos
- Faturas Abertas (aguardando pagamento)
- Inadimplentes (faturas vencidas)
- Envios Hoje (+ total do mês)

**b) Recuperação (3 cartões)**
- Recuperado via cobrança (R$) — faturas pagas que tiveram ao menos uma mensagem `sent`
- Ainda em aberto (R$) — somatório de todas as faturas não pagas
- Taxa de recuperação (%)

**c) Gráficos analíticos**
- Inadimplência vs Recuperação (R$) — últimos 6 meses
- Mensagens Enviadas vs Falhas
- Recuperação por Estágio (D-5, D-2, D-0, D+1, D+5, D+10, D+14)
- Distribuição de clientes (ativos/inativos/bloqueados)

> **O que o sistema considera "recuperado"?** Uma fatura com `status = paga` **E** com pelo menos um `MessageLog` com `status = sent` vinculado. Ou seja: o cliente pagou depois de ter recebido uma cobrança nossa.

---

## 4. Clientes

Lista completa da base sincronizada do ERP.

**Funcionalidades**:
- Busca por nome, CPF/CNPJ ou WhatsApp
- Filtro por status (ativo / inativo / bloqueado)
- Exportação CSV (botão "Exportar")
- Coluna "Faturas em aberto" mostra quantidade e valor devido

**Origem dos dados**: vêm do sync com o ERP (SGP ou Hubsoft). Não é possível editar manualmente — o sistema é fonte-espelho do ERP.

Para forçar sincronia imediata: Configurações → ERP → botão "Sincronizar agora".

---

## 5. Growth

Área analítica com visões de crescimento, performance e tendências. Tem os mesmos gráficos do Dashboard em granularidade maior, além de:

- Evolução mês a mês de clientes novos/inativados
- Desempenho por estágio em taxa de conversão
- Heatmap de dias com melhor resposta

---

## 6. Cobranças

Histórico completo de mensagens disparadas pelo sistema.

**Colunas da tabela**:
- Cliente e WhatsApp
- Estágio (D-5, D-2, D-0, D+1, D+5, D+10, D+14)
- Status (enviada, bloqueada, falha, pulada, duplicada)
- Data/hora
- Valor da fatura associada

**Filtros**:
- Busca por cliente
- Filtro por estágio
- Filtro por status
- Intervalo de datas

**Ações**:
- **Disparar cobranças agora** (botão no topo): executa o billing engine sob demanda, respeitando todas as regras de proteção. Mostra barra de progresso e banner com resultado (enviadas, puladas, erros).
- **Exportar CSV**: baixa o histórico filtrado.

> **Importante**: o botão "Disparar" é bloqueado por 10 minutos após ser acionado para evitar envios em duplicata. Se clicar duas vezes seguidas, a segunda vez retorna um erro 429.

---

## 7. Inadimplência

Foco em quem deve. Agrupa faturas vencidas por cliente.

**Filtros**:
- Busca por nome
- Dias de atraso (mín/máx)
- Estágio atual da régua

**Informação por linha**:
- Nome do cliente
- Quantas faturas em atraso
- Valor total devido
- Dias desde o primeiro vencimento
- Estágio em que o cliente está

**Exportação CSV** disponível.

> Clientes com atraso superior a 60 dias aparecem aqui, mas o sistema **não dispara cobrança automática** para eles (entram em fluxo manual: negativação, jurídico, suspensão).

---

## 8. Workflow (templates de mensagem)

Permite personalizar o texto das 7 mensagens da régua. Cada estágio tem:

| Estágio | Quando | Tom | Boleto/PIX |
|---------|--------|-----|------------|
| D-5 | 5 dias antes | Leve e carinhoso | Não |
| D-2 | 2 dias antes | Prático e animado | Sim |
| D-0 | Dia do vencimento | Atencioso | Sim |
| D+1 | 1 dia depois | Tranquilo | Sim |
| D+5 | 5 dias depois | Incentivador | Sim |
| D+10 | 10 dias depois | Empático | Sim |
| D+14 | 14 dias depois | Firme, aviso de suspensão | Não |

**Variáveis disponíveis** no texto:
- `{nome}` — primeiro nome do cliente
- `{data_vencimento}` — DD/MM/AAAA
- `{valor}` — R$ 0,00
- `{link_boleto}` — URL do boleto
- `{codigo_pix}` — código copia-e-cola

**Ações por template**:
- **Editar** — abre o editor
- **Restaurar padrão** — volta à versão original
- **Salvar** — publica a alteração

O PIX fica em uma mensagem separada, disparada 1,5s depois da principal para facilitar o "copia e cola" do cliente.

---

## 9. Configurações

Dividida em 4 abas:

### 9.1. Empresa
- Nome, CNPJ, e-mail, logo (aparece no topo do menu)
- Telefone WhatsApp de suporte (aparece nas mensagens como "Ou fale com a gente")
- Horário de atendimento (ex: "Seg-Sex 8h às 18h")

### 9.2. Integração ERP
Escolha **SGP** ou **Hubsoft** e preencha:

**SGP**:
- URL base (ex: `https://suaempresa.sgp.net.br`)
- Token
- App

**Hubsoft**:
- URL base
- Client ID, Client Secret, Usuário, Senha

**Ações**:
- **Testar conexão** — valida credenciais
- **Sincronizar agora** — força pull de clientes e faturas

### 9.3. WhatsApp (Evolution API)
- URL base, API Key, nome da instância
- **Conectar QR Code** — gera o QR para pareamento
- **Enviar mensagem de teste** — valida envio para um número

### 9.4. Cobranças
- **Modo teste**: quando ligado, o sistema simula tudo mas não envia. Mensagens ficam com status `blocked_test`.
- **Janela de envio**: horário permitido (ex: 08:00 às 20:00)
- **Dias da semana**: quais dias o disparo roda (ex: 1-6 = seg a sáb)

---

## 10. Como o disparo automático funciona

O cron roda uma vez por dia (ou via botão manual em Cobranças). Para cada empresa ativa:

1. **Carrega configurações** (janela, modo teste, credenciais)
2. **Verifica janela de envio** — se fora do horário ou dia, aborta
3. **Verifica feriado** — se hoje é feriado, aborta
4. **Identifica clientes bloqueados** — quem tem qualquer fatura >60 dias em atraso é excluído
5. **Percorre cada um dos 7 estágios**:
   - Busca faturas cujo `dueDate` bate com o offset do estágio (D-5, D-2, ..., D+14)
   - Para cada fatura:
     - Se o cliente está na lista de bloqueados, pula
     - Consulta o ERP em tempo real: fatura já foi paga? Se sim, marca local como `paga` e pula
     - Cria log "pending" antes de enviar (anti-duplicata)
     - Renderiza o template do estágio
     - Envia pelo WhatsApp (mensagem principal + PIX se houver)
     - Atualiza o log com o resultado (`sent`, `failed`, etc.)
6. **Retorna sumário**: total enviado, pulado, com erro

---

## 11. Regras de proteção

O sistema evita ativamente disparos incorretos com 5 camadas:

1. **Validação em tempo real no ERP**: antes de enviar qualquer estágio, consulta SGP/Hubsoft. Se a fatura já está paga, atualiza local e pula.
2. **Bloqueio >60 dias**: clientes com qualquer fatura em atraso há mais de 60 dias não recebem cobrança automática.
3. **Anti-duplicata por fatura+estágio**: constraint única no banco impede 2 envios do mesmo estágio para a mesma fatura.
4. **Anti-duplicata diária**: se o cliente já recebeu uma mensagem `sent` hoje (qualquer estágio), o sistema pula.
5. **Lock por empresa**: o botão "Disparar cobranças agora" fica bloqueado por 10 minutos após o acionamento, evitando execuções concorrentes se o operador clicar várias vezes.

Além disso:
- **Modo teste** nunca envia de verdade (apenas registra `blocked_test`)
- **Janela de envio** bloqueia fora do horário
- **Feriados** são respeitados (configuráveis por empresa)
- **Cliente sem WhatsApp** é marcado como `skipped_no_phone`

---

## 12. Modo claro / modo escuro

No rodapé do menu lateral, clique no ícone de lua/sol para alternar. A preferência é salva no navegador.

---

## Suporte

Em caso de dúvidas ou problemas, entre em contato com o administrador do sistema.
