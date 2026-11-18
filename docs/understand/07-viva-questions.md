# 07 — Viva questions

⭐ = one of the 10 most likely questions. Answers are short on purpose: say them in your own words, and be ready to point to the line.

---

## A. The big picture

**1. ⭐ What does your project do?**
It turns a plain-English prompt into a static web app. A Streamlit UI sends the prompt into a LangGraph pipeline: a planner (LLM) makes a structured plan, an architect turns it into one task per file, and a coder (LLM with tool calling) writes each file into `generated_project/`. The result is served on `localhost:8502` (`main.py`, `agent/graph.py`).

**2. ⭐ Walk me through what happens when I click Generate.**
`main.py:30` streams the graph with `{"user_prompt"}` → `planner_agent` returns `{"plan"}` → `architect_agent` returns `{"task_plan"}` → `coder_agent` runs once per file, each time forcing a `write_file` tool call and bumping `current_step_idx` → when the index passes the last file it returns `status: "DONE"` → the conditional edge goes to `END` → the UI shows Done and the preview link (`agent/graph.py:21-112`, `main.py:37-47`).

**3. Why split the work into several agents instead of one big prompt?**
Smaller, focused calls: the plan is validated before any code is written, each file gets its own LLM call (shorter outputs, less chance of being cut off), and progress can be shown per step. The trade-off is that the agents don't share context, which causes mismatched files (see Q24).

**4. ⭐ Why LangGraph rather than plain Python function calls?**
It gives a declared graph with a loop (`add_conditional_edges`, `agent/graph.py:105-109`), step-by-step streaming for the UI (`agent.stream`), and a built-in safety limit (`recursion_limit`). Honest answer: with only three nodes, plain Python would also work. LangGraph pays off if you add branches like review or retry nodes.

**5. Why Streamlit?**
A working web UI in about 30 lines of Python, with no HTML/JS or separate API server. Good for a prototype; not designed for many concurrent users.

**6. Why Groq and `openai/gpt-oss-120b`?**
Groq serves open-weight models with very fast inference, and the model supports tool calling and structured output, both of which the pipeline needs. The model is a one-line change (`agent/graph.py:16`).

**7. Why force plain HTML/CSS/JS output?**
So the result runs by just opening `index.html`: no npm, no build step, and it can be served by `python -m http.server` (`agent/prompts.py:6-8`).

## B. The agents in detail

**8. ⭐ What is "structured output" and where do you use it?**
Asking the LLM to return data that matches a schema and getting back a validated Pydantic object. The planner uses `llm.with_structured_output(Plan)` (`agent/graph.py:24`). The `Field(description=...)` strings in `agent/states.py` become part of the schema the model sees.

**9. ⭐ Does the architect use an LLM?**
No, and this is a common trap. It is a plain list comprehension mapping each `File` to an `ImplementationTask` (`agent/graph.py:35-41`). `architect_prompt` in `agent/prompts.py:16` is left over and unused. The README's "ordered by dependency" isn't implemented; it keeps the planner's order.

**10. ⭐ What is tool calling and how does the coder use it?**
The model is told about functions it may call; it replies with a tool call (name, args, id), and *our* code executes it and returns a `tool` message. The coder binds `write_file` with `tool_choice` forcing that tool (`agent/graph.py:75`), runs each call through `TOOL_MAP` (`agent/graph.py:84`), and appends the result with its `tool_call_id` (`agent/graph.py:85`).

**11. Why force `write_file` instead of letting the model choose?**
Otherwise the model might reply with text, or keep calling `read_file`/`list_files` and never write. Forcing it guarantees one write per file in a single round trip. Consequence: the `for _ in range(5)` loop and the re-bind at `agent/graph.py:91` almost never run.

**12. Why is existing content truncated to 1500 characters?**
To keep the prompt small (fewer tokens, lower cost and latency) (`agent/graph.py:60-61`). Downside: when re-editing a large file, the model only sees its start.

**13. How does the coder know when to stop?**
`CoderState.current_step_idx` is incremented after every file (`agent/graph.py:93`). When it reaches `len(steps)` the coder returns `status: "DONE"` (`agent/graph.py:55-56`), and the conditional edge maps that to `END`.

**14. What does `recursion_limit` do, and what value do you need?**
It is the maximum number of graph steps before LangGraph raises `GraphRecursionError`. This graph uses N + 3 steps for N files, so the default 100 supports up to 97 files. It is set from the sidebar (`main.py:24, 32`).

**15. ⭐ How is state passed between agents?**
Through LangGraph state. Because the graph uses `StateGraph(dict)` (`agent/graph.py:97`), each node's return value **replaces** the whole state (I verified this by running it). So the planner's output drops `user_prompt`, and the coder carries everything it needs inside one `CoderState` object.

**16. What would change if you used a `TypedDict` state?**
LangGraph would keep each key and only overwrite the keys a node returns, so `user_prompt` and `plan` would still be available to later nodes. You could also add reducers (e.g. append to a list of written files).

