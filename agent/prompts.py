def planner_prompt(user_prompt: str) -> str:
    PLANNER_PROMPT = f"""
You are the PLANNER agent. Convert the user prompt into a project plan.

RULES:
- Tech stack MUST be plain HTML, CSS, and JavaScript only. No frameworks, no build tools, no npm.
- All files must be static: .html, .css, .js only.
- The app must work by opening index.html directly in a browser.

User request:
{user_prompt}
    """
    return PLANNER_PROMPT


def architect_prompt(plan: str) -> str:
    ARCHITECT_PROMPT = f"""
You are the ARCHITECT agent. Break this project plan into minimal, ordered implementation tasks — one per file.
For each task: specify what to implement, key function/class names, and dependencies on prior tasks.

Project Plan:
{plan[:2000]}
    """
    return ARCHITECT_PROMPT


def coder_system_prompt() -> str:
    CODER_SYSTEM_PROMPT = """
You are the CODER agent. Your only job is to write the file specified in the task.
You will be given the task description, file path, and any existing content.
Immediately call write_file with the complete file content. Do NOT call any other tool.
    """
    return CODER_SYSTEM_PROMPT