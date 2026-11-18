# 05 — File guide

Boilerplate (`.gitignore`, `.python-version`) and generated output are covered only briefly at the end.

---

### `main.py`
- **Job:** the Streamlit web UI. It takes the prompt, runs the agent pipeline with live status, and serves and links the generated app.
- **Called by:** `streamlit run main.py` | **Calls:** `agent.graph.agent.stream`, `subprocess.Popen`
- **Inputs → Outputs:** prompt text and recursion limit → status messages, final-state JSON, and a link to `localhost:8502`
- **Key parts:**
  - `PROJECT_ROOT`, `SERVER_PORT` (6-7): where output lives, and the preview port
  - `start_file_server()` (10-18): starts `python -m http.server` once per session, tracked in `st.session_state`
  - prompt / sidebar inputs (23-24)
  - Generate block (26-40): streams graph steps, shows the current node, catches every exception
  - preview link (42-47): finds the first `index.html` and builds its URL
- **If this breaks, you'll see:** a Streamlit error page, a button that does nothing, or no "Open your app" link.

### `agent/graph.py`
- **Job:** the heart of the project. It configures the LLM, defines the three agents and wires them into a LangGraph.
- **Called by:** `main.py:4` (import), or `python -m agent.graph` | **Calls:** `ChatGroq`, `agent/prompts.py`, `agent/states.py`, `agent/tools.py`
- **Inputs → Outputs:** `{"user_prompt": str}` → files on disk; final state `{"coder_state", "status": "DONE"}`
- **Key parts:**
  - `load_dotenv`, `set_debug`, `set_verbose` (11-14): config and very noisy logging
  - `llm` (16): the Groq model `openai/gpt-oss-120b`
  - `TOOL_MAP` (18): tool name → tool object
  - `planner_agent` (21-29): prompt → `Plan` via structured output
  - `architect_agent` (32-45): `Plan` → `TaskPlan`, pure Python, prints JSON to the terminal
  - `coder_agent` (48-94): one file per call. Forces a `write_file` tool call, at most 5 rounds, advances the index
  - graph wiring (97-112): nodes, edges, the conditional loop, entry point, `compile()`
  - `__main__` demo (113-116)
- **If this breaks, you'll see:** red `Error: …` in the UI and a traceback in the terminal. Most often: missing API key, schema validation failure, `GraphRecursionError`.

### `agent/prompts.py`
- **Job:** builds the instruction text sent to the LLM.
- **Called by:** `agent/graph.py:25` (`planner_prompt`), `agent/graph.py:64` (`coder_system_prompt`) | **Calls:** nothing
- **Inputs → Outputs:** user prompt string → full prompt string
- **Key parts:**
  - `planner_prompt` (1-13): forces a plain HTML/CSS/JS stack with no build tools
  - `architect_prompt` (16-24): **unused** (the architect no longer calls the LLM)
  - `coder_system_prompt` (27-33): "Immediately call write_file… Do NOT call any other tool."
- **If this breaks, you'll see:** bad plans (e.g. React files) or the coder replying with text instead of writing a file.

### `agent/states.py`
- **Job:** Pydantic data models shared between the agents.
- **Called by:** `agent/graph.py` (star import) | **Calls:** Pydantic
- **Inputs → Outputs:** raw dicts / LLM JSON → validated objects
- **Key parts:** `File` (6), `Plan` (10), `ImplementationTask` (17), `TaskPlan` (21, `extra="allow"` at 23), `CoderState` (25)
- **If this breaks, you'll see:** `ValidationError`, or the planner returning `None`.

### `agent/tools.py`
- **Job:** the file-system tools the LLM may call, plus a sandbox check.
- **Called by:** `agent/graph.py:9, 18, 59, 84` | **Calls:** `pathlib`, `open`, `subprocess`
- **Inputs → Outputs:** relative paths and content → files on disk / file text / file lists
- **Key parts:**
  - `PROJECT_ROOT` (7): `cwd/generated_project`
  - `safe_path_for_project` (10-14): refuses any path that resolves outside `PROJECT_ROOT`
  - `write_file` (17-24): creates parent folders, overwrites the file, returns `"WROTE:<path>"`
  - `read_file` (27-34): returns `""` if missing
  - `get_current_directory` (37-40): its docstring says "current working directory" but it returns `PROJECT_ROOT`
  - `list_files` (43-50)
  - `run_cmd` (52-57): **unused** and not given to the LLM. Uses `shell=True`
  - `init_project_root` (60-62): **unused**
- **If this breaks, you'll see:** `ValueError: Attempt to write outside project root`, permission errors, or files appearing in an unexpected folder.

### `pyproject.toml`
- **Job:** project metadata and dependencies for `uv`/`pip`. The project's internal name is `coder-buddy` (line 2), and the description is still the template placeholder (line 4).
- **If this breaks, you'll see:** `ModuleNotFoundError` after `uv sync`.

### `README.md`
- **Job:** user-facing docs. Be careful: it says the architect "breaks the plan… ordered by dependency" (`README.md:14`), but in the code the architect just keeps the planner's order with no LLM call (`agent/graph.py:35-41`).

### Boilerplate
- `.gitignore`: ignores caches and `.venv`. **Missing `.env`.**
- `.python-version`: `3.14`, used by `uv`.

### `generated_project/*` (output, not source)
- `index.html`: a self-contained calculator (CSS and JS inline, `index.html:8-78, 118-172`). It does **not** link `style.css` or `script.js`.
- `script.js`: a calculator script expecting `#calc-display` and `.calc-btn` (`script.js:8-9`), which `index.html` doesn't contain.
- `style.css`: calculator styles for `.calc-*` classes.
- `app.js`: a **todo app** script from an earlier run, expecting `#task-input`, `#add-task`, `#task-list` (`app.js:12-14`).

Try explaining this back to me in one or two sentences: *if you wanted to give the coder a new tool, which two files would you change and what line in each?*
