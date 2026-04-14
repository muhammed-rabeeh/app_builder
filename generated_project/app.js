// app.js – Simple Todo List with persistence using localStorage
// ---------------------------------------------------------------
// This script expects the following minimal HTML structure (IDs are important):
// <input id="task-input" type="text" placeholder="Enter a new task" />
// <button id="add-task">Add</button>
// <ul id="task-list"></ul>
// ---------------------------------------------------------------

(() => {
  // ----- Constants & State -------------------------------------------------
  const STORAGE_KEY = "todo-tasks";
  const taskInput = document.getElementById("task-input");
  const addBtn = document.getElementById("add-task");
  const taskList = document.getElementById("task-list");

  // In‑memory representation of tasks. Each task: { id: string, text: string, completed: boolean }
  let tasks = [];

  // ----- Utility Functions -------------------------------------------------
  /** Generate a short unique identifier */
  const generateId = () => {
    // Simple base‑36 timestamp + random suffix – good enough for this app
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  };

  /** Load tasks from localStorage (if any) */
  const loadTasks = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        tasks = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored tasks", e);
        tasks = [];
      }
    } else {
      tasks = [];
    }
  };

  /** Persist current tasks array to localStorage */
  const saveTasks = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  };

  /** Create a DOM element for a single task */
  const createTaskElement = (task) => {
    const li = document.createElement("li");
    li.dataset.id = task.id;
    li.className = "task-item";
    if (task.completed) li.classList.add("completed");

    // Checkbox (or button) to toggle completion
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.className = "task-toggle";
    checkbox.title = "Mark as completed";
    li.appendChild(checkbox);

    // Text node for the task description
    const span = document.createElement("span");
    span.textContent = task.text;
    span.className = "task-text";
    li.appendChild(span);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.className = "task-delete";
    delBtn.title = "Delete task";
    li.appendChild(delBtn);

    return li;
  };

  /** Render the whole task list */
  const renderTasks = () => {
    // Clear existing items
    taskList.innerHTML = "";
    // Append each task element
    tasks.forEach((task) => {
      const el = createTaskElement(task);
      taskList.appendChild(el);
    });
  };

  // ----- Core Operations ---------------------------------------------------
  const addTask = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return; // ignore empty input
    const newTask = {
      id: generateId(),
      text: trimmed,
      completed: false,
    };
    tasks.push(newTask);
    saveTasks();
    renderTasks();
    taskInput.value = "";
    taskInput.focus();
  };

  const toggleTaskCompletion = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  };

  const deleteTask = (id) => {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    renderTasks();
  };

  // ----- Event Listeners ---------------------------------------------------
  // Add task via button click
  addBtn.addEventListener("click", () => {
    addTask(taskInput.value);
  });

  // Add task via Enter key while input is focused
  taskInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask(taskInput.value);
    }
  });

  // Delegated handling for toggle & delete inside the task list
  taskList.addEventListener("click", (e) => {
    const li = e.target.closest("li.task-item");
    if (!li) return; // click outside a task item
    const id = li.dataset.id;

    if (e.target.matches("input.task-toggle")) {
      toggleTaskCompletion(id);
    } else if (e.target.matches("button.task-delete")) {
      deleteTask(id);
    }
  });

  // ----- Initialization ----------------------------------------------------
  const init = () => {
    loadTasks();
    renderTasks();
  };

  // Run init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
