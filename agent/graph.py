from dotenv import load_dotenv
from langchain_core.globals import set_verbose, set_debug
from langchain_groq.chat_models import ChatGroq
from langgraph.constants import END
from langgraph.graph import StateGraph

from agent.prompts import *
from agent.states import *
from agent.tools import write_file, read_file, get_current_directory, list_files

_ = load_dotenv()

set_debug(True)
set_verbose(True)

llm = ChatGroq(model="openai/gpt-oss-120b")

TOOL_MAP = {t.name: t for t in [read_file, write_file, list_files, get_current_directory]}


def planner_agent(state: dict) -> dict:
    """Converts user prompt into a structured Plan."""
    user_prompt = state["user_prompt"]
    resp = llm.with_structured_output(Plan).invoke(
        planner_prompt(user_prompt)
    )
    if resp is None:
        raise ValueError("Planner did not return a valid response.")
    return {"plan": resp}


def architect_agent(state: dict) -> dict:
    """Creates TaskPlan from Plan."""
    plan: Plan = state["plan"]
    steps = [
        ImplementationTask(
            filepath=f.path,
            task_description=f"{f.purpose}. Tech stack: {plan.techstack}. App: {plan.description}."
        )
        for f in plan.files
    ]
    task_plan = TaskPlan(implementation_steps=steps)
    task_plan.plan = plan
    print(task_plan.model_dump_json())
    return {"task_plan": task_plan}


def coder_agent(state: dict) -> dict:
    """Coder agent that forces write_file on first turn, then runs free tool loop."""
    coder_state: CoderState = state.get("coder_state")
    if coder_state is None:
        coder_state = CoderState(task_plan=state["task_plan"], current_step_idx=0)

    steps = coder_state.task_plan.implementation_steps
    if coder_state.current_step_idx >= len(steps):
        return {"coder_state": coder_state, "status": "DONE"}

    current_task = steps[coder_state.current_step_idx]
    existing_content = read_file.run(current_task.filepath)
    if len(existing_content) > 1500:
        existing_content = existing_content[:1500] + "\n...[truncated]"

    messages = [
        {"role": "system", "content": coder_system_prompt()},
        {"role": "user", "content": (
            f"Task: {current_task.task_description}\n"
            f"File: {current_task.filepath}\n"
            f"Existing content:\n{existing_content}\n"
            "Write the complete file content now by calling write_file. Do not call any other tool first."
        )},
    ]

    coder_tools = list(TOOL_MAP.values())
    # First turn: only expose write_file so the model cannot call anything else
    bound = llm.bind_tools([write_file], tool_choice={"type": "function", "function": {"name": "write_file"}})

    for _ in range(5):
        response = bound.invoke(messages)
        if not response.tool_calls:
            break
        messages.append(response)
        wrote = False
        for tc in response.tool_calls:
            result = TOOL_MAP[tc["name"]].invoke(tc["args"])
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": str(result)})
            if tc["name"] == "write_file":
                wrote = True
        if wrote:
            break
        # After first turn, allow any tool
        bound = llm.bind_tools(coder_tools)

    coder_state.current_step_idx += 1
    return {"coder_state": coder_state}


graph = StateGraph(dict)

graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder", coder_agent)

graph.add_edge("planner", "architect")
graph.add_edge("architect", "coder")
graph.add_conditional_edges(
    "coder",
    lambda s: "END" if s.get("status") == "DONE" else "coder",
    {"END": END, "coder": "coder"}
)

graph.set_entry_point("planner")
agent = graph.compile()
if __name__ == "__main__":
    result = agent.invoke({"user_prompt": "Build a colourful modern todo app in html css and js"},
                          {"recursion_limit": 100})
    print("Final State:", result)
