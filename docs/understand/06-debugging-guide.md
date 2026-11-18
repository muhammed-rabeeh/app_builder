# 06 — Debugging guide

## Where errors and logs appear

| Layer | Where to look | What you'll see |
| --- | --- | --- |
| Streamlit UI (`main.py`) | The browser page at :8501 | Red `Error: …` box (`main.py:40`), or Streamlit's own red traceback page |
| Agents / LangGraph / LLM (`agent/*.py`) | **The terminal** where you ran `streamlit run` | Full Python traceback; LangChain debug log of every prompt and LLM reply (`set_debug(True)`, `agent/graph.py:13`); the architect's JSON (`agent/graph.py:44`) |
| Groq API | Terminal traceback; the Groq console (usage / errors) | 401 (bad key), 429 (rate limit), 400 (bad request) |
| Files | `generated_project/` in your editor; `ls -R generated_project` | Missing, empty or stale files |
| Preview server (:8502) | **Nowhere**: its output goes to `DEVNULL` (`main.py:15-16`) | You only notice it's broken when the link fails |
| Generated app | Browser DevTools → **Console** and **Network** tabs at :8502 | `Cannot read properties of null`, 404s for CSS/JS |

## How to read a stack trace (a real one from this project)

This came from calling `write_file` with an absolute path, which happens when the LLM plans a file as `/index.html`:

```text
Traceback (most recent call last):
  File "<string>", line 3, in <module>
    write_file.invoke({'path': '/index.html', 'content': 'x'})
  File ".../langchain_core/tools/base.py", line 765, in invoke
    return self.run(tool_input, **kwargs)
  File ".../langchain_core/tools/base.py", line 1133, in run
    raise error_to_raise
  File ".../langchain_core/tools/structured.py", line 152, in _run
    return self.func(*args, **kwargs)
  File "/home/user/app_builder/agent/tools.py", line 20, in write_file
    p = safe_path_for_project(path)
  File "/home/user/app_builder/agent/tools.py", line 13, in safe_path_for_project
    raise ValueError("Attempt to write outside project root")
ValueError: Attempt to write outside project root
```

1. **Read the last line first:** the error type (`ValueError`) and message.
2. **Read upward until you hit *your* files** (paths without `site-packages`): `agent/tools.py:13`, then `agent/tools.py:20`. The library frames in between (`langchain_core/...`) are just how the tool was invoked. You can usually skip them.
3. **Ask "what value got here?"** The path was `/index.html`. `PROJECT_ROOT / "/index.html"` throws away `PROJECT_ROOT`, because joining an absolute path replaces everything before it.
4. In the real app, this trace would continue *up* through `agent/graph.py:84` (the coder running the tool) and LangGraph, to `main.py:30`, and finally into the `except` at `main.py:39`.

## Most likely bugs, per layer

### UI (`main.py`)
1. **Generate button stays disabled**, because Streamlit only updates `text_area` on blur or Ctrl+Enter. *Find it:* click outside the box, then check `main.py:26`.
2. **Old app link shows before you generate anything.** `main.py:42` finds an `index.html` from a previous run. *Find it:* `ls generated_project`.
3. **Preview server doesn't start / port busy** (another process on 8502, or a second browser tab has its own `session_state` and tries again). *Find it:* temporarily remove `stdout=DEVNULL, stderr=DEVNULL` (`main.py:15-16`) to see the error; run `lsof -i :8502`.

### Agents (`agent/graph.py`)
1. **Auth error at the first LLM call**: the key isn't loaded. *Find it:* add `import os; print("KEY?", bool(os.getenv("GROQ_API_KEY")))` right after `agent/graph.py:11`.
2. **`GraphRecursionError`**: more than `recursion_limit − 3` files. *Find it:* look at the architect's printed JSON (`agent/graph.py:44`) and count `implementation_steps`.
3. **Planner returns `None` / validation error.** *Find it:* scroll the debug log for the raw LLM reply just before the error. Compare it to `Plan` in `agent/states.py:10-15`.

### Tools / files (`agent/tools.py`)
1. **"Attempt to write outside project root"**: absolute or `..` path from the LLM (trace above). *Find it:* `print(path)` at the top of `write_file` (`agent/tools.py:20`).
2. **Files appear in a weird folder**: you started Streamlit from another directory, and `PROJECT_ROOT` depends on `cwd` (`agent/tools.py:7`, `main.py:6`). *Find it:* `print(PROJECT_ROOT)`.
3. **Stale files from older runs** mixed into the new app: nothing deletes them (see `04-data.md`). *Find it:* `ls -la generated_project` and compare modification times.

### Generated output bugs
Your current `generated_project/` is a perfect example:
- `index.html` has its own inline script using `id="display"` (`index.html:82, 119`).
- `script.js` expects `#calc-display` and `.calc-btn` (`script.js:8-9`), and `index.html` never loads it anyway.
- `app.js` is a todo app (`app.js:1`) left over from another run.

**Root cause:** each coder call only sees its own task text and its own file (`agent/graph.py:63-71`), and the architect gives no shared contract (IDs, function names). *Find it:* open the generated app, press F12 → Console; and search `index.html` for `<script src=` / `<link rel="stylesheet"`.

## Manual debugging techniques (no AI needed)

| Technique | How, in this project |
| --- | --- |
| `print()` | Add `print("STATE", state)` at the top of any agent. It shows up in the terminal |
| Run without the UI | `uv run python -m agent.graph`: faster to iterate, and you get a clean traceback |
| Breakpoint | Put `breakpoint()` in e.g. `coder_agent` and run `python -m agent.graph`. In `pdb`: `p current_task`, `n` (next), `c` (continue) |
| Inspect state per step | Temporarily change `main.py:35` to `status.write(step)` to see every update |
| Network tab | For the generated app: F12 → Network, reload, look for red 404s |
| `git diff` | `git diff` / `git diff HEAD~1` to see what *you* changed since it last worked |
| `git bisect` | `git bisect start`, `git bisect bad`, `git bisect good <hash>`, then test each commit Git checks out |

## Checklist before asking AI

1. Did I read the **last line** of the traceback and find the first frame in *my* code?
2. Is the `.env` file in the folder I ran the command from, with `GROQ_API_KEY=` spelled exactly?
3. Did I run from the **project root**?
4. Did I check what is actually in `generated_project/` (and delete stale files)?
5. Does the error happen with `python -m agent.graph` too (UI or agent problem)?
6. What does the LangChain debug log show the LLM actually *returned*?
7. For the generated app: what does the browser **Console** say?
8. What changed since it last worked (`git diff`)?
9. Can I reproduce it with the smallest possible prompt (e.g. "a page that says hello")?

Try explaining this back to me in one or two sentences: *a run fails with a red Error box. What are the first two places you look, and why?*
