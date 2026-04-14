# 🤖 App Builder

An AI-powered app generator that turns a plain English prompt into a working static web app (HTML, CSS, JS) using a multi-agent LangGraph pipeline.

## How it works

Three agents run in sequence:

```
Planner → Architect → Coder (loops per file)
```

- **Planner** — converts your prompt into a structured project plan (name, description, tech stack, file list)
- **Architect** — breaks the plan into one implementation task per file, ordered by dependency
- **Coder** — writes each file using an LLM with forced `write_file` tool calls; loops until all files are written

Generated files are saved to `generated_project/` and served locally via Python's built-in HTTP server.

## Requirements

- Python 3.11+
- A [Groq](https://console.groq.com) API key

## Setup

```bash
# Install dependencies
uv sync

# Add your Groq API key
echo GROQ_API_KEY=your_key_here > .env
```

## Run

```bash
streamlit run main.py
```

Then open [http://localhost:8501](http://localhost:8501), enter a prompt, and click **Generate**.

Once generation completes, a link to your app appears at `http://localhost:8502`.

## Project structure

```
├── agent/
│   ├── graph.py       # LangGraph pipeline (planner → architect → coder)
│   ├── prompts.py     # Prompt templates for each agent
│   ├── states.py      # Pydantic models (Plan, TaskPlan, CoderState)
│   └── tools.py       # File I/O tools (read_file, write_file, list_files)
├── generated_project/ # Output directory for generated apps
├── main.py            # Streamlit UI
└── pyproject.toml
```

## Configuration

| Option | Default | Description |
|---|---|---|
| Recursion limit | 100 | Max LangGraph steps (increase for large projects) |
| Server port | 8502 | Port for the generated app preview server |
