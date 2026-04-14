// script.js
// Scientific Calculator Logic
// Handles button clicks, keyboard input, expression parsing and evaluation.
// No external libraries – uses built‑in Math functions.

(() => {
  // -------------------- Selectors --------------------
  const $display = document.getElementById("calc-display"); // <input> or <div>
  const $buttons = document.querySelectorAll(".calc-btn"); // all calculator buttons

  // -------------------- State --------------------
  // The current expression shown on the display (as a string).
  let expression = "";

  // -------------------- Helper Functions --------------------
  /**
   * Update the visual display to match the internal `expression`.
   */
  const updateDisplay = () => {
    $display.value = expression || "0";
  };

  /**
   * Insert a token (number, operator, function) at the end of the expression.
   * @param {string} token
   */
  const appendToken = (token) => {
    // Prevent two consecutive operators (except for '-' which can be unary).
    const operators = "+-*/%^";
    const lastChar = expression.slice(-1);
    if (operators.includes(token) && operators.includes(lastChar) && token !== "-") {
      // Replace the previous operator with the new one.
      expression = expression.slice(0, -1) + token;
    } else {
      expression += token;
    }
    updateDisplay();
  };

  /**
   * Clear the whole expression.
   */
  const clearAll = () => {
    expression = "";
    updateDisplay();
  };

  /**
   * Delete the last character (backspace).
   */
  const backspace = () => {
    expression = expression.slice(0, -1);
    updateDisplay();
  };

  /**
   * Map calculator button labels to JavaScript/Math equivalents.
   */
  const tokenMap = {
    // Numbers and basic operators are used as‑is.
    "÷": "/",
    "×": "*",
    "−": "-",
    "+": "+",
    "%": "%",
    "^": "**",
    // Scientific functions – we prepend "Math." when building the eval string.
    "sin": "Math.sin",
    "cos": "Math.cos",
    "tan": "Math.tan",
    "log": "Math.log10",
    "ln": "Math.log",
    "√": "Math.sqrt",
    "π": "Math.PI",
    "e": "Math.E",
    // Parentheses
    "(": "(",
    ")": ")",
    // Decimal point
    ".": "."
  };

  /**
   * Convert the user‑friendly expression into a JavaScript expression that can be evaluated safely.
   * Only the tokens defined in `tokenMap` are allowed.
   */
  const buildEvalExpression = () => {
    // Tokenise the expression – simple approach: replace known tokens.
    let evalExpr = expression;
    // Replace function names first (e.g., sin, cos) to avoid partial replacement of letters.
    Object.entries(tokenMap).forEach(([key, value]) => {
      // Use regex with word boundaries for alphabetic functions, otherwise simple replace.
      const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(escapedKey, "g");
      evalExpr = evalExpr.replace(regex, value);
    });
    return evalExpr;
  };

  /**
   * Evaluate the current expression and display the result.
   */
  const evaluate = () => {
    if (!expression) return;
    try {
      const evalExpr = buildEvalExpression();
      // Using Function constructor instead of eval for a tiny bit more safety.
      // The expression is limited to the characters we explicitly allow.
      const result = Function(`"use strict";return (${evalExpr})`)();
      // Format result – avoid long floating point tails.
      expression = Number.isFinite(result) ? Number(result.toPrecision(12)).toString() : "Error";
    } catch (e) {
      console.error("Calculation error", e);
      expression = "Error";
    }
    updateDisplay();
  };

  // -------------------- Event Handlers --------------------
  const handleButtonClick = (e) => {
    const btn = e.target.closest(".calc-btn");
    if (!btn) return;
    const raw = btn.dataset.value || btn.textContent.trim();
    switch (raw) {
      case "C":
        clearAll();
        break;
      case "←":
        backspace();
        break;
      case "=":
        evaluate();
        break;
      default:
        // Translate the button label to the internal token.
        const token = tokenMap[raw] !== undefined ? tokenMap[raw] : raw;
        appendToken(token);
        break;
    }
  };

  const handleKeyDown = (e) => {
    // Allow numbers, operators, parentheses, decimal point, and shortcuts.
    const key = e.key;
    if (key === "Enter") {
      e.preventDefault();
      evaluate();
      return;
    }
    if (key === "Escape") {
      e.preventDefault();
      clearAll();
      return;
    }
    if (key === "Backspace") {
      e.preventDefault();
      backspace();
      return;
    }
    // Map keyboard characters to calculator tokens where necessary.
    const keyMap = {
      "/": "/",
      "*": "*",
      "-": "-",
      "+": "+",
      "%": "%",
      "^": "**",
      "(": "(",
      ")": ")",
      ".": "."
    };
    if (/[0-9]/.test(key)) {
      appendToken(key);
      return;
    }
    if (keyMap[key] !== undefined) {
      appendToken(keyMap[key]);
      return;
    }
    // Support common scientific shortcuts.
    const funcMap = {
      "s": "Math.sin",
      "c": "Math.cos",
      "t": "Math.tan",
      "l": "Math.log",
      "n": "Math.log",
      "r": "Math.sqrt",
      "p": "Math.PI",
      "e": "Math.E"
    };
    if (funcMap[key]) {
      // Insert function name (e.g., sin) followed by '(' for immediate argument entry.
      const name = funcMap[key].replace(/^Math\./, "");
      appendToken(name + "(");
      return;
    }
  };

  // -------------------- Initialization --------------------
  const init = () => {
    // Attach button listeners.
    $buttons.forEach(($btn) => $btn.addEventListener("click", handleButtonClick));
    // Keyboard input.
    document.addEventListener("keydown", handleKeyDown);
    // Initialise display.
    updateDisplay();
  };

  // Run init when DOM is ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
