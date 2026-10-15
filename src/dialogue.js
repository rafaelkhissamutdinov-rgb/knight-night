// Диалоги: идёт по репликам, проверяет условия, ставит флаги, обрабатывает выбор.
// Формат реплики: { who, text, if: 'флаг', ifNot: 'флаг', set: 'флаг', goto: 'диалог', choices: [{ text, set, goto, path }] }.
// goto — id другого диалога, который продолжит разговор.
export class DialogueRunner {
  constructor(dialogues, flags) {
    this.dialogues = dialogues;
    this.flags = flags;
    this.lines = [];
    this.i = -1;
    this.done = true;
  }

  get current() { return this.done ? null : this.lines[this.i]; }

  start(id) {
    const script = this.dialogues[id];
    if (!script) throw new Error(`нет диалога «${id}»`);
    this.lines = script;
    this.i = -1;
    this.done = false;
    return this.advance();
  }

  passes(line) {
    if (line.if && !this.flags[line.if]) return false;
    if (line.ifNot && this.flags[line.ifNot]) return false;
    return true;
  }

  advance() {
    // реплика с goto (без выбора) — после неё разговор продолжается другим диалогом (v0.78: возврат к темам)
    const cur = this.done ? null : this.lines[this.i];
    if (cur?.goto && !cur.choices) return this.start(cur.goto);
    do this.i++; while (this.i < this.lines.length && !this.passes(this.lines[this.i]));
    if (this.i >= this.lines.length) {
      this.done = true;
      return null;
    }
    const line = this.lines[this.i];
    for (const f of [].concat(line.set ?? [])) this.flags[f] = true;   // set — флаг или список
    return line;
  }

  choose(k) {
    const choice = this.current?.choices?.[k];
    if (!choice) return this.current;
    for (const f of [].concat(choice.set ?? [])) this.flags[f] = true;
    if (choice.goto) return this.start(choice.goto);
    return this.advance();
  }
}
