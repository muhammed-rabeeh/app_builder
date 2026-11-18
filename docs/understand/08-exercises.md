# 08 — Exercises

Do these **without AI**. Use the editor's search (Ctrl+Shift+F), the earlier guide files, and the terminal.

## Part 1 — Reading challenges

1. **Find where the LLM model name is set.** Then find every place that model is called. (How many calls happen for a 3-file plan?)
2. **Find the line that decides whether the coder runs again or the graph ends.** What exact value must the state contain to stop?
3. **Find where a file path from the LLM is checked for safety.** Work out by hand what happens with `"css/style.css"`, `"../main.py"` and `"/tmp/x.html"`.
4. **Find where the text "Running: coder" comes from.** Which variable holds `coder`, and where does that value originate?
5. **Find three pieces of code that are never used.** For each, explain how you proved it (hint: search for the name across all `.py` files).

## Part 2 — Change tasks (easy → hard)

Create a branch first: `git checkout -b practice/<name>`.

### 1. Easy: change the preview port to 9000
- Hint 1: there is one constant for it.
- Hint 2: after changing it, restart Streamlit. Does an old server still hold 8502?

### 2. Easy: show which file the coder is working on
Make the status say `⚙️ Running: coder (style.css)` instead of just `coder`.
- Hint 1: `step` is `{node_name: update}`. What's inside the coder's update?
- Hint 2: `CoderState` has `task_plan` and `current_step_idx`. Remember the index has already been incremented when you see it.

### 3. Medium: clear old output before each run
Stop old files mixing with new ones.
- Hint 1: the best place is in `main.py`, right before `agent.stream` is called.
- Hint 2: look at `shutil.rmtree` and `Path.mkdir(parents=True, exist_ok=True)`. Notice the unused `init_project_root` in `agent/tools.py`.
- Hint 3: think about the running preview server: its `cwd` is that folder.

### 4. Medium-hard: switch the state to a `TypedDict`
Make LangGraph keep `user_prompt` and `plan` instead of replacing the state.
- Hint 1: define `class AgentState(TypedDict, total=False):` with keys `user_prompt`, `plan`, `task_plan`, `coder_state`, `status`.
- Hint 2: pass it to `StateGraph(...)` at `agent/graph.py:97`.
- Hint 3: verify by adding `print(state.keys())` at the top of `coder_agent`. What did it print before your change?

### 5. Hard: give the coder context from files already written
So `script.js` uses the same IDs as `index.html`.
- Hint 1: in `coder_agent`, before building `messages`, loop over the steps with index `< current_step_idx` and `read_file` each one.
- Hint 2: you'll blow up the prompt size. Reuse the 1500-character truncation idea, or include only the first N lines.
- Hint 3: also consider writing `index.html` first. Does the planner's order guarantee that? Could you sort the steps in the architect?
- Hint 4: test it with `uv run python -m agent.graph` and open the result. Check the browser console for errors.

Once you can do task 5, you can answer viva question 24 from real experience.
