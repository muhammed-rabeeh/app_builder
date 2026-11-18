# 02 — Concepts (in the order you need them)

Each concept follows the same format: **what it is → analogy → tiny example → where it is in this project → the bug it most often causes.**
Since you know another language, I compare each one to things you may already know.

---

## 1. Environment variables and `.env`

- **What:** named values the operating system hands to a program, typically used for secrets like API keys.
- **Analogy:** a sealed envelope handed to the worker at the door, instead of writing the code on the whiteboard.
- **Example:**
  ```python
  from dotenv import load_dotenv
  import os
  load_dotenv()                      # copies KEY=value lines from .env into os.environ
  print(os.environ["GROQ_API_KEY"])
  ```
- **Here:** `agent/graph.py:11` calls `load_dotenv()`. `ChatGroq` (`agent/graph.py:16`) then reads `GROQ_API_KEY` itself; you never see it in code.
- **Common bug:** `.env` sits in a different folder from where you ran the command, or the key name is misspelled, so you get an authentication error at the first LLM call.

## 2. Modules, imports and `if __name__ == "__main__":`

- **What:** every `.py` file is a module. `import` loads it once and runs its top-level code. `__name__` equals `"__main__"` only when the file is run directly.
- **Analogy:** like `require`/`import` in JS. The `__main__` block is like a "demo only" section.
- **Example:**
  ```python
  # graph.py
  agent = build()               # runs on import
  if __name__ == "__main__":
      agent.invoke(...)         # runs only with: python -m agent.graph
  ```
- **Here:** `main.py:4` does `from agent.graph import agent`, which runs all of `agent/graph.py` top to bottom: it loads `.env`, creates the LLM, builds and compiles the graph. The test run at `agent/graph.py:113-116` is skipped on import.
  `from agent.prompts import *` (`agent/graph.py:7`) imports *every* public name. This "star import" is short to write but hides where names come from.
- **Common bug:** running a script from the wrong folder raises `ModuleNotFoundError: No module named 'agent'`.

## 3. Type hints

- **What:** annotations like `state: dict -> dict`. Python does **not** enforce them at runtime, but Pydantic and LangGraph *read* them.
- **Analogy:** TypeScript types that Python itself ignores.
- **Example:** `def planner_agent(state: dict) -> dict:`
- **Here:** every agent function (`agent/graph.py:21, 32, 48`). Also `StateGraph(dict)` at `agent/graph.py:97`; see concept 11.
- **Common bug:** trusting a hint that says `dict` when the value is really `None`.

## 4. Decorators

- **What:** `@something` above a function wraps or replaces that function with an enhanced version.
- **Analogy:** Java/TS annotations, or a gift wrapper that adds a label and a handle.
- **Example:**
  ```python
  @tool
  def write_file(path: str, content: str) -> str:
      """Writes content to a file..."""
  ```
- **Here:** `agent/tools.py:17, 27, 37, 43, 52`. After `@tool`, `write_file` is no longer a plain function. It is a LangChain **Tool object** with `.name`, `.invoke(dict)`, `.run(str)`, and a JSON schema built from the type hints **and the docstring**. The LLM reads that docstring to decide how to use the tool.
- **Common bug:** calling `write_file("a.html", "...")` like a normal function. You must use `write_file.invoke({"path": ..., "content": ...})`, as `agent/graph.py:84` does.

## 5. Pydantic models

- **What:** classes that declare fields with types. Pydantic validates data on creation and can export a JSON Schema.
- **Analogy:** a DTO / Java record / Zod schema: a form with labelled boxes that rejects wrong types.
- **Example:**
  ```python
  class File(BaseModel):
      path: str = Field(description="The path to the file")
      purpose: str
  File(path="index.html", purpose="markup")   # ok
  File(path=123)                               # ValidationError
  ```
- **Here:** all of `agent/states.py`. The `Field(description=...)` strings are not just comments: they are sent to the LLM as part of the schema (concept 8).
  `ConfigDict(extra="allow")` (`agent/states.py:23`) lets `TaskPlan` accept fields it doesn't declare. That is why `task_plan.plan = plan` (`agent/graph.py:43`) works.
- **Common bug:** the LLM returns data that doesn't fit the model, so validation fails or `None` is returned (handled at `agent/graph.py:27-28`).

## 6. LLMs and chat messages

