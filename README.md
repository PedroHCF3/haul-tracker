# Haul Tracker

Painel pessoal responsivo, pensado para Android, com autenticação Supabase, cadastro de produtos, status de importação, links de referência QC e controle básico de valores.

## 1. Criar o projeto Supabase
1. Crie um projeto em https://supabase.com/.
2. No painel, abra **SQL Editor** e execute `supabase-schema.sql`.
3. Em **Authentication → Providers**, habilite Email. Para Google, configure as credenciais OAuth do Google e habilite o provider Google no Supabase.
4. Em **Authentication → URL Configuration**, configure a URL local de desenvolvimento e, depois, o domínio onde publicar o app.
5. Em **Project Settings → API Keys**, copie Project URL e a chave **Publishable** (`sb_publishable_...`).

## 2. Configurar e executar
```bash
# O arquivo .env.local já vem configurado para este projeto.
# Se precisar alterar, use VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

Para gerar a versão de produção:
```bash
npm run build
```
Os arquivos finais ficam em `dist/`.

## 3. Usar no Android
Publique o conteúdo de `dist/` em um host HTTPS (por exemplo, Vercel ou Netlify), configure a URL no Supabase e abra o endereço no Chrome Android. Use **Adicionar à tela inicial** para instalar como PWA.

## Segurança
- Nunca coloque uma `secret` key ou `service_role` no frontend. Use somente a chave Publishable (`sb_publishable_...`) ou anon legada.
- As políticas RLS do SQL limitam cada usuário aos próprios produtos.
- Não informe senha do CSSBuy, Google ou outros serviços neste app.

## Limites atuais
- O login e o armazenamento ficam funcionais após configurar o projeto Supabase e as URLs de autenticação.
- O app não acessa automaticamente pedidos, armazém, fotos ou pagamentos do CSSBuy: não foi identificada API pública oficial para isso neste projeto.
- Doppel.Fit e UUFinds abrem como ferramentas externas. A pesquisa, comparação automática de imagens e importação de resultados ainda não estão conectadas por API.
- Os valores são registros manuais em BRL; não há cotação automática, cálculo de frete ou impostos.


## Configuração já aplicada
O arquivo `.env.local` deste pacote contém a URL do projeto e a chave Publishable fornecidas para conectar o Haul Tracker. Essa chave é pública por definição e pode ficar no cliente; a proteção dos dados depende das políticas RLS. Não compartilhe chaves `sb_secret_...` ou `service_role`.
