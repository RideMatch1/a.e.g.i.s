// TP — variable script src is real XSS supply-chain vector.
// xss-checker MUST flag CWE-79.
export function loadDynamicScript(userInput: string) {
  const script = document.createElement('script');
  script.src = userInput;
  document.head.appendChild(script);
}
