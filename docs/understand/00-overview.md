# 00 — Overview

## What this project does (3 sentences)

1. You type a request like *"Build a colourful modern todo app"* into a small web page.
2. Behind the page, a chain of three AI steps ("agents") plans the app, splits it into files, and asks a large language model (LLM) to write each file's code.
3. The finished HTML/CSS/JS files are saved to `generated_project/`, and the page gives you a link where you can open the generated app in your browser.

## The whole system as an analogy: a small building firm

| Building firm | This project | Where |
| --- | --- | --- |
| Reception desk where the customer describes the house | Streamlit page (`main.py`) | `main.py:21-26` |
| **Planner**: writes the brief (name, features, list of rooms) | `planner_agent` asks the LLM for a `Plan` | `agent/graph.py:21-29` |
| **Architect**: turns each room on the list into a work order | `architect_agent` turns each file into an `ImplementationTask` | `agent/graph.py:32-45` |
| **Builder**: builds one room per visit, then comes back for the next | `coder_agent` writes one file per run, looping until all are done | `agent/graph.py:48-94` |
| Site manager who decides who works next | LangGraph `StateGraph` (the "pipeline") | `agent/graph.py:97-112` |
| The building plot | `generated_project/` folder | `agent/tools.py:7` |
| Open-house viewing | Python's built-in web server on port 8502 | `main.py:10-18` |

## Tech stack

| Technology | What it is (one line) | Why this project uses it | Where in code |
| --- | --- | --- | --- |
| **Python ≥ 3.11** | The programming language for everything except the generated app | Most AI tooling lives in Python | `pyproject.toml:6` |
| **uv** | A fast Python package manager (like `npm` for Node) | Installs dependencies from `pyproject.toml` | README "Setup" |
| **Streamlit** | Builds a web UI from a plain Python script, with no HTML needed | Gives you a text box, button and status messages | `main.py:3, 21-47` |
| **LangGraph** | A library for running steps as a graph (state machine) with loops | Runs planner → architect → coder → coder … → END | `agent/graph.py:4-5, 97-112` |
| **LangChain (core)** | A shared toolkit for LLM apps: message formats, "tools", structured output | Defines the `@tool` functions and `with_structured_output` | `agent/tools.py:5`, `agent/graph.py:24` |
| **langchain-groq / Groq** | A Groq client for LangChain; Groq is a hosted LLM API | Supplies the model `openai/gpt-oss-120b` | `agent/graph.py:3, 16` |
| **Pydantic** | Data classes with type checking (like TypeScript interfaces that are also checked at runtime) | Defines the shape of `Plan`, `TaskPlan`, `CoderState` and makes the LLM fill it | `agent/states.py` |
| **python-dotenv** | Loads `KEY=value` lines from a `.env` file into environment variables | Puts `GROQ_API_KEY` where `ChatGroq` can find it | `agent/graph.py:1, 11` |
| **`http.server`** (built into Python) | A tiny static-file web server | Serves the generated app at `localhost:8502` | `main.py:12-17` |
| HTML / CSS / JS | What the *generated* app is written in | The planner prompt forces a plain stack with no build step | `agent/prompts.py:6-8` |

> Note: `groq`, `langchain` and `pip` are listed in `pyproject.toml:8-13`, but the code never imports `groq` or `langchain` directly. They come in as dependencies of `langchain-groq` / `langchain-core`.

## How to run it locally

Run every command from the **project root** (the folder containing `main.py`). Both `main.py:6` and `agent/tools.py:7` build their paths from the *current working directory*, so running from anywhere else puts files in the wrong place.

1. **Install dependencies**
   ```bash
   uv sync
   ```
   `uv` reads `pyproject.toml`, creates a `.venv/` folder (a private copy of Python plus packages for this project) and installs everything into it.
   ⚠️ `.python-version` says `3.14` while `pyproject.toml` says `>=3.11`. `uv` will try to use 3.14. If that causes trouble, change `.python-version` to a version you have.

2. **Add your API key**
   ```bash
   echo GROQ_API_KEY=your_key_here > .env
   ```
   This creates a file `.env`. `load_dotenv()` (`agent/graph.py:11`) reads it, and `ChatGroq` looks for the variable `GROQ_API_KEY`.
   ⚠️ `.gitignore` does **not** list `.env`, so `git add .` would commit your secret key. Add `.env` to `.gitignore` before you commit anything.

3. **Start the UI**
   ```bash
   uv run streamlit run main.py
   ```
   (`uv run` uses the project's `.venv`. Plain `streamlit run main.py` also works if the venv is activated.) Streamlit opens `http://localhost:8501`.

4. **Generate**: type a prompt, click **Generate**, and watch the status line change from `planner` to `architect` to `coder`.

5. **Open the result** at the link that appears (`http://localhost:8502/`).

6. **Optional: run the pipeline without the UI**
   ```bash
   uv run python -m agent.graph
   ```
   This runs the hard-coded todo-app prompt in `agent/graph.py:113-116` and prints the final state.

Try explaining this back to me in one or two sentences: *what are the three agents, and what does each one hand to the next?*