## C. Data and models

**17. What are your data models?**
`File`, `Plan`, `ImplementationTask`, `TaskPlan`, `CoderState` (`agent/states.py`). Plan → files; TaskPlan → implementation steps; CoderState → task plan plus current index.

**18. Why Pydantic?**
Type validation of LLM output, automatic JSON Schema for structured output, and a clear contract between agents.

**19. What does `extra="allow"` do in `TaskPlan`?**
It allows undeclared fields, which is why `task_plan.plan = plan` works (`agent/states.py:23`, `agent/graph.py:43`). It would be cleaner to declare `plan: Optional[Plan]`.

**20. Is there a database?**
No. Output is plain files in `generated_project/`; everything else lives in memory for one run.

## D. Security and safety

**21. ⭐ How do you stop the LLM writing anywhere on disk?**
Every file tool goes through `safe_path_for_project` (`agent/tools.py:10-14`), which resolves the path (collapsing `..`) and refuses anything outside `generated_project/`. The LLM also only gets file tools; `run_cmd` (shell access) exists but is not in `TOOL_MAP`.

**22. How is the API key protected?**
It is kept out of code in a `.env` file loaded by `python-dotenv` (`agent/graph.py:11`). Weakness to admit: `.gitignore` doesn't list `.env`, so it could be committed by accident. That should be fixed.

**23. Is the generated code safe to run?**
Not guaranteed: it is unreviewed LLM output. The generated calculator uses `eval` / `Function` on the expression (`generated_project/index.html:154`, `script.js:109`). It only runs in your browser on localhost, but it shouldn't be deployed without review.

## E. Errors, limits, weaknesses

**24. ⭐ The generated files don't always work together. Why?**
Each coder call sees only its own task and its own file (`agent/graph.py:63-71`); it never sees the other files or a shared spec of IDs and functions. Example in the repo: `script.js` expects `#calc-display` (`script.js:8`), but `index.html` uses `#display` and never loads `script.js`. Fix: pass already-written files (or an interface spec from a real LLM architect) into each coder call, or add a reviewer node.

**25. What happens if the LLM call fails?**
Nothing inside the agents catches it. The exception propagates out of `agent.stream`, and `main.py:39-40` shows `Error: …`. The full traceback is in the terminal. There is no retry.

**26. What happens on a second run?**
Files are overwritten if they have the same name, but old files are never deleted, so runs can mix (the repo currently has a todo `app.js` next to a calculator). The coder also receives the old content as "existing content", so it may *edit* rather than start fresh.

**27. How would it scale to many users?**
Badly as-is: one shared `generated_project/` folder and a fixed port 8502, so two users would overwrite each other. Fixes: a per-session output folder (e.g. a UUID), a dynamic port or one static server for all folders, running generation in a background job queue, and rate limiting for Groq.

**28. How long does a run take / what does it cost?**
Roughly one LLM call for the plan plus one per file. Time and cost grow linearly with the number of files. I can't give exact numbers without measuring.

## F. Improvements and reflection

**29. ⭐ What would you improve first?**
(1) Give the coder context from the other files or a shared spec. (2) Clear or version the output folder per run. (3) Add `.env` to `.gitignore`. (4) Add error handling and retries per node. (5) Remove dead code (`architect_prompt`, `run_cmd`, `init_project_root`, `current_file_content`). (6) Add tests.

**30. How would you add a "reviewer" agent?**
Add a node after the coder loop that reads all files (with `list_files` / `read_file`), asks the LLM for problems, and routes back to the coder for fixes via a conditional edge. Register it with `graph.add_node`, and point the coder's `"END"` branch to it.

**31. How would you test this project?**
Unit tests for `safe_path_for_project` (`..`, absolute paths, valid nested paths) and `architect_agent` (pure function). For the planner and coder, mock the LLM with a fake that returns fixed `Plan`/tool calls, so tests are free and deterministic.

**32. What was the hardest part?**
(Answer from your own experience.) Good candidates: making the LLM reliably write files (hence the forced `tool_choice`), and understanding LangGraph's state replacement.

**33. What is `set_debug(True)` for, and would you keep it?**
It logs every prompt and response, which is great for debugging (`agent/graph.py:13-14`). In production I'd turn it off: very noisy, and it may log sensitive prompts.

**34. Why does `main.py` use `st.session_state` for the server process?**
Streamlit re-runs the whole script on every interaction. Without `session_state`, it would try to start a new `http.server` on every click (`main.py:11, 18`).

**35. Why is the server started with `Popen` instead of `subprocess.run`?**
`run` waits for the program to finish, and a web server never finishes, so the UI would freeze. `Popen` starts it in the background (`main.py:12`).

**36. What happens if `index.html` is in a subfolder?**
`rglob` finds it, and `main.py:44-46` builds `/subfolder/` into the URL.

Try explaining this back to me in one or two sentences: *pick one weakness from section E and explain both its cause and a fix, pointing to a line of code.*
