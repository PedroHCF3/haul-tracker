# 📦 Haul Tracker

<p align="center">
  <strong>Seu painel pessoal para organizar produtos, compras e importações.</strong><br />
  Acompanhe itens, variações, imagens, referências QC e valores em um só lugar.
</p>

<p align="center">
  <a href="https://haul-tracker-pedrohcf3.vercel.app">🌐 Abrir Haul Tracker</a>
  ·
  <a href="https://github.com/PedroHCF3/haul-tracker/releases">📱 APK Android</a>
  ·
  <a href="https://github.com/PedroHCF3/haul-tracker/actions">⚙️ Builds e Actions</a>
</p>

---

## ✨ Sobre o projeto

O **Haul Tracker** é uma aplicação web responsiva, com foco em uso no computador e no Android, criada para centralizar o acompanhamento de produtos encontrados em marketplaces e agentes de compra.

O projeto combina autenticação e armazenamento em nuvem com ferramentas para organizar itens, consultar informações disponíveis a partir de links de produtos e acompanhar valores.

## 🚀 Recursos

- **Conta pessoal:** autenticação e dados associados ao usuário por meio do Supabase.
- **Cadastro de produtos:** organize seus itens e mantenha os links de origem.
- **Consulta de produtos:** suporte a links de marketplaces e agentes compatíveis, com recuperação de informações disponíveis.
- **Variações e SKUs:** visualize opções como tamanho, cor e versão quando essas informações forem fornecidas pela fonte.
- **Galeria de imagens:** visualize imagens do produto e das variações, com navegação por páginas em galerias maiores.
- **Acompanhamento:** organize produtos por status e acompanhe o andamento da sua lista.
- **Favoritos e lista de desejos:** mantenha os itens importantes separados.
- **Financeiro:** acompanhe os valores cadastrados e ajuste manualmente a cotação do yuan para recalcular valores de produtos que possuem preço original em CNY.
- **Guarda-roupa e outfits:** organize peças e monte combinações com os produtos cadastrados.
- **Referências QC:** guarde e consulte links externos relacionados à qualidade dos produtos.
- **Android:** a aplicação pode ser empacotada como APK usando Capacitor.

> A disponibilidade de informações de produtos, variações e imagens depende do marketplace, do formato do link e das fontes externas utilizadas.

## 🧰 Tecnologias

| Tecnologia | Utilização |
| --- | --- |
| React | Interface da aplicação |
| Vite | Desenvolvimento e build |
| JavaScript | Lógica do frontend |
| Supabase | Autenticação, banco de dados e Edge Functions |
| PostgreSQL | Persistência dos dados |
| Capacitor | Empacotamento para Android |
| Vercel | Hospedagem da aplicação |
| GitHub Actions | Automação do build Android |

## 🌐 Acessar

A versão publicada está disponível em:

**[haul-tracker-pedrohcf3.vercel.app](https://haul-tracker-pedrohcf3.vercel.app)**

O projeto também pode ser instalado no Android por meio do APK disponibilizado nas [releases do GitHub](https://github.com/PedroHCF3/haul-tracker/releases), quando houver uma versão publicada.

## 💻 Executar localmente

### 1. Pré-requisitos

- Node.js 20 ou superior
- npm
- Um projeto Supabase configurado

### 2. Clonar o repositório

```bash
git clone https://github.com/PedroHCF3/haul-tracker.git
cd haul-tracker
npm install
```

### 3. Configurar o Supabase

Crie um projeto em [supabase.com](https://supabase.com/) e configure as variáveis de ambiente.

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publishable
```

Depois:

1. Abra o **SQL Editor** do Supabase e execute o conteúdo de `supabase-schema.sql`, caso esse schema ainda não tenha sido aplicado ao projeto.
2. Em **Authentication → Providers**, habilite o método de login utilizado pela aplicação.
3. Em **Authentication → URL Configuration**, configure as URLs locais e de produção.
4. Confira as políticas de segurança (RLS) das tabelas antes de utilizar dados reais.

Use somente a chave **Publishable** no frontend. Nunca coloque chaves `secret` ou `service_role` em variáveis com prefixo `VITE_`, no código do cliente ou em commits.

### 4. Iniciar o servidor

```bash
npm run dev
```

O Vite exibirá o endereço local para abrir a aplicação no navegador.

### 5. Gerar o build web

```bash
npm run build
```

Os arquivos prontos para publicação serão gerados na pasta `dist/`.

Para testar o build localmente:

```bash
npm run preview
```

## 📱 Gerar o APK Android

O repositório possui o workflow **Build Android APK**, executado pelo GitHub Actions.

Ele pode ser iniciado automaticamente por push nas branches configuradas no workflow ou manualmente pela aba **Actions** usando a opção **Run workflow**.

Quando a execução terminar:

1. Acesse [GitHub Actions](https://github.com/PedroHCF3/haul-tracker/actions).
2. Abra a execução **Build Android APK**.
3. Baixe o artefato `haul-tracker-android-apk`.
4. Extraia o arquivo ZIP e instale o arquivo `app-debug.apk` no dispositivo Android.

Quando uma release for publicada pelo workflow, o APK também ficará disponível na página de [Releases](https://github.com/PedroHCF3/haul-tracker/releases).

O APK gerado é uma build de depuração, indicada para instalação e testes pessoais. Ela não é, por si só, uma versão assinada para publicação na Google Play Store.

## 🔐 Segurança e privacidade

- A autenticação e o armazenamento são gerenciados pelo Supabase.
- As políticas **Row Level Security (RLS)** devem restringir o acesso aos dados de cada usuário.
- Não compartilhe credenciais de CSSBuy, Google ou de outros serviços com o aplicativo.
- Não envie arquivos `.env.local` nem credenciais privadas ao GitHub.
- Chaves privadas e tokens de serviços externos devem permanecer em variáveis de ambiente seguras no backend ou nas configurações de secrets da plataforma.

## ⚠️ Observações e limitações

- O Haul Tracker organiza os dados disponíveis; ele não substitui a conta do usuário nos marketplaces ou agentes de compra.
- Não presume acesso à conta, aos pedidos, ao armazém ou aos pagamentos do CSSBuy.
- A consulta de informações de produtos depende da disponibilidade e do formato dos dados fornecidos por cada fonte.
- Ferramentas externas de QC e busca podem abrir fora do aplicativo; isso não significa que exista integração automática com todos esses serviços.
- A cotação do yuan é informada manualmente pelo usuário. Não é uma cotação financeira em tempo real.
- Frete, impostos e outras despesas devem ser considerados separadamente quando não estiverem disponíveis nos dados cadastrados.

## 🗂️ Estrutura geral

```text
haul-tracker/
├── .github/
│   └── workflows/       # Automação do GitHub Actions
├── supabase/            # Recursos e funções do Supabase
├── public/              # Arquivos públicos da aplicação
├── src/                 # Código-fonte (quando aplicável)
├── supabase-schema.sql  # Estrutura inicial do banco
├── package.json
└── README.md
```

A estrutura pode variar conforme a organização atual dos arquivos do projeto.

## 📄 Licença

Este repositório não declara uma licença de código aberto. Todos os direitos sobre o código permanecem com seus respectivos titulares, salvo indicação em contrário.

---

<p align="center">
  Feito para deixar o acompanhamento das suas compras mais simples. 📦
</p>