- **What:** an LLM is a model that continues text. Chat APIs take a list of **messages**, each with a **role**: `system` (rules), `user` (request), `assistant` (model reply), `tool` (result of a tool the model asked for).
- **Analogy:** a very well-read contractor who only knows what's on the notes you hand over, and forgets everything between calls.
- **Example:**
  ```python
  messages = [{"role": "system", "content": "You are the CODER..."},
              {"role": "user",   "content": "Task: ... File: index.html"}]
  response = llm.invoke(messages)
  ```
- **Here:** `llm = ChatGroq(model="openai/gpt-oss-120b")` (`agent/graph.py:16`). The coder builds its message list at `agent/graph.py:63-71`.
- **Common bug:** forgetting that every call is **stateless**. The coder writing `script.js` cannot see what it wrote in `index.html` unless you include it in the messages, and this project does not.

## 7. Prompt templates (f-strings)

- **What:** `f"...{variable}..."` builds a string with values inserted. A "prompt template" is just a function returning such a string.
- **Analogy:** a mail-merge letter.
- **Example:** `f"User request:\n{user_prompt}"`
- **Here:** `planner_prompt` (`agent/prompts.py:1-13`) and `coder_system_prompt` (`agent/prompts.py:27-33`). `architect_prompt` (`agent/prompts.py:16-24`) exists but is **never called**: leftover from an earlier design.
- **Common bug:** a literal `{` or `}` in an f-string (common when the prompt contains JSON) raises a `SyntaxError` or `ValueError`. Write `{{` and `}}` instead.

## 8. Structured output

- **What:** instead of free text, you ask the LLM to return data matching a schema, and LangChain turns the answer into a Pydantic object.
- **Analogy:** handing the contractor a printed form to fill in, rather than asking them to "write a letter".
- **Example:**
  ```python
  plan = llm.with_structured_output(Plan).invoke("Build a todo app")
  plan.files[0].path   # a real Python object
  ```
- **Here:** `agent/graph.py:24-26`. Under the hood LangChain sends the `Plan` JSON schema (built from `agent/states.py:10-15` including descriptions) and parses the reply.
- **Common bug:** the model returns invalid JSON or skips a required field, so you get an exception or `None`.

## 9. Tool calling (function calling) and `tool_choice`

- **What:** you give the LLM a list of functions it may use (name, description, argument schema). The model doesn't run them. It replies with a **tool call** (`{"name": "write_file", "args": {...}, "id": "..."}`), *your* code runs the function and sends back a `tool` message.
- **Analogy:** the contractor can't touch the site directly. They fill in a request slip ("write this file with this content") and *you* do it.
- **Example:**
  ```python
  bound = llm.bind_tools([write_file],
          tool_choice={"type": "function", "function": {"name": "write_file"}})
  resp = bound.invoke(messages)
  for tc in resp.tool_calls:
      TOOL_MAP[tc["name"]].invoke(tc["args"])
  ```
- **Here:** `agent/graph.py:75-89`. `tool_choice` naming `write_file` **forces** the model to call that tool on its first reply. `TOOL_MAP` (`agent/graph.py:18`) is a name→tool dictionary used to look up which function to run.
- **Common bug:** sending a tool result without the matching `tool_call_id` (`agent/graph.py:85`). The API rejects the conversation.

## 10. Agent (and the agent loop)

- **What:** "agent" just means *an LLM step that can decide actions* (here, by calling tools), usually inside a loop: ask, run the tools it asks for, feed back the results, repeat.
- **Analogy:** a worker who can ask for tools and keeps working until the task is done or their time runs out.
- **Here:** be precise in a viva:
  - **Planner** is a single structured-output call. It doesn't use tools.
  - **Architect** is *not* an LLM agent at all: a list comprehension (`agent/graph.py:35-41`).
  - **Coder** is the only tool-using agent: up to 5 rounds per file (`agent/graph.py:77`). Because the first round *forces* `write_file`, it nearly always breaks after round 1 (`agent/graph.py:86-89`). The code that re-binds all tools at `agent/graph.py:91` is almost never reached.
- **Common bug:** an agent loop with no maximum, which can run (and bill you) forever. This project caps it at 5.

## 11. LangGraph: state, nodes, edges, compile, stream

- **What:** a **graph** of functions (**nodes**) joined by **edges**. A shared **state** object is passed along: each node receives the state and returns an update. **Conditional edges** pick the next node from the state, which allows loops.
- **Analogy:** a factory conveyor belt with a switch at the end that can send the item back round.
- **Example:**
  ```python
  g = StateGraph(dict)
  g.add_node("coder", coder_agent)
  g.add_conditional_edges("coder", lambda s: "END" if s.get("status")=="DONE" else "coder",
                          {"END": END, "coder": "coder"})
  agent = g.compile()
  ```
