import subprocess
import pathlib
import streamlit as st
from agent.graph import agent

PROJECT_ROOT = pathlib.Path.cwd() / "generated_project"
SERVER_PORT = 8502


def start_file_server():
    if "server_proc" not in st.session_state:
        proc = subprocess.Popen(
            ["python", "-m", "http.server", str(SERVER_PORT)],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        st.session_state["server_proc"] = proc


st.title("🤖 App Builder")

prompt = st.text_area("Enter your project prompt", placeholder="Build a colourful modern todo app in html css and js")
recursion_limit = st.sidebar.number_input("Recursion limit", min_value=10, max_value=500, value=100)

if st.button("Generate", disabled=not prompt.strip()):
    with st.spinner("Running agent..."):
        try:
            status = st.empty()
            for step in agent.stream(
                {"user_prompt": prompt},
                {"recursion_limit": recursion_limit}
            ):
                node = next(iter(step))
                status.info(f"⚙️ Running: **{node}**")

            status.success("✅ Done!")
            st.json(step)
        except Exception as e:
            st.error(f"Error: {e}")

if any(PROJECT_ROOT.rglob("index.html")):
    start_file_server()
    index = next(PROJECT_ROOT.rglob("index.html"))
    rel = index.relative_to(PROJECT_ROOT).parent
    path = f"/{rel}/" if str(rel) != "." else "/"
    st.markdown(f"### 🌐 Open your app: [http://localhost:{SERVER_PORT}{path}](http://localhost:{SERVER_PORT}{path})")
