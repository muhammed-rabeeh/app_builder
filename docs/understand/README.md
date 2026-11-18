# Understanding App Builder: study guide

A guide to explain, change and debug this project without AI. Every claim points to `file:line` so you can check it in the real code.

| # | File | What you'll learn |
| --- | --- | --- |
| 0 | [00-overview.md](00-overview.md) | What the project does, the tech stack, how to run it |
| 1 | [01-architecture.md](01-architecture.md) | Layers diagram, folder map, "where would I look if…" |
| 2 | [02-concepts.md](02-concepts.md) | 15 concepts the code uses (Pydantic, tool calling, LangGraph state, Streamlit re-runs…) |
| 3 | [03-flows.md](03-flows.md) | Step-by-step traces with sequence diagrams |
| 4 | [04-data.md](04-data.md) | Data models, state over time, where data is created and updated |
| 5 | [05-file-guide.md](05-file-guide.md) | Every source file: job, key functions, failure symptoms |
| 6 | [06-debugging-guide.md](06-debugging-guide.md) | Where errors show up, a real stack trace, likely bugs, checklist |
| 7 | [07-viva-questions.md](07-viva-questions.md) | 36 questions with model answers (⭐ = top 10) |
| 8 | [08-exercises.md](08-exercises.md) | Reading challenges and change tasks with hints |

## Suggested study plan (viva prep, ~1 week)

| Day | Do this |
| --- | --- |
| 1 | Read 00 and 01. Run the app once and watch the terminal while it generates. |
| 2 | Read 02. For each concept, open the cited line and read the real code. |
| 3 | Read 03 and 04. Without looking, draw the Flow 2 sequence diagram on paper. |
| 4 | Read 05. Read every `.py` file top to bottom (~280 lines in total). |
| 5 | Read 06. Do reading challenges 1–5 in 08. |
| 6 | Read 07. Answer every ⭐ question **out loud**, then compare with the model answers. |
| 7 | Do change tasks 1–3 (and 4–5 if you have time). Re-answer Q15 and Q24 using what you learned. |

## Five facts examiners like to probe

1. The **architect does not use the LLM** (`agent/graph.py:32-45`); `architect_prompt` is unused.
2. `StateGraph(dict)` **replaces** state on each step; it doesn't merge it (`agent/graph.py:97`).
3. The coder **forces** `write_file` with `tool_choice` (`agent/graph.py:75`), so the 5-round loop usually runs once.
4. File writes are **sandboxed** to `generated_project/` (`agent/tools.py:10-14`).
5. Coder calls **don't share context**, which is why generated files can mismatch (`agent/graph.py:63-71`).
