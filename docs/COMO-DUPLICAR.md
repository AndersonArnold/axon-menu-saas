# 📋 Como Duplicar o Axon Menu para Novos Clientes

Este guia explica como criar cópias do Axon Menu Base para vender a outros estabelecimentos.

## Método Rápido (5 minutos)

### 1. Copiar a pasta do projeto

```bash
# Copie toda a pasta do projeto
cp -r "axon menu base" "nome-do-cliente"
```

### 2. Editar o `config.json`

Abra o arquivo `config.json` na pasta copiada e altere:

```json
{
  "store": {
    "name": "Nome do Novo Estabelecimento",
    "address": "Endereço do cliente",
    "phone": "Telefone do cliente",
    "whatsapp": "WhatsApp do cliente",
    "googleMapsLink": "Link do Google Maps do cliente"
  },
  "schedule": {
    // Ajustar horários de funcionamento
  },
  "delivery": {
    // Ajustar zonas e taxas de entrega
  },
  "theme": {
    "primaryColor": "#COR-DO-CLIENTE",
    // Ajustar cores conforme identidade visual
  },
  "admin": {
    "password": "senha-unica-do-cliente"
  }
}
```

### 3. Substituir imagens pelo painel admin

1. Acesse `http://endereco-do-site/admin.html`
2. Faça login com a senha definida
3. Vá em **Configurações** → Upload do logo e banner
4. Vá em **Cardápio** → Adicione categorias e itens com fotos

### 4. Deploy (Publicar online)

#### Opção A: Vercel (Gratuito)
```bash
cd nome-do-cliente
npm install
npx vercel
```

#### Opção B: Netlify (Gratuito)
```bash
cd nome-do-cliente
npm run build
# Arraste a pasta "dist" para netlify.com/drop
```

#### Opção C: Hospedagem própria
```bash
cd nome-do-cliente
npm run build
# Copie o conteúdo da pasta "dist" para o servidor
```

---

## Checklist de Personalização

- [ ] Nome da loja
- [ ] Logo (upload via admin)
- [ ] Banner (upload via admin)
- [ ] Endereço + Link Google Maps
- [ ] Telefone e WhatsApp
- [ ] Horário de funcionamento
- [ ] Categorias do cardápio
- [ ] Itens do cardápio com fotos e preços
- [ ] Zonas de entrega e taxas
- [ ] Formas de pagamento habilitadas
- [ ] Cores do tema (identidade visual)
- [ ] Senha do admin
- [ ] Layout das mesas
- [ ] Redes sociais

---

## Dicas para Vender

1. **Ofereça pacotes**: Básico (só cardápio), Completo (com mesas e caixa), Premium (com suporte)
2. **Cobre mensalidade**: Pela hospedagem e manutenção
3. **Personalize as cores**: Use as cores da marca do cliente
4. **Tire fotos profissionais**: Itens com boas fotos vendem mais
5. **Demonstração**: Use o template base como demo para mostrar aos clientes

---

## Estrutura de Arquivos Importantes

| Arquivo | O que alterar |
|---------|---------------|
| `config.json` | Todas as configurações do estabelecimento |
| `public/manifest.json` | Nome do app (PWA) |
| `index.html` | Título da página (meta tags) |
| `admin.html` | Título da página admin |

> **Nota**: Todo o resto é configurável pelo painel admin após o deploy!
