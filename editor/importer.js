// Dolphin Blocks — C → blocks importer.
//
// Reverses the Dolphin Blocks code generator: it reads C that uses the db_*
// runtime API (i.e. apps this tool exported, or hand-written code that sticks to
// the same calls) and rebuilds the block program. It does NOT parse arbitrary
// Flipper firmware C — only the db_* subset the generator produces.
//
// Exposes: window.dolphinImportC(cText) -> { state, warnings:[...] }
//   state is a Blockly serialization object ready for workspaces.load().

(function () {
    "use strict";

    const CAST_TYPES = new Set([
        "int", "uint32_t", "uint8_t", "uint16_t", "int32_t", "float", "size_t",
        "long", "unsigned", "char", "bool",
    ]);

    let WARN = [];
    function warn(msg) {
        WARN.push(msg);
    }

    // ---- small block builders ----
    function blk(type, fields, inputs) {
        const b = { type: type };
        if (fields) b.fields = fields;
        if (inputs) {
            b.inputs = {};
            for (const k in inputs) {
                if (inputs[k]) b.inputs[k] = { block: inputs[k] };
            }
        }
        return b;
    }
    const vNum = (n) => ({ type: "math_number", fields: { NUM: Number(n) } });
    const vText = (s) => ({ type: "text", fields: { TEXT: unescapeC(s) } });

    function unescapeC(s) {
        return String(s)
            .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
            .replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    // ---- balanced splitting helpers ----
    // Split a string on top-level occurrences of a single-char separator,
    // respecting (), {}, and "strings".
    function splitTop(s, sep) {
        const out = [];
        let depth = 0, inStr = false, cur = "";
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (inStr) {
                cur += c;
                if (c === "\\") { cur += s[++i]; continue; }
                if (c === '"') inStr = false;
                continue;
            }
            if (c === '"') { inStr = true; cur += c; continue; }
            if (c === "(" || c === "{") depth++;
            else if (c === ")" || c === "}") depth--;
            if (c === sep && depth === 0) { out.push(cur); cur = ""; }
            else cur += c;
        }
        if (cur.trim() !== "" || out.length) out.push(cur);
        return out;
    }
    const splitArgs = (s) => splitTop(s, ",").map((x) => x.trim()).filter((x) => x.length);

    // ============================= Expressions =============================
    function tokenize(s) {
        const toks = [];
        let i = 0;
        while (i < s.length) {
            const c = s[i];
            if (/\s/.test(c)) { i++; continue; }
            if (c === '"') {
                let j = i + 1, str = "";
                while (j < s.length && s[j] !== '"') {
                    if (s[j] === "\\") { str += s[j] + s[j + 1]; j += 2; }
                    else { str += s[j]; j++; }
                }
                toks.push({ t: "str", v: str });
                i = j + 1;
                continue;
            }
            if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1]))) {
                const m = s.slice(i).match(/^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?f?/);
                toks.push({ t: "num", v: m[0].replace(/f$/, "") });
                i += m[0].length;
                continue;
            }
            if (/[A-Za-z_]/.test(c)) {
                const m = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
                toks.push({ t: "id", v: m[0] });
                i += m[0].length;
                continue;
            }
            const two = s.substr(i, 2);
            if (["&&", "||", "==", "!=", "<=", ">="].includes(two)) { toks.push({ t: "op", v: two }); i += 2; continue; }
            if ("+-*/%<>!(),&".includes(c)) { toks.push({ t: "op", v: c }); i++; continue; }
            i++;
        }
        return toks;
    }

    const BINPREC = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 };
    const CMP = { "==": "EQ", "!=": "NEQ", "<": "LT", "<=": "LTE", ">": "GT", ">=": "GTE" };
    const ARITH = { "+": "ADD", "-": "MINUS", "*": "MULTIPLY", "/": "DIVIDE" };

    function parseExpr(str) {
        const toks = tokenize(str);
        let pos = 0;
        const peek = () => toks[pos];
        const next = () => toks[pos++];

        function parsePrimary() {
            const t = peek();
            if (!t) return vNum(0);
            if (t.t === "num") { next(); return vNum(t.v); }
            if (t.t === "str") { next(); return vText(t.v); }
            if (t.t === "op" && t.v === "!") { next(); return blk("logic_negate", null, { BOOL: parseUnary() }); }
            if (t.t === "op" && t.v === "-") {
                next();
                const operand = parsePrimary();
                if (operand.type === "math_number") { operand.fields.NUM = -Number(operand.fields.NUM); return operand; }
                return blk("math_arithmetic", { OP: "MINUS" }, { A: vNum(0), B: operand });
            }
            if (t.t === "op" && t.v === "(") {
                // cast  (type)  or grouping
                if (toks[pos + 1] && toks[pos + 1].t === "id" && CAST_TYPES.has(toks[pos + 1].v) &&
                    toks[pos + 2] && toks[pos + 2].t === "op" && toks[pos + 2].v === ")") {
                    pos += 3; // consume ( type )
                    return parseUnary();
                }
                next(); // (
                const e = parseBin(0);
                if (peek() && peek().v === ")") next();
                return e;
            }
            if (t.t === "id") {
                next();
                if (peek() && peek().v === "(") {
                    // function call — consume balanced parens as raw text
                    const argStr = readParenRaw();
                    return mapCallValue(t.v, splitArgs(argStr));
                }
                if (t.v === "true" || t.v === "false") return blk("logic_boolean", { BOOL: t.v === "true" ? "TRUE" : "FALSE" });
                return mapVarRead(t.v);
            }
            next();
            return vNum(0);
        }
        function parseUnary() { return parsePrimary(); }
        function parseBin(minPrec) {
            let left = parseUnary();
            while (peek() && peek().t === "op" && BINPREC[peek().v] && BINPREC[peek().v] > minPrec) {
                const op = next().v;
                const right = parseBin(BINPREC[op]);
                left = buildBinary(op, left, right);
            }
            return left;
        }
        // read raw text inside the balanced parens starting at current "("
        function readParenRaw() {
            // reconstruct from original token stream is messy; re-scan the source
            // instead using the remaining token span.
            let depth = 0, out = "";
            // we are positioned at "("
            next(); // consume (
            while (peek()) {
                const t = peek();
                if (t.v === "(") depth++;
                if (t.v === ")") { if (depth === 0) { next(); break; } depth--; }
                out += (t.t === "str" ? '"' + t.v + '"' : t.v) + " ";
                next();
            }
            return out.trim();
        }
        const result = parseBin(0);
        return result;
    }

    function buildBinary(op, a, b) {
        if (op === "&&" || op === "||") return blk("logic_operation", { OP: op === "&&" ? "AND" : "OR" }, { A: a, B: b });
        if (CMP[op]) return blk("logic_compare", { OP: CMP[op] }, { A: a, B: b });
        if (op === "%") return blk("math_modulo", null, { DIVIDEND: a, DIVISOR: b });
        if (ARITH[op]) return blk("math_arithmetic", { OP: ARITH[op] }, { A: a, B: b });
        return a;
    }

    function mapVarRead(id) {
        if (/^n_/.test(id)) return blk("db_num_get", { VAR: id.slice(2) });
        if (/^s_/.test(id)) return blk("db_txt_get", { VAR: id.slice(2) });
        let m;
        if ((m = id.match(/^L_(.+)_len$/))) return blk("db_list_length", { LIST: m[1] });
        if ((m = id.match(/^TL_(.+)_len$/))) return blk("db_tlist_length", { LIST: m[1] });
        warn("Unknown identifier: " + id);
        return vNum(0);
    }

    function stripQuotes(s) {
        s = s.trim();
        const m = s.match(/^"([\s\S]*)"$/);
        return m ? unescapeC(m[1]) : s;
    }

    // Value-returning db_* calls.
    function mapCallValue(name, args) {
        switch (name) {
            case "db_random": return blk("math_random_int", null, { FROM: parseExpr(args[0]), TO: parseExpr(args[1]) });
            case "powf": return blk("math_arithmetic", { OP: "POWER" }, { A: parseExpr(args[0]), B: parseExpr(args[1]) });
            case "db_is_pressed":
            case "db_button_pressed": return blk("db_is_pressed", { BTN: args[1] });
            case "db_gpio_read": return blk("db_gpio_read", { PIN: args[1] });
            case "db_subghz_listen": return blk("db_subghz_listen", null, { FREQ: parseExpr(args[1]), MS: parseExpr(args[2]) });
            case "db_nfc_read_uid": return blk("db_nfc_read", { VAR: varName(args[2]) }, { MS: parseExpr(args[1]) });
            case "db_ir_receive": return blk("db_ir_receive", { VAR: varName(args[2]) }, { MS: parseExpr(args[1]) });
            case "db_uart_read_line": return blk("db_uart_read", { VAR: varName(args[2]) }, { MS: parseExpr(args[1]) });
            case "db_file_read_line": return blk("db_file_read_line", { VAR: varName(args[3]) }, { LINE: parseExpr(args[2]), PATH: parseExpr(args[1]) });
            case "db_file_exists": return blk("db_file_exists", null, { PATH: parseExpr(args[1]) });
            case "db_file_line_count": return blk("db_file_line_count", null, { PATH: parseExpr(args[1]) });
            case "db_pick_file": return blk("db_pick_file", { DIR: stripQuotes(args[1]), EXT: stripQuotes(args[2]) });
            case "db_list_get": return blk("db_list_get", { LIST: listName(args[0]) }, { INDEX: parseExpr(args[2]) });
            case "db_tlist_get": return blk("db_tlist_get", { LIST: tlistName(args[0]) }, { INDEX: parseExpr(args[2]) });
            default:
                warn("Unknown value call: " + name + "()");
                return vNum(0);
        }
    }

    const varName = (a) => a.replace(/^s_/, "").trim();
    const listName = (a) => a.replace(/^L_/, "").trim();
    const tlistName = (a) => a.replace(/^TL_/, "").trim();

    // ============================= Statements =============================
    // Parse a function body (contents between the outer braces) into an ordered
    // array of statement block objects.
    function parseBody(body) {
        const raw = splitBodyStatements(body);
        collapseBuzz(raw);
        const blocks = [];
        for (const st of raw) {
            const b = classifyStatement(st);
            if (b) blocks.push(b);
        }
        return chain(blocks);
    }

    // Break a body into raw statement strings. Control statements (if/while/for)
    // carry their full `( ... ) { ... }` (plus else) as one entry.
    function splitBodyStatements(body) {
        const out = [];
        let i = 0;
        const n = body.length;
        const skipWs = () => { while (i < n && /\s/.test(body[i])) i++; };
        function readParen() { // assumes body[i] === "("
            let d = 0, s = "", inStr = false;
            for (; i < n; i++) {
                const c = body[i];
                s += c;
                if (inStr) { if (c === "\\") { s += body[++i]; } else if (c === '"') inStr = false; continue; }
                if (c === '"') inStr = true;
                else if (c === "(") d++;
                else if (c === ")") { d--; if (d === 0) { i++; break; } }
            }
            return s;
        }
        function readBrace() { // assumes body[i] === "{"
            let d = 0, s = "", inStr = false;
            for (; i < n; i++) {
                const c = body[i];
                s += c;
                if (inStr) { if (c === "\\") { s += body[++i]; } else if (c === '"') inStr = false; continue; }
                if (c === '"') inStr = true;
                else if (c === "{") d++;
                else if (c === "}") { d--; if (d === 0) { i++; break; } }
            }
            return s;
        }
        while (true) {
            skipWs();
            if (i >= n) break;
            const rest = body.slice(i);
            const kw = rest.match(/^(if|while|for)\s*\(/);
            if (kw) {
                const keyword = kw[1];
                i += kw[1].length;
                skipWs();
                const cond = readParen();
                skipWs();
                let bodyBlock = "";
                if (body[i] === "{") bodyBlock = readBrace();
                else { // single statement body (rare); read to ;
                    let s = "";
                    while (i < n && body[i] !== ";") s += body[i++];
                    if (body[i] === ";") { s += ";"; i++; }
                    bodyBlock = "{" + s + "}";
                }
                let entry = keyword + " " + cond + " " + bodyBlock;
                // else / else if chains
                while (true) {
                    const save = i;
                    skipWs();
                    if (body.slice(i, i + 4) === "else") {
                        i += 4;
                        skipWs();
                        const elseIf = body.slice(i).match(/^if\s*\(/);
                        if (elseIf) {
                            i += elseIf[0].length - 1; // position at "("
                            // actually position at "(": recompute
                        }
                        if (body.slice(i).match(/^if\s*\(/)) {
                            const m = body.slice(i).match(/^if\s*/);
                            i += m[0].length;
                            const c2 = readParen();
                            skipWs();
                            const b2 = readBrace();
                            entry += " else if " + c2 + " " + b2;
                        } else if (body[i] === "{") {
                            const b2 = readBrace();
                            entry += " else " + b2;
                            break;
                        } else break;
                    } else { i = save; break; }
                }
                out.push(entry.trim());
            } else {
                // simple statement up to ';' at depth 0
                let d = 0, s = "", inStr = false;
                for (; i < n; i++) {
                    const c = body[i];
                    if (inStr) { s += c; if (c === "\\") { s += body[++i]; } else if (c === '"') inStr = false; continue; }
                    if (c === '"') { inStr = true; s += c; continue; }
                    if (c === "(" || c === "{") d++;
                    else if (c === ")" || c === "}") d--;
                    if (c === ";" && d === 0) { i++; break; }
                    s += c;
                }
                const t = s.trim();
                if (t) out.push(t);
            }
        }
        return out;
    }

    function collapseBuzz(raw) {
        for (let i = 0; i < raw.length - 2; i++) {
            if (/^db_vibro\(ctx,\s*true\)$/.test(raw[i]) &&
                /^db_delay\(ctx,/.test(raw[i + 1]) &&
                /^db_vibro\(ctx,\s*false\)$/.test(raw[i + 2])) {
                const m = raw[i + 1].match(/^db_delay\(ctx,\s*([\s\S]*)\)$/);
                raw.splice(i, 3, "__buzz(" + (m ? m[1] : "200") + ")");
            }
        }
    }

    function chain(blocks) {
        for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
        return blocks.length ? blocks[0] : null;
    }

    // Classify one raw statement string → a block (or null to drop).
    function classifyStatement(st) {
        st = st.trim();
        if (!st || st === "(void)ctx") return null;

        // control structures
        if (/^if[\s(]/.test(st)) return parseIf(st);
        if (/^while[\s(]/.test(st)) return parseWhile(st);
        if (/^for[\s(]/.test(st)) return parseFor(st);
        if (st === "break") return blk("controls_flow_statements", { FLOW: "BREAK" });
        if (st === "continue") return blk("controls_flow_statements", { FLOW: "CONTINUE" });

        // assignments
        let m;
        if ((m = st.match(/^n_([A-Za-z0-9_]+)\s*\+=\s*([\s\S]+)$/)))
            return blk("db_num_change", { VAR: m[1] }, { VALUE: parseExpr(m[2]) });
        if ((m = st.match(/^n_([A-Za-z0-9_]+)\s*=\s*([\s\S]+)$/)))
            return blk("db_num_set", { VAR: m[1] }, { VALUE: parseExpr(m[2]) });
        if ((m = st.match(/^L_([A-Za-z0-9_]+)_len\s*=\s*0$/)))
            return blk("db_list_clear", { LIST: m[1] });
        if ((m = st.match(/^TL_([A-Za-z0-9_]+)_len\s*=\s*0$/)))
            return blk("db_tlist_clear", { LIST: m[1] });

        // snprintf text set
        if ((m = st.match(/^snprintf\(\s*s_([A-Za-z0-9_]+)\s*,\s*sizeof\([^)]*\)\s*,\s*"%s"\s*,\s*([\s\S]+)\)$/)))
            return blk("db_txt_set", { VAR: m[1] }, { VALUE: parseExpr(m[2]) });

        if (st.indexOf("__buzz(") === 0) {
            const inner = st.slice(7, -1);
            return blk("db_buzz", null, { MS: parseExpr(inner) });
        }

        // generic call:  name( args )
        const call = st.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)$/);
        if (call) return mapCallStatement(call[1], splitArgs(call[2]));

        warn("Could not parse: " + st.slice(0, 60));
        return blk("db_print_text", null, { TEXT: vText("[unparsed] " + st.slice(0, 30)) });
    }

    const COLOR_TRIPLES = { "255,0,0": 1, "0,255,0": 1, "0,0,255": 1, "255,180,0": 1, "0,255,255": 1, "255,0,255": 1, "255,255,255": 1 };

    function mapCallStatement(name, args) {
        const E = (i) => parseExpr(args[i]);
        switch (name) {
            case "db_print": return blk("db_print_text", null, { TEXT: E(1) });
            case "db_print_num": return blk("db_print_text", null, { TEXT: E(2) });
            case "db_print_int": return blk("db_print_label_num", { LABEL: stripQuotes(args[1]) }, { VALUE: E(2) });
            case "db_clear": return blk("db_clear");
            case "db_canvas_clear": return blk("db_canvas_clear");
            case "db_draw_text": return blk("db_draw_text", null, { TXT: E(3), X: E(1), Y: E(2) });
            case "db_draw_box": return blk("db_draw_box", { FILLED: args[5] }, { X: E(1), Y: E(2), W: E(3), H: E(4) });
            case "db_draw_line": return blk("db_draw_line", null, { X0: E(1), Y0: E(2), X1: E(3), Y1: E(4) });
            case "db_led": {
                const triple = args.slice(1).join(",").replace(/\s/g, "");
                if (COLOR_TRIPLES[triple] && !/uint8_t/.test(args[1]))
                    return blk("db_led_named", { COLOR: triple });
                return blk("db_led_rgb", null, { R: E(1), G: E(2), B: E(3) });
            }
            case "db_led_off": return blk("db_led_off");
            case "db_beep": return blk("db_beep");
            case "db_tone": {
                const noteFreq = String(args[1]).replace(/f$/, "");
                if (/^[0-9.]+$/.test(noteFreq)) return blk("db_note", { NOTE: noteFreq }, { MS: E(2) });
                return blk("db_tone", null, { FREQ: E(1), MS: E(2) });
            }
            case "db_success": return blk("db_feedback", { KIND: "success" });
            case "db_error": return blk("db_feedback", { KIND: "error" });
            case "db_backlight": return blk("db_backlight", { STATE: args[1] });
            case "db_delay": return blk("db_delay", null, { MS: E(1) });
            case "db_button_wait": return blk("db_wait_any");
            case "db_gpio_mode_output": return blk("db_gpio_out", { PIN: args[1] });
            case "db_gpio_mode_input": return blk("db_gpio_in", { PIN: args[1], PULL: args[2] });
            case "db_gpio_write": return blk("db_gpio_write", { PIN: args[1], LEVEL: args[2] });
            case "db_pwm_start": return blk("db_pwm_start", null, { FREQ: E(1), DUTY: E(2) });
            case "db_pwm_stop": return blk("db_pwm_stop");
            case "db_ir_send": return blk("db_ir_send", { PROTO: stripQuotes(args[1]) }, { ADDR: E(2), CMD: E(3) });
            case "db_ir_send_file": return blk("db_ir_send_file", { BUTTON: stripQuotes(args[2]) }, { PATH: E(1) });
            case "db_subghz_send_file": return blk("db_subghz_send_file", null, { PATH: E(1) });
            case "db_nfc_emulate_file": return blk("db_nfc_emulate", null, { PATH: E(1), MS: E(2) });
            case "db_ble_beacon_name": return blk("db_ble_broadcast_name", null, { NAME: E(1) });
            case "db_ble_beacon_name_mac": return blk("db_ble_broadcast_name_mac", { MAC: stripQuotes(args[2]) }, { NAME: E(1) });
            case "db_ble_beacon_raw": return blk("db_ble_broadcast_raw", { HEX: stripQuotes(args[1]) });
            case "db_ble_beacon_stop": return blk("db_ble_broadcast_stop");
            case "db_uart_begin": return blk("db_uart_begin", { BAUD: String(args[1]) });
            case "db_uart_writeln": return blk("db_uart_writeln", null, { TEXT: E(1) });
            case "db_uart_write": return blk("db_uart_write", null, { TEXT: E(1) });
            case "db_uart_end": return blk("db_uart_end");
            case "db_file_append_line": return blk("db_file_append_line", null, { TEXT: E(2), PATH: E(1) });
            case "db_file_write": return blk("db_file_write", null, { TEXT: E(2), PATH: E(1) });
            case "db_file_delete": return blk("db_file_delete", null, { PATH: E(1) });
            case "db_list_add": return blk("db_list_add", { LIST: listName(args[0]) }, { VALUE: parseExpr(args[3]) });
            case "db_list_set": return blk("db_list_set", { LIST: listName(args[0]) }, { INDEX: parseExpr(args[2]), VALUE: parseExpr(args[3]) });
            case "db_tlist_add": return blk("db_tlist_add", { LIST: tlistName(args[0]) }, { VALUE: parseExpr(args[3]) });
            case "db_tlist_set": return blk("db_tlist_set", { LIST: tlistName(args[0]) }, { INDEX: parseExpr(args[2]), VALUE: parseExpr(args[3]) });
            // statement use of boolean-returning calls (e.g. a lone read) — keep the side effect
            case "db_nfc_read_uid":
            case "db_ir_receive":
            case "db_uart_read_line":
            case "db_file_read_line":
            case "db_file_exists":
            case "db_subghz_listen":
                warn(name + "() used as a statement; wrap it in an 'if' to use its result");
                return null;
            default:
                if (/^fn_/.test(name)) return blk("db_func_call", { NAME: name.slice(3) });
                warn("Unknown statement call: " + name + "()");
                return blk("db_print_text", null, { TEXT: vText("[unparsed] " + name) });
        }
    }

    // ---- control structures ----
    function innerBraces(s) {
        const a = s.indexOf("{");
        const b = s.lastIndexOf("}");
        return a >= 0 && b > a ? s.slice(a + 1, b) : "";
    }
    function firstParen(s) {
        const a = s.indexOf("(");
        if (a < 0) return "";
        let d = 0;
        for (let i = a; i < s.length; i++) {
            if (s[i] === "(") d++;
            else if (s[i] === ")") { d--; if (d === 0) return s.slice(a + 1, i); }
        }
        return "";
    }

    function parseIf(st) {
        // Split into segments: if (c){..}  else if (c){..}  else {..}
        const branches = [];
        let elseBody = null;
        let rest = st;
        // leading "if"
        rest = rest.replace(/^if\s*/, "");
        while (true) {
            const cond = firstParen(rest);
            const afterCond = rest.slice(rest.indexOf("(" + "") + 0);
            const braceStart = rest.indexOf("{");
            const body = matchBrace(rest, braceStart);
            branches.push({ cond: cond, body: body.inner });
            rest = rest.slice(body.end).replace(/^\s*/, "");
            if (rest.indexOf("else if") === 0) { rest = rest.replace(/^else\s*if\s*/, ""); continue; }
            if (rest.indexOf("else") === 0) {
                rest = rest.replace(/^else\s*/, "");
                const bs = rest.indexOf("{");
                const eb = matchBrace(rest, bs);
                elseBody = eb.inner;
            }
            break;
        }
        const block = blk("controls_if");
        block.inputs = {};
        branches.forEach((br, idx) => {
            const cb = parseExpr(br.cond);
            if (cb) block.inputs["IF" + idx] = { block: cb };
            const db = parseBody(br.body);
            if (db) block.inputs["DO" + idx] = { block: db };
        });
        const extra = {};
        if (branches.length > 1) extra.elseIfCount = branches.length - 1;
        if (elseBody !== null) {
            extra.hasElse = true;
            const eb = parseBody(elseBody);
            if (eb) block.inputs["ELSE"] = { block: eb };
        }
        if (extra.elseIfCount || extra.hasElse) block.extraState = extra;
        return block;
    }

    function matchBrace(s, start) {
        let d = 0;
        for (let i = start; i < s.length; i++) {
            if (s[i] === "{") d++;
            else if (s[i] === "}") { d--; if (d === 0) return { inner: s.slice(start + 1, i), end: i + 1 }; }
        }
        return { inner: "", end: s.length };
    }

    function stripStop(cond) {
        return cond.replace(/\s*&&\s*!db_should_stop\(ctx\)\s*$/, "").trim();
    }

    function parseWhile(st) {
        let cond = firstParen(st).trim();
        const body = innerBraces(st);
        if (cond === "!db_should_stop(ctx)") {
            return blk("db_forever", null, { DO: parseBody(body) });
        }
        const inner = stripStop(cond);
        const bodyTrim = body.trim();
        // wait-for-button pattern
        let m = inner.match(/^!db_button_pressed\(ctx,\s*([A-Za-z0-9_]+)\)$/);
        if (m && /^db_delay\(ctx,\s*10\)\s*;?$/.test(bodyTrim)) return blk("db_wait_button", { BTN: m[1] });
        // wait-until pattern:  !(COND)  with body db_delay(10)
        m = inner.match(/^!\(([\s\S]*)\)$/);
        if (m && /^db_delay\(ctx,\s*10\)\s*;?$/.test(bodyTrim)) return blk("db_wait_until", null, { COND: parseExpr(m[1]) });
        return blk("controls_whileUntil", { MODE: "WHILE" }, { BOOL: parseExpr(inner), DO: parseBody(body) });
    }

    function parseFor(st) {
        const header = firstParen(st);
        const body = innerBraces(st);
        // int iN = START; iN <op> LIMIT && ...; iN++
        const m = header.match(/int\s+(i\d+)\s*=\s*([^;]+);\s*\1\s*(<=|<)\s*([\s\S]*?)\s*&&[\s\S]*;\s*\1\+\+/);
        if (!m) {
            warn("Unrecognized for-loop; importing body only");
            return parseBody(body);
        }
        const start = m[2].trim(), op = m[3], limit = m[4].trim();
        let mm;
        if ((mm = limit.match(/^L_([A-Za-z0-9_]+)_len$/)) && start === "1" && op === "<=") {
            // number foreach: first body line is  n_VAR = db_list_get(...)
            const restBlock = dropFirstStatement(body, /^n_([A-Za-z0-9_]+)\s*=\s*db_list_get/);
            const vn = (body.match(/n_([A-Za-z0-9_]+)\s*=\s*db_list_get/) || [])[1] || "item";
            const fb = blk("db_list_foreach", { LIST: mm[1], VAR: vn });
            fb.inputs = restBlock ? { DO: { block: restBlock } } : {};
            return fb;
        }
        if ((mm = limit.match(/^TL_([A-Za-z0-9_]+)_len$/)) && start === "1" && op === "<=") {
            const restBlock = dropFirstStatement(body, /^snprintf\(\s*s_/);
            const vn = (body.match(/snprintf\(\s*s_([A-Za-z0-9_]+)/) || [])[1] || "item";
            const fb = blk("db_tlist_foreach", { LIST: mm[1], VAR: vn });
            fb.inputs = restBlock ? { DO: { block: restBlock } } : {};
            return fb;
        }
        // plain repeat N
        return blk("controls_repeat_ext", null, { TIMES: parseExpr(limit), DO: parseBody(body) });
    }

    function dropFirstStatement(body, re) {
        const raw = splitBodyStatements(body);
        if (raw.length && re.test(raw[0].trim())) raw.shift();
        const blocks = [];
        collapseBuzz(raw);
        for (const st of raw) { const b = classifyStatement(st); if (b) blocks.push(b); }
        return chain(blocks);
    }

    // ============================= Top level =============================
    function extractFunction(src, signatureRe) {
        const m = src.match(signatureRe);
        if (!m) return null;
        const braceStart = src.indexOf("{", m.index);
        const mb = matchBrace(src, braceStart);
        return { name: m[1], body: mb.inner };
    }

    function dolphinImportC(cText) {
        WARN = [];
        // strip // and /* */ comments (outside strings — good enough for generated code)
        let src = cText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

        const topBlocks = [];

        // app name
        const nameM = src.match(/DOLPHIN_APP_NAME\s*=\s*"([^"]*)"/);
        const appName = nameM ? unescapeC(nameM[1]) : "Imported App";

        // functions: static void fn_NAME(DbCtx* ctx) { ... }
        const fnRe = /static\s+void\s+(fn_[A-Za-z0-9_]+)\s*\(\s*DbCtx\s*\*\s*ctx\s*\)\s*\{/g;
        let fm;
        const fnPositions = [];
        while ((fm = fnRe.exec(src)) !== null) fnPositions.push({ name: fm[1], braceAt: fnRe.lastIndex - 1 });
        let y = 40;
        for (const f of fnPositions) {
            const mb = matchBrace(src, f.braceAt);
            // drop a trailing (void)ctx; line handled by classify
            const body = parseBody(f.body = mb.inner);
            const def = { type: "db_func_define", x: 40, y: y, fields: { NAME: f.name.slice(3) } };
            if (body) def.inputs = { BODY: { block: body } };
            topBlocks.push(def);
            y += 60;
        }

        // main program
        const prog = extractFunction(src, /void\s+(dolphin_program)\s*\(\s*DbCtx\s*\*\s*ctx\s*\)\s*\{/);
        const mainBody = prog ? parseBody(prog.body) : null;
        const start = { type: "db_on_start", x: 320, y: 40 };
        if (mainBody) start.next = { block: mainBody };
        topBlocks.push(start);

        return {
            appName: appName,
            state: { blocks: { languageVersion: 0, blocks: topBlocks } },
            warnings: WARN.slice(),
        };
    }

    window.dolphinImportC = dolphinImportC;
})();
