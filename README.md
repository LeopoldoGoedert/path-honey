# Path Honey V1

PWA estático para planejamento visual de rotas da FLL BIOGLOW e geração de MicroPython no padrão da Honey Flowers.

## O que já funciona
- Campo BIOGLOW como fundo interativo.
- Waypoints clicáveis e arrastáveis.
- Conversão de rota em ações `giro_1` + `andar_1`.
- Ações manuais: andar, girar, garra, garra simultânea, espera e botão.
- Lançamentos 1–7 pré-carregados a partir dos programas enviados.
- Geração e download de `.py`.
- Salvamento local no navegador.
- PWA/offline após a primeira abertura.

## Rodar localmente
Na pasta do projeto:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`.

## Publicar
É um site estático: pode ser publicado diretamente no Vercel, Netlify, GitHub Pages ou servidor local.

## Observação de calibração
A imagem oficial é referência visual. As dimensões do campo são configuráveis no painel para que a equipe calibre distância/ângulo com o tapete físico.
