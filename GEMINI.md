# Instructions

- After every modification, commit the changes in git. Use `[gemini]` and a summary for the title, and the ptompt in the message.

# Kindle Browser Compatibility Guide

This document outlines the best practices for writing web code that is compatible with older browsers, specifically the Kindle e-reader's web browser. Adhering to these guidelines will help prevent common issues like blank screens, broken layouts, and unsupported features.

## JavaScript (ES5)

The Kindle browser does not support modern JavaScript (ES6+). All JavaScript code must be written in ES5 or transpiled to ES5.

### Variable Declarations

- **Use `var` instead of `const` and `let`:** The `const` and `let` keywords are not supported. Use `var` for all variable declarations.

### String Methods

- **Use `indexOf() === 0` instead of `startsWith()`:** The `startsWith()` method is not available. Use `indexOf() === 0` to check if a string starts with a specific substring.
- **Use `indexOf() !== -1` instead of `includes()`:** The `includes()` method is not available. Use `indexOf() !== -1` to check if a string contains a specific substring.

### URL Parsing

- **Avoid `URLSearchParams`:** The `URLSearchParams` API is not supported. Manually parse URL parameters from `window.location.hash` or `window.location.search`.

### Asynchronous Operations

- **Use `XMLHttpRequest` instead of `fetch` and `async/await`:** The `fetch` API and `async/await` syntax are not supported. Use traditional `XMLHttpRequest` with callbacks for asynchronous operations.

## CSS

The Kindle browser has limited support for modern CSS features.

### Layout

- **Avoid Flexbox:** The CSS Flexible Box Layout (`display: flex`) is not supported. Use traditional layout methods like `display: block`, `display: inline-block`, and `float` to create layouts.
- **Avoid `vh` and `vw` units:** The viewport units (`vh`, `vw`) are not supported. Use percentages (`%`) for fluid layouts.

### Character Encoding

- **Avoid Emojis:** Many modern emoji characters are not supported and will render as empty squares. Use HTML entities (e.g., `&#8635;`) or plain text alternatives.

## HTML

- **Use the `title` attribute for tooltips:** The `title` attribute is a simple and widely supported way to add tooltips to elements.
