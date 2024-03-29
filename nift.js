class Tokenizer {
    constructor(source) {
        // Skip whitespace, then match one of:
        // - special character: ( ) $ @ ' :
        // - string literal: "a b\"c() d"
        // - word: foo-bar
        this.re = /[\s,]*([:'()@$]|"(?:\\.|[^\\"])*"?|[^\s,:'"()@$]+)/y;
        this.source = source;
        this.match = this.re.exec(this.source);
    }

    peek() {
        return this.match && this.match[1];
    }

    pop() {
        const token = this.peek();
        this.match = this.re.exec(this.source);
        return token;
    }
}

function readForm(tokens) {
    const t = tokens.peek();
    if (t === null) return null;
    if (t === '(') return readTable(tokens);
    if (t === ')') throw new Error("Unexpected ')'");
    if (t[0] === '"') return readString(tokens);
    if (/[0-9]/.test(t[0])) return readNumber(tokens);
    return readSymbol(tokens);
}

function readTable(tokens) {
    const form = { table: [] };
    tokens.pop(); // discard leading (
    while (true) {
        const t = tokens.peek();
        if (t === null) {
            throw new Error("Expected ')'");
        }
        if (t === ')') {
            tokens.pop();
            break;
        }
        if (t === ':') {
            tokens.pop();
            const key = readForm(tokens);
            if (!key) throw new Error("Expected key after ':'");
            const value = readForm(tokens);
            if (!value) throw new Error("Expected value after ':'");
            form.table.push({ key, value });
            continue;
        }
        form.table.push(readForm(tokens));
    }
    return form;
}

function readString(tokens) {
    const t = tokens.pop();
    return { string: t.slice(1, t.length-1) };
}

function readNumber(tokens) {
    const t = tokens.pop();
    return { number: Number(t) };
}

function readSymbol(tokens) {
    const t = tokens.pop();
    return { symbol: t };
}

function read(source, root=true) {
    if (root) {
        source = `(${source})`;
    }
    const tokens = new Tokenizer(source);
    const form = readForm(tokens);
    return form;
}

function evaluate(form, context) {
    return form;
}

function print(form) {
    if (form.number) return form.number.toString();
    if (form.symbol) return form.symbol.toString();
    if (form.string) return `"${form.string.replace('"','\\"')}"`;
    if (form.table) {
        const items = [];
        for (const r of form.table) {
            if (r.key) {
                items.push(`:${print(r.key)}`);
                items.push(print(r.value));
            } else {
                items.push(print(r));
            }
        }
        return `(${items.join(' ')})`;
    }
}

function rep(source) {
    const form = read(source);
    const result = evaluate(form);
    return print(result);
}

function formToJs(form) {
    if (!form) return null;
    if (form.number) return form.number;
    if (form.string) return form.string;
    if (form.symbol) return form.symbol;
    if (form.table) {
        const o = {};
        const a = [];
        for (const entry of form.table) {
            if (entry.key) {
                const k = formToJs(entry.key);
                if (typeof k === 'object') {
                    throw new Error('Cannot convert non-string key to JSON');
                }
                const v = formToJs(entry.value);
                o[k.toString()] = v;
            } else {
                a.push(formToJs(entry));
            }
        }
        if (!Object.keys(o).length) return a;
        if (a.length) {
            o.children = a;
        }
        return o;
    }
}

const VOID_TAGS = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'html', 'img', 'input', 
    'link', 'meta', 'param', 'source', 'track', 'wbr',
];
function formToHtml(form, indent=0) {
    const i = Array(indent).fill(' ').join('');
    const text = form.string || form.number || form.symbol;
    if (text) return `${i}${text}`;
    if (!form.table) {
        throw new Error(`Unexpected form! ${JSON.stringify(form)}`);
    }

    // Separate table into object and array data
    const o = {};
    const a = [];
    for (const e of form.table) {
        if (e.key) {
            if (e.key.table || e.value.table) continue;
            const k = e.key.string || e.key.symbol;
            const v = e.value.string || e.value.symbol || e.value.number;
            o[k] = v;
        } else {
            a.push(e);
        }
    }
    const [head, ...tail] = a;
    const tag = head.string || head.symbol || 'div';

    // Style tag
    if (tag === 'style') {
        const lines = [];
        lines.push('<style>');
        for (let i = 0; i < tail.length; i += 2) {
            const selector = tail[i].symbol || tail[i].string;
            const rules = formToObject(tail[i+1]);
            lines.push(`${selector} {`);
            for (const [k, v] of Object.entries(rules)) {
                lines.push(`  ${k}: ${v};`);
            }
            lines.push('}');
        }
        lines.push('</style>');
        return lines.join('\n');
    }

    const nextIndent = (tag === 'html' ? indent : indent+2);
    const children = tail.map(f => formToHtml(f, nextIndent));
    const props = (Object.entries(o)
        .map(([k, v]) => ` ${k}="${v.replace('"', '\\"')}"`)
        .join('')
    );
    return [
        ...(tag === 'html' ? ['<!doctype html>'] : []),
        `${i}<${tag}${props}>`,
        ...children,
        ...(!VOID_TAGS.includes(tag) ? [`${i}</${tag}>`] : []),
    ].join('\n');
}

const sample1 = `
html
:lang en
(meta :encoding utf-8)
(title "My Website")
(h1 "Hello World!")
(br)
(p "Lorem ipsum dolor sit amet")
`.trim();

import readline from 'readline';
async function main(input, output) {
    const prompt = 'nift> ';
    const rl = readline.createInterface({ input, output, prompt });
    rl.on('line', line => {
        line = line.trim();
        if (line.length) {
            const answer = rep(line);
            output.write(`${answer}\n`);
        }
        rl.prompt();
    });
    rl.prompt();
    await new Promise(r => rl.once('close', r));
}

function demo() {
    console.log(sample1);

    console.log('---');

    const form = read(sample1);
    const obj = formToJs(form);
    console.log(JSON.stringify(obj));

    // console.log('---');

    // const html = formToHtml(form);
    // console.log(html);

    console.log('---');

    console.log(print(form));

    // console.log('---');

    // console.log(formToHtml(read(print(form))));
}

import { fileURLToPath } from 'url';
if (fileURLToPath(import.meta.url) === process.argv[1]) {
    // main(process.stdin, process.stdout);
    demo();
}