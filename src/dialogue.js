// Диалоги: идёт по репликам, проверяет условия, ставит флаги, обрабатывает выбор.
// Формат реплики: { who, text, if: 'флаг', ifNot: 'флаг', set: 'флаг', choices: [{ text, set, goto }] }.
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
    do this.i++; while (this.i < this.lines.length && !this.passes(this.lines[this.i]));
    if (this.i >= this.lines.length) {
      this.done = true;
      return null;
    }
    const line = this.lines[this.i];
    if (line.set) this.flags[line.set] = true;
    return line;
  }

  choose(k) {
    const choice = this.current?.choices?.[k];
    if (!choice) return this.current;
    if (choice.set) this.flags[choice.set] = true;
    if (choice.goto) return this.start(choice.goto);
    return this.advance();
  }
}
