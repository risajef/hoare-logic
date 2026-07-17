import type { Expression, Statement } from './types';

export type ParsedProblem = {
  pre: Expression;
  stmt: Statement;
  post: Expression;
};

class ProblemParser {
  private position = 0;
  private readonly tokens: string[];

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  parseProblem(): ParsedProblem {
    const pre = this.parseBracedExpression();
    const stmt = this.parseStatement();
    if (!this.peek()) throw this.error('Missing postcondition');
    const post = this.parseBracedExpression();
    if (this.peek()) throw this.error(`Unexpected token "${this.peek()}" after postcondition`);
    return { pre, stmt, post };
  }

  private parseBracedExpression(): Expression {
    this.expect('{');
    const expression = this.parseExpression();
    this.expect('}');
    return expression;
  }

  private parseStatement(): Statement {
    const first = this.parseAtomicStatement();
    if (this.consume(';')) {
      return { type: 'sequence', s1: first, s2: this.parseStatement() };
    }
    return first;
  }

  private parseAtomicStatement(): Statement {
    const next = this.peek();
    if (next === 'skip') {
      this.position += 1;
      return { type: 'skip' };
    }
    if (next === 'while') {
      this.position += 1;
      const cond = this.parseExpression();
      this.expect('do');
      return { type: 'while', cond, body: this.parseStatement() };
    }
    if (next === 'if') {
      this.position += 1;
      const cond = this.parseExpression();
      this.expect('then');
      const s1 = this.parseStatement();
      this.expect('else');
      const s2 = this.parseStatement();
      return { type: 'conditional', cond, s1, s2 };
    }

    const variable = this.take('assignment target');
    if (!isIdentifier(variable)) throw this.error(`Expected an assignment target, got "${variable}"`);
    this.expect(':=');
    return { type: 'assign', var: variable, expr: this.parseExpression() };
  }

  private parseExpression(): Expression {
    const token = this.take('expression');
    if (token === '(') {
      const operator = this.take('operator');
      const arguments_: Expression[] = [];
      while (this.peek() !== ')') {
        if (!this.peek()) throw this.error('Missing closing ) in expression');
        arguments_.push(this.parseExpression());
      }
      this.expect(')');
      return makeOperation(operator, arguments_);
    }
    if (token === 'true') return { type: 'true' };
    if (token === 'false') return { type: 'false' };
    if (isNumber(token)) return { type: 'const', value: Number(token) };
    if (isIdentifier(token)) return { type: 'var', name: token };
    throw this.error(`Expected an expression, got "${token}"`);
  }

  private peek(): string | undefined {
    return this.tokens[this.position];
  }

  private take(description: string): string {
    const token = this.peek();
    if (!token) throw this.error(`Expected ${description}, but reached the end of the problem`);
    this.position += 1;
    return token;
  }

  private expect(expected: string): void {
    const actual = this.take(`"${expected}"`);
    if (actual !== expected) throw this.error(`Expected "${expected}", got "${actual}"`);
  }

  private consume(expected: string): boolean {
    if (this.peek() !== expected) return false;
    this.position += 1;
    return true;
  }

  private error(message: string): Error {
    return new Error(`Cannot parse problem: ${message}`);
  }
}

function makeOperation(operator: string, arguments_: Expression[]): Expression {
  const normalized = normalizeOperator(operator);
  if (normalized === '!') {
    if (arguments_.length !== 1) throw new Error(`Cannot parse problem: Operator "${operator}" needs exactly one argument`);
    return { type: 'unop', op: '¬', expr: arguments_[0] };
  }
  if (arguments_.length < 2) throw new Error(`Cannot parse problem: Operator "${operator}" needs at least two arguments`);

  return arguments_.slice(1).reduce<Expression>(
    (left, right) => ({ type: 'binop', op: normalized, left, right }),
    arguments_[0],
  );
}

function normalizeOperator(operator: string): string {
  const aliases: Record<string, string> = {
    '=': '==',
    '==': '==',
    'and': '∧',
    '&&': '∧',
    '∧': '∧',
    'or': '∨',
    '||': '∨',
    '∨': '∨',
    'not': '!',
    '!': '!',
    '¬': '!',
    '<=': '≤',
    '≤': '≤',
    '>=': '≥',
    '≥': '≥',
    '+': '+',
    '-': '-',
    '*': '*',
    '⨯': '*',
    '<': '<',
    '>': '>',
  };
  const normalized = aliases[operator];
  if (!normalized) throw new Error(`Cannot parse problem: Unsupported operator "${operator}"`);
  return normalized;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
    } else if ('{}();'.includes(char)) {
      tokens.push(char);
      index += 1;
    } else if (input.slice(index, index + 2) === ':=') {
      tokens.push(':=');
      index += 2;
    } else {
      const start = index;
      while (index < input.length && !/\s/.test(input[index]) && !'{}();'.includes(input[index]) && input.slice(index, index + 2) !== ':=') {
        index += 1;
      }
      tokens.push(input.slice(start, index));
    }
  }
  return tokens;
}

function isNumber(token: string): boolean {
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(token);
}

function isIdentifier(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

export function parseProblem(input: string): ParsedProblem {
  return new ProblemParser(tokenize(input.trim())).parseProblem();
}
