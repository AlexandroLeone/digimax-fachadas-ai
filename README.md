# Digimax Projetos — Fachadas Inteligentes

Frontend em Next.js/Tailwind CSS e backend em FastAPI. O formulário aceita o briefing paramétrico, exibe conceitos e exporta os parâmetros em JSON para fluxos BIM.

## Estrutura

```text
app/                  # Página principal Next.js
components/ui/        # Componentes acessíveis
public/               # Ativos públicos
backend/main.py       # API FastAPI e Super Prompt
backend/requirements.txt
backend/.env.example
```

## Desenvolvimento

Frontend: `pnpm dev`

Backend: crie um ambiente virtual, instale `backend/requirements.txt` e execute `uvicorn backend.main:app --reload --port 8000`. Defina `NEXT_PUBLIC_API_URL=http://localhost:8000` no frontend. Sem backend disponível, a interface entra em modo demonstrativo.