- **Here:** `agent/graph.py:97-112`.
  - **Important (verified by running it):** with `StateGraph(dict)`, each node's return value **replaces** the whole state; nothing is merged. After the planner, the state is only `{"plan": ...}` and `user_prompt` is gone. After the architect it is only `{"task_plan": ...}`. That is most likely why the architect stashes the plan inside the task plan (`agent/graph.py:43`), although no later code actually reads `task_plan.plan`. It is also why the coder keeps everything inside one `CoderState` it passes to itself (`agent/graph.py:50-52, 94`). If you used a `TypedDict` state schema instead, LangGraph would merge per key.
  - `compile()` (`agent/graph.py:112`) turns the blueprint into a runnable object.
  - `agent.stream(input, config)` (`main.py:30-33`) yields one `{node_name: update}` dict per step, so the UI can show progress. `agent.invoke` (`agent/graph.py:114`) just returns the final state.
  - `recursion_limit` (`main.py:24, 32`) is the maximum number of steps. This graph needs **N + 3** steps for N files (planner, architect, N coder runs, plus one final coder run that returns `DONE`).
- **Common bug:** a conditional edge that never reaches `END`, which raises `GraphRecursionError`.

## 12. Streamlit's execution model

- **What:** Streamlit **re-runs your whole script from top to bottom** every time the user interacts (clicks, types). `st.session_state` is a dict that survives those re-runs.
- **Analogy:** like a React component that re-renders on every state change, but the "component" is the entire file. `session_state` is like `useState`.
- **Example:**
  ```python
  if "count" not in st.session_state:
      st.session_state["count"] = 0
  if st.button("+1"): st.session_state["count"] += 1
  ```
- **Here:** `st.button` returns `True` only on the re-run caused by the click (`main.py:26`). `st.empty()` (`main.py:29`) is a placeholder you overwrite to show live status (`main.py:35`). `session_state["server_proc"]` (`main.py:11, 18`) keeps the file server from starting twice.
- **Common bug:** expecting a variable to keep its value across clicks without putting it in `session_state`.

## 13. Subprocesses

- **What:** starting another program from Python. `Popen` starts it and returns immediately, without waiting for it to finish.
- **Analogy:** hiring a separate doorman and getting back on with your work.
- **Example:** `subprocess.Popen(["python", "-m", "http.server", "8502"], cwd="generated_project")`
- **Here:** `main.py:12-17` (preview server), and the unused `run_cmd` (`agent/tools.py:52-57`), which uses `shell=True`. That would be dangerous if an LLM could call it, but it is **not** in `TOOL_MAP`.
- **Common bug:** an orphaned server process still holding the port after Streamlit stops, giving `OSError: Address already in use`.

## 14. `pathlib` and path-traversal protection

- **What:** `pathlib.Path` treats paths as objects. `.resolve()` turns `a/../../etc` into a real absolute path.
- **Analogy:** a security guard who checks that every delivery address is inside the building plot.
- **Example:**
  ```python
  p = (PROJECT_ROOT / "../secret.txt").resolve()   # → /home/you/secret.txt
  PROJECT_ROOT.resolve() in p.parents              # False → refuse
  ```
- **Here:** `safe_path_for_project` (`agent/tools.py:10-14`) is called by every file tool. It stops the LLM from writing outside `generated_project/`.
- **Common bug:** the LLM returns an absolute path like `/index.html`. `PROJECT_ROOT / "/index.html"` becomes `/index.html`, the check raises `ValueError`, and the whole run stops.

## 15. Exceptions and `try/except`

- **What:** errors "bubble up" through function calls until something catches them.
- **Analogy:** a problem escalated up the chain of command until a manager deals with it.
- **Here:** nothing inside the agents catches errors. A failing LLM call, tool or validation propagates out of `agent.stream`, and the **only** catch is `main.py:39-40`, which shows `Error: …` in red.
- **Common bug:** a bare `except Exception` hides *which* step failed. Read the terminal for the full traceback.

Try explaining this back to me in one or two sentences: *why does `architect_agent` copy `plan` onto `task_plan`, and does anything later actually use it?* (Hint: search for `.plan` in `agent/graph.py`.)
