"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/braces/lib/utils.js
var require_utils = __commonJS({
  "node_modules/braces/lib/utils.js"(exports2) {
    "use strict";
    exports2.isInteger = (num) => {
      if (typeof num === "number") {
        return Number.isInteger(num);
      }
      if (typeof num === "string" && num.trim() !== "") {
        return Number.isInteger(Number(num));
      }
      return false;
    };
    exports2.find = (node, type) => node.nodes.find((node2) => node2.type === type);
    exports2.exceedsLimit = (min, max, step = 1, limit) => {
      if (limit === false) return false;
      if (!exports2.isInteger(min) || !exports2.isInteger(max)) return false;
      return (Number(max) - Number(min)) / Number(step) >= limit;
    };
    exports2.escapeNode = (block, n = 0, type) => {
      const node = block.nodes[n];
      if (!node) return;
      if (type && node.type === type || node.type === "open" || node.type === "close") {
        if (node.escaped !== true) {
          node.value = "\\" + node.value;
          node.escaped = true;
        }
      }
    };
    exports2.encloseBrace = (node) => {
      if (node.type !== "brace") return false;
      if (node.commas >> 0 + node.ranges >> 0 === 0) {
        node.invalid = true;
        return true;
      }
      return false;
    };
    exports2.isInvalidBrace = (block) => {
      if (block.type !== "brace") return false;
      if (block.invalid === true || block.dollar) return true;
      if (block.commas >> 0 + block.ranges >> 0 === 0) {
        block.invalid = true;
        return true;
      }
      if (block.open !== true || block.close !== true) {
        block.invalid = true;
        return true;
      }
      return false;
    };
    exports2.isOpenOrClose = (node) => {
      if (node.type === "open" || node.type === "close") {
        return true;
      }
      return node.open === true || node.close === true;
    };
    exports2.reduce = (nodes) => nodes.reduce((acc, node) => {
      if (node.type === "text") acc.push(node.value);
      if (node.type === "range") node.type = "text";
      return acc;
    }, []);
    exports2.flatten = (...args) => {
      const result = [];
      const flat = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          const ele = arr[i];
          if (Array.isArray(ele)) {
            flat(ele);
            continue;
          }
          if (ele !== void 0) {
            result.push(ele);
          }
        }
        return result;
      };
      flat(args);
      return result;
    };
  }
});

// node_modules/braces/lib/stringify.js
var require_stringify = __commonJS({
  "node_modules/braces/lib/stringify.js"(exports2, module2) {
    "use strict";
    var utils = require_utils();
    module2.exports = (ast, options = {}) => {
      const stringify = (node, parent = {}) => {
        const invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent);
        const invalidNode = node.invalid === true && options.escapeInvalid === true;
        let output = "";
        if (node.value) {
          if ((invalidBlock || invalidNode) && utils.isOpenOrClose(node)) {
            return "\\" + node.value;
          }
          return node.value;
        }
        if (node.value) {
          return node.value;
        }
        if (node.nodes) {
          for (const child of node.nodes) {
            output += stringify(child);
          }
        }
        return output;
      };
      return stringify(ast);
    };
  }
});

// node_modules/is-number/index.js
var require_is_number = __commonJS({
  "node_modules/is-number/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function(num) {
      if (typeof num === "number") {
        return num - num === 0;
      }
      if (typeof num === "string" && num.trim() !== "") {
        return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
      }
      return false;
    };
  }
});

// node_modules/to-regex-range/index.js
var require_to_regex_range = __commonJS({
  "node_modules/to-regex-range/index.js"(exports2, module2) {
    "use strict";
    var isNumber = require_is_number();
    var toRegexRange = (min, max, options) => {
      if (isNumber(min) === false) {
        throw new TypeError("toRegexRange: expected the first argument to be a number");
      }
      if (max === void 0 || min === max) {
        return String(min);
      }
      if (isNumber(max) === false) {
        throw new TypeError("toRegexRange: expected the second argument to be a number.");
      }
      let opts = { relaxZeros: true, ...options };
      if (typeof opts.strictZeros === "boolean") {
        opts.relaxZeros = opts.strictZeros === false;
      }
      let relax = String(opts.relaxZeros);
      let shorthand = String(opts.shorthand);
      let capture = String(opts.capture);
      let wrap = String(opts.wrap);
      let cacheKey = min + ":" + max + "=" + relax + shorthand + capture + wrap;
      if (toRegexRange.cache.hasOwnProperty(cacheKey)) {
        return toRegexRange.cache[cacheKey].result;
      }
      let a = Math.min(min, max);
      let b = Math.max(min, max);
      if (Math.abs(a - b) === 1) {
        let result = min + "|" + max;
        if (opts.capture) {
          return `(${result})`;
        }
        if (opts.wrap === false) {
          return result;
        }
        return `(?:${result})`;
      }
      let isPadded = hasPadding(min) || hasPadding(max);
      let state = { min, max, a, b };
      let positives = [];
      let negatives = [];
      if (isPadded) {
        state.isPadded = isPadded;
        state.maxLen = String(state.max).length;
      }
      if (a < 0) {
        let newMin = b < 0 ? Math.abs(b) : 1;
        negatives = splitToPatterns(newMin, Math.abs(a), state, opts);
        a = state.a = 0;
      }
      if (b >= 0) {
        positives = splitToPatterns(a, b, state, opts);
      }
      state.negatives = negatives;
      state.positives = positives;
      state.result = collatePatterns(negatives, positives, opts);
      if (opts.capture === true) {
        state.result = `(${state.result})`;
      } else if (opts.wrap !== false && positives.length + negatives.length > 1) {
        state.result = `(?:${state.result})`;
      }
      toRegexRange.cache[cacheKey] = state;
      return state.result;
    };
    function collatePatterns(neg, pos, options) {
      let onlyNegative = filterPatterns(neg, pos, "-", false, options) || [];
      let onlyPositive = filterPatterns(pos, neg, "", false, options) || [];
      let intersected = filterPatterns(neg, pos, "-?", true, options) || [];
      let subpatterns = onlyNegative.concat(intersected).concat(onlyPositive);
      return subpatterns.join("|");
    }
    function splitToRanges(min, max) {
      let nines = 1;
      let zeros = 1;
      let stop = countNines(min, nines);
      let stops = /* @__PURE__ */ new Set([max]);
      while (min <= stop && stop <= max) {
        stops.add(stop);
        nines += 1;
        stop = countNines(min, nines);
      }
      stop = countZeros(max + 1, zeros) - 1;
      while (min < stop && stop <= max) {
        stops.add(stop);
        zeros += 1;
        stop = countZeros(max + 1, zeros) - 1;
      }
      stops = [...stops];
      stops.sort(compare);
      return stops;
    }
    function rangeToPattern(start, stop, options) {
      if (start === stop) {
        return { pattern: start, count: [], digits: 0 };
      }
      let zipped = zip(start, stop);
      let digits = zipped.length;
      let pattern = "";
      let count = 0;
      for (let i = 0; i < digits; i++) {
        let [startDigit, stopDigit] = zipped[i];
        if (startDigit === stopDigit) {
          pattern += startDigit;
        } else if (startDigit !== "0" || stopDigit !== "9") {
          pattern += toCharacterClass(startDigit, stopDigit, options);
        } else {
          count++;
        }
      }
      if (count) {
        pattern += options.shorthand === true ? "\\d" : "[0-9]";
      }
      return { pattern, count: [count], digits };
    }
    function splitToPatterns(min, max, tok, options) {
      let ranges = splitToRanges(min, max);
      let tokens = [];
      let start = min;
      let prev;
      for (let i = 0; i < ranges.length; i++) {
        let max2 = ranges[i];
        let obj = rangeToPattern(String(start), String(max2), options);
        let zeros = "";
        if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
          if (prev.count.length > 1) {
            prev.count.pop();
          }
          prev.count.push(obj.count[0]);
          prev.string = prev.pattern + toQuantifier(prev.count);
          start = max2 + 1;
          continue;
        }
        if (tok.isPadded) {
          zeros = padZeros(max2, tok, options);
        }
        obj.string = zeros + obj.pattern + toQuantifier(obj.count);
        tokens.push(obj);
        start = max2 + 1;
        prev = obj;
      }
      return tokens;
    }
    function filterPatterns(arr, comparison, prefix, intersection, options) {
      let result = [];
      for (let ele of arr) {
        let { string } = ele;
        if (!intersection && !contains(comparison, "string", string)) {
          result.push(prefix + string);
        }
        if (intersection && contains(comparison, "string", string)) {
          result.push(prefix + string);
        }
      }
      return result;
    }
    function zip(a, b) {
      let arr = [];
      for (let i = 0; i < a.length; i++) arr.push([a[i], b[i]]);
      return arr;
    }
    function compare(a, b) {
      return a > b ? 1 : b > a ? -1 : 0;
    }
    function contains(arr, key, val) {
      return arr.some((ele) => ele[key] === val);
    }
    function countNines(min, len) {
      return Number(String(min).slice(0, -len) + "9".repeat(len));
    }
    function countZeros(integer, zeros) {
      return integer - integer % Math.pow(10, zeros);
    }
    function toQuantifier(digits) {
      let [start = 0, stop = ""] = digits;
      if (stop || start > 1) {
        return `{${start + (stop ? "," + stop : "")}}`;
      }
      return "";
    }
    function toCharacterClass(a, b, options) {
      return `[${a}${b - a === 1 ? "" : "-"}${b}]`;
    }
    function hasPadding(str) {
      return /^-?(0+)\d/.test(str);
    }
    function padZeros(value, tok, options) {
      if (!tok.isPadded) {
        return value;
      }
      let diff = Math.abs(tok.maxLen - String(value).length);
      let relax = options.relaxZeros !== false;
      switch (diff) {
        case 0:
          return "";
        case 1:
          return relax ? "0?" : "0";
        case 2:
          return relax ? "0{0,2}" : "00";
        default: {
          return relax ? `0{0,${diff}}` : `0{${diff}}`;
        }
      }
    }
    toRegexRange.cache = {};
    toRegexRange.clearCache = () => toRegexRange.cache = {};
    module2.exports = toRegexRange;
  }
});

// node_modules/fill-range/index.js
var require_fill_range = __commonJS({
  "node_modules/fill-range/index.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var toRegexRange = require_to_regex_range();
    var isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    var transform = (toNumber) => {
      return (value) => toNumber === true ? Number(value) : String(value);
    };
    var isValidValue = (value) => {
      return typeof value === "number" || typeof value === "string" && value !== "";
    };
    var isNumber = (num) => Number.isInteger(+num);
    var zeros = (input) => {
      let value = `${input}`;
      let index = -1;
      if (value[0] === "-") value = value.slice(1);
      if (value === "0") return false;
      while (value[++index] === "0") ;
      return index > 0;
    };
    var stringify = (start, end, options) => {
      if (typeof start === "string" || typeof end === "string") {
        return true;
      }
      return options.stringify === true;
    };
    var pad = (input, maxLength, toNumber) => {
      if (maxLength > 0) {
        let dash = input[0] === "-" ? "-" : "";
        if (dash) input = input.slice(1);
        input = dash + input.padStart(dash ? maxLength - 1 : maxLength, "0");
      }
      if (toNumber === false) {
        return String(input);
      }
      return input;
    };
    var toMaxLen = (input, maxLength) => {
      let negative = input[0] === "-" ? "-" : "";
      if (negative) {
        input = input.slice(1);
        maxLength--;
      }
      while (input.length < maxLength) input = "0" + input;
      return negative ? "-" + input : input;
    };
    var toSequence = (parts, options, maxLen) => {
      parts.negatives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      parts.positives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      let prefix = options.capture ? "" : "?:";
      let positives = "";
      let negatives = "";
      let result;
      if (parts.positives.length) {
        positives = parts.positives.map((v) => toMaxLen(String(v), maxLen)).join("|");
      }
      if (parts.negatives.length) {
        negatives = `-(${prefix}${parts.negatives.map((v) => toMaxLen(String(v), maxLen)).join("|")})`;
      }
      if (positives && negatives) {
        result = `${positives}|${negatives}`;
      } else {
        result = positives || negatives;
      }
      if (options.wrap) {
        return `(${prefix}${result})`;
      }
      return result;
    };
    var toRange = (a, b, isNumbers, options) => {
      if (isNumbers) {
        return toRegexRange(a, b, { wrap: false, ...options });
      }
      let start = String.fromCharCode(a);
      if (a === b) return start;
      let stop = String.fromCharCode(b);
      return `[${start}-${stop}]`;
    };
    var toRegex = (start, end, options) => {
      if (Array.isArray(start)) {
        let wrap = options.wrap === true;
        let prefix = options.capture ? "" : "?:";
        return wrap ? `(${prefix}${start.join("|")})` : start.join("|");
      }
      return toRegexRange(start, end, options);
    };
    var rangeError = (...args) => {
      return new RangeError("Invalid range arguments: " + util.inspect(...args));
    };
    var invalidRange = (start, end, options) => {
      if (options.strictRanges === true) throw rangeError([start, end]);
      return [];
    };
    var invalidStep = (step, options) => {
      if (options.strictRanges === true) {
        throw new TypeError(`Expected step "${step}" to be a number`);
      }
      return [];
    };
    var fillNumbers = (start, end, step = 1, options = {}) => {
      let a = Number(start);
      let b = Number(end);
      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        if (options.strictRanges === true) throw rangeError([start, end]);
        return [];
      }
      if (a === 0) a = 0;
      if (b === 0) b = 0;
      let descending = a > b;
      let startString = String(start);
      let endString = String(end);
      let stepString = String(step);
      step = Math.max(Math.abs(step), 1);
      let padded = zeros(startString) || zeros(endString) || zeros(stepString);
      let maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0;
      let toNumber = padded === false && stringify(start, end, options) === false;
      let format = options.transform || transform(toNumber);
      if (options.toRegex && step === 1) {
        return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
      }
      let parts = { negatives: [], positives: [] };
      let push = (num) => parts[num < 0 ? "negatives" : "positives"].push(Math.abs(num));
      let range = [];
      let index = 0;
      while (descending ? a >= b : a <= b) {
        if (options.toRegex === true && step > 1) {
          push(a);
        } else {
          range.push(pad(format(a, index), maxLen, toNumber));
        }
        a = descending ? a - step : a + step;
        index++;
      }
      if (options.toRegex === true) {
        return step > 1 ? toSequence(parts, options, maxLen) : toRegex(range, null, { wrap: false, ...options });
      }
      return range;
    };
    var fillLetters = (start, end, step = 1, options = {}) => {
      if (!isNumber(start) && start.length > 1 || !isNumber(end) && end.length > 1) {
        return invalidRange(start, end, options);
      }
      let format = options.transform || ((val) => String.fromCharCode(val));
      let a = `${start}`.charCodeAt(0);
      let b = `${end}`.charCodeAt(0);
      let descending = a > b;
      let min = Math.min(a, b);
      let max = Math.max(a, b);
      if (options.toRegex && step === 1) {
        return toRange(min, max, false, options);
      }
      let range = [];
      let index = 0;
      while (descending ? a >= b : a <= b) {
        range.push(format(a, index));
        a = descending ? a - step : a + step;
        index++;
      }
      if (options.toRegex === true) {
        return toRegex(range, null, { wrap: false, options });
      }
      return range;
    };
    var fill = (start, end, step, options = {}) => {
      if (end == null && isValidValue(start)) {
        return [start];
      }
      if (!isValidValue(start) || !isValidValue(end)) {
        return invalidRange(start, end, options);
      }
      if (typeof step === "function") {
        return fill(start, end, 1, { transform: step });
      }
      if (isObject(step)) {
        return fill(start, end, 0, step);
      }
      let opts = { ...options };
      if (opts.capture === true) opts.wrap = true;
      step = step || opts.step || 1;
      if (!isNumber(step)) {
        if (step != null && !isObject(step)) return invalidStep(step, opts);
        return fill(start, end, 1, step);
      }
      if (isNumber(start) && isNumber(end)) {
        return fillNumbers(start, end, step, opts);
      }
      return fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
    };
    module2.exports = fill;
  }
});

// node_modules/braces/lib/compile.js
var require_compile = __commonJS({
  "node_modules/braces/lib/compile.js"(exports2, module2) {
    "use strict";
    var fill = require_fill_range();
    var utils = require_utils();
    var compile = (ast, options = {}) => {
      const walk = (node, parent = {}) => {
        const invalidBlock = utils.isInvalidBrace(parent);
        const invalidNode = node.invalid === true && options.escapeInvalid === true;
        const invalid = invalidBlock === true || invalidNode === true;
        const prefix = options.escapeInvalid === true ? "\\" : "";
        let output = "";
        if (node.isOpen === true) {
          return prefix + node.value;
        }
        if (node.isClose === true) {
          console.log("node.isClose", prefix, node.value);
          return prefix + node.value;
        }
        if (node.type === "open") {
          return invalid ? prefix + node.value : "(";
        }
        if (node.type === "close") {
          return invalid ? prefix + node.value : ")";
        }
        if (node.type === "comma") {
          return node.prev.type === "comma" ? "" : invalid ? node.value : "|";
        }
        if (node.value) {
          return node.value;
        }
        if (node.nodes && node.ranges > 0) {
          const args = utils.reduce(node.nodes);
          const range = fill(...args, { ...options, wrap: false, toRegex: true, strictZeros: true });
          if (range.length !== 0) {
            return args.length > 1 && range.length > 1 ? `(${range})` : range;
          }
        }
        if (node.nodes) {
          for (const child of node.nodes) {
            output += walk(child, node);
          }
        }
        return output;
      };
      return walk(ast);
    };
    module2.exports = compile;
  }
});

// node_modules/braces/lib/expand.js
var require_expand = __commonJS({
  "node_modules/braces/lib/expand.js"(exports2, module2) {
    "use strict";
    var fill = require_fill_range();
    var stringify = require_stringify();
    var utils = require_utils();
    var append = (queue = "", stash = "", enclose = false) => {
      const result = [];
      queue = [].concat(queue);
      stash = [].concat(stash);
      if (!stash.length) return queue;
      if (!queue.length) {
        return enclose ? utils.flatten(stash).map((ele) => `{${ele}}`) : stash;
      }
      for (const item of queue) {
        if (Array.isArray(item)) {
          for (const value of item) {
            result.push(append(value, stash, enclose));
          }
        } else {
          for (let ele of stash) {
            if (enclose === true && typeof ele === "string") ele = `{${ele}}`;
            result.push(Array.isArray(ele) ? append(item, ele, enclose) : item + ele);
          }
        }
      }
      return utils.flatten(result);
    };
    var expand = (ast, options = {}) => {
      const rangeLimit = options.rangeLimit === void 0 ? 1e3 : options.rangeLimit;
      const walk = (node, parent = {}) => {
        node.queue = [];
        let p = parent;
        let q = parent.queue;
        while (p.type !== "brace" && p.type !== "root" && p.parent) {
          p = p.parent;
          q = p.queue;
        }
        if (node.invalid || node.dollar) {
          q.push(append(q.pop(), stringify(node, options)));
          return;
        }
        if (node.type === "brace" && node.invalid !== true && node.nodes.length === 2) {
          q.push(append(q.pop(), ["{}"]));
          return;
        }
        if (node.nodes && node.ranges > 0) {
          const args = utils.reduce(node.nodes);
          if (utils.exceedsLimit(...args, options.step, rangeLimit)) {
            throw new RangeError("expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.");
          }
          let range = fill(...args, options);
          if (range.length === 0) {
            range = stringify(node, options);
          }
          q.push(append(q.pop(), range));
          node.nodes = [];
          return;
        }
        const enclose = utils.encloseBrace(node);
        let queue = node.queue;
        let block = node;
        while (block.type !== "brace" && block.type !== "root" && block.parent) {
          block = block.parent;
          queue = block.queue;
        }
        for (let i = 0; i < node.nodes.length; i++) {
          const child = node.nodes[i];
          if (child.type === "comma" && node.type === "brace") {
            if (i === 1) queue.push("");
            queue.push("");
            continue;
          }
          if (child.type === "close") {
            q.push(append(q.pop(), queue, enclose));
            continue;
          }
          if (child.value && child.type !== "open") {
            queue.push(append(queue.pop(), child.value));
            continue;
          }
          if (child.nodes) {
            walk(child, node);
          }
        }
        return queue;
      };
      return utils.flatten(walk(ast));
    };
    module2.exports = expand;
  }
});

// node_modules/braces/lib/constants.js
var require_constants = __commonJS({
  "node_modules/braces/lib/constants.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      MAX_LENGTH: 1e4,
      // Digits
      CHAR_0: "0",
      /* 0 */
      CHAR_9: "9",
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: "A",
      /* A */
      CHAR_LOWERCASE_A: "a",
      /* a */
      CHAR_UPPERCASE_Z: "Z",
      /* Z */
      CHAR_LOWERCASE_Z: "z",
      /* z */
      CHAR_LEFT_PARENTHESES: "(",
      /* ( */
      CHAR_RIGHT_PARENTHESES: ")",
      /* ) */
      CHAR_ASTERISK: "*",
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: "&",
      /* & */
      CHAR_AT: "@",
      /* @ */
      CHAR_BACKSLASH: "\\",
      /* \ */
      CHAR_BACKTICK: "`",
      /* ` */
      CHAR_CARRIAGE_RETURN: "\r",
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: "^",
      /* ^ */
      CHAR_COLON: ":",
      /* : */
      CHAR_COMMA: ",",
      /* , */
      CHAR_DOLLAR: "$",
      /* . */
      CHAR_DOT: ".",
      /* . */
      CHAR_DOUBLE_QUOTE: '"',
      /* " */
      CHAR_EQUAL: "=",
      /* = */
      CHAR_EXCLAMATION_MARK: "!",
      /* ! */
      CHAR_FORM_FEED: "\f",
      /* \f */
      CHAR_FORWARD_SLASH: "/",
      /* / */
      CHAR_HASH: "#",
      /* # */
      CHAR_HYPHEN_MINUS: "-",
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: "<",
      /* < */
      CHAR_LEFT_CURLY_BRACE: "{",
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: "[",
      /* [ */
      CHAR_LINE_FEED: "\n",
      /* \n */
      CHAR_NO_BREAK_SPACE: "\xA0",
      /* \u00A0 */
      CHAR_PERCENT: "%",
      /* % */
      CHAR_PLUS: "+",
      /* + */
      CHAR_QUESTION_MARK: "?",
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: ">",
      /* > */
      CHAR_RIGHT_CURLY_BRACE: "}",
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: "]",
      /* ] */
      CHAR_SEMICOLON: ";",
      /* ; */
      CHAR_SINGLE_QUOTE: "'",
      /* ' */
      CHAR_SPACE: " ",
      /*   */
      CHAR_TAB: "	",
      /* \t */
      CHAR_UNDERSCORE: "_",
      /* _ */
      CHAR_VERTICAL_LINE: "|",
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: "\uFEFF"
      /* \uFEFF */
    };
  }
});

// node_modules/braces/lib/parse.js
var require_parse = __commonJS({
  "node_modules/braces/lib/parse.js"(exports2, module2) {
    "use strict";
    var stringify = require_stringify();
    var {
      MAX_LENGTH,
      CHAR_BACKSLASH,
      /* \ */
      CHAR_BACKTICK,
      /* ` */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_RIGHT_SQUARE_BRACKET,
      /* ] */
      CHAR_DOUBLE_QUOTE,
      /* " */
      CHAR_SINGLE_QUOTE,
      /* ' */
      CHAR_NO_BREAK_SPACE,
      CHAR_ZERO_WIDTH_NOBREAK_SPACE
    } = require_constants();
    var parse2 = (input, options = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      const opts = options || {};
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      if (input.length > max) {
        throw new SyntaxError(`Input length (${input.length}), exceeds max characters (${max})`);
      }
      const ast = { type: "root", input, nodes: [] };
      const stack = [ast];
      let block = ast;
      let prev = ast;
      let brackets = 0;
      const length = input.length;
      let index = 0;
      let depth = 0;
      let value;
      const advance = () => input[index++];
      const push = (node) => {
        if (node.type === "text" && prev.type === "dot") {
          prev.type = "text";
        }
        if (prev && prev.type === "text" && node.type === "text") {
          prev.value += node.value;
          return;
        }
        block.nodes.push(node);
        node.parent = block;
        node.prev = prev;
        prev = node;
        return node;
      };
      push({ type: "bos" });
      while (index < length) {
        block = stack[stack.length - 1];
        value = advance();
        if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE || value === CHAR_NO_BREAK_SPACE) {
          continue;
        }
        if (value === CHAR_BACKSLASH) {
          push({ type: "text", value: (options.keepEscaping ? value : "") + advance() });
          continue;
        }
        if (value === CHAR_RIGHT_SQUARE_BRACKET) {
          push({ type: "text", value: "\\" + value });
          continue;
        }
        if (value === CHAR_LEFT_SQUARE_BRACKET) {
          brackets++;
          let next;
          while (index < length && (next = advance())) {
            value += next;
            if (next === CHAR_LEFT_SQUARE_BRACKET) {
              brackets++;
              continue;
            }
            if (next === CHAR_BACKSLASH) {
              value += advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              brackets--;
              if (brackets === 0) {
                break;
              }
            }
          }
          push({ type: "text", value });
          continue;
        }
        if (value === CHAR_LEFT_PARENTHESES) {
          block = push({ type: "paren", nodes: [] });
          stack.push(block);
          push({ type: "text", value });
          continue;
        }
        if (value === CHAR_RIGHT_PARENTHESES) {
          if (block.type !== "paren") {
            push({ type: "text", value });
            continue;
          }
          block = stack.pop();
          push({ type: "text", value });
          block = stack[stack.length - 1];
          continue;
        }
        if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
          const open = value;
          let next;
          if (options.keepQuotes !== true) {
            value = "";
          }
          while (index < length && (next = advance())) {
            if (next === CHAR_BACKSLASH) {
              value += next + advance();
              continue;
            }
            if (next === open) {
              if (options.keepQuotes === true) value += next;
              break;
            }
            value += next;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === CHAR_LEFT_CURLY_BRACE) {
          depth++;
          const dollar = prev.value && prev.value.slice(-1) === "$" || block.dollar === true;
          const brace = {
            type: "brace",
            open: true,
            close: false,
            dollar,
            depth,
            commas: 0,
            ranges: 0,
            nodes: []
          };
          block = push(brace);
          stack.push(block);
          push({ type: "open", value });
          continue;
        }
        if (value === CHAR_RIGHT_CURLY_BRACE) {
          if (block.type !== "brace") {
            push({ type: "text", value });
            continue;
          }
          const type = "close";
          block = stack.pop();
          block.close = true;
          push({ type, value });
          depth--;
          block = stack[stack.length - 1];
          continue;
        }
        if (value === CHAR_COMMA && depth > 0) {
          if (block.ranges > 0) {
            block.ranges = 0;
            const open = block.nodes.shift();
            block.nodes = [open, { type: "text", value: stringify(block) }];
          }
          push({ type: "comma", value });
          block.commas++;
          continue;
        }
        if (value === CHAR_DOT && depth > 0 && block.commas === 0) {
          const siblings = block.nodes;
          if (depth === 0 || siblings.length === 0) {
            push({ type: "text", value });
            continue;
          }
          if (prev.type === "dot") {
            block.range = [];
            prev.value += value;
            prev.type = "range";
            if (block.nodes.length !== 3 && block.nodes.length !== 5) {
              block.invalid = true;
              block.ranges = 0;
              prev.type = "text";
              continue;
            }
            block.ranges++;
            block.args = [];
            continue;
          }
          if (prev.type === "range") {
            siblings.pop();
            const before = siblings[siblings.length - 1];
            before.value += prev.value + value;
            prev = before;
            block.ranges--;
            continue;
          }
          push({ type: "dot", value });
          continue;
        }
        push({ type: "text", value });
      }
      do {
        block = stack.pop();
        if (block.type !== "root") {
          block.nodes.forEach((node) => {
            if (!node.nodes) {
              if (node.type === "open") node.isOpen = true;
              if (node.type === "close") node.isClose = true;
              if (!node.nodes) node.type = "text";
              node.invalid = true;
            }
          });
          const parent = stack[stack.length - 1];
          const index2 = parent.nodes.indexOf(block);
          parent.nodes.splice(index2, 1, ...block.nodes);
        }
      } while (stack.length > 0);
      push({ type: "eos" });
      return ast;
    };
    module2.exports = parse2;
  }
});

// node_modules/braces/index.js
var require_braces = __commonJS({
  "node_modules/braces/index.js"(exports2, module2) {
    "use strict";
    var stringify = require_stringify();
    var compile = require_compile();
    var expand = require_expand();
    var parse2 = require_parse();
    var braces = (input, options = {}) => {
      let output = [];
      if (Array.isArray(input)) {
        for (const pattern of input) {
          const result = braces.create(pattern, options);
          if (Array.isArray(result)) {
            output.push(...result);
          } else {
            output.push(result);
          }
        }
      } else {
        output = [].concat(braces.create(input, options));
      }
      if (options && options.expand === true && options.nodupes === true) {
        output = [...new Set(output)];
      }
      return output;
    };
    braces.parse = (input, options = {}) => parse2(input, options);
    braces.stringify = (input, options = {}) => {
      if (typeof input === "string") {
        return stringify(braces.parse(input, options), options);
      }
      return stringify(input, options);
    };
    braces.compile = (input, options = {}) => {
      if (typeof input === "string") {
        input = braces.parse(input, options);
      }
      return compile(input, options);
    };
    braces.expand = (input, options = {}) => {
      if (typeof input === "string") {
        input = braces.parse(input, options);
      }
      let result = expand(input, options);
      if (options.noempty === true) {
        result = result.filter(Boolean);
      }
      if (options.nodupes === true) {
        result = [...new Set(result)];
      }
      return result;
    };
    braces.create = (input, options = {}) => {
      if (input === "" || input.length < 3) {
        return [input];
      }
      return options.expand !== true ? braces.compile(input, options) : braces.expand(input, options);
    };
    module2.exports = braces;
  }
});

// node_modules/picomatch/lib/constants.js
var require_constants2 = __commonJS({
  "node_modules/picomatch/lib/constants.js"(exports2, module2) {
    "use strict";
    var path12 = require("path");
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`
    };
    var POSIX_REGEX_SOURCE = {
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module2.exports = {
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      SEP: path12.sep,
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// node_modules/picomatch/lib/utils.js
var require_utils2 = __commonJS({
  "node_modules/picomatch/lib/utils.js"(exports2) {
    "use strict";
    var path12 = require("path");
    var win32 = process.platform === "win32";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants2();
    exports2.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports2.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports2.isRegexChar = (str) => str.length === 1 && exports2.hasRegexChars(str);
    exports2.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports2.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports2.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports2.supportsLookbehinds = () => {
      const segs = process.version.slice(1).split(".").map(Number);
      if (segs.length === 3 && segs[0] >= 9 || segs[0] === 8 && segs[1] >= 10) {
        return true;
      }
      return false;
    };
    exports2.isWindows = (options) => {
      if (options && typeof options.windows === "boolean") {
        return options.windows;
      }
      return win32 === true || path12.sep === "\\";
    };
    exports2.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports2.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports2.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports2.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
  }
});

// node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "node_modules/picomatch/lib/scan.js"(exports2, module2) {
    "use strict";
    var utils = require_utils2();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants2();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module2.exports = scan;
  }
});

// node_modules/picomatch/lib/parse.js
var require_parse2 = __commonJS({
  "node_modules/picomatch/lib/parse.js"(exports2, module2) {
    "use strict";
    var constants = require_constants2();
    var utils = require_utils2();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var parse2 = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const win32 = utils.isWindows(options);
      const PLATFORM_CHARS = constants.globChars(win32);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.value += tok.value;
          prev.output = (prev.output || "") + tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse2(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix = POSIX_REGEX_SOURCE[rest2];
                if (posix) {
                  prev.value = pre + posix;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (next === "<" && !utils.supportsLookbehinds()) {
              throw new Error("Node.js v10 or higher is required for regex lookbehinds");
            }
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse2.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const win32 = utils.isWindows(options);
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(win32);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module2.exports = parse2;
  }
});

// node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "node_modules/picomatch/lib/picomatch.js"(exports2, module2) {
    "use strict";
    var path12 = require("path");
    var scan = require_scan();
    var parse2 = require_parse2();
    var utils = require_utils2();
    var constants = require_constants2();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix = utils.isWindows(options);
      const regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch.test(input, regex, options, { glob, posix });
        const result = { glob, state, regex, posix, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch.test = (input, regex, options, { glob, posix } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch.matchBase = (input, glob, options, posix = utils.isWindows(options)) => {
      const regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
      return regex.test(path12.basename(input));
    };
    picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
    picomatch.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch.parse(p, options));
      return parse2(pattern, { ...options, fastpaths: false });
    };
    picomatch.scan = (input, options) => scan(input, options);
    picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse2.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse2(input, options);
      }
      return picomatch.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch.constants = constants;
    module2.exports = picomatch;
  }
});

// node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "node_modules/picomatch/index.js"(exports2, module2) {
    "use strict";
    module2.exports = require_picomatch();
  }
});

// node_modules/micromatch/index.js
var require_micromatch = __commonJS({
  "node_modules/micromatch/index.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var braces = require_braces();
    var picomatch = require_picomatch2();
    var utils = require_utils2();
    var isEmptyString = (v) => v === "" || v === "./";
    var hasBraces = (v) => {
      const index = v.indexOf("{");
      return index > -1 && v.indexOf("}", index) > -1;
    };
    var micromatch4 = (list, patterns, options) => {
      patterns = [].concat(patterns);
      list = [].concat(list);
      let omit = /* @__PURE__ */ new Set();
      let keep = /* @__PURE__ */ new Set();
      let items = /* @__PURE__ */ new Set();
      let negatives = 0;
      let onResult = (state) => {
        items.add(state.output);
        if (options && options.onResult) {
          options.onResult(state);
        }
      };
      for (let i = 0; i < patterns.length; i++) {
        let isMatch = picomatch(String(patterns[i]), { ...options, onResult }, true);
        let negated = isMatch.state.negated || isMatch.state.negatedExtglob;
        if (negated) negatives++;
        for (let item of list) {
          let matched = isMatch(item, true);
          let match = negated ? !matched.isMatch : matched.isMatch;
          if (!match) continue;
          if (negated) {
            omit.add(matched.output);
          } else {
            omit.delete(matched.output);
            keep.add(matched.output);
          }
        }
      }
      let result = negatives === patterns.length ? [...items] : [...keep];
      let matches = result.filter((item) => !omit.has(item));
      if (options && matches.length === 0) {
        if (options.failglob === true) {
          throw new Error(`No matches found for "${patterns.join(", ")}"`);
        }
        if (options.nonull === true || options.nullglob === true) {
          return options.unescape ? patterns.map((p) => p.replace(/\\/g, "")) : patterns;
        }
      }
      return matches;
    };
    micromatch4.match = micromatch4;
    micromatch4.matcher = (pattern, options) => picomatch(pattern, options);
    micromatch4.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
    micromatch4.any = micromatch4.isMatch;
    micromatch4.not = (list, patterns, options = {}) => {
      patterns = [].concat(patterns).map(String);
      let result = /* @__PURE__ */ new Set();
      let items = [];
      let onResult = (state) => {
        if (options.onResult) options.onResult(state);
        items.push(state.output);
      };
      let matches = new Set(micromatch4(list, patterns, { ...options, onResult }));
      for (let item of items) {
        if (!matches.has(item)) {
          result.add(item);
        }
      }
      return [...result];
    };
    micromatch4.contains = (str, pattern, options) => {
      if (typeof str !== "string") {
        throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
      }
      if (Array.isArray(pattern)) {
        return pattern.some((p) => micromatch4.contains(str, p, options));
      }
      if (typeof pattern === "string") {
        if (isEmptyString(str) || isEmptyString(pattern)) {
          return false;
        }
        if (str.includes(pattern) || str.startsWith("./") && str.slice(2).includes(pattern)) {
          return true;
        }
      }
      return micromatch4.isMatch(str, pattern, { ...options, contains: true });
    };
    micromatch4.matchKeys = (obj, patterns, options) => {
      if (!utils.isObject(obj)) {
        throw new TypeError("Expected the first argument to be an object");
      }
      let keys = micromatch4(Object.keys(obj), patterns, options);
      let res = {};
      for (let key of keys) res[key] = obj[key];
      return res;
    };
    micromatch4.some = (list, patterns, options) => {
      let items = [].concat(list);
      for (let pattern of [].concat(patterns)) {
        let isMatch = picomatch(String(pattern), options);
        if (items.some((item) => isMatch(item))) {
          return true;
        }
      }
      return false;
    };
    micromatch4.every = (list, patterns, options) => {
      let items = [].concat(list);
      for (let pattern of [].concat(patterns)) {
        let isMatch = picomatch(String(pattern), options);
        if (!items.every((item) => isMatch(item))) {
          return false;
        }
      }
      return true;
    };
    micromatch4.all = (str, patterns, options) => {
      if (typeof str !== "string") {
        throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
      }
      return [].concat(patterns).every((p) => picomatch(p, options)(str));
    };
    micromatch4.capture = (glob, input, options) => {
      let posix = utils.isWindows(options);
      let regex = picomatch.makeRe(String(glob), { ...options, capture: true });
      let match = regex.exec(posix ? utils.toPosixSlashes(input) : input);
      if (match) {
        return match.slice(1).map((v) => v === void 0 ? "" : v);
      }
    };
    micromatch4.makeRe = (...args) => picomatch.makeRe(...args);
    micromatch4.scan = (...args) => picomatch.scan(...args);
    micromatch4.parse = (patterns, options) => {
      let res = [];
      for (let pattern of [].concat(patterns || [])) {
        for (let str of braces(String(pattern), options)) {
          res.push(picomatch.parse(str, options));
        }
      }
      return res;
    };
    micromatch4.braces = (pattern, options) => {
      if (typeof pattern !== "string") throw new TypeError("Expected a string");
      if (options && options.nobrace === true || !hasBraces(pattern)) {
        return [pattern];
      }
      return braces(pattern, options);
    };
    micromatch4.braceExpand = (pattern, options) => {
      if (typeof pattern !== "string") throw new TypeError("Expected a string");
      return micromatch4.braces(pattern, { ...options, expand: true });
    };
    micromatch4.hasBraces = hasBraces;
    module2.exports = micromatch4;
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  CommandRouter: () => CommandRouter,
  Logger: () => Logger,
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(main_exports);
var vscode18 = __toESM(require("vscode"));

// src/types.ts
function success(value) {
  return { kind: "ok", value };
}
function failure(error) {
  return { kind: "err", error };
}

// src/router.ts
var CommandRouter = class {
  constructor(logger) {
    this.handlers = {};
    this.middlewares = [];
    this.domains = /* @__PURE__ */ new Map();
    this.logger = logger;
  }
  /**
   * Register handlers from a domain service.
   * Validates command names upfront, no late binding.
   */
  registerDomain(domain) {
    if (this.domains.has(domain.name)) {
      this.logger.warn(
        `Domain '${domain.name}' already registered, skipping`,
        "CommandRouter.registerDomain"
      );
      return;
    }
    const domain_handlers = Object.entries(domain.handlers);
    for (const [name, handler] of domain_handlers) {
      if (this.handlers[name]) {
        const err = {
          code: "HANDLER_CONFLICT",
          message: `Handler '${name}' already registered`,
          context: "CommandRouter.registerDomain"
        };
        this.logger.error(
          `Cannot register '${name}': handler conflict`,
          "CommandRouter.registerDomain",
          err
        );
        throw err;
      }
      this.handlers[name] = handler;
    }
    this.domains.set(domain.name, domain);
    this.logger.info(
      `Registered ${domain_handlers.length} handlers from domain '${domain.name}'`,
      "CommandRouter.registerDomain"
    );
  }
  /**
   * Register a middleware for cross-cutting concerns.
   * Executed in order before handler dispatch.
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }
  /**
   * Dispatch a command through the middleware chain to its handler.
   * Returns Result monad — no exceptions thrown.
   */
  async dispatch(command, context) {
    const handler = this.handlers[command.name];
    if (!handler) {
      const err = {
        code: "HANDLER_NOT_FOUND",
        message: `No handler registered for command '${command.name}'`,
        context: command.name
      };
      this.logger.warn(
        `Command not found: ${command.name}`,
        "CommandRouter.dispatch",
        err
      );
      return failure(err);
    }
    const mwCtx = {
      commandName: command.name,
      startTime: Date.now(),
      permissions: []
    };
    try {
      await this.executeMiddlewares(mwCtx, 0);
    } catch (mwErr) {
      const err = {
        code: "MIDDLEWARE_ERROR",
        message: `Middleware execution failed for '${command.name}'`,
        details: mwErr,
        context: "CommandRouter.dispatch"
      };
      this.logger.error(
        `Middleware failed: ${command.name}`,
        "CommandRouter.dispatch",
        err
      );
      return failure(err);
    }
    try {
      const result = await handler(context, command.params);
      const duration = Date.now() - mwCtx.startTime;
      this.logger.info(
        `Command '${command.name}' executed in ${duration}ms`,
        "CommandRouter.dispatch"
      );
      return result;
    } catch (handlerErr) {
      const err = {
        code: "HANDLER_ERROR",
        message: `Handler for '${command.name}' threw an exception`,
        details: handlerErr,
        context: command.name
      };
      this.logger.error(
        `Handler error: ${command.name}`,
        "CommandRouter.dispatch",
        err
      );
      return failure(err);
    }
  }
  /**
   * Execute middleware chain recursively.
   */
  async executeMiddlewares(ctx, index) {
    if (index >= this.middlewares.length) {
      return;
    }
    const middleware = this.middlewares[index];
    await middleware(ctx, () => this.executeMiddlewares(ctx, index + 1));
  }
  /**
   * List registered command names.
   */
  listCommands() {
    return Object.keys(this.handlers);
  }
  /**
   * List registered domains.
   */
  listDomains() {
    return Array.from(this.domains.keys());
  }
  /**
   * Validate that all required commands for a domain are registered.
   */
  async validateDomains() {
    const errors = [];
    for (const [domainName, domain] of this.domains) {
      const domainHandlers = Object.keys(domain.handlers);
      for (const handlerName of domainHandlers) {
        if (!this.handlers[handlerName]) {
          errors.push(
            `Domain '${domainName}' handler '${handlerName}' not in registry`
          );
        }
      }
      if (domain.initialize) {
        const initResult = await domain.initialize();
        if (initResult.kind === "err") {
          errors.push(
            `Domain '${domainName}' initialization failed: ${initResult.error.message}`
          );
        }
      }
    }
    if (errors.length > 0) {
      const err = {
        code: "VALIDATION_ERROR",
        message: `Domain validation failed`,
        details: errors,
        context: "CommandRouter.validateDomains"
      };
      this.logger.error(
        `Domain validation failed: ${errors.length} errors`,
        "CommandRouter.validateDomains",
        err
      );
      return failure(err);
    }
    this.logger.info(
      `All ${this.domains.size} domains validated successfully`,
      "CommandRouter.validateDomains"
    );
    return success(void 0);
  }
  /**
   * Cleanup: call teardown on all domains in reverse order.
   */
  async teardown() {
    const domains = Array.from(this.domains.values()).reverse();
    for (const domain of domains) {
      if (domain.teardown) {
        try {
          await domain.teardown();
        } catch (err) {
          this.logger.warn(
            `Domain '${domain.name}' teardown threw: ${err}`,
            "CommandRouter.teardown"
          );
        }
      }
    }
    this.logger.info("Router teardown complete", "CommandRouter.teardown");
  }
};

// src/infrastructure/logger.ts
var Logger = class {
  constructor(maxEntries = 1e3) {
    this.entries = [];
    this.maxEntries = maxEntries;
  }
  debug(message, context, data) {
    this.log("DEBUG" /* DEBUG */, message, context, data);
  }
  info(message, context, data) {
    this.log("INFO" /* INFO */, message, context, data);
  }
  warn(message, context, error) {
    this.log("WARN" /* WARN */, message, context, error);
  }
  error(message, context, error) {
    this.log("ERROR" /* ERROR */, message, context, error);
  }
  log(level, message, context, data) {
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      message,
      context,
      data
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }
  /**
   * Export logs for debugging or telemetry.
   */
  exportLogs(level) {
    if (!level) {
      return [...this.entries];
    }
    return this.entries.filter((e) => e.level === level);
  }
  /**
   * Clear log history.
   */
  clear() {
    this.entries = [];
  }
  /**
   * Get recent logs (last N entries).
   */
  recent(count = 100) {
    return this.entries.slice(-count);
  }
};

// src/infrastructure/error-codes.ts
var GIT_ERROR_CODES = {
  // Core Git Operations
  GIT_UNAVAILABLE: "GIT_UNAVAILABLE",
  GIT_INIT_ERROR: "GIT_INIT_ERROR",
  GIT_STATUS_ERROR: "GIT_STATUS_ERROR",
  GIT_PULL_ERROR: "GIT_PULL_ERROR",
  GIT_COMMIT_ERROR: "GIT_COMMIT_ERROR",
  GIT_FETCH_ERROR: "GIT_FETCH_ERROR",
  GIT_RESET_ERROR: "GIT_RESET_ERROR",
  // Change Parsing & Staging
  GET_CHANGES_FAILED: "GET_CHANGES_FAILED",
  PARSE_CHANGES_FAILED: "PARSE_CHANGES_FAILED",
  STAGE_FAILED: "STAGE_FAILED",
  // Batch Commit Operations
  COMMIT_FAILED: "COMMIT_FAILED",
  BATCH_COMMIT_ERROR: "BATCH_COMMIT_ERROR",
  ROLLBACK_FAILED: "ROLLBACK_FAILED",
  // Inbound Analysis
  INBOUND_ANALYSIS_ERROR: "INBOUND_ANALYSIS_ERROR",
  INBOUND_DIFF_PARSE_ERROR: "INBOUND_DIFF_PARSE_ERROR",
  CONFLICT_DETECTION_ERROR: "CONFLICT_DETECTION_ERROR",
  // Analytics
  ANALYTICS_ERROR: "ANALYTICS_ERROR",
  EXPORT_ERROR: "EXPORT_ERROR",
  INVALID_PERIOD: "INVALID_PERIOD",
  // Smart Commit
  SMART_COMMIT_ERROR: "SMART_COMMIT_ERROR",
  // Validation
  NO_CHANGES: "NO_CHANGES",
  NO_GROUPS_APPROVED: "NO_GROUPS_APPROVED",
  COMMIT_CANCELLED: "COMMIT_CANCELLED",
  PR_GENERATION_ERROR: "PR_GENERATION_ERROR",
  PR_REVIEW_ERROR: "PR_REVIEW_ERROR",
  PR_COMMENT_ERROR: "PR_COMMENT_ERROR",
  CONFLICT_RESOLUTION_ERROR: "CONFLICT_RESOLUTION_ERROR"
};
var HYGIENE_ERROR_CODES = {
  HYGIENE_INIT_ERROR: "HYGIENE_INIT_ERROR",
  HYGIENE_SCAN_ERROR: "HYGIENE_SCAN_ERROR",
  HYGIENE_CLEANUP_ERROR: "HYGIENE_CLEANUP_ERROR",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_DELETE_ERROR: "FILE_DELETE_ERROR",
  IMPACT_ANALYSIS_ERROR: "IMPACT_ANALYSIS_ERROR",
  HYGIENE_CLEANUP_NO_FILES: "HYGIENE_CLEANUP_NO_FILES",
  HYGIENE_ANALYTICS_ERROR: "HYGIENE_ANALYTICS_ERROR",
  DEAD_CODE_SCAN_ERROR: "DEAD_CODE_SCAN_ERROR"
};
var CHAT_ERROR_CODES = {
  CHAT_INIT_ERROR: "CHAT_INIT_ERROR",
  CHAT_CONTEXT_ERROR: "CHAT_CONTEXT_ERROR",
  CHAT_DELEGATE_ERROR: "CHAT_DELEGATE_ERROR",
  CHAT_DELEGATE_NO_GENERATE_FN: "CHAT_DELEGATE_NO_GENERATE_FN"
};
var WORKFLOW_ERROR_CODES = {
  WORKFLOW_INIT_ERROR: "WORKFLOW_INIT_ERROR",
  STEP_RUNNER_NOT_AVAILABLE: "STEP_RUNNER_NOT_AVAILABLE",
  WORKFLOW_EXECUTION_ERROR: "WORKFLOW_EXECUTION_ERROR",
  INVALID_NEXT_STEP: "INVALID_NEXT_STEP",
  STEP_EXECUTION_ERROR: "STEP_EXECUTION_ERROR",
  STEP_TIMEOUT: "STEP_TIMEOUT",
  INTERPOLATION_ERROR: "INTERPOLATION_ERROR",
  INVALID_WORKFLOW: "INVALID_WORKFLOW",
  WORKFLOW_LIST_ERROR: "WORKFLOW_LIST_ERROR",
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_EXECUTION_FAILED: "WORKFLOW_EXECUTION_FAILED",
  WORKFLOW_RUN_ERROR: "WORKFLOW_RUN_ERROR"
};
var AGENT_ERROR_CODES = {
  AGENT_INIT_ERROR: "AGENT_INIT_ERROR",
  AGENT_LIST_ERROR: "AGENT_LIST_ERROR",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  MISSING_CAPABILITY: "MISSING_CAPABILITY",
  EXECUTION_FAILED: "EXECUTION_FAILED",
  INVALID_WORKFLOW_REFERENCE: "INVALID_WORKFLOW_REFERENCE"
};
var ROUTER_ERROR_CODES = {
  HANDLER_NOT_FOUND: "HANDLER_NOT_FOUND",
  HANDLER_CONFLICT: "HANDLER_CONFLICT",
  HANDLER_ERROR: "HANDLER_ERROR",
  MIDDLEWARE_ERROR: "MIDDLEWARE_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DOMAIN_INIT_ERROR: "DOMAIN_INIT_ERROR"
};
var INFRASTRUCTURE_ERROR_CODES = {
  CONFIG_INIT_ERROR: "CONFIG_INIT_ERROR",
  CONFIG_SET_ERROR: "CONFIG_SET_ERROR",
  CONFIG_READ_ERROR: "CONFIG_READ_ERROR",
  CONFIG_WRITE_ERROR: "CONFIG_WRITE_ERROR",
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  WORKSPACE_READ_ERROR: "WORKSPACE_READ_ERROR",
  WORKSPACE_WRITE_ERROR: "WORKSPACE_WRITE_ERROR",
  WEBVIEW_ERROR: "WEBVIEW_ERROR",
  LOGGER_ERROR: "LOGGER_ERROR",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE"
};
var GENERIC_ERROR_CODES = {
  INVALID_PARAMS: "INVALID_PARAMS",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  TIMEOUT: "TIMEOUT",
  UNKNOWN_ERROR: "UNKNOWN_ERROR"
};
var ERROR_CODES = {
  ...GIT_ERROR_CODES,
  ...HYGIENE_ERROR_CODES,
  ...CHAT_ERROR_CODES,
  ...WORKFLOW_ERROR_CODES,
  ...AGENT_ERROR_CODES,
  ...ROUTER_ERROR_CODES,
  ...INFRASTRUCTURE_ERROR_CODES,
  ...GENERIC_ERROR_CODES
};
var TELEMETRY_EVENTS = {
  ["COMMAND_STARTED" /* COMMAND_STARTED */]: {
    eventName: "COMMAND_STARTED" /* COMMAND_STARTED */,
    isCritical: false,
    description: "Fired when a command begins execution",
    payloadExample: {
      commandName: "git.smartCommit",
      timestamp: Date.now()
    }
  },
  ["COMMAND_COMPLETED" /* COMMAND_COMPLETED */]: {
    eventName: "COMMAND_COMPLETED" /* COMMAND_COMPLETED */,
    isCritical: true,
    description: "Fired when a command completes successfully",
    payloadExample: {
      commandName: "git.smartCommit",
      durationMs: 1234,
      timestamp: Date.now()
    }
  },
  ["COMMAND_FAILED" /* COMMAND_FAILED */]: {
    eventName: "COMMAND_FAILED" /* COMMAND_FAILED */,
    isCritical: true,
    description: "Fired when a command fails",
    payloadExample: {
      commandName: "git.smartCommit",
      errorCode: "BATCH_COMMIT_ERROR",
      durationMs: 234
    }
  },
  ["GIT_INIT" /* GIT_INIT */]: {
    eventName: "GIT_INIT" /* GIT_INIT */,
    isCritical: true,
    description: "Git domain initialized successfully",
    payloadExample: {
      branch: "main",
      timestamp: Date.now()
    }
  },
  ["GIT_STATUS_CHECK" /* GIT_STATUS_CHECK */]: {
    eventName: "GIT_STATUS_CHECK" /* GIT_STATUS_CHECK */,
    isCritical: false,
    description: "Git status checked",
    payloadExample: {
      branch: "main",
      isDirty: true,
      stagedCount: 3
    }
  },
  ["GIT_PULL_EXECUTED" /* GIT_PULL_EXECUTED */]: {
    eventName: "GIT_PULL_EXECUTED" /* GIT_PULL_EXECUTED */,
    isCritical: true,
    description: "Git pull completed",
    payloadExample: {
      branch: "main",
      success: true
    }
  },
  ["GIT_COMMIT_EXECUTED" /* GIT_COMMIT_EXECUTED */]: {
    eventName: "GIT_COMMIT_EXECUTED" /* GIT_COMMIT_EXECUTED */,
    isCritical: true,
    description: "Git commit completed",
    payloadExample: {
      fileCount: 5,
      hash: "abc123def456"
    }
  },
  ["GIT_SMART_COMMIT" /* GIT_SMART_COMMIT */]: {
    eventName: "GIT_SMART_COMMIT" /* GIT_SMART_COMMIT */,
    isCritical: true,
    description: "Smart commit executed with change grouping",
    payloadExample: {
      filesAnalyzed: 10,
      groupsCreated: 3,
      commitsCreated: 3,
      durationMs: 2e3
    }
  },
  ["GIT_BATCH_COMMIT" /* GIT_BATCH_COMMIT */]: {
    eventName: "GIT_BATCH_COMMIT" /* GIT_BATCH_COMMIT */,
    isCritical: true,
    description: "Batch commit executed",
    payloadExample: {
      groupCount: 3,
      totalFiles: 10,
      commitCount: 3
    }
  },
  ["GIT_BATCH_ROLLBACK" /* GIT_BATCH_ROLLBACK */]: {
    eventName: "GIT_BATCH_ROLLBACK" /* GIT_BATCH_ROLLBACK */,
    isCritical: true,
    description: "Batch commit rolled back due to error",
    payloadExample: {
      commitCount: 2,
      reason: "COMMIT_FAILED"
    }
  },
  ["GIT_INBOUND_ANALYSIS" /* GIT_INBOUND_ANALYSIS */]: {
    eventName: "GIT_INBOUND_ANALYSIS" /* GIT_INBOUND_ANALYSIS */,
    isCritical: false,
    description: "Inbound changes analyzed",
    payloadExample: {
      remoteChanges: 5,
      conflicts: 2,
      highSeverity: 1
    }
  },
  ["WORKFLOW_STARTED" /* WORKFLOW_STARTED */]: {
    eventName: "WORKFLOW_STARTED" /* WORKFLOW_STARTED */,
    isCritical: true,
    description: "Workflow execution started",
    payloadExample: {
      workflowName: "deploy",
      stepCount: 5
    }
  },
  ["WORKFLOW_COMPLETED" /* WORKFLOW_COMPLETED */]: {
    eventName: "WORKFLOW_COMPLETED" /* WORKFLOW_COMPLETED */,
    isCritical: true,
    description: "Workflow completed successfully",
    payloadExample: {
      workflowName: "deploy",
      durationMs: 5e3,
      stepsExecuted: 5
    }
  },
  ["WORKFLOW_STEP_EXECUTED" /* WORKFLOW_STEP_EXECUTED */]: {
    eventName: "WORKFLOW_STEP_EXECUTED" /* WORKFLOW_STEP_EXECUTED */,
    isCritical: false,
    description: "Single workflow step executed",
    payloadExample: {
      workflowName: "deploy",
      stepId: "checkout",
      success: true
    }
  },
  ["HYGIENE_SCAN" /* HYGIENE_SCAN */]: {
    eventName: "HYGIENE_SCAN" /* HYGIENE_SCAN */,
    isCritical: false,
    description: "Workspace hygiene scan completed",
    payloadExample: {
      deadFiles: 3,
      largeFiles: 2,
      logFiles: 5
    }
  },
  ["HYGIENE_CLEANUP" /* HYGIENE_CLEANUP */]: {
    eventName: "HYGIENE_CLEANUP" /* HYGIENE_CLEANUP */,
    isCritical: true,
    description: "Workspace cleanup completed",
    payloadExample: {
      filesDeleted: 10,
      bytesFreed: 1048576,
      dryRun: false
    }
  },
  ["ERROR_OCCURRED" /* ERROR_OCCURRED */]: {
    eventName: "ERROR_OCCURRED" /* ERROR_OCCURRED */,
    isCritical: true,
    description: "Error occurred during execution",
    payloadExample: {
      errorCode: "GIT_UNAVAILABLE",
      context: "GitDomainService.initialize",
      timestamp: Date.now()
    }
  },
  ["RETRY_ATTEMPTED" /* RETRY_ATTEMPTED */]: {
    eventName: "RETRY_ATTEMPTED" /* RETRY_ATTEMPTED */,
    isCritical: false,
    description: "Operation retry attempted",
    payloadExample: {
      attemptNumber: 2,
      operation: "git.fetch",
      backoffMs: 1e3
    }
  },
  ["ANALYTICS_GENERATED" /* ANALYTICS_GENERATED */]: {
    eventName: "ANALYTICS_GENERATED" /* ANALYTICS_GENERATED */,
    isCritical: false,
    description: "Git analytics report generated",
    payloadExample: {
      commitCount: 150,
      authorCount: 5,
      fileCount: 50
    }
  },
  ["ANALYTICS_EXPORTED" /* ANALYTICS_EXPORTED */]: {
    eventName: "ANALYTICS_EXPORTED" /* ANALYTICS_EXPORTED */,
    isCritical: false,
    description: "Analytics exported to file",
    payloadExample: {
      format: "json",
      filePath: "/workspace/analytics.json"
    }
  }
};

// src/domains/git/handlers.ts
function createStatusHandler(gitProvider, logger) {
  return async (_ctx, params = {}) => {
    if (params.branch !== void 0 && typeof params.branch !== "string") {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Branch must be a string when provided",
        context: "git.status"
      });
    }
    try {
      logger.debug(
        `Getting git status for branch: ${params.branch || "current"}`,
        "GitStatusHandler"
      );
      const result = await gitProvider.status(params.branch);
      if (result.kind === "ok") {
        return success(result.value);
      }
      return result;
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.GIT_STATUS_ERROR,
        message: "Failed to fetch git status",
        details: err,
        context: "git.status"
      });
    }
  };
}
function createPullHandler(gitProvider, logger) {
  return async (_ctx, params = {}) => {
    if (params.branch !== void 0 && typeof params.branch !== "string") {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Branch must be a string when provided",
        context: "git.pull"
      });
    }
    try {
      logger.info(
        `Pulling from git branch: ${params.branch || "current"}`,
        "GitPullHandler"
      );
      const result = await gitProvider.pull(params.branch);
      if (result.kind === "ok") {
        logger.info(
          `Pull successful: ${result.value.message}`,
          "GitPullHandler"
        );
        return success(void 0);
      }
      return result;
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.GIT_PULL_ERROR,
        message: "Failed to pull from git",
        details: err,
        context: "git.pull"
      });
    }
  };
}
function createCommitHandler(gitProvider, logger) {
  return async (_ctx, params = { message: "" }) => {
    if (params.branch !== void 0 && typeof params.branch !== "string") {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Branch must be a string when provided",
        context: "git.commit"
      });
    }
    if (!params.message || params.message.trim().length === 0) {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Commit message is required and cannot be empty",
        context: "git.commit"
      });
    }
    try {
      logger.info(
        `Committing with message: "${params.message}"`,
        "GitCommitHandler"
      );
      const result = await gitProvider.commit(params.message, params.branch);
      if (result.kind === "ok") {
        logger.info("Commit successful", "GitCommitHandler");
        return success(void 0);
      }
      return result;
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.GIT_COMMIT_ERROR,
        message: "Failed to commit to git",
        details: err,
        context: "git.commit"
      });
    }
  };
}

// src/domains/git/smart-commit-handler.ts
function createSmartCommitHandler(gitProvider, logger, changeGrouper, messageSuggester, batchCommitter, approvalUI) {
  return async (_ctx, params = {}) => {
    const startTime = Date.now();
    try {
      if (params.autoApprove !== void 0 && typeof params.autoApprove !== "boolean") {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "autoApprove must be a boolean when provided",
          context: "git.smartCommit"
        });
      }
      if (params.branch !== void 0 && typeof params.branch !== "string") {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Branch must be a string when provided",
          context: "git.smartCommit"
        });
      }
      logger.info(
        `Smart commit: analyzing changes for branch ${params.branch || "current"}`,
        "GitSmartCommitHandler"
      );
      const changesResult = await gitProvider.getAllChanges();
      if (changesResult.kind === "err") {
        return failure({
          code: GIT_ERROR_CODES.GET_CHANGES_FAILED,
          message: "Failed to get git changes",
          details: changesResult.error,
          context: "git.smartCommit"
        });
      }
      if (changesResult.value.length === 0) {
        return failure({
          code: GIT_ERROR_CODES.NO_CHANGES,
          message: "No changes to commit",
          context: "git.smartCommit"
        });
      }
      logger.info(
        `Found ${changesResult.value.length} changed files`,
        "GitSmartCommitHandler"
      );
      const fileChanges = parseFileChanges(changesResult.value);
      logger.debug(
        `Parsed ${fileChanges.length} file changes with metadata`,
        "GitSmartCommitHandler"
      );
      const groups = changeGrouper.group(fileChanges);
      logger.info(
        `Grouped ${fileChanges.length} files into ${groups.length} groups`,
        "GitSmartCommitHandler"
      );
      const groupsWithMessages = groups.map((g) => ({
        ...g,
        suggestedMessage: messageSuggester.suggest(g)
      }));
      let approvedGroups;
      if (params.autoApprove || !approvalUI) {
        approvedGroups = groupsWithMessages;
        logger.info(
          `Auto-approving all ${groupsWithMessages.length} group(s)`,
          "GitSmartCommitHandler"
        );
      } else {
        logger.info(
          `Presenting ${groupsWithMessages.length} group(s) for user approval`,
          "GitSmartCommitHandler"
        );
        const approvalResult = await approvalUI(groupsWithMessages);
        if (approvalResult === null) {
          return failure({
            code: GIT_ERROR_CODES.COMMIT_CANCELLED,
            message: "Smart commit cancelled by user",
            context: "git.smartCommit"
          });
        }
        approvedGroups = approvalResult.map((item) => ({
          ...item.group,
          suggestedMessage: {
            ...item.group.suggestedMessage,
            full: item.approvedMessage
          }
        }));
      }
      if (approvedGroups.length === 0) {
        return failure({
          code: GIT_ERROR_CODES.NO_GROUPS_APPROVED,
          message: "No groups approved for commit",
          context: "git.smartCommit"
        });
      }
      const commitResult = await batchCommitter.executeBatch(approvedGroups);
      if (commitResult.kind === "err") {
        return commitResult;
      }
      const duration = Date.now() - startTime;
      const result = {
        commits: commitResult.value,
        totalFiles: fileChanges.length,
        totalGroups: groups.length,
        duration
      };
      logger.info(
        `Smart commit completed: ${result.commits.length} commits, ${result.totalFiles} files in ${duration}ms`,
        "GitSmartCommitHandler"
      );
      return success(result);
    } catch (err) {
      logger.error(
        "Smart commit error",
        "GitSmartCommitHandler",
        {
          code: GIT_ERROR_CODES.SMART_COMMIT_ERROR,
          message: "Unexpected error during smart commit",
          details: err
        }
      );
      return failure({
        code: GIT_ERROR_CODES.SMART_COMMIT_ERROR,
        message: "Failed to execute smart commit",
        details: err,
        context: "git.smartCommit"
      });
    }
  };
}
function parseFileChanges(changes) {
  const getFileType = (path12) => {
    const match = path12.match(/\.([a-z]+)$/i);
    return match ? `.${match[1]}` : "";
  };
  const extractDomain = (path12) => {
    const parts = path12.split("/");
    if (parts[0] === "src" && parts[1]) {
      if (parts[1] === "domains" && parts[2]) {
        return parts[2];
      }
      if (parts[1] === "infrastructure") {
        return "infrastructure";
      }
    }
    return parts[0] || "root";
  };
  return changes.map((change) => ({
    path: change.path,
    status: change.status,
    domain: extractDomain(change.path),
    fileType: getFileType(change.path),
    additions: change.additions,
    deletions: change.deletions
  }));
}

// src/domains/git/inbound-handler.ts
function createAnalyzeInboundHandler(inboundAnalyzer, logger) {
  return async (_ctx, _params = {}) => {
    try {
      logger.info("Analyzing inbound changes from remote", "GitAnalyzeInboundHandler");
      const result = await inboundAnalyzer.analyze();
      if (result.kind === "err") {
        logger.error(
          "Failed to analyze inbound changes",
          "GitAnalyzeInboundHandler",
          result.error
        );
        return result;
      }
      const analysis = result.value;
      logger.info(
        `Inbound analysis complete: ${analysis.totalInbound} remote changes, ${analysis.conflicts.length} conflicts`,
        "GitAnalyzeInboundHandler"
      );
      return success(analysis);
    } catch (err) {
      logger.error(
        "Unexpected error during inbound analysis",
        "GitAnalyzeInboundHandler",
        {
          code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
          message: "Failed to analyze inbound changes",
          details: err
        }
      );
      return failure({
        code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
        message: "Failed to analyze inbound changes",
        details: err,
        context: "git.analyzeInbound"
      });
    }
  };
}

// src/infrastructure/command-catalog.ts
var COMMAND_CATALOG = [
  // ── Git ────────────────────────────────────────────────────────────────────
  { commandName: "git.status", lmToolName: "meridian_git_status", description: "check branch state" },
  { commandName: "git.smartCommit", lmToolName: "meridian_git_smart_commit", description: "group and commit staged changes" },
  {
    commandName: "git.pull",
    /* destructive: excluded from LM tools */
    description: "pull remote changes"
  },
  { commandName: "git.analyzeInbound", lmToolName: "meridian_git_analyze_inbound", description: "analyze incoming remote changes for conflicts" },
  { commandName: "git.showAnalytics", lmToolName: "meridian_git_show_analytics", description: "show git analytics report" },
  { commandName: "git.generatePR", lmToolName: "meridian_git_generate_pr", description: "generate a PR description" },
  { commandName: "git.reviewPR", lmToolName: "meridian_git_review_pr", description: "review branch changes (verdict + comments)" },
  { commandName: "git.commentPR", lmToolName: "meridian_git_comment_pr", description: "generate inline review comments" },
  { commandName: "git.resolveConflicts", lmToolName: "meridian_git_resolve_conflicts", description: "suggest conflict resolution strategies" },
  { commandName: "git.sessionBriefing", lmToolName: "meridian_git_session_briefing", description: "generate a morning session briefing" },
  { commandName: "git.exportJson", lmToolName: "meridian_git_export_json", description: "export git analytics data as JSON" },
  { commandName: "git.exportCsv", lmToolName: "meridian_git_export_csv", description: "export git analytics data as CSV" },
  // ── Hygiene ────────────────────────────────────────────────────────────────
  { commandName: "hygiene.scan", lmToolName: "meridian_hygiene_scan", description: "scan workspace for dead files, large files, logs" },
  {
    commandName: "hygiene.showAnalytics",
    /* webview: excluded from LM tools */
    description: "show hygiene analytics"
  },
  {
    commandName: "hygiene.cleanup",
    /* destructive: excluded from LM tools */
    description: "delete flagged files from a hygiene scan (dry-run safe)"
  },
  { commandName: "hygiene.impactAnalysis", lmToolName: "meridian_hygiene_impact", description: "trace blast radius of a file or function" },
  // ── Workflow ───────────────────────────────────────────────────────────────
  { commandName: "workflow.list", lmToolName: "meridian_workflow_list", description: "list available workflows" },
  {
    commandName: "workflow.run",
    lmToolName: "meridian_workflow_run",
    description: "run a named workflow",
    classifierLine: "workflow.run:<name>   \u2013 run a named workflow (replace <name>)"
  },
  // ── Agent ──────────────────────────────────────────────────────────────────
  { commandName: "agent.list", lmToolName: "meridian_agent_list", description: "list available agents" },
  { commandName: "agent.execute", lmToolName: "meridian_agent_execute", description: "run a named agent with a target command or workflow" },
  // ── Chat (meta: omitted from classifier + KNOWN_COMMAND_NAMES) ─────────────
  { commandName: "chat.context", omitFromClassifier: true, description: "gather workspace and git context" },
  { commandName: "chat.delegate", omitFromClassifier: true, lmToolName: "meridian_chat_delegate", description: "classify and delegate a task" }
];
var KNOWN_COMMAND_NAMES = new Set(
  COMMAND_CATALOG.filter((e) => !e.omitFromClassifier).map((e) => e.commandName)
);
var LM_TOOL_DEFS = COMMAND_CATALOG.filter((e) => e.lmToolName !== void 0).map((e) => ({ name: e.lmToolName, commandName: e.commandName }));
function buildClassifierLines() {
  const PAD = 22;
  return COMMAND_CATALOG.filter((e) => !e.omitFromClassifier).map((e) => e.classifierLine ?? `${e.commandName.padEnd(PAD)} \u2013 ${e.description}`).join("\n");
}

// src/infrastructure/prompt-registry.ts
var PROMPTS = {
  // ── git/pr-handlers ─────────────────────────────────────────────────
  PR_GENERATION: `You are a PR description generator for a software project.
Given the branch name, recent commits, changed files with stats, and a diff, generate a pull request description.

Output format (markdown):
# <PR title in conventional commit style, e.g. "feat(git): add PR description generator">

## Summary
<2-3 sentences explaining what this PR does and why>

## Changes
<bulleted list of key changes, grouped by area>

## Test Plan
<how to verify these changes work correctly>

Guidelines:
- Keep the title under 72 characters
- Focus on the "why" not the "what" in the summary
- Group changes logically, not by file
- Be specific in the test plan`,
  PR_REVIEW: `You are a senior code reviewer. Given a branch's commits, changed files, and diff, produce a structured review.

Output format (JSON):
{
  "summary": "<1-2 sentence overall assessment>",
  "verdict": "approve" | "request-changes" | "comment",
  "comments": [
    { "file": "<path>", "severity": "critical" | "suggestion" | "nit", "comment": "<specific feedback>" }
  ]
}

Guidelines:
- Flag bugs, security issues, and missing error handling as critical
- Suggest improvements for readability and maintainability as suggestion
- Style and naming issues are nit
- Be specific \u2014 reference exact patterns, not vague advice
- Return valid JSON only, no markdown fences`,
  PR_COMMENT: `You are a code reviewer generating inline comments. Given changed files and a diff, produce file-level comments.

Output format (JSON):
{
  "comments": [
    { "file": "<path>", "line": <number or null>, "comment": "<specific, actionable feedback>" }
  ]
}

Guidelines:
- Focus on logic errors, edge cases, and missing validation
- Reference specific code patterns from the diff
- One comment per issue, not per file
- Return valid JSON only, no markdown fences`,
  CONFLICT_RESOLUTION: `You are a git conflict resolution assistant. Given inbound changes with conflicts, file diffs, and severity scores, suggest resolution strategies.

Output format (JSON):
{
  "overview": "<1-2 sentence situation summary>",
  "perFile": [
    {
      "path": "<file path>",
      "strategy": "keep-ours" | "keep-theirs" | "manual-merge" | "review-needed",
      "rationale": "<why this strategy>",
      "suggestedSteps": ["<step 1>", "<step 2>"]
    }
  ]
}

Guidelines:
- Choose keep-ours/keep-theirs only when one side's changes clearly subsume the other
- Default to manual-merge for complex overlapping logic changes
- Use review-needed when you lack sufficient context
- Be concrete in suggested steps
- Return valid JSON only, no markdown fences`,
  // ── git/session-handler ─────────────────────────────────────────────
  SESSION_BRIEFING: `You are a developer assistant generating a morning session briefing.
Given the current git branch state, recent commits, and uncommitted changes, produce a concise briefing.

Output format (markdown):
# Session Briefing \u2014 <branch name>

## Branch State
<1-2 sentences: branch name, whether it is dirty, staged/unstaged counts>

## Recent Commits
<bulleted list of last N commits with short hash and message>

## Uncommitted Changes
<bulleted list of modified files, or "None" if clean>

## Flags
<any notable issues: many uncommitted files, detached HEAD, etc. Omit section if none.>

Guidelines:
- Keep it scannable \u2014 bullets over prose
- Flag anything that needs attention before starting work
- If the workspace is clean, say so clearly`,
  // ── chat/handlers ───────────────────────────────────────────────────
  DELEGATE_CLASSIFIER: `You are a command router for the Meridian VS Code extension.
Given a task description, respond with EXACTLY ONE command ID that best handles it.

${buildClassifierLines()}

Respond with ONLY the command ID (e.g. "git.status" or "workflow.run:my-workflow"). Nothing else.`,
  // ── hygiene/impact-analysis-handler ─────────────────────────────────
  IMPACT_ANALYSIS: `Analyze the following code impact analysis and provide a concise markdown summary.
Format: "Changing this would affect X importers and Y test files. High risk: changes to exports or core functions; low risk: internal-only changes."
Be brief and actionable.`
};
function getPrompt(id) {
  return PROMPTS[id];
}

// src/domains/git/pr-handlers.ts
async function gatherPRContext(gitProvider, targetBranch = "main") {
  const branchResult = await gitProvider.getCurrentBranch();
  if (branchResult.kind === "err") return branchResult;
  const branch = branchResult.value.trim();
  const mergeBaseResult = await gitProvider.getMergeBase(branch, targetBranch);
  const rangeBase = mergeBaseResult.kind === "ok" ? mergeBaseResult.value : targetBranch;
  const commitsResult = await gitProvider.getCommitRange(rangeBase, "HEAD");
  if (commitsResult.kind === "err") return commitsResult;
  const rangeRef = `${rangeBase}...HEAD`;
  const numstatResult = await gitProvider.diff(rangeRef, ["--numstat"]);
  if (numstatResult.kind === "err") return numstatResult;
  const changes = parseNumstatOutput(numstatResult.value);
  if (changes.length === 0) {
    return failure({
      code: GIT_ERROR_CODES.NO_CHANGES,
      message: `No changes between ${targetBranch} and HEAD`,
      context: "gatherPRContext"
    });
  }
  const diffResult = await gitProvider.diff(rangeRef);
  return success({
    branch,
    targetBranch,
    commits: commitsResult.value,
    changes,
    diff: diffResult.kind === "ok" ? diffResult.value : "(diff unavailable)"
  });
}
function parseNumstatOutput(raw) {
  const results = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("	");
    if (parts.length < 3) continue;
    const additions = parseInt(parts[0] ?? "0", 10) || 0;
    const deletions = parseInt(parts[1] ?? "0", 10) || 0;
    const path12 = (parts[2] ?? "").trim();
    if (!path12) continue;
    const status = additions === 0 && deletions > 0 ? "D" : deletions === 0 && additions > 0 ? "A" : "M";
    results.push({ path: path12, status, additions, deletions });
  }
  return results;
}
function createGeneratePRHandler(gitProvider, logger, generateProseFn) {
  return async (_ctx, params = {}) => {
    const targetBranch = params.targetBranch ?? "main";
    const contextResult = await gatherPRContext(gitProvider, targetBranch);
    if (contextResult.kind === "err") return contextResult;
    const prContext = contextResult.value;
    if (prContext.changes.length === 0) {
      return failure({
        code: GIT_ERROR_CODES.NO_CHANGES,
        message: "No changes to generate PR for",
        context: "git.generatePR"
      });
    }
    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: getPrompt("PR_GENERATION"),
      data: {
        branch: prContext.branch,
        targetBranch: prContext.targetBranch,
        commits: prContext.commits,
        changes: prContext.changes,
        diff: prContext.diff
      }
    });
    if (proseResult.kind === "err") return proseResult;
    const text = proseResult.value;
    const lines = text.split("\n");
    const titleLine = lines.find((l) => l.startsWith("# ")) ?? lines[0] ?? prContext.branch;
    const title = titleLine.replace(/^#\s*/, "").trim();
    const body = text;
    logger.info(`PR description generated for ${prContext.branch}`, "git.generatePR");
    return success({ title, body, branch: prContext.branch });
  };
}
function createReviewPRHandler(gitProvider, logger, generateProseFn) {
  return async (_ctx, params = {}) => {
    const contextResult = await gatherPRContext(gitProvider, params.targetBranch ?? "main");
    if (contextResult.kind === "err") return contextResult;
    const ctx = contextResult.value;
    if (ctx.changes.length === 0) {
      return failure({ code: GIT_ERROR_CODES.NO_CHANGES, message: "No changes to review", context: "git.reviewPR" });
    }
    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: getPrompt("PR_REVIEW"),
      data: { branch: ctx.branch, targetBranch: ctx.targetBranch, commits: ctx.commits, changes: ctx.changes, diff: ctx.diff }
    });
    if (proseResult.kind === "err") return proseResult;
    try {
      const parsed = JSON.parse(proseResult.value);
      logger.info(`PR review generated for ${ctx.branch}: ${parsed.verdict}`, "git.reviewPR");
      return success({
        branch: ctx.branch,
        summary: parsed.summary ?? "",
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        verdict: parsed.verdict ?? "comment"
      });
    } catch {
      logger.info(`PR review generated for ${ctx.branch} (text fallback)`, "git.reviewPR");
      return success({ branch: ctx.branch, summary: proseResult.value, comments: [], verdict: "comment" });
    }
  };
}
function createCommentPRHandler(gitProvider, logger, generateProseFn) {
  return async (_ctx, params = {}) => {
    const contextResult = await gatherPRContext(gitProvider, params.targetBranch ?? "main");
    if (contextResult.kind === "err") return contextResult;
    const ctx = contextResult.value;
    if (ctx.changes.length === 0) {
      return failure({ code: GIT_ERROR_CODES.NO_CHANGES, message: "No changes to comment on", context: "git.commentPR" });
    }
    const data = {
      branch: ctx.branch,
      commits: ctx.commits,
      changes: ctx.changes,
      diff: ctx.diff
    };
    if (params.paths?.length) {
      data.filterPaths = params.paths;
    }
    const proseResult = await generateProseFn({ domain: "git", systemPrompt: getPrompt("PR_COMMENT"), data });
    if (proseResult.kind === "err") return proseResult;
    try {
      const parsed = JSON.parse(proseResult.value);
      const comments = Array.isArray(parsed.comments) ? parsed.comments : [];
      logger.info(`${comments.length} inline comment(s) generated for ${ctx.branch}`, "git.commentPR");
      return success({ branch: ctx.branch, comments });
    } catch {
      logger.info(`PR comments generated for ${ctx.branch} (text fallback)`, "git.commentPR");
      return success({ branch: ctx.branch, comments: [{ file: "(general)", comment: proseResult.value }] });
    }
  };
}
function createResolveConflictsHandler(gitProvider, logger, inboundAnalyzer, generateProseFn) {
  return async (_ctx) => {
    const analysisResult = await inboundAnalyzer.analyze();
    if (analysisResult.kind === "err") return analysisResult;
    const analysis = analysisResult.value;
    if (analysis.conflicts.length === 0) {
      return failure({ code: GIT_ERROR_CODES.NO_CHANGES, message: "No conflicts to resolve", context: "git.resolveConflicts" });
    }
    const conflictDiffs = {};
    for (const conflict of analysis.conflicts) {
      const diffResult = await gitProvider.diff(`HEAD..origin/${analysis.branch}`, ["--", conflict.path]);
      if (diffResult.kind === "ok") {
        conflictDiffs[conflict.path] = diffResult.value;
      }
    }
    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: getPrompt("CONFLICT_RESOLUTION"),
      data: {
        branch: analysis.branch,
        totalInbound: analysis.totalInbound,
        totalLocal: analysis.totalLocal,
        conflicts: analysis.conflicts,
        conflictDiffs,
        summary: analysis.summary
      }
    });
    if (proseResult.kind === "err") return proseResult;
    try {
      const parsed = JSON.parse(proseResult.value);
      logger.info(`Conflict resolution for ${parsed.perFile?.length ?? 0} file(s)`, "git.resolveConflicts");
      return success({
        overview: parsed.overview ?? "",
        perFile: Array.isArray(parsed.perFile) ? parsed.perFile : []
      });
    } catch {
      logger.info(`Conflict resolution generated (text fallback)`, "git.resolveConflicts");
      return success({ overview: proseResult.value, perFile: [] });
    }
  };
}

// src/domains/git/session-handler.ts
function createSessionBriefingHandler(gitProvider, logger, generateProseFn) {
  return async (_ctx) => {
    const statusResult = await gitProvider.status();
    if (statusResult.kind === "err") return statusResult;
    const status = statusResult.value;
    const commitsResult = await gitProvider.getRecentCommits(10);
    if (commitsResult.kind === "err") return commitsResult;
    const changesResult = await gitProvider.getAllChanges();
    if (changesResult.kind === "err") return changesResult;
    const uncommitted = changesResult.value;
    const flags = [];
    if (uncommitted.length > 10) {
      flags.push(`Large number of uncommitted files (${uncommitted.length})`);
    }
    if (status.branch === "HEAD") {
      flags.push("Detached HEAD \u2014 not on a named branch");
    }
    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: getPrompt("SESSION_BRIEFING"),
      data: {
        branch: status.branch,
        isDirty: status.isDirty,
        staged: status.staged,
        unstaged: status.unstaged,
        untracked: status.untracked,
        recentCommits: commitsResult.value,
        uncommittedFiles: uncommitted.map((f) => ({ path: f.path, status: f.status })),
        flags
      }
    });
    if (proseResult.kind === "err") return proseResult;
    logger.info(`Session briefing generated for branch '${status.branch}'`, "git.sessionBriefing");
    return success(proseResult.value);
  };
}

// src/domains/git/analytics-handler.ts
function createShowAnalyticsHandler(analyzer, logger) {
  return async (_ctx, params = {}) => {
    try {
      const period = params.period || "3mo";
      if (period !== "3mo" && period !== "6mo" && period !== "12mo") {
        return failure({
          code: GIT_ERROR_CODES.INVALID_PERIOD,
          message: `Invalid period: ${period}. Must be 3mo, 6mo, or 12mo`,
          context: "ShowAnalyticsHandler"
        });
      }
      const options = {
        period,
        author: params.author,
        pathPattern: params.pathPattern
      };
      logger.info(
        `Running analytics for period: ${options.period}`,
        "ShowAnalyticsHandler"
      );
      const report = await analyzer.analyze(options);
      logger.info(
        `Analytics complete: ${report.summary.totalCommits} commits by ${report.summary.totalAuthors} authors`,
        "ShowAnalyticsHandler"
      );
      return success(report);
    } catch (err) {
      const error = {
        code: GIT_ERROR_CODES.ANALYTICS_ERROR,
        message: `Failed to generate analytics: ${err instanceof Error ? err.message : String(err)}`,
        context: "ShowAnalyticsHandler",
        details: err
      };
      logger.error(
        `Analytics failed: ${error.message}`,
        "ShowAnalyticsHandler",
        error
      );
      return failure(error);
    }
  };
}
function createExportJsonHandler(analyzer, _logger) {
  return async (_ctx, params = {}) => {
    try {
      const period = params.period || "3mo";
      if (period !== "3mo" && period !== "6mo" && period !== "12mo") {
        return failure({
          code: GIT_ERROR_CODES.INVALID_PERIOD,
          message: `Invalid period: ${period}. Must be 3mo, 6mo, or 12mo`,
          context: "ExportJsonHandler"
        });
      }
      const options = {
        period,
        author: params.author,
        pathPattern: params.pathPattern
      };
      const report = await analyzer.analyze(options);
      const json = analyzer.exportToJSON(report);
      return success(json);
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.EXPORT_ERROR,
        message: `Failed to export JSON: ${err instanceof Error ? err.message : String(err)}`,
        context: "ExportJsonHandler",
        details: err
      });
    }
  };
}
function createExportCsvHandler(analyzer, _logger) {
  return async (_ctx, params = {}) => {
    try {
      const period = params.period || "3mo";
      if (period !== "3mo" && period !== "6mo" && period !== "12mo") {
        return failure({
          code: GIT_ERROR_CODES.INVALID_PERIOD,
          message: `Invalid period: ${period}. Must be 3mo, 6mo, or 12mo`,
          context: "ExportCsvHandler"
        });
      }
      const options = {
        period,
        author: params.author,
        pathPattern: params.pathPattern
      };
      const report = await analyzer.analyze(options);
      const csv = analyzer.exportToCSV(report);
      return success(csv);
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.EXPORT_ERROR,
        message: `Failed to export CSV: ${err instanceof Error ? err.message : String(err)}`,
        context: "ExportCsvHandler",
        details: err
      });
    }
  };
}

// src/domains/git/smart-commit-service.ts
var SIMILARITY_THRESHOLD = 0.4;
function generateId() {
  return Math.random().toString(36).substring(2, 11);
}
var ChangeGrouper = class {
  /**
   * Group similar file changes using greedy clustering.
   */
  group(changes) {
    const groups = [];
    const ungrouped = new Set(changes);
    while (ungrouped.size > 0) {
      const seedValue = ungrouped.values().next().value;
      if (!seedValue) break;
      const seed = seedValue;
      const group = [seed];
      ungrouped.delete(seed);
      for (const candidate of Array.from(ungrouped)) {
        const similarity = this.score(seed, candidate);
        if (similarity > SIMILARITY_THRESHOLD) {
          group.push(candidate);
          ungrouped.delete(candidate);
        }
      }
      const avgSimilarity = group.length > 1 ? group.reduce((sum, file, i, arr) => {
        if (i === 0) return 0;
        return sum + this.score(arr[0], file);
      }, 0) / (group.length - 1) : 1;
      groups.push({
        id: generateId(),
        files: group,
        suggestedMessage: { type: "chore", scope: "", description: "", full: "" },
        similarity: Math.min(1, avgSimilarity)
      });
    }
    return groups;
  }
  /**
   * Score similarity between two file changes (0-1).
   */
  score(a, b) {
    const typeMatch = a.status === b.status ? 1 : 0.5;
    const domainMatch = a.domain === b.domain ? 1 : 0;
    const fileTypeMatch = a.fileType === b.fileType ? 0.5 : 0.2;
    return (typeMatch + domainMatch + fileTypeMatch) / 3;
  }
};
var CommitMessageSuggester = class {
  /**
   * Suggest a commit message for a group of changes.
   */
  suggest(group) {
    const { type, scope, description } = this.analyze(group);
    return {
      type,
      scope,
      description,
      full: `${type}${scope ? `(${scope})` : ""}: ${description}`
    };
  }
  /**
   * Analyze group to determine commit type, scope, and description.
   */
  analyze(group) {
    const hasAdds = group.files.some((f) => f.status === "A");
    const hasModifies = group.files.some((f) => f.status === "M");
    const hasDeletes = group.files.some((f) => f.status === "D");
    let type = "chore";
    if (hasAdds && !hasDeletes && !hasModifies) {
      type = "feat";
    } else if (hasModifies && !hasAdds && !hasDeletes) {
      type = "fix";
    } else if (this.isDocsOnly(group)) {
      type = "docs";
    } else if (this.isRefactorOnly(group)) {
      type = "refactor";
    }
    const domains = group.files.map((f) => f.domain);
    const scope = this.mostCommonDomain(domains);
    const fileCount = group.files.length;
    const description = this.describeGroup(group, fileCount);
    return { type, scope, description };
  }
  /**
   * Check if group contains only documentation files.
   */
  isDocsOnly(group) {
    return group.files.every((f) => f.fileType.match(/\.(md|txt|rst)$/i));
  }
  /**
   * Check if group is a refactoring-only change (modifications, no adds/deletes).
   */
  isRefactorOnly(group) {
    return group.files.every((f) => f.status === "M") && group.files.length > 1;
  }
  /**
   * Find most common domain in a list.
   */
  mostCommonDomain(domains) {
    if (domains.length === 0) return "";
    const counts = /* @__PURE__ */ new Map();
    for (const domain of domains) {
      counts.set(domain, (counts.get(domain) || 0) + 1);
    }
    let maxDomain = "";
    let maxCount = 0;
    for (const [domain, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxDomain = domain;
      }
    }
    return maxDomain;
  }
  /**
   * Generate human-readable description for the group.
   */
  describeGroup(group, fileCount) {
    if (fileCount === 1) {
      const file = group.files[0];
      const action = this.actionVerb(file.status);
      const filename = file.path.split("/").pop() || file.path;
      return `${action} ${filename}`;
    } else if (this.isHomogeneous(group)) {
      const action = this.actionVerb(group.files[0].status);
      const scope = this.mostCommonDomain(group.files.map((f) => f.domain));
      return `${action} ${fileCount} ${scope} files`;
    } else {
      return `update ${fileCount} files`;
    }
  }
  /**
   * Check if all files have the same status.
   */
  isHomogeneous(group) {
    if (group.files.length === 0) return true;
    const firstStatus = group.files[0].status;
    return group.files.every((f) => f.status === firstStatus);
  }
  /**
   * Map change status to action verb.
   */
  actionVerb(status) {
    const verbs = {
      A: "add",
      M: "update",
      D: "remove",
      R: "rename"
    };
    return verbs[status] || "modify";
  }
};
var BatchCommitter = class {
  constructor(gitProvider, logger) {
    this.committedHashes = [];
    this.gitProvider = gitProvider;
    this.logger = logger;
  }
  /**
   * Execute batch commits for approved groups.
   * Returns committed hashes or error with automatic rollback.
   */
  async executeBatch(approvedGroups) {
    const commits = [];
    this.committedHashes = [];
    try {
      for (const group of approvedGroups) {
        const paths = group.files.map((f) => f.path);
        const stageResult = await this.gitProvider.stage(paths);
        if (stageResult.kind === "err") {
          await this.rollback();
          return failure({
            code: "STAGE_FAILED",
            message: `Failed to stage files for group ${group.id}`,
            details: stageResult.error,
            context: "BatchCommitter.executeBatch"
          });
        }
        const commitResult = await this.gitProvider.commit(
          group.suggestedMessage.full
        );
        if (commitResult.kind === "err") {
          await this.rollback();
          return failure({
            code: "COMMIT_FAILED",
            message: `Failed to commit group ${group.id}`,
            details: commitResult.error,
            context: "BatchCommitter.executeBatch"
          });
        }
        const hash = commitResult.value;
        this.committedHashes.push(hash);
        commits.push({
          hash,
          message: group.suggestedMessage.full,
          files: paths,
          timestamp: Date.now()
        });
        this.logger.info(
          `Committed group ${group.id}: ${group.suggestedMessage.full}`,
          "BatchCommitter"
        );
      }
      return success(commits);
    } catch (err) {
      await this.rollback();
      return failure({
        code: "BATCH_COMMIT_ERROR",
        message: "Unexpected error during batch commit",
        details: err,
        context: "BatchCommitter.executeBatch"
      });
    }
  }
  /**
   * Rollback all commits in reverse order.
   */
  async rollback() {
    if (this.committedHashes.length === 0) {
      return;
    }
    this.logger.info(
      `Rolling back ${this.committedHashes.length} commits`,
      "BatchCommitter"
    );
    const firstHash = this.committedHashes[0];
    const resetResult = await this.gitProvider.reset({
      mode: "--soft",
      ref: `${firstHash}^`
    });
    if (resetResult.kind === "err") {
      this.logger.error(
        `Rollback failed: could not reset to ${firstHash}^`,
        "BatchCommitter",
        resetResult.error
      );
    } else {
      this.logger.info("Rollback successful", "BatchCommitter");
    }
  }
};

// src/domains/git/inbound-analyzer.ts
var InboundAnalyzer = class {
  constructor(gitProvider, logger) {
    this.gitProvider = gitProvider;
    this.logger = logger;
  }
  /**
   * Analyze incoming changes from remote without pulling.
   * Detects conflicts between local and remote changes.
   * Validates all inputs and handles errors gracefully.
   */
  async analyze() {
    try {
      this.logger.info("Fetching from remote...", "InboundAnalyzer");
      const fetchResult = await this.gitProvider.fetch("origin");
      if (fetchResult.kind === "err") {
        return fetchResult;
      }
      const branchResult = await this.gitProvider.getCurrentBranch();
      if (branchResult.kind === "err") {
        return branchResult;
      }
      const branch = branchResult.value;
      if (!branch || typeof branch !== "string") {
        return failure({
          code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
          message: "Invalid branch name from git provider",
          context: "InboundAnalyzer.analyze"
        });
      }
      const upstream = `origin/${branch}`;
      const inboundDiffResult = await this.gitProvider.diff(`HEAD..${upstream}`, ["--name-status"]);
      if (inboundDiffResult.kind === "err") {
        return inboundDiffResult;
      }
      const inboundDiff = inboundDiffResult.value;
      if (inboundDiff === null || inboundDiff === void 0) {
        return failure({
          code: GIT_ERROR_CODES.INBOUND_DIFF_PARSE_ERROR,
          message: "Git provider returned null diff",
          context: "InboundAnalyzer.analyze"
        });
      }
      if (inboundDiff.trim() === "") {
        return success({
          remote: "origin",
          branch,
          totalInbound: 0,
          totalLocal: 0,
          conflicts: [],
          summary: {
            description: "Remote branch is up-to-date",
            conflicts: { high: 0, medium: 0, low: 0 },
            fileTypes: {},
            recommendations: ["\u2705 No remote changes detected. Fully synced."]
          },
          diffLink: `View with: git diff HEAD..origin/${branch}`
        });
      }
      const localChangesResult = await this.gitProvider.getAllChanges();
      if (localChangesResult.kind === "err") {
        return localChangesResult;
      }
      const inboundChanges = this.parseGitDiff(inboundDiff || "");
      const localChanges = new Map(
        localChangesResult.value.map((c) => [c.path, c.status])
      );
      if (!inboundChanges || inboundChanges.size === 0) {
        this.logger.warn(
          "No inbound changes parsed from diff",
          "InboundAnalyzer.analyze"
        );
      }
      const conflicts = await this.detectConflicts(
        inboundChanges,
        localChanges,
        branch
      );
      const summary = this.summarize(inboundChanges, localChanges, conflicts);
      const diffLinkResult = await this.gitProvider.getRemoteUrl("origin");
      let diffLink = `View with: git diff HEAD..origin/${branch}`;
      if (diffLinkResult.kind === "ok" && diffLinkResult.value) {
        try {
          diffLink = this.generateDiffLink(diffLinkResult.value, branch);
        } catch (err) {
          this.logger.warn(
            "Failed to generate diff link; using fallback",
            "InboundAnalyzer.analyze"
          );
        }
      }
      return success({
        remote: "origin",
        branch,
        totalInbound: inboundChanges.size,
        totalLocal: localChanges.size,
        conflicts,
        summary,
        diffLink
      });
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
        message: "Failed to analyze inbound changes; check git is installed with: git --version",
        details: err,
        context: "InboundAnalyzer.analyze"
      });
    }
  }
  /**
   * Parse git diff output into a map of path -> status
   * Validates input and handles malformed output gracefully
   */
  parseGitDiff(diffOutput) {
    const changes = /* @__PURE__ */ new Map();
    if (!diffOutput || typeof diffOutput !== "string") {
      this.logger.warn(
        "parseGitDiff received invalid input; returning empty map",
        "InboundAnalyzer.parseGitDiff"
      );
      return changes;
    }
    try {
      const lines = diffOutput.trim().split("\n");
      for (const line of lines) {
        if (!line || !line.trim()) continue;
        const parts = line.split(/\s+/);
        if (parts.length < 2) {
          this.logger.debug(
            `Skipping malformed diff line: ${line}`,
            "InboundAnalyzer.parseGitDiff"
          );
          continue;
        }
        const rawStatus = parts[0];
        const status = rawStatus.charAt(0);
        const path12 = rawStatus.startsWith("R") && parts.length >= 3 ? parts[2] : parts.slice(1).join(" ");
        if (!path12 || !status) {
          this.logger.debug(
            "Skipping line with empty status or path",
            "InboundAnalyzer.parseGitDiff"
          );
          continue;
        }
        changes.set(path12, status);
      }
      return changes;
    } catch (err) {
      this.logger.error(
        "Failed to parse git diff output",
        "InboundAnalyzer.parseGitDiff",
        {
          code: GIT_ERROR_CODES.INBOUND_DIFF_PARSE_ERROR,
          message: "Git diff parsing failed; returning empty map",
          details: err
        }
      );
      return changes;
    }
  }
  /**
   * Detect conflicts between inbound and local changes
   * Guards against null/undefined and errors in sub-operations
   */
  async detectConflicts(inbound, local, branch) {
    const conflicts = [];
    if (!inbound || !local) {
      this.logger.warn(
        "detectConflicts: invalid input maps; returning empty conflicts",
        "InboundAnalyzer.detectConflicts"
      );
      return conflicts;
    }
    if (!branch || typeof branch !== "string") {
      this.logger.warn(
        "detectConflicts: invalid branch; returning empty conflicts",
        "InboundAnalyzer.detectConflicts"
      );
      return conflicts;
    }
    try {
      for (const [path12, remoteStatus] of inbound) {
        if (!path12 || !remoteStatus) continue;
        if (local.has(path12)) {
          const localStatus = local.get(path12);
          if (!localStatus) {
            this.logger.debug(
              `Skipping ${path12}: empty local status`,
              "InboundAnalyzer.detectConflicts"
            );
            continue;
          }
          if (localStatus === "M" && remoteStatus === "M") {
            const localChanges = await this.estimateChanges(path12, "HEAD");
            const remoteChanges = await this.estimateChanges(
              path12,
              `origin/${branch}`
            );
            conflicts.push({
              path: path12,
              localStatus: "M",
              remoteStatus: "M",
              severity: "high",
              localChanges,
              remoteChanges
            });
          } else if (localStatus === "M" && remoteStatus === "D") {
            const localChanges = await this.estimateChanges(path12, "HEAD");
            conflicts.push({
              path: path12,
              localStatus: "M",
              remoteStatus: "D",
              severity: "high",
              localChanges,
              remoteChanges: 0
            });
          } else if (localStatus === "D" && remoteStatus === "M") {
            const remoteChanges = await this.estimateChanges(
              path12,
              `origin/${branch}`
            );
            conflicts.push({
              path: path12,
              localStatus: "D",
              remoteStatus: "M",
              severity: "high",
              localChanges: 0,
              remoteChanges
            });
          } else if (localStatus === "A" && remoteStatus === "A") {
            const localChanges = await this.estimateChanges(path12, "HEAD");
            const remoteChanges = await this.estimateChanges(
              path12,
              `origin/${branch}`
            );
            conflicts.push({
              path: path12,
              localStatus: "A",
              remoteStatus: "A",
              severity: "medium",
              localChanges,
              remoteChanges
            });
          }
        }
      }
      return conflicts;
    } catch (err) {
      this.logger.error(
        "Error during conflict detection",
        "InboundAnalyzer.detectConflicts",
        {
          code: GIT_ERROR_CODES.CONFLICT_DETECTION_ERROR,
          message: "Failed to detect conflicts",
          details: err
        }
      );
      return conflicts;
    }
  }
  /**
   * Count actual line changes for a file at a given ref using git diff --numstat.
   */
  async estimateChanges(path12, ref) {
    if (!path12 || !ref) {
      return 0;
    }
    const result = await this.gitProvider.diff(ref, ["--numstat", "--", path12]);
    if (result.kind === "err") return 0;
    const match = result.value.trim().match(/^(\d+)\s+(\d+)/);
    if (!match) return 0;
    return parseInt(match[1] ?? "0", 10) + parseInt(match[2] ?? "0", 10);
  }
  /**
   * Summarize changes with recommendations
   * Guards against null/undefined inputs
   */
  summarize(inbound, _local, conflicts) {
    try {
      if (!inbound || !(inbound instanceof Map)) {
        this.logger.warn(
          "summarize: invalid inbound map; returning empty summary",
          "InboundAnalyzer.summarize"
        );
        return {
          description: "Unable to summarize changes",
          conflicts: { high: 0, medium: 0, low: 0 },
          fileTypes: {},
          recommendations: ["\u26A0\uFE0F Summary generation failed"]
        };
      }
      if (!conflicts || !Array.isArray(conflicts)) {
        this.logger.warn(
          "summarize: invalid conflicts array; using empty array",
          "InboundAnalyzer.summarize"
        );
        conflicts = [];
      }
      const highSeverity = conflicts.filter((c) => c?.severity === "high").length;
      const mediumSeverity = conflicts.filter((c) => c?.severity === "medium").length;
      const lowSeverity = conflicts.filter((c) => c?.severity === "low").length;
      const fileTypes = {};
      for (const [path12] of inbound) {
        if (!path12 || typeof path12 !== "string") continue;
        const ext = path12.split(".").pop() || "unknown";
        const key = `.${ext}`;
        fileTypes[key] = (fileTypes[key] ?? 0) + 1;
      }
      const recommendations = this.recommendations(conflicts);
      const description = conflicts.length === 0 ? `0 conflicts in ${inbound.size} inbound change${inbound.size !== 1 ? "s" : ""}` : `${conflicts.length} potential conflict${conflicts.length !== 1 ? "s" : ""} in ${inbound.size} inbound change${inbound.size !== 1 ? "s" : ""}`;
      return {
        description,
        conflicts: { high: highSeverity, medium: mediumSeverity, low: lowSeverity },
        fileTypes,
        recommendations
      };
    } catch (err) {
      this.logger.error(
        "Error during summary generation",
        "InboundAnalyzer.summarize",
        {
          code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
          message: "Failed to summarize changes",
          details: err
        }
      );
      return {
        description: "Unable to summarize changes",
        conflicts: { high: 0, medium: 0, low: 0 },
        fileTypes: {},
        recommendations: ["\u26A0\uFE0F Summary generation failed"]
      };
    }
  }
  /**
   * Generate recommendations based on conflicts
   */
  recommendations(conflicts) {
    const recs = [];
    const highConflicts = conflicts.filter((c) => c.severity === "high");
    if (highConflicts.length > 0) {
      recs.push(
        `\u26A0\uFE0F  Review ${highConflicts.length} high-severity conflict${highConflicts.length !== 1 ? "s" : ""}`
      );
      highConflicts.slice(0, 3).forEach((c) => {
        const action = c.localStatus === "D" ? "deleted" : c.localStatus === "A" ? "added" : "modified";
        recs.push(`  \u2022 You ${action} ${c.path}, remote changed it`);
      });
    }
    const mediumConflicts = conflicts.filter((c) => c.severity === "medium");
    if (mediumConflicts.length > 0) {
      recs.push(
        `\u{1F4CB} Both sides added ${mediumConflicts.length} file${mediumConflicts.length !== 1 ? "s" : ""}`
      );
    }
    if (conflicts.length === 0) {
      recs.push("\u2705 No conflicts detected. Safe to pull.");
    }
    return recs;
  }
  /**
   * Generate a diff link for the remote changes
   * Handles various git hosting platforms and falls back gracefully
   */
  generateDiffLink(remoteUrl, branch) {
    try {
      if (!remoteUrl || typeof remoteUrl !== "string") {
        throw new Error("Invalid remote URL");
      }
      if (!branch || typeof branch !== "string") {
        throw new Error("Invalid branch name");
      }
      if (remoteUrl.includes("github.com")) {
        const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
        if (match && match[1] && match[2]) {
          const owner = match[1].trim();
          const repo = match[2].trim();
          return `https://github.com/${owner}/${repo}/compare/${branch}...origin/${branch}`;
        }
      }
      if (remoteUrl.includes("gitlab.com")) {
        const match = remoteUrl.match(/gitlab\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
        if (match && match[1] && match[2]) {
          const owner = match[1].trim();
          const repo = match[2].trim();
          return `https://gitlab.com/${owner}/${repo}/-/compare/${branch}...origin/${branch}`;
        }
      }
      if (remoteUrl.includes("bitbucket")) {
        const match = remoteUrl.match(/bitbucket\.org[:/](.+?)\/(.+?)(?:\.git)?$/);
        if (match && match[1] && match[2]) {
          const owner = match[1].trim();
          const repo = match[2].trim();
          return `https://bitbucket.org/${owner}/${repo}/compare/${branch}...origin/${branch}`;
        }
      }
      return `View with: git diff HEAD..origin/${branch}`;
    } catch (err) {
      this.logger.warn(
        `Failed to generate diff link for ${remoteUrl}; using fallback`,
        "InboundAnalyzer.generateDiffLink"
      );
      return `View with: git diff HEAD..origin/${branch || "HEAD"}`;
    }
  }
};

// src/domains/git/analytics-service.ts
var import_child_process = require("child_process");
var import_micromatch = __toESM(require_micromatch());

// src/constants.ts
var CACHE_SETTINGS = {
  /** Git analytics report cache TTL in milliseconds (10 minutes) */
  ANALYTICS_TTL_MS: 10 * 60 * 1e3,
  /** Dead code scan cache TTL in milliseconds (5 minutes) */
  DEAD_CODE_TTL_MS: 5 * 60 * 1e3
};
var GIT_DEFAULTS = {
  /** Default remote name */
  DEFAULT_REMOTE: "origin",
  /** Default main branch */
  DEFAULT_BRANCH: "main",
  /** Fallback branch if main doesn't exist */
  FALLBACK_BRANCH: "master",
  /** Default depth for shallow clones (0 = full clone) */
  CLONE_DEPTH: 0,
  /** Whether to auto-fetch before operations */
  AUTO_FETCH: false,
  /** Whether to clean branches after merge */
  AUTO_BRANCH_CLEAN: true,
  /** Commit message minimum length (characters) */
  MIN_MESSAGE_LENGTH: 5,
  /** Commit message maximum length (characters) */
  MAX_MESSAGE_LENGTH: 72,
  /** Maximum number of inbound changes to process */
  MAX_INBOUND_CHANGES: 100,
  /** Git operation timeout in milliseconds */
  OPERATION_TIMEOUT_MS: 30 * 1e3
};
var WORKSPACE_EXCLUDE_BASE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.vscode/**",
  "**/.idea/**"
];
var HYGIENE_SETTINGS = {
  /** Whether hygiene checks are enabled */
  ENABLED: true,
  /** Scan interval in minutes */
  SCAN_INTERVAL_MINUTES: 60,
  /** Maximum file size to check in bytes (10 MB) */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** File patterns to exclude from hygiene checks */
  EXCLUDE_PATTERNS: [
    ...WORKSPACE_EXCLUDE_BASE,
    // Build / output
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/bundled/**",
    // Python runtime & tooling
    "**/.venv/**",
    "**/venv/**",
    "**/__pycache__/**",
    "**/.pytest_cache/**",
    "**/.mypy_cache/**",
    "**/.ruff_cache/**",
    "**/.tox/**",
    "**/.eggs/**",
    "**/*.egg-info/**",
    // JS/TS coverage & caches
    "**/coverage/**",
    "**/.nyc_output/**",
    "**/.cache/**"
  ],
  /** Log file patterns to detect */
  LOG_FILE_PATTERNS: ["*.log", "debug.log", "*-error.log"],
  /** Temporary file patterns */
  TEMP_FILE_PATTERNS: ["*.tmp", "*.temp", "*.bak", "*~", "*.orig", "*.swp"]
};
var HYGIENE_ANALYTICS_EXCLUDE_PATTERNS = [
  ...WORKSPACE_EXCLUDE_BASE,
  // Python runtime & tooling
  "**/.venv/**",
  "**/venv/**",
  "**/__pycache__/**",
  "**/.pytest_cache/**",
  "**/.mypy_cache/**",
  "**/.ruff_cache/**",
  "**/.tox/**",
  "**/.eggs/**",
  "**/*.egg-info/**",
  // Package managers & build tool caches
  "**/.yarn/**",
  "**/.pnpm-store/**",
  "**/vendor/**",
  "**/vendor",
  "**/.bundle/**",
  "**/.gradle/**",
  "**/packages/**",
  "**/packages",
  "**/.terraform/**",
  "**/.terraform",
  "**/.dart_tool/**",
  "**/.dart_tool",
  "**/deps/**",
  "**/deps",
  "**/_build/**",
  "**/_build",
  "**/.stack-work/**",
  "**/.stack-work",
  "**/.cpcache/**",
  "**/.cpcache"
];
var CHAT_SETTINGS = {
  /** Default LLM model for chat operations */
  DEFAULT_MODEL: "gpt-4",
  /** Alternative models */
  AVAILABLE_MODELS: ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo"],
  /** Lines of context to include from active file */
  CONTEXT_LINES: 50,
  /** Maximum context size in characters */
  MAX_CONTEXT_CHARS: 4e3,
  /** Chat message timeout in milliseconds */
  RESPONSE_TIMEOUT_MS: 30 * 1e3,
  /** Maximum number of messages to keep in conversation */
  MAX_CONVERSATION_DEPTH: 10
};
var TELEMETRY_EVENT_KINDS = {
  COMMAND_STARTED: "COMMAND_STARTED",
  COMMAND_COMPLETED: "COMMAND_COMPLETED",
  COMMAND_FAILED: "COMMAND_FAILED",
  CACHE_HIT: "CACHE_HIT",
  CACHE_MISS: "CACHE_MISS",
  ERROR_OCCURRED: "ERROR_OCCURRED",
  WORKFLOW_STARTED: "WORKFLOW_STARTED",
  WORKFLOW_COMPLETED: "WORKFLOW_COMPLETED",
  WORKFLOW_FAILED: "WORKFLOW_FAILED",
  AGENT_INVOKED: "AGENT_INVOKED",
  USER_ACTION: "USER_ACTION"
};
var ANALYTICS_SETTINGS = {
  /** Number of high-churn files to surface in the summary report */
  TOP_CHURN_FILES_COUNT: 10,
  /** Number of top authors to surface in the summary report */
  TOP_AUTHORS_COUNT: 5,
  /** Maximum file rows written to a CSV export */
  CSV_MAX_FILES: 100,
  /** Volatility score above which a file is classified as "high" risk */
  RISK_HIGH_VOLATILITY: 100,
  /** Volatility score above which a file is classified as "medium" risk */
  RISK_MEDIUM_VOLATILITY: 30,
  /** Confidence score assigned to commit trend calculations (0–1) */
  TREND_CONFIDENCE: 0.75,
  /** Minimum slope magnitude to classify a trend as "up" or "down" vs "stable" */
  TREND_SLOPE_THRESHOLD: 0.5
};
var DEAD_CODE_DIAGNOSTIC_CODES = /* @__PURE__ */ new Set([6133, 6192, 6196, 6198, 6199, 6205]);
var UI_SETTINGS = {
  /** Debounce delay for file watcher → tree refresh (ms) */
  WATCHER_DEBOUNCE_MS: 500
};

// src/infrastructure/cache.ts
var TtlCache = class {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.entries = /* @__PURE__ */ new Map();
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return void 0;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.entries.delete(key);
      return void 0;
    }
    return entry.value;
  }
  set(key, value) {
    this.entries.set(key, { value, cachedAt: Date.now() });
  }
  has(key) {
    return this.get(key) !== void 0;
  }
  delete(key) {
    return this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
};

// src/domains/git/analytics-service.ts
var ANALYTICS_EXCLUDE = [
  ...WORKSPACE_EXCLUDE_BASE,
  "**/out/**",
  "**/dist/**",
  "**/build/**",
  "**/*.lock",
  "**/package-lock.json"
];
var GitAnalyzer = class {
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.cacheMap = new TtlCache(CACHE_SETTINGS.ANALYTICS_TTL_MS);
  }
  /**
   * Generate cache key from options
   */
  getCacheKey(opts) {
    const parts = [opts.period, opts.author || "all", opts.pathPattern || "all"];
    return parts.join("|");
  }
  /**
   * Main entry point: analyze git history over period
   */
  async analyze(opts) {
    const cacheKey = this.getCacheKey(opts);
    const cached = this.cacheMap.get(cacheKey);
    if (cached) {
      return cached;
    }
    const since = this.getPeriodStartDate(opts.period);
    const until = /* @__PURE__ */ new Date();
    const commits = this.parseGitLog(since, until, opts);
    const files = this.aggregateFiles(commits);
    const authors = this.aggregateAuthors(commits);
    const trends = this.calculateTrends(commits, since);
    const summary = this.buildSummary(commits, files, authors, since, until);
    const commitFrequency = this.buildCommitFrequency(commits);
    const churnFiles = files.sort((a, b) => b.volatility - a.volatility).slice(0, ANALYTICS_SETTINGS.TOP_CHURN_FILES_COUNT);
    const topAuthors = authors.sort((a, b) => b.commits - a.commits).slice(0, ANALYTICS_SETTINGS.TOP_AUTHORS_COUNT);
    const report = {
      period: opts.period,
      generatedAt: /* @__PURE__ */ new Date(),
      summary,
      commits,
      files,
      authors,
      trends,
      commitFrequency,
      churnFiles,
      topAuthors
    };
    this.cacheMap.set(cacheKey, report);
    return report;
  }
  /**
   * Parse git log with numstat format
   * Format: git log --pretty=format:"%H|%an|%ai|%s" --numstat
   * Output:
   *   hash|author|date|message
   *   5   3   src/file.ts
   *   2   1   src/other.ts
   */
  parseGitLog(since, until, opts) {
    try {
      const sinceStr = since.toISOString().split("T")[0];
      const untilStr = until.toISOString().split("T")[0];
      let cmd = `git log --since="${sinceStr}" --until="${untilStr}" --pretty=format:"%H|%an|%ai|%s" --numstat`;
      if (opts.author) {
        cmd += ` --author="${opts.author}"`;
      }
      const output = (0, import_child_process.execSync)(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"], cwd: this.workspaceRoot });
      const commits = [];
      let currentCommit = null;
      const commitLines = /* @__PURE__ */ new Map();
      for (const line of output.split("\n")) {
        if (!line.trim()) continue;
        if (line.includes("|")) {
          if (currentCommit && currentCommit.hash) {
            const filesLines = commitLines.get(currentCommit.hash) || [];
            this.aggregateCommitFiles(currentCommit, filesLines);
            if (opts.pathPattern !== void 0) {
              this.applyPathFilter(currentCommit, opts.pathPattern);
            }
            if (opts.pathPattern === void 0 || this.matchesPathPattern(currentCommit, opts.pathPattern)) {
              commits.push(currentCommit);
            }
          }
          const parts = line.split("|");
          if (parts.length >= 4) {
            currentCommit = {
              hash: parts[0],
              author: parts[1],
              date: new Date(parts[2]),
              message: parts[3],
              filesChanged: 0,
              insertions: 0,
              deletions: 0,
              files: []
            };
            commitLines.set(parts[0], []);
          }
        } else if (currentCommit && currentCommit.hash) {
          const lines = commitLines.get(currentCommit.hash) || [];
          lines.push(line);
          commitLines.set(currentCommit.hash, lines);
        }
      }
      if (currentCommit && currentCommit.hash) {
        const filesLines = commitLines.get(currentCommit.hash) || [];
        this.aggregateCommitFiles(currentCommit, filesLines);
        if (opts.pathPattern !== void 0) {
          this.applyPathFilter(currentCommit, opts.pathPattern);
        }
        if (opts.pathPattern === void 0 || this.matchesPathPattern(currentCommit, opts.pathPattern)) {
          commits.push(currentCommit);
        }
      }
      return commits;
    } catch (err) {
      return [];
    }
  }
  /**
   * Process numstat lines for a commit
   */
  aggregateCommitFiles(commit, lines) {
    const files = [];
    let totalInsertions = 0;
    let totalDeletions = 0;
    for (const line of lines) {
      const parts = line.split("	");
      if (parts.length >= 3) {
        const insertions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        const path12 = parts[2].trim();
        if (path12) {
          files.push({ path: path12, insertions, deletions });
          totalInsertions += insertions;
          totalDeletions += deletions;
        }
      }
    }
    commit.files = files;
    commit.filesChanged = files.length;
    commit.insertions = totalInsertions;
    commit.deletions = totalDeletions;
  }
  /**
   * Trim a commit's file list to only those matching pattern,
   * and recompute the derived insertion/deletion/filesChanged totals.
   * Must be called before matchesPathPattern().
   */
  applyPathFilter(commit, pattern) {
    const matched = commit.files.filter((f) => import_micromatch.default.isMatch(f.path, pattern));
    commit.files = matched;
    commit.filesChanged = matched.length;
    commit.insertions = matched.reduce((s, f) => s + f.insertions, 0);
    commit.deletions = matched.reduce((s, f) => s + f.deletions, 0);
  }
  /**
   * Check if commit matches path pattern filter
   */
  matchesPathPattern(commit, pattern) {
    return commit.files.some((f) => import_micromatch.default.isMatch(f.path, pattern));
  }
  /**
   * Aggregate file-level statistics
   */
  aggregateFiles(commits) {
    const fileMap = /* @__PURE__ */ new Map();
    for (const commit of commits) {
      for (const fileChange of commit.files) {
        const { path: path12, insertions, deletions } = fileChange;
        if (import_micromatch.default.isMatch(path12, ANALYTICS_EXCLUDE)) {
          continue;
        }
        if (!fileMap.has(path12)) {
          fileMap.set(path12, {
            path: path12,
            commitCount: 0,
            insertions: 0,
            deletions: 0,
            volatility: 0,
            authors: [],
            lastModified: commit.date,
            risk: "low"
          });
        }
        const metric = fileMap.get(path12);
        metric.commitCount++;
        metric.insertions += insertions;
        metric.deletions += deletions;
        if (!metric.authors.includes(commit.author)) {
          metric.authors.push(commit.author);
        }
        if (commit.date > metric.lastModified) {
          metric.lastModified = commit.date;
        }
      }
    }
    for (const metric of fileMap.values()) {
      metric.volatility = metric.commitCount > 0 ? (metric.insertions + metric.deletions) / metric.commitCount : 0;
      if (metric.volatility > ANALYTICS_SETTINGS.RISK_HIGH_VOLATILITY) {
        metric.risk = "high";
      } else if (metric.volatility > ANALYTICS_SETTINGS.RISK_MEDIUM_VOLATILITY) {
        metric.risk = "medium";
      } else {
        metric.risk = "low";
      }
    }
    return Array.from(fileMap.values()).sort(
      (a, b) => b.volatility - a.volatility
    );
  }
  /**
   * Aggregate author-level statistics
   */
  aggregateAuthors(commits) {
    const authorMap = /* @__PURE__ */ new Map();
    for (const commit of commits) {
      if (!authorMap.has(commit.author)) {
        authorMap.set(commit.author, {
          name: commit.author,
          commits: 0,
          insertions: 0,
          deletions: 0,
          filesChanged: 0,
          lastActive: commit.date
        });
      }
      const metric = authorMap.get(commit.author);
      metric.commits++;
      metric.insertions += commit.insertions;
      metric.deletions += commit.deletions;
      metric.filesChanged += commit.filesChanged;
      if (commit.date > metric.lastActive) {
        metric.lastActive = commit.date;
      }
    }
    return Array.from(authorMap.values()).sort(
      (a, b) => b.commits - a.commits
    );
  }
  /**
   * Calculate trend metrics, normalized by actual period length.
   */
  calculateTrends(commits, _since) {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1e3;
    const mid = Math.floor(commits.length / 2);
    const firstHalf = commits.slice(0, mid);
    const secondHalf = commits.slice(mid);
    const spanWeeks = (half) => {
      if (half.length < 2) return 1;
      const ms = Math.abs(half[0].date.getTime() - half[half.length - 1].date.getTime());
      return Math.max(1, ms / WEEK_MS);
    };
    const firstAvg = firstHalf.length / spanWeeks(firstHalf);
    const secondAvg = secondHalf.length / spanWeeks(secondHalf);
    const commitSlope = firstAvg - secondAvg;
    const volatilitySlope = this.getAverageVolatility(firstHalf) - this.getAverageVolatility(secondHalf);
    return {
      commitTrend: {
        slope: commitSlope,
        direction: this.getDirection(commitSlope),
        confidence: ANALYTICS_SETTINGS.TREND_CONFIDENCE
      },
      volatilityTrend: {
        slope: volatilitySlope,
        direction: this.getDirection(volatilitySlope)
      }
    };
  }
  /**
   * Get trend direction from slope
   */
  getDirection(slope) {
    if (slope > ANALYTICS_SETTINGS.TREND_SLOPE_THRESHOLD) return "up";
    if (slope < -ANALYTICS_SETTINGS.TREND_SLOPE_THRESHOLD) return "down";
    return "stable";
  }
  /**
   * Calculate average volatility for a set of commits
   */
  getAverageVolatility(commits) {
    if (commits.length === 0) return 0;
    const total = commits.reduce(
      (sum, c) => sum + (c.insertions + c.deletions),
      0
    );
    return total / commits.length;
  }
  /**
   * Build summary statistics
   */
  buildSummary(commits, files, authors, since, until) {
    const weeksDiff = (until.getTime() - since.getTime()) / (7 * 24 * 60 * 60 * 1e3);
    const totalInsertions = commits.reduce((sum, c) => sum + c.insertions, 0);
    const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);
    return {
      totalCommits: commits.length,
      totalAuthors: authors.length,
      totalFilesModified: files.length,
      totalLinesAdded: totalInsertions,
      totalLinesDeleted: totalDeletions,
      commitFrequency: weeksDiff > 0 ? commits.length / weeksDiff : 0,
      averageCommitSize: commits.length > 0 ? (totalInsertions + totalDeletions) / commits.length : 0,
      churnRate: files.reduce((sum, f) => sum + f.volatility, 0) / files.length || 0
    };
  }
  /**
   * Build commit frequency time series data
   */
  buildCommitFrequency(commits) {
    const weekMap = /* @__PURE__ */ new Map();
    for (const commit of commits) {
      const weekKey = this.getWeekKey(commit.date);
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
    }
    const sorted = Array.from(weekMap.entries()).sort();
    const labels = sorted.map(([key]) => key);
    const data = sorted.map(([, count]) => count);
    return { labels, data };
  }
  /**
   * Get ISO 8601 week key for grouping (YYYY-W##).
   * Avoids week-of-month fragmentation at month boundaries.
   */
  getWeekKey(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
    return `${d.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
  }
  /**
   * Get period start date
   */
  getPeriodStartDate(period) {
    const now = /* @__PURE__ */ new Date();
    const months = period === "3mo" ? 3 : period === "6mo" ? 6 : 12;
    return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  }
  /**
   * Clear cache
   */
  clearCache() {
    this.cacheMap.clear();
  }
  /**
   * Export analytics to JSON
   */
  exportToJSON(report) {
    return JSON.stringify(report, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2);
  }
  /**
   * Export analytics to CSV
   */
  exportToCSV(report) {
    const csvStr = (value) => `"${value.replace(/"/g, '""')}"`;
    const lines = [];
    lines.push("Git Analytics Report");
    lines.push(`Period,${report.period}`);
    lines.push(`Generated,${report.generatedAt.toISOString()}`);
    lines.push("");
    lines.push("Summary");
    lines.push(
      `Total Commits,Total Authors,Total Files Modified,Lines Added,Lines Deleted,Commit Frequency (per week),Avg Commit Size,Churn Rate`
    );
    const sum = report.summary;
    lines.push(
      `${sum.totalCommits},${sum.totalAuthors},${sum.totalFilesModified},${sum.totalLinesAdded},${sum.totalLinesDeleted},${sum.commitFrequency.toFixed(2)},${sum.averageCommitSize.toFixed(2)},${sum.churnRate.toFixed(2)}`
    );
    lines.push("");
    lines.push("Files");
    lines.push(
      "Path,Commits,Insertions,Deletions,Volatility,Risk,Authors,Last Modified"
    );
    for (const file of report.files.slice(0, ANALYTICS_SETTINGS.CSV_MAX_FILES)) {
      lines.push(
        `${csvStr(file.path)},${file.commitCount},${file.insertions},${file.deletions},${file.volatility.toFixed(2)},${file.risk},${csvStr(file.authors.join(";"))},${file.lastModified.toISOString()}`
      );
    }
    lines.push("");
    lines.push("Authors");
    lines.push("Name,Commits,Insertions,Deletions,Files Changed,Last Active");
    for (const author of report.authors) {
      lines.push(
        `${csvStr(author.name)},${author.commits},${author.insertions},${author.deletions},${author.filesChanged},${author.lastActive.toISOString()}`
      );
    }
    return lines.join("\n");
  }
};

// src/domains/git/service.ts
var GitDomainService = class {
  constructor(gitProvider, logger, workspaceRoot = process.cwd(), approvalUI, generateProseFn) {
    this.name = "git";
    this.handlers = {};
    this.gitProvider = gitProvider;
    this.logger = logger;
    this.changeGrouper = new ChangeGrouper();
    this.messageSuggester = new CommitMessageSuggester();
    this.batchCommitter = new BatchCommitter(gitProvider, logger);
    this.inboundAnalyzer = new InboundAnalyzer(gitProvider, logger);
    this.analyzer = new GitAnalyzer(workspaceRoot);
    this.handlers = {
      "git.status": createStatusHandler(gitProvider, logger),
      "git.pull": createPullHandler(gitProvider, logger),
      "git.commit": createCommitHandler(gitProvider, logger),
      "git.smartCommit": createSmartCommitHandler(
        gitProvider,
        logger,
        this.changeGrouper,
        this.messageSuggester,
        this.batchCommitter,
        approvalUI
      ),
      "git.analyzeInbound": createAnalyzeInboundHandler(
        this.inboundAnalyzer,
        logger
      ),
      "git.showAnalytics": createShowAnalyticsHandler(
        this.analyzer,
        logger
      ),
      "git.exportJson": createExportJsonHandler(
        this.analyzer,
        logger
      ),
      "git.exportCsv": createExportCsvHandler(
        this.analyzer,
        logger
      ),
      ...generateProseFn ? {
        "git.generatePR": createGeneratePRHandler(gitProvider, logger, generateProseFn),
        "git.reviewPR": createReviewPRHandler(gitProvider, logger, generateProseFn),
        "git.commentPR": createCommentPRHandler(gitProvider, logger, generateProseFn),
        "git.resolveConflicts": createResolveConflictsHandler(gitProvider, logger, this.inboundAnalyzer, generateProseFn),
        "git.sessionBriefing": createSessionBriefingHandler(gitProvider, logger, generateProseFn)
      } : {}
    };
  }
  /**
   * Initialize domain — verify git is available, check repo state.
   */
  async initialize() {
    try {
      this.logger.info(
        "Initializing git domain",
        "GitDomainService.initialize"
      );
      const statusResult = await this.gitProvider.status();
      if (statusResult.kind === "err") {
        return failure({
          code: "GIT_UNAVAILABLE",
          message: "Git is not available or not initialized",
          details: statusResult.error,
          context: "GitDomainService.initialize"
        });
      }
      this.logger.info(
        `Git initialized (branch: ${statusResult.value.branch})`,
        "GitDomainService.initialize"
      );
      return success(void 0);
    } catch (err) {
      return failure({
        code: "GIT_INIT_ERROR",
        message: "Failed to initialize git domain",
        details: err,
        context: "GitDomainService.initialize"
      });
    }
  }
  /**
   * Cleanup — no resources to release, but log completion.
   */
  async teardown() {
    this.logger.debug("Tearing down git domain", "GitDomainService.teardown");
  }
};
function createGitDomain(gitProvider, logger, workspaceRoot = process.cwd(), approvalUI, generateProseFn) {
  return new GitDomainService(gitProvider, logger, workspaceRoot, approvalUI, generateProseFn);
}

// src/domains/hygiene/scan-handler.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var micromatch2 = require_micromatch();
function readGitignorePatterns(workspaceRoot) {
  try {
    const gitignorePath = path.join(workspaceRoot, ".gitignore");
    const content = fs.readFileSync(gitignorePath, "utf-8");
    return content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#")).map((line) => {
      const stripped = line.endsWith("/") ? line.slice(0, -1) : line;
      return stripped.startsWith("**/") ? stripped : `**/${stripped}`;
    });
  } catch {
    return [];
  }
}
function readMeridianIgnorePatterns(workspaceRoot) {
  try {
    const meridianIgnorePath = path.join(workspaceRoot, ".meridianignore");
    const content = fs.readFileSync(meridianIgnorePath, "utf-8");
    return content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#")).map((line) => {
      const stripped = line.endsWith("/") ? line.slice(0, -1) : line;
      return stripped.startsWith("**/") ? stripped : `**/${stripped}`;
    });
  } catch {
    return [];
  }
}
function isExcluded(filePath, patterns) {
  return patterns.length > 0 && micromatch2.isMatch(filePath, patterns);
}
function createScanHandler(workspaceProvider, logger, deadCodeAnalyzer) {
  return async (ctx) => {
    try {
      logger.info("Scanning workspace for hygiene issues", "HygieneScanHandler");
      const workspaceRoot = ctx.workspaceFolders?.[0] ?? process.cwd();
      const gitignorePatterns = readGitignorePatterns(workspaceRoot);
      const meridianIgnorePatterns = readMeridianIgnorePatterns(workspaceRoot);
      const excludePatterns = [
        ...HYGIENE_SETTINGS.EXCLUDE_PATTERNS,
        ...gitignorePatterns,
        ...meridianIgnorePatterns
      ];
      const deadFiles = [];
      const deadPatterns = HYGIENE_SETTINGS.TEMP_FILE_PATTERNS.map((p) => `**/${p}`);
      for (const pattern of deadPatterns) {
        const result = await workspaceProvider.findFiles(pattern);
        if (result.kind === "ok") {
          for (const f of result.value) {
            if (!deadFiles.includes(f) && !isExcluded(f, excludePatterns)) {
              deadFiles.push(f);
            }
          }
        }
      }
      const logFiles = [];
      const logPatterns = HYGIENE_SETTINGS.LOG_FILE_PATTERNS.map((p) => `**/${p}`);
      for (const pattern of logPatterns) {
        const result = await workspaceProvider.findFiles(pattern);
        if (result.kind === "ok") {
          for (const f of result.value) {
            if (!logFiles.includes(f) && !isExcluded(f, excludePatterns)) {
              logFiles.push(f);
            }
          }
        }
      }
      const largeFiles = [];
      const allFilesResult = await workspaceProvider.findFiles("**/*");
      if (allFilesResult.kind === "ok") {
        for (const filePath of allFilesResult.value) {
          if (isExcluded(filePath, excludePatterns)) {
            continue;
          }
          const readResult = await workspaceProvider.readFile(filePath);
          if (readResult.kind === "ok") {
            const sizeBytes = Buffer.byteLength(readResult.value, "utf8");
            if (sizeBytes > HYGIENE_SETTINGS.MAX_FILE_SIZE_BYTES) {
              largeFiles.push({ path: filePath, sizeBytes });
            }
          }
        }
      }
      const markdownFiles = [];
      const mdResult = await workspaceProvider.findFiles("**/*.md");
      if (mdResult.kind === "ok") {
        for (const filePath of mdResult.value) {
          if (isExcluded(filePath, excludePatterns)) continue;
          const readResult = await workspaceProvider.readFile(filePath);
          if (readResult.kind === "ok") {
            const sizeBytes = Buffer.byteLength(readResult.value, "utf8");
            const lineCount = readResult.value.split("\n").length;
            markdownFiles.push({ path: filePath, sizeBytes, lineCount });
          }
        }
      }
      let deadCode = { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 };
      try {
        deadCode = deadCodeAnalyzer.analyze(workspaceRoot);
      } catch {
        deadCode = { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 };
      }
      const scan = {
        deadFiles,
        largeFiles,
        logFiles,
        markdownFiles,
        deadCode
      };
      logger.info(
        `Found ${scan.deadFiles.length} dead, ${scan.largeFiles.length} large, ${scan.logFiles.length} log, ${scan.markdownFiles.length} markdown, ${scan.deadCode.items.length} dead-code items`,
        "HygieneScanHandler"
      );
      return success(scan);
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.HYGIENE_SCAN_ERROR,
        message: "Workspace scan failed",
        details: err,
        context: "hygiene.scan"
      });
    }
  };
}

// src/domains/hygiene/cleanup-handler.ts
function createCleanupHandler(workspaceProvider, logger) {
  return async (_ctx, params = {}) => {
    try {
      const { dryRun = false, files } = params;
      if (!files || files.length === 0) {
        return failure({
          code: HYGIENE_ERROR_CODES.HYGIENE_CLEANUP_NO_FILES,
          message: "Cleanup requires an explicit file list; none provided",
          context: "hygiene.cleanup"
        });
      }
      const mode = dryRun ? "DRY RUN" : "EXECUTE";
      logger.info(
        `Starting cleanup (${mode}) for ${files.length} file(s)`,
        "HygieneCleanupHandler"
      );
      if (dryRun) {
        logger.info(
          `Dry-run complete: ${files.length} file(s) would be deleted`,
          "HygieneCleanupHandler"
        );
        return success({
          dryRun: true,
          files,
          deleted: [],
          failed: []
        });
      }
      const deleted = [];
      const failed = [];
      for (const filePath of files) {
        const result = await workspaceProvider.deleteFile(filePath);
        if (result.kind === "ok") {
          deleted.push(filePath);
          logger.debug(`Deleted: ${filePath}`, "HygieneCleanupHandler");
        } else {
          failed.push({ path: filePath, reason: result.error.message });
          logger.warn(
            `Failed to delete: ${filePath} \u2014 ${result.error.message}`,
            "HygieneCleanupHandler",
            result.error
          );
        }
      }
      logger.info(
        `Cleanup complete: ${deleted.length} deleted, ${failed.length} failed`,
        "HygieneCleanupHandler"
      );
      return success({ dryRun: false, files, deleted, failed });
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.HYGIENE_CLEANUP_ERROR,
        message: "Cleanup operation failed",
        details: err,
        context: "hygiene.cleanup"
      });
    }
  };
}

// src/domains/hygiene/analytics-service.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/domains/hygiene/analytics-types.ts
var PRUNE_DEFAULTS = {
  minAgeDays: 30,
  maxSizeMB: 1,
  minLineCount: 0,
  categories: ["backup", "temp", "log", "artifact"]
};

// src/domains/hygiene/analytics-utils.ts
var MARKDOWN_EXTS = /* @__PURE__ */ new Set([".md", ".mdx"]);
var LOG_EXTS = /* @__PURE__ */ new Set([".log"]);
var CONFIG_EXTS = /* @__PURE__ */ new Set([".yml", ".yaml", ".json", ".toml", ".ini", ".env"]);
var BACKUP_EXTS = /* @__PURE__ */ new Set([".bak", ".orig", ".swp"]);
var TEMP_EXTS = /* @__PURE__ */ new Set([".tmp", ".temp"]);
var SOURCE_EXTS = /* @__PURE__ */ new Set([".ts", ".js", ".py", ".go", ".rs", ".java", ".rb", ".cs", ".tsx", ".jsx", ".sh", ".bash"]);
var ARTIFACT_EXTS = /* @__PURE__ */ new Set([".class", ".pyc", ".pyo", ".o", ".obj", ".a", ".so"]);
var ARTIFACT_DIRS = /* @__PURE__ */ new Set([
  "target",
  ".next",
  ".nuxt",
  ".parcel-cache",
  "__pycache__",
  "venv",
  ".venv",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  ".eggs"
]);
var LINE_COUNT_EXTS = /* @__PURE__ */ new Set([
  ...MARKDOWN_EXTS,
  ...LOG_EXTS,
  ...CONFIG_EXTS,
  ...SOURCE_EXTS
]);
var MAX_LINECOUNT_BYTES = 5 * 1024 * 1024;
function categorize(ext, name, relPath) {
  if (ARTIFACT_EXTS.has(ext)) return "artifact";
  const parts = relPath.split(/[/\\]/);
  if (parts.some((p) => ARTIFACT_DIRS.has(p) || p.endsWith(".egg-info"))) return "artifact";
  if (MARKDOWN_EXTS.has(ext)) return "markdown";
  if (LOG_EXTS.has(ext)) return "log";
  if (CONFIG_EXTS.has(ext)) return "config";
  if (BACKUP_EXTS.has(ext) || name.endsWith("~")) return "backup";
  if (TEMP_EXTS.has(ext)) return "temp";
  if (SOURCE_EXTS.has(ext)) return "source";
  return "other";
}
function isLineCountable(ext, sizeBytes) {
  return LINE_COUNT_EXTS.has(ext) && sizeBytes <= MAX_LINECOUNT_BYTES;
}
function isPruneCandidate(ageDays, category, sizeBytes, lineCount, config) {
  if (ageDays < config.minAgeDays) return false;
  const categoryMatch = config.categories.includes(category);
  const sizeMatch = sizeBytes > config.maxSizeMB * 1048576;
  const lineMatch = config.minLineCount > 0 && lineCount >= config.minLineCount;
  return categoryMatch || sizeMatch || lineMatch;
}
function lastNDays(n) {
  const result = [];
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const key = dayStart.toISOString().slice(0, 10);
    const label = dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    result.push({ key, label, start: dayStart.getTime(), end: dayEnd.getTime() });
  }
  return result;
}
function buildTemporalData(files, deadCodeByRelPath) {
  const days = lastNDays(14);
  const totalByDay = {};
  const pruneByDay = {};
  const deadCodeByDay = {};
  const extByDay = {};
  const extTotals = {};
  for (const d of days) {
    totalByDay[d.key] = 0;
    pruneByDay[d.key] = 0;
    deadCodeByDay[d.key] = 0;
    extByDay[d.key] = {};
  }
  for (const f of files) {
    const fileMs = f.lastModified.getTime();
    for (const d of days) {
      if (fileMs >= d.start && fileMs < d.end) {
        totalByDay[d.key]++;
        if (f.isPruneCandidate) pruneByDay[d.key]++;
        if (deadCodeByRelPath) {
          deadCodeByDay[d.key] += deadCodeByRelPath.get(f.path) ?? 0;
        }
        const ext = f.extension || "(none)";
        extTotals[ext] = (extTotals[ext] || 0) + 1;
        extByDay[d.key][ext] = (extByDay[d.key][ext] || 0) + 1;
        break;
      }
    }
  }
  const topExtensions = Object.entries(extTotals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ext]) => ext);
  const buckets = days.map((d) => ({
    label: d.label,
    total: totalByDay[d.key],
    pruneCount: pruneByDay[d.key],
    deadCodeCount: deadCodeByDay[d.key],
    byExtension: Object.fromEntries(
      topExtensions.map((ext) => [ext, extByDay[d.key][ext] || 0])
    )
  }));
  return { buckets, topExtensions };
}

// src/domains/hygiene/analytics-service.ts
var micromatch3 = require_micromatch();
var HEAVY_ARTIFACT_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  "venv",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  ".eggs",
  ".yarn",
  ".pnpm-store",
  "vendor",
  ".bundle",
  ".gradle",
  "packages",
  ".terraform",
  ".dart_tool",
  "deps",
  "_build",
  ".stack-work",
  ".cpcache"
]);
function countLines(filePath, ext, sizeBytes) {
  if (!isLineCountable(ext, sizeBytes)) return -1;
  try {
    const content = fs2.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return -1;
  }
}
function readMeridianIgnorePatterns2(workspaceRoot) {
  try {
    const content = fs2.readFileSync(path2.join(workspaceRoot, ".meridianignore"), "utf-8");
    return content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#")).map((l) => {
      const stripped = l.endsWith("/") ? l.slice(0, -1) : l;
      return stripped.startsWith("**/") ? stripped : `**/${stripped}`;
    });
  } catch {
    return [];
  }
}
function pruneConfigKey(config) {
  return JSON.stringify(config);
}
function buildDeadCodeRelPathMap(workspaceRoot, scan) {
  const sep = workspaceRoot.endsWith("/") ? "" : "/";
  const prefix = workspaceRoot + sep;
  const map = /* @__PURE__ */ new Map();
  for (const item of scan.items) {
    if (!item.filePath.startsWith(prefix)) continue;
    const rel = item.filePath.slice(prefix.length);
    map.set(rel, (map.get(rel) ?? 0) + 1);
  }
  return map;
}
var HygieneAnalyzer = class {
  constructor() {
    this.cache = new TtlCache(CACHE_SETTINGS.ANALYTICS_TTL_MS);
  }
  /**
   * Analyze workspace files and return a full report.
   * Cached per workspaceRoot+pruneConfig for 10 minutes.
   *
   * @param deadCodeScan — optional scan from DeadCodeAnalyzer; when provided,
   *   dead code issue counts are bucketed into the temporal chart and the raw
   *   scan is included in the report for the webview summary cards.
   */
  analyze(workspaceRoot, config = PRUNE_DEFAULTS, deadCodeScan) {
    const cfgKey = pruneConfigKey(config);
    const cached = this.cache.get(workspaceRoot);
    if (cached && cached.configKey === cfgKey) {
      if (deadCodeScan) {
        return { ...cached.report, deadCode: deadCodeScan };
      }
      return cached.report;
    }
    const excludePatterns = [
      ...HYGIENE_ANALYTICS_EXCLUDE_PATTERNS,
      ...readMeridianIgnorePatterns2(workspaceRoot)
    ];
    const files = this.walkDir(workspaceRoot, workspaceRoot, excludePatterns, config);
    const deadCodeByRelPath = deadCodeScan ? buildDeadCodeRelPathMap(workspaceRoot, deadCodeScan) : void 0;
    const summary = this.buildSummary(files);
    const pruneCandiates = files.filter((f) => f.isPruneCandidate);
    const largestFiles = [...files].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 20);
    const oldestFiles = [...files].sort((a, b) => b.ageDays - a.ageDays).slice(0, 20);
    const temporalData = buildTemporalData(files, deadCodeByRelPath);
    const report = {
      generatedAt: /* @__PURE__ */ new Date(),
      workspaceRoot,
      summary,
      files,
      pruneCandiates,
      largestFiles,
      oldestFiles,
      temporalData,
      pruneConfig: config,
      deadCode: deadCodeScan
    };
    this.cache.set(workspaceRoot, { report, configKey: cfgKey });
    return report;
  }
  clearCache() {
    this.cache.clear();
  }
  // --------------------------------------------------------------------------
  walkDir(dir, workspaceRoot, excludePatterns, config) {
    const entries = [];
    let dirEntries;
    try {
      dirEntries = fs2.readdirSync(dir, { withFileTypes: true });
    } catch {
      return entries;
    }
    for (const dirent of dirEntries) {
      const fullPath = path2.join(dir, dirent.name);
      const relPath = path2.relative(workspaceRoot, fullPath);
      const isExcluded2 = micromatch3.isMatch(fullPath, excludePatterns) || micromatch3.isMatch(relPath, excludePatterns);
      if (isExcluded2) {
        if (dirent.isDirectory() && (HEAVY_ARTIFACT_DIRS.has(dirent.name) || dirent.name.endsWith(".egg-info"))) {
          try {
            const stat = fs2.statSync(fullPath);
            const ageDays = Math.floor((Date.now() - stat.mtimeMs) / 864e5);
            entries.push({
              path: relPath,
              name: dirent.name,
              extension: "",
              category: "artifact",
              sizeBytes: 0,
              lastModified: stat.mtime,
              ageDays,
              lineCount: -1,
              isPruneCandidate: isPruneCandidate(
                ageDays,
                "artifact",
                0,
                -1,
                config
              )
            });
          } catch {
          }
        }
        continue;
      }
      if (dirent.isDirectory()) {
        entries.push(...this.walkDir(fullPath, workspaceRoot, excludePatterns, config));
      } else if (dirent.isFile()) {
        let stat;
        try {
          stat = fs2.statSync(fullPath);
        } catch {
          continue;
        }
        const ext = path2.extname(dirent.name).toLowerCase();
        const ageDays = Math.floor((Date.now() - stat.mtimeMs) / 864e5);
        const category = categorize(ext, dirent.name, relPath);
        const lineCount = countLines(fullPath, ext, stat.size);
        entries.push({
          path: relPath,
          name: dirent.name,
          extension: ext,
          category,
          sizeBytes: stat.size,
          lastModified: stat.mtime,
          ageDays,
          lineCount,
          isPruneCandidate: isPruneCandidate(ageDays, category, stat.size, lineCount, config)
        });
      }
    }
    return entries;
  }
  buildSummary(files) {
    const byCategory = {};
    for (const f of files) {
      if (!byCategory[f.category]) {
        byCategory[f.category] = { count: 0, sizeBytes: 0 };
      }
      byCategory[f.category].count++;
      byCategory[f.category].sizeBytes += f.sizeBytes;
    }
    const pruneFiles = files.filter((f) => f.isPruneCandidate);
    return {
      totalFiles: files.length,
      totalSizeBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
      pruneCount: pruneFiles.length,
      pruneEstimateSizeBytes: pruneFiles.reduce((s, f) => s + f.sizeBytes, 0),
      byCategory
    };
  }
};

// src/domains/hygiene/dead-code-analyzer.ts
var ts = __toESM(require("typescript"));
var path3 = __toESM(require("path"));
var DeadCodeAnalyzer = class {
  constructor(logger) {
    this.logger = logger;
    this.cache = new TtlCache(CACHE_SETTINGS.DEAD_CODE_TTL_MS);
  }
  /**
   * Analyze workspace TypeScript files for dead code diagnostics.
   * Results are cached for 5 minutes per workspaceRoot.
   */
  analyze(workspaceRoot) {
    const cached = this.cache.get(workspaceRoot);
    if (cached) {
      this.logger.debug("Dead code analyzer: cache hit", "DeadCodeAnalyzer");
      return cached;
    }
    try {
      const scan = this.runScan(workspaceRoot);
      this.cache.set(workspaceRoot, scan);
      this.logger.info(
        `Dead code scan complete: ${scan.items.length} issues in ${scan.fileCount} files (${scan.durationMs}ms)`,
        "DeadCodeAnalyzer"
      );
      return scan;
    } catch (err) {
      this.logger.warn("Dead code scan failed", "DeadCodeAnalyzer", {
        code: HYGIENE_ERROR_CODES.DEAD_CODE_SCAN_ERROR,
        message: String(err)
      });
      return { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 };
    }
  }
  clearCache() {
    this.cache.clear();
  }
  // --------------------------------------------------------------------------
  runScan(workspaceRoot) {
    const startMs = Date.now();
    const tsconfigPath = ts.findConfigFile(workspaceRoot, ts.sys.fileExists, "tsconfig.json") ?? null;
    let fileNames;
    let compilerOptions;
    if (tsconfigPath) {
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (configFile.error) {
        throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
      }
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path3.dirname(tsconfigPath)
      );
      fileNames = parsedConfig.fileNames;
      compilerOptions = {
        ...parsedConfig.options,
        noUnusedLocals: true,
        noUnusedParameters: true,
        skipLibCheck: true
      };
    } else {
      fileNames = ts.sys.readDirectory(
        workspaceRoot,
        [".ts", ".tsx"],
        [...HYGIENE_SETTINGS.EXCLUDE_PATTERNS],
        ["**/*.ts", "**/*.tsx"]
      );
      compilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: false,
        noUnusedLocals: true,
        noUnusedParameters: true,
        skipLibCheck: true
      };
    }
    const relevantFiles = fileNames.filter(
      (f) => f.startsWith(workspaceRoot) && !f.endsWith(".d.ts")
    );
    const program = ts.createProgram(relevantFiles, compilerOptions);
    const items = [];
    for (const sourceFile of program.getSourceFiles()) {
      const filePath = sourceFile.fileName;
      if (!filePath.startsWith(workspaceRoot) || filePath.endsWith(".d.ts")) {
        continue;
      }
      const diagnostics = program.getSemanticDiagnostics(sourceFile);
      for (const d of diagnostics) {
        if (!DEAD_CODE_DIAGNOSTIC_CODES.has(d.code)) continue;
        if (d.start === void 0 || !d.file) continue;
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
        items.push({
          filePath,
          line: line + 1,
          // convert 0-based → 1-based
          character: character + 1,
          // convert 0-based → 1-based
          message,
          code: d.code,
          category: deriveCategory(d.code)
        });
      }
    }
    return {
      items,
      tsconfigPath,
      durationMs: Date.now() - startMs,
      fileCount: relevantFiles.length
    };
  }
};
function deriveCategory(code) {
  if (code === 6192) return "unusedImport";
  if (code === 6196 || code === 6205) return "unusedTypeParam";
  return "unusedLocal";
}

// src/domains/hygiene/analytics-handler.ts
function createShowHygieneAnalyticsHandler(analyzer, deadCodeAnalyzer, logger) {
  return async (ctx, params = {}) => {
    try {
      const workspaceRoot = ctx.workspaceFolders?.[0] ?? process.cwd();
      const config = {
        minAgeDays: params.minAgeDays ?? PRUNE_DEFAULTS.minAgeDays,
        maxSizeMB: params.maxSizeMB ?? PRUNE_DEFAULTS.maxSizeMB,
        minLineCount: params.minLineCount ?? PRUNE_DEFAULTS.minLineCount,
        categories: params.categories ?? PRUNE_DEFAULTS.categories
      };
      const deadCode = deadCodeAnalyzer.analyze(workspaceRoot);
      const report = analyzer.analyze(workspaceRoot, config, deadCode);
      logger.info(
        `Hygiene analytics: ${report.summary.totalFiles} files, ${report.summary.pruneCount} prune candidates, ${deadCode.items.length} dead code items`,
        "HygieneAnalyticsHandler"
      );
      return success(report);
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.HYGIENE_ANALYTICS_ERROR,
        message: "Hygiene analytics failed",
        details: err,
        context: "hygiene.showAnalytics"
      });
    }
  };
}

// src/domains/hygiene/impact-analysis-handler.ts
var path5 = __toESM(require("path"));
var ts3 = __toESM(require("typescript"));

// src/domains/hygiene/impact-visitor.ts
var path4 = __toESM(require("path"));
var ts2 = __toESM(require("typescript"));
var ImpactAnalysisVisitor = class {
  constructor(program, targetFile, targetFunction) {
    this.program = program;
    this.targetFile = targetFile;
    this.targetFunction = targetFunction;
    this.importers = /* @__PURE__ */ new Set();
    this.callSites = [];
    this.testFiles = /* @__PURE__ */ new Set();
  }
  analyze() {
    const sourceFiles = this.program.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      if (sourceFile.fileName.includes(".d.ts")) continue;
      if (this.isTestFile(sourceFile.fileName)) {
        this.testFiles.add(sourceFile.fileName);
      }
      ts2.forEachChild(sourceFile, (node) => {
        this.visitNode(node, sourceFile.fileName);
      });
    }
    return {
      importers: Array.from(this.importers),
      callSites: this.callSites,
      testFiles: Array.from(this.testFiles)
    };
  }
  visitNode(node, fileName) {
    if (!node) return;
    if (ts2.isImportDeclaration(node) || ts2.isImportEqualsDeclaration(node)) {
      const importPath = this.extractImportPath(node);
      if (importPath && this.pathsResolveToTarget(importPath)) {
        this.importers.add(fileName);
      }
    }
    if (this.targetFunction && ts2.isCallExpression(node)) {
      const funcName = this.extractCallName(node);
      if (funcName === this.targetFunction) {
        this.callSites.push(`${fileName}:${node.getStart()}`);
      }
    }
    ts2.forEachChild(node, (child) => {
      this.visitNode(child, fileName);
    });
  }
  extractImportPath(node) {
    if (ts2.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts2.isStringLiteral(moduleSpecifier)) {
        return moduleSpecifier.text;
      }
    } else if (ts2.isImportEqualsDeclaration(node)) {
      const moduleReference = node.moduleReference;
      if (ts2.isExternalModuleReference(moduleReference) && ts2.isStringLiteral(moduleReference.expression)) {
        return moduleReference.expression.text;
      }
    }
    return null;
  }
  // Simple heuristic: check if path contains target filename stem.
  pathsResolveToTarget(importPath) {
    const targetStem = path4.parse(this.targetFile).name;
    return importPath.endsWith(`/${targetStem}`) || importPath.endsWith(`/${targetStem}`);
  }
  extractCallName(node) {
    const expression = node.expression;
    if (ts2.isIdentifier(expression)) {
      return expression.text;
    }
    if (ts2.isPropertyAccessExpression(expression) && ts2.isIdentifier(expression.name)) {
      return expression.name.text;
    }
    return null;
  }
  isTestFile(fileName) {
    return /\.test\.(ts|js)$/.test(fileName) || /\.spec\.(ts|js)$/.test(fileName);
  }
};

// src/domains/hygiene/impact-analysis-handler.ts
var ImpactAnalyzer = class {
  constructor(logger) {
    this.logger = logger;
    this.cache = new TtlCache(CACHE_SETTINGS.ANALYTICS_TTL_MS);
  }
  analyze(workspaceRoot, filePath, functionName) {
    const cacheKey = `${workspaceRoot}|${filePath || functionName}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const tsconfigPath = ts3.findConfigFile(
        workspaceRoot,
        ts3.sys.fileExists,
        "tsconfig.json"
      );
      if (!tsconfigPath) {
        this.logger.warn("No tsconfig.json found", "ImpactAnalyzer");
        return null;
      }
      const configFile = ts3.readConfigFile(tsconfigPath, ts3.sys.readFile);
      if (configFile.error) {
        this.logger.warn("Failed to read tsconfig", "ImpactAnalyzer");
        return null;
      }
      const parsedConfig = ts3.parseJsonConfigFileContent(
        configFile.config,
        ts3.sys,
        path5.dirname(tsconfigPath)
      );
      const program = ts3.createProgram(parsedConfig.fileNames, parsedConfig.options);
      const targetFile = filePath || "";
      const visitor = new ImpactAnalysisVisitor(program, targetFile, functionName);
      const result = visitor.analyze();
      const context = {
        target: filePath || functionName || "unknown",
        importers: result.importers,
        callSites: result.callSites,
        testFiles: result.testFiles,
        dependentFiles: Array.from(
          /* @__PURE__ */ new Set([...result.importers, ...result.testFiles])
        ),
        analysisType: filePath ? "file" : "function"
      };
      this.cache.set(cacheKey, context);
      return context;
    } catch (err) {
      this.logger.warn("Impact analysis failed", "ImpactAnalyzer", {
        code: HYGIENE_ERROR_CODES.IMPACT_ANALYSIS_ERROR,
        message: String(err)
      });
      return null;
    }
  }
  clearCache() {
    this.cache.clear();
  }
};
function createImpactAnalysisHandler(logger, generateProseFn) {
  const analyzer = new ImpactAnalyzer(logger);
  return async (_ctx, params) => {
    try {
      if (!params.filePath && !params.functionName) {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Impact analysis requires either filePath or functionName",
          context: "hygiene.impactAnalysis"
        });
      }
      logger.info(
        `Analyzing impact of ${params.filePath || params.functionName}`,
        "ImpactAnalysisHandler"
      );
      const workspaceRoot = _ctx.workspaceFolders?.[0];
      if (!workspaceRoot) {
        return failure({
          code: INFRASTRUCTURE_ERROR_CODES.WORKSPACE_NOT_FOUND,
          message: "No workspace folder found",
          context: "hygiene.impactAnalysis"
        });
      }
      const context = analyzer.analyze(workspaceRoot, params.filePath, params.functionName);
      if (!context) {
        return failure({
          code: HYGIENE_ERROR_CODES.IMPACT_ANALYSIS_ERROR,
          message: "Failed to analyze impact; check TypeScript config and file paths",
          context: "hygiene.impactAnalysis"
        });
      }
      if (!generateProseFn) {
        return failure({
          code: INFRASTRUCTURE_ERROR_CODES.MODEL_UNAVAILABLE,
          message: "Impact analysis requires a prose generation function (is Copilot enabled?)",
          context: "hygiene.impactAnalysis"
        });
      }
      const proseResult = await generateProseFn({
        domain: "hygiene",
        systemPrompt: getPrompt("IMPACT_ANALYSIS"),
        data: {
          target: context.target,
          type: context.analysisType,
          importerCount: context.importers.length,
          callSiteCount: context.callSites.length,
          testFileCount: context.testFiles.length,
          importers: context.importers.slice(0, 10),
          // Limit for token efficiency
          testFiles: context.testFiles.slice(0, 5)
        }
      });
      if (proseResult.kind === "err") {
        return proseResult;
      }
      return success({
        summary: proseResult.value,
        metrics: {
          importers: context.importers.length,
          callSites: context.callSites.length,
          testFiles: context.testFiles.length,
          dependentFiles: context.dependentFiles.length
        },
        targetPath: params.filePath,
        targetFunction: params.functionName
      });
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.IMPACT_ANALYSIS_ERROR,
        message: `Impact analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        details: err,
        context: "hygiene.impactAnalysis"
      });
    }
  };
}

// src/domains/hygiene/service.ts
var HygieneDomainService = class {
  constructor(workspaceProvider, logger, workspaceRoot, generateProseFn) {
    this.name = "hygiene";
    this.handlers = {};
    this.scanIntervalMs = HYGIENE_SETTINGS.SCAN_INTERVAL_MINUTES * 60 * 1e3;
    this.logger = logger;
    this.workspaceRoot = workspaceRoot;
    this.analyzer = new HygieneAnalyzer();
    this.deadCodeAnalyzer = new DeadCodeAnalyzer(logger);
    this.handlers = {
      "hygiene.scan": createScanHandler(workspaceProvider, logger, this.deadCodeAnalyzer),
      "hygiene.cleanup": createCleanupHandler(workspaceProvider, logger),
      "hygiene.showAnalytics": createShowHygieneAnalyticsHandler(this.analyzer, this.deadCodeAnalyzer, logger),
      "hygiene.impactAnalysis": createImpactAnalysisHandler(logger, generateProseFn)
    };
  }
  /**
   * Initialize domain — set up background scan scheduling.
   */
  async initialize() {
    try {
      this.logger.info(
        "Initializing hygiene domain",
        "HygieneDomainService.initialize"
      );
      if (HYGIENE_SETTINGS.ENABLED && this.workspaceRoot) {
        const workspaceRoot = this.workspaceRoot;
        const scanCtx = {
          extensionPath: "",
          workspaceFolders: [workspaceRoot]
        };
        const handler = this.handlers["hygiene.scan"];
        this._timer = setInterval(() => {
          if (handler) {
            handler(scanCtx, {}).catch((err) => {
              this.logger.warn(
                "Background hygiene scan failed",
                "HygieneDomainService",
                { code: HYGIENE_ERROR_CODES.HYGIENE_SCAN_ERROR, message: String(err) }
              );
            });
          }
        }, this.scanIntervalMs);
        this.logger.info(
          `Hygiene scan scheduled every ${this.scanIntervalMs / 1e3}s`,
          "HygieneDomainService.initialize"
        );
      }
      return success(void 0);
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.HYGIENE_INIT_ERROR,
        message: "Failed to initialize hygiene domain",
        details: err,
        context: "HygieneDomainService.initialize"
      });
    }
  }
  /**
   * Cleanup — stop background scanning.
   */
  async teardown() {
    this.logger.debug(
      "Tearing down hygiene domain",
      "HygieneDomainService.teardown"
    );
    if (this._timer !== void 0) {
      clearInterval(this._timer);
      this._timer = void 0;
    }
  }
};
function createHygieneDomain(workspaceProvider, logger, workspaceRoot, generateProseFn) {
  return new HygieneDomainService(workspaceProvider, logger, workspaceRoot, generateProseFn);
}

// src/domains/chat/handlers.ts
function createContextHandler(gitProvider, logger) {
  return async (ctx) => {
    try {
      logger.info("Gathering chat context", "ChatContextHandler");
      const statusResult = await gitProvider.status();
      const gitStatus = statusResult.kind === "ok" ? statusResult.value : void 0;
      const chatCtx = {
        activeFile: ctx.activeFilePath,
        gitBranch: gitStatus?.branch,
        gitStatus
      };
      logger.debug(
        `Context gathered: file=${chatCtx.activeFile ?? "none"}, branch=${chatCtx.gitBranch ?? "none"}`,
        "ChatContextHandler"
      );
      return success(chatCtx);
    } catch (err) {
      return failure({
        code: CHAT_ERROR_CODES.CHAT_CONTEXT_ERROR,
        message: "Failed to gather chat context",
        details: err,
        context: "chat.context"
      });
    }
  };
}
var KNOWN_COMMANDS = KNOWN_COMMAND_NAMES;
function createDelegateHandler(dispatcher, logger, generateProseFn) {
  return async (ctx, params) => {
    try {
      const { task } = params;
      if (!generateProseFn) {
        return failure({
          code: CHAT_ERROR_CODES.CHAT_DELEGATE_NO_GENERATE_FN,
          message: "chat.delegate requires a prose generation function (is Copilot enabled?)",
          context: "chat.delegate"
        });
      }
      logger.info(`Classifying task: "${task}"`, "ChatDelegateHandler");
      const classifyResult = await generateProseFn({
        domain: "chat",
        systemPrompt: getPrompt("DELEGATE_CLASSIFIER"),
        data: { task }
      });
      if (classifyResult.kind === "err") {
        return failure(classifyResult.error);
      }
      const raw = classifyResult.value.trim().split("\n")[0].trim();
      let commandName;
      let dispatchParams = {};
      if (raw.startsWith("workflow.run:")) {
        commandName = "workflow.run";
        dispatchParams = { name: raw.slice("workflow.run:".length).trim() };
      } else {
        commandName = KNOWN_COMMANDS.has(raw) ? raw : "chat.context";
      }
      logger.info(`Classified as: "${commandName}" (raw: "${raw}")`, "ChatDelegateHandler");
      const dispatchResult = await dispatcher({ name: commandName, params: dispatchParams }, ctx);
      if (dispatchResult.kind === "err") {
        logger.warn(
          `Dispatch failed for "${commandName}": ${dispatchResult.error.message}`,
          "ChatDelegateHandler",
          dispatchResult.error
        );
        return failure(dispatchResult.error);
      }
      logger.info(`Delegated "${task}" \u2192 "${commandName}" successfully`, "ChatDelegateHandler");
      return success({
        dispatched: true,
        commandName,
        result: dispatchResult.value
      });
    } catch (err) {
      return failure({
        code: CHAT_ERROR_CODES.CHAT_DELEGATE_ERROR,
        message: "Failed to delegate task",
        details: err,
        context: "chat.delegate"
      });
    }
  };
}

// src/domains/chat/service.ts
var ChatDomainService = class {
  constructor(gitProvider, logger, dispatcher, generateProseFn) {
    this.name = "chat";
    this.handlers = {};
    this.logger = logger;
    this.handlers = {
      "chat.context": createContextHandler(gitProvider, logger),
      "chat.delegate": createDelegateHandler(dispatcher, logger, generateProseFn)
    };
  }
  async initialize() {
    try {
      this.logger.info(
        "Initializing chat domain",
        "ChatDomainService.initialize"
      );
      return success(void 0);
    } catch (err) {
      return failure({
        code: "CHAT_INIT_ERROR",
        message: "Failed to initialize chat domain",
        details: err,
        context: "ChatDomainService.initialize"
      });
    }
  }
  async teardown() {
    this.logger.debug(
      "Tearing down chat domain",
      "ChatDomainService.teardown"
    );
  }
};
function createChatDomain(gitProvider, logger, dispatcher, generateProseFn) {
  return new ChatDomainService(gitProvider, logger, dispatcher, generateProseFn);
}

// src/domains/workflow/service.ts
var import_node_path = __toESM(require("node:path"));

// src/domains/workflow/handlers.ts
function createListWorkflowsHandler(logger, discoverWorkflows) {
  return async (_ctx) => {
    try {
      logger.debug("Listing workflows", "WorkflowListHandler");
      const workflows = discoverWorkflows();
      const workflowList = Array.from(workflows.values()).map((w) => ({
        name: w.name,
        description: w.description,
        version: w.version,
        stepCount: w.steps.length
      }));
      return success({
        workflows: workflowList,
        count: workflowList.length
      });
    } catch (err) {
      return failure({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_LIST_ERROR,
        message: "Failed to list workflows",
        details: err,
        context: "workflow.list"
      });
    }
  };
}
function createRunWorkflowHandler(logger, getWorkflowEngine, loadWorkflow) {
  return async (ctx, params) => {
    if (!params.name || params.name.trim().length === 0) {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Workflow name is required",
        context: "workflow.run"
      });
    }
    try {
      logger.info(`Running workflow: ${params.name}`, "WorkflowRunHandler");
      const workflow = loadWorkflow(params.name);
      if (!workflow) {
        return failure({
          code: WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
          message: `Workflow not found: ${params.name}`,
          context: "workflow.run"
        });
      }
      const engine = getWorkflowEngine();
      const startTime = Date.now();
      const executionResult = await engine.execute(
        workflow,
        ctx,
        params.variables || {}
      );
      const duration = Date.now() - startTime;
      if (executionResult.kind === "ok") {
        logger.info(
          `Workflow completed: ${params.name}`,
          "WorkflowRunHandler"
        );
        return success({
          workflowName: params.name,
          success: true,
          duration,
          stepCount: workflow.steps.length,
          message: "Workflow completed successfully"
        });
      } else {
        const failedStepId = executionResult.error.details?.currentStep;
        return failure({
          code: WORKFLOW_ERROR_CODES.WORKFLOW_EXECUTION_FAILED,
          message: `Workflow failed: ${executionResult.error.message}`,
          details: {
            duration,
            stepCount: workflow.steps.length,
            failedAt: failedStepId
          },
          context: "workflow.run"
        });
      }
    } catch (err) {
      return failure({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_RUN_ERROR,
        message: `Failed to run workflow: ${params.name}`,
        details: err,
        context: "workflow.run"
      });
    }
  };
}

// src/infrastructure/workspace.ts
var fs3 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var WORKSPACE_PATHS = {
  AGENTS_DIR: ".vscode/agents",
  WORKFLOWS_DIR: ".vscode/workflows",
  AGENT_SCHEMA: ".vscode/agents/.schema.json",
  WORKFLOW_SCHEMA: ".vscode/workflows/.schema.json"
};
function resolveWorkspacePath(relativePath, workspaceRoot) {
  return path6.join(workspaceRoot ?? ".", relativePath);
}
function getAgentsDir(workspaceRoot) {
  return resolveWorkspacePath(WORKSPACE_PATHS.AGENTS_DIR, workspaceRoot);
}
function getWorkflowsDir(workspaceRoot) {
  return resolveWorkspacePath(WORKSPACE_PATHS.WORKFLOWS_DIR, workspaceRoot);
}
function listJsonFiles(dirPath) {
  try {
    const entries = fs3.readdirSync(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => path6.join(dirPath, e.name));
  } catch {
    return [];
  }
}
function readJsonFile(filePath) {
  try {
    const raw = fs3.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// src/infrastructure/workflow-engine.ts
var WorkflowEngine = class {
  constructor(logger, stepRunner) {
    this.logger = logger;
    this.stepRunner = stepRunner;
  }
  /**
   * Execute workflow definition linearly.
   */
  async execute(workflow, commandContext, variables = {}) {
    const executionCtx = {
      workflowName: workflow.name,
      currentStepId: workflow.steps[0]?.id || "exit",
      stepResults: /* @__PURE__ */ new Map(),
      startTime: Date.now(),
      variables
    };
    try {
      let stepIndex = 0;
      while (stepIndex < workflow.steps.length) {
        const step = workflow.steps[stepIndex];
        executionCtx.currentStepId = step.id;
        const stepResult = await this.executeStep(
          step,
          commandContext,
          executionCtx
        );
        executionCtx.stepResults.set(step.id, stepResult);
        this.logger.info(
          `Step ${step.id} completed: ${stepResult.success ? "success" : "failure"}`,
          "WorkflowEngine.execute"
        );
        const nextStepId = stepResult.nextStepId || this.resolveNextStep(step, stepResult);
        if (!nextStepId || nextStepId === "exit") {
          break;
        }
        const nextStepIndex = workflow.steps.findIndex((s) => s.id === nextStepId);
        if (nextStepIndex === -1) {
          return failure({
            code: "INVALID_NEXT_STEP",
            message: `Step ${step.id} references undefined next step: ${nextStepId}`,
            context: "WorkflowEngine.execute"
          });
        }
        stepIndex = nextStepIndex;
      }
      return success(executionCtx);
    } catch (err) {
      this.logger.error(
        `Workflow execution failed`,
        "WorkflowEngine.execute",
        { error: err, currentStep: executionCtx.currentStepId }
      );
      return failure({
        code: "WORKFLOW_EXECUTION_ERROR",
        message: `Workflow ${workflow.name} failed at step ${executionCtx.currentStepId}`,
        details: err,
        context: "WorkflowEngine.execute"
      });
    }
  }
  /**
   * Execute single workflow step.
   */
  async executeStep(step, commandContext, executionCtx) {
    try {
      const params = this.interpolateParams(step.params, executionCtx.variables);
      const command = {
        name: step.command,
        params
      };
      const result = await this.stepRunner(command, commandContext);
      const stepResult = {
        stepId: step.id,
        success: result.kind === "ok",
        output: result.kind === "ok" ? result.value : void 0
      };
      if (result.kind === "err") {
        stepResult.error = result.error.message;
      }
      return stepResult;
    } catch (err) {
      return {
        stepId: step.id,
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
  /**
   * Resolve next step based on conditions.
   */
  resolveNextStep(step, result) {
    if (result.success) {
      return step.onSuccess;
    } else {
      return step.onFailure;
    }
  }
  /**
   * Interpolate variables in step params.
   * Example: { path: "$(srcPath)" } → { path: "/home/user/src" }
   */
  interpolateParams(params, variables) {
    const result = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        result[key] = this.interpolateString(value, variables);
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.interpolateParams(
          value,
          variables
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  /**
   * Interpolate single string with variables.
   */
  interpolateString(value, variables) {
    return value.replace(/\$\(([^)]+)\)/g, (_, varName) => {
      return String(variables[varName] ?? `$(${varName})`);
    });
  }
};

// src/domains/workflow/validation.ts
function validateWorkflowDefinition(data) {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data;
  if (typeof obj.name !== "string" || !obj.name) {
    return false;
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return false;
  }
  for (const step of obj.steps) {
    if (typeof step !== "object" || step === null) {
      return false;
    }
    const stepObj = step;
    if (typeof stepObj.id !== "string" || !stepObj.id) {
      return false;
    }
    if (typeof stepObj.command !== "string" || !stepObj.command) {
      return false;
    }
    if (typeof stepObj.params !== "object") {
      return false;
    }
  }
  return true;
}

// src/domains/workflow/service.ts
var WorkflowDomainService = class {
  constructor(logger, stepRunner, workspaceRoot, extensionPath) {
    this.name = "workflow";
    this.handlers = {};
    this.workflowCache = /* @__PURE__ */ new Map();
    this.workflowEngine = null;
    this.stepRunner = null;
    this.logger = logger;
    this.stepRunner = stepRunner || this.createDefaultStepRunner();
    this.workspaceRoot = workspaceRoot;
    this.extensionPath = extensionPath;
    this.handlers = {
      "workflow.list": createListWorkflowsHandler(
        this.logger,
        () => this.discoverWorkflows()
      ),
      "workflow.run": createRunWorkflowHandler(
        this.logger,
        this.getWorkflowEngine.bind(this),
        (name) => this.loadWorkflow(name)
      )
    };
  }
  /**
   * Initialize domain — discover workflows.
   */
  async initialize() {
    try {
      this.logger.info(
        "Initializing workflow domain",
        "WorkflowDomainService.initialize"
      );
      const discovered = this.discoverWorkflows();
      this.logger.info(
        `Discovered ${discovered.size} workflows`,
        "WorkflowDomainService.initialize"
      );
      return success(void 0);
    } catch (err) {
      return failure({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_INIT_ERROR,
        message: "Failed to initialize workflow domain",
        details: err,
        context: "WorkflowDomainService.initialize"
      });
    }
  }
  /**
   * Teardown — clear caches.
   */
  async teardown() {
    this.logger.debug(
      "Tearing down workflow domain",
      "WorkflowDomainService.teardown"
    );
    this.workflowCache.clear();
  }
  /**
   * Discover workflows from bundled and workspace locations.
   * Workspace workflows override bundled ones (same name).
   */
  discoverWorkflows() {
    this.workflowCache.clear();
    if (this.extensionPath) {
      const bundledDir = import_node_path.default.join(
        this.extensionPath,
        "bundled",
        "workflows"
      );
      try {
        const files2 = listJsonFiles(bundledDir);
        for (const filePath of files2) {
          const data = readJsonFile(filePath);
          if (data && validateWorkflowDefinition(data)) {
            this.workflowCache.set(data.name, data);
          }
        }
      } catch {
        this.logger.debug(
          `Bundled workflows directory not found: ${bundledDir}`,
          "WorkflowDomainService.discoverWorkflows"
        );
      }
    }
    const workflowsDir = getWorkflowsDir(this.workspaceRoot);
    const files = listJsonFiles(workflowsDir);
    for (const filePath of files) {
      const data = readJsonFile(filePath);
      if (data && validateWorkflowDefinition(data)) {
        this.workflowCache.set(data.name, data);
      }
    }
    return this.workflowCache;
  }
  /**
   * Load workflow by name from cache or discover.
   */
  loadWorkflow(name) {
    let workflow = this.workflowCache.get(name);
    if (!workflow) {
      this.discoverWorkflows();
      workflow = this.workflowCache.get(name);
    }
    return workflow || null;
  }
  /**
   * Get workflow engine instance.
   */
  getWorkflowEngine() {
    if (!this.workflowEngine) {
      this.workflowEngine = new WorkflowEngine(
        this.logger,
        this.stepRunner || this.createDefaultStepRunner()
      );
    }
    return this.workflowEngine;
  }
  /**
   * Create default step runner that throws (should be provided by router).
   */
  createDefaultStepRunner() {
    return async () => {
      return failure({
        code: WORKFLOW_ERROR_CODES.STEP_RUNNER_NOT_AVAILABLE,
        message: "Step runner not initialized. Register workflow domain with router.",
        context: "WorkflowDomainService"
      });
    };
  }
};
function createWorkflowDomain(logger, stepRunner, workspaceRoot, extensionPath) {
  return new WorkflowDomainService(logger, stepRunner, workspaceRoot, extensionPath);
}

// src/domains/agent/handlers.ts
function createListAgentsHandler(logger, discoverAgents) {
  return async (_ctx) => {
    try {
      logger.debug("Listing agents", "AgentListHandler");
      const agents = discoverAgents();
      const agentList = Array.from(agents.values()).map((a) => ({
        id: a.id,
        description: a.description,
        version: a.version,
        capabilities: a.capabilities,
        workflowTriggers: a.workflowTriggers
      }));
      return success({
        agents: agentList,
        count: agentList.length
      });
    } catch (err) {
      return failure({
        code: AGENT_ERROR_CODES.AGENT_LIST_ERROR,
        message: "Failed to list agents",
        details: err,
        context: "agent.list"
      });
    }
  };
}

// src/infrastructure/agent-registry.ts
var path8 = __toESM(require("path"));
function validateAgentDefinition(data) {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data;
  if (typeof obj.id !== "string" || !obj.id) {
    return false;
  }
  if (!Array.isArray(obj.capabilities)) {
    return false;
  }
  if (obj.description !== void 0 && typeof obj.description !== "string") {
    return false;
  }
  if (obj.version !== void 0 && typeof obj.version !== "string") {
    return false;
  }
  if (obj.workflowTriggers !== void 0 && !Array.isArray(obj.workflowTriggers)) {
    return false;
  }
  if (obj.metadata !== void 0 && typeof obj.metadata !== "object") {
    return false;
  }
  return true;
}
function loadAgents(workspaceRoot, extensionPath) {
  const agents = /* @__PURE__ */ new Map();
  if (extensionPath) {
    const bundledDir = path8.join(extensionPath, "bundled", "agents");
    const files2 = listJsonFiles(bundledDir);
    for (const filePath of files2) {
      const data = readJsonFile(filePath);
      if (validateAgentDefinition(data)) {
        agents.set(data.id, data);
      }
    }
  }
  const workspaceDir = getAgentsDir(workspaceRoot);
  const files = listJsonFiles(workspaceDir);
  for (const filePath of files) {
    const data = readJsonFile(filePath);
    if (validateAgentDefinition(data)) {
      agents.set(data.id, data);
    }
  }
  return agents;
}

// src/domains/agent/execution-handler.ts
var AgentExecutor = class {
  constructor(logger, commandDispatcher, workspaceRoot, extensionPath) {
    this.logger = logger;
    this.commandDispatcher = commandDispatcher;
    this.workspaceRoot = workspaceRoot;
    this.extensionPath = extensionPath;
  }
  async execute(agentId, targetCommand, targetWorkflow, params, ctx) {
    const state = {
      agentId,
      targetCommand,
      targetWorkflow,
      startTime: Date.now(),
      logs: [],
      success: false
    };
    try {
      const agents = loadAgents(this.workspaceRoot, this.extensionPath);
      const agent = agents.get(agentId);
      if (!agent) {
        return failure({
          code: AGENT_ERROR_CODES.AGENT_NOT_FOUND,
          message: `Agent '${agentId}' not found in registry`,
          context: "AgentExecutor.execute"
        });
      }
      this.log(state, `Agent '${agentId}' loaded`);
      if (targetCommand && !agent.capabilities.includes(targetCommand)) {
        return failure({
          code: AGENT_ERROR_CODES.MISSING_CAPABILITY,
          message: `Agent '${agentId}' does not have capability '${targetCommand}'`,
          context: "AgentExecutor.execute"
        });
      }
      if (targetWorkflow && !(agent.workflowTriggers || []).includes(targetWorkflow)) {
        this.logger.warn(
          `Agent '${agentId}' does not declare workflow trigger '${targetWorkflow}'`,
          "AgentExecutor"
        );
      }
      if (targetCommand) {
        const cmdResult = await this.executeCommand(
          targetCommand,
          params || {},
          ctx || {
            extensionPath: this.extensionPath || "",
            workspaceFolders: this.workspaceRoot ? [this.workspaceRoot] : []
          },
          state
        );
        if (cmdResult.kind === "err") {
          state.success = false;
          state.error = cmdResult.error.message;
          this.log(state, `Command '${targetCommand}' failed: ${cmdResult.error.message}`);
          return success(this.buildResult(state, agent));
        }
        state.success = true;
        state.output = cmdResult.value;
        this.log(state, `Command '${targetCommand}' completed successfully`);
        return success(this.buildResult(state, agent));
      } else if (targetWorkflow) {
        const workflowCmd = {
          name: "workflow.run",
          params: { workflowName: targetWorkflow, ...params }
        };
        const ctx_ = ctx || {
          extensionPath: this.extensionPath || "",
          workspaceFolders: this.workspaceRoot ? [this.workspaceRoot] : []
        };
        const wfResult = await this.commandDispatcher(workflowCmd, ctx_);
        if (wfResult.kind === "err") {
          state.success = false;
          state.error = wfResult.error.message;
          this.log(state, `Workflow '${targetWorkflow}' failed: ${wfResult.error.message}`);
          return success(this.buildResult(state, agent));
        }
        state.success = true;
        state.output = wfResult.value;
        this.log(state, `Workflow '${targetWorkflow}' completed successfully`);
        return success(this.buildResult(state, agent));
      } else {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Agent execution requires either targetCommand or targetWorkflow",
          context: "AgentExecutor.execute"
        });
      }
    } catch (err) {
      state.success = false;
      state.error = err instanceof Error ? err.message : String(err);
      this.log(state, `Execution error: ${state.error}`);
      return failure({
        code: AGENT_ERROR_CODES.EXECUTION_FAILED,
        message: `Agent '${agentId}' execution failed: ${state.error}`,
        details: err,
        context: "AgentExecutor.execute"
      });
    }
  }
  async executeCommand(commandName, params, ctx, state) {
    this.log(state, `Dispatching command '${commandName}' with params: ${JSON.stringify(params)}`);
    const cmd = {
      name: commandName,
      params
    };
    return this.commandDispatcher(cmd, ctx);
  }
  log(state, message) {
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level: "info",
      message
    };
    state.logs.push(entry);
    this.logger.info(message, "AgentExecutor");
  }
  buildResult(state, agent) {
    return {
      agentId: state.agentId,
      success: state.success,
      durationMs: Date.now() - state.startTime,
      logs: state.logs,
      output: state.output,
      error: state.error,
      executedCommand: state.targetCommand,
      executedWorkflow: state.targetWorkflow,
      agentCapabilities: agent.capabilities
    };
  }
};
function createExecuteAgentHandler(logger, commandDispatcher, workspaceRoot, extensionPath) {
  const executor = new AgentExecutor(logger, commandDispatcher, workspaceRoot, extensionPath);
  return async (ctx, params) => {
    try {
      if (!params.agentId) {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Agent execution requires agentId",
          context: "agent.execute"
        });
      }
      if (!params.targetCommand && !params.targetWorkflow) {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Agent execution requires either targetCommand or targetWorkflow",
          context: "agent.execute"
        });
      }
      logger.info(
        `Executing agent '${params.agentId}' ${params.targetCommand ? `command '${params.targetCommand}'` : `workflow '${params.targetWorkflow}'`}`,
        "ExecuteAgentHandler"
      );
      return executor.execute(
        params.agentId,
        params.targetCommand,
        params.targetWorkflow,
        params.params,
        ctx
      );
    } catch (err) {
      return failure({
        code: AGENT_ERROR_CODES.EXECUTION_FAILED,
        message: `Failed to execute agent: ${err instanceof Error ? err.message : String(err)}`,
        details: err,
        context: "agent.execute"
      });
    }
  };
}

// src/domains/agent/service.ts
var AgentDomainService = class {
  constructor(logger, workspaceRoot, extensionPath, commandDispatcher) {
    this.name = "agent";
    this.handlers = {};
    this.agentCache = /* @__PURE__ */ new Map();
    this.logger = logger;
    this.workspaceRoot = workspaceRoot;
    this.extensionPath = extensionPath;
    this.handlers = {
      "agent.list": createListAgentsHandler(
        this.logger,
        () => this.discoverAgents()
      )
    };
    if (commandDispatcher) {
      this.handlers["agent.execute"] = createExecuteAgentHandler(
        this.logger,
        commandDispatcher,
        workspaceRoot,
        extensionPath
      );
    }
  }
  /**
   * Initialize domain — discover agents.
   */
  async initialize() {
    try {
      this.logger.info(
        "Initializing agent domain",
        "AgentDomainService.initialize"
      );
      const discovered = this.discoverAgents();
      this.logger.info(
        `Discovered ${discovered.size} agents`,
        "AgentDomainService.initialize"
      );
      return success(void 0);
    } catch (err) {
      return failure({
        code: "AGENT_INIT_ERROR",
        message: "Failed to initialize agent domain",
        details: err,
        context: "AgentDomainService.initialize"
      });
    }
  }
  /**
   * Teardown — clear caches.
   */
  async teardown() {
    this.logger.debug(
      "Tearing down agent domain",
      "AgentDomainService.teardown"
    );
    this.agentCache.clear();
  }
  /**
   * Discover agents from bundled and workspace locations.
   */
  discoverAgents() {
    this.agentCache = loadAgents(this.workspaceRoot, this.extensionPath);
    return this.agentCache;
  }
};
function createAgentDomain(logger, workspaceRoot, extensionPath, commandDispatcher) {
  return new AgentDomainService(logger, workspaceRoot, extensionPath, commandDispatcher);
}

// src/cross-cutting/middleware.ts
function createObservabilityMiddleware(logger, telemetry) {
  return async (ctx, next) => {
    logger.debug(
      `[${ctx.commandName}] Starting execution`,
      "ObservabilityMiddleware",
      { commandName: ctx.commandName }
    );
    const start = Date.now();
    telemetry.trackCommandStarted(ctx.commandName);
    try {
      await next();
      const duration = Date.now() - start;
      logger.info(
        `[${ctx.commandName}] Completed in ${duration}ms`,
        "ObservabilityMiddleware",
        { commandName: ctx.commandName, duration }
      );
      telemetry.trackCommandCompleted(ctx.commandName, duration, "success");
    } catch (err) {
      const duration = Date.now() - start;
      const appErr = {
        code: "MIDDLEWARE_ERROR",
        message: err instanceof Error ? err.message : String(err),
        details: err,
        context: ctx.commandName
      };
      logger.error(
        `[${ctx.commandName}] Failed after ${duration}ms`,
        "ObservabilityMiddleware",
        appErr
      );
      telemetry.trackCommandFailed(ctx.commandName, duration, appErr);
      throw err;
    }
  };
}
function createAuditMiddleware(logger) {
  return async (ctx, next) => {
    const auditCommands = [
      "git.commit",
      "git.pull",
      "hygiene.cleanup",
      "chat.delegate"
    ];
    if (auditCommands.includes(ctx.commandName)) {
      logger.info(
        `[AUDIT] Command invoked: ${ctx.commandName}`,
        "AuditMiddleware",
        { commandName: ctx.commandName, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
      );
    }
    await next();
  };
}

// src/infrastructure/git-provider.ts
var import_child_process2 = require("child_process");
var import_util = require("util");
var execFileAsync = (0, import_util.promisify)(import_child_process2.execFile);
var GIT_TIMEOUT_MS = 3e4;
function gitError(op, err) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    code: "GIT_OPERATION_FAILED",
    message: `git ${op} failed: ${message}`,
    context: "GitProvider",
    details: err
  };
}
async function git(args, cwd) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024
      // 10 MB
    });
    return success(stdout.trimEnd());
  } catch (err) {
    return failure(gitError(args[0] ?? "unknown", err));
  }
}
function parseCommitLog(raw) {
  const commits = [];
  let current = null;
  let ins = 0;
  let del = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      if (current?.shortHash) {
        commits.push({ ...current, insertions: ins, deletions: del });
        current = null;
        ins = 0;
        del = 0;
      }
      continue;
    }
    if (line.includes("|") && !line.match(/^\d+\t/)) {
      if (current?.shortHash) {
        commits.push({ ...current, insertions: ins, deletions: del });
        ins = 0;
        del = 0;
      }
      const parts = line.split("|");
      current = { shortHash: parts[0], message: parts[1], author: parts[2] };
    } else if (current && line.match(/^\d+\t|^-\t/)) {
      const parts = line.split("	");
      ins += parseInt(parts[0] ?? "0", 10) || 0;
      del += parseInt(parts[1] ?? "0", 10) || 0;
    }
  }
  if (current?.shortHash) {
    commits.push({ ...current, insertions: ins, deletions: del });
  }
  return commits;
}
var RealGitProvider = class {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
  }
  async status(_branch) {
    const branchResult = await this.getCurrentBranch();
    if (branchResult.kind === "err") return branchResult;
    const porcelainResult = await git(
      ["status", "--porcelain=v1"],
      this.workspaceRoot
    );
    if (porcelainResult.kind === "err") return porcelainResult;
    const lines = porcelainResult.value.split("\n").filter((l) => l.length > 0);
    let staged = 0;
    let unstaged = 0;
    let untracked = 0;
    for (const line of lines) {
      const x = line[0] ?? " ";
      const y = line[1] ?? " ";
      if (x === "?") {
        untracked++;
      } else {
        if (x !== " ") staged++;
        if (y !== " " && y !== "?") unstaged++;
      }
    }
    return success({
      branch: branchResult.value,
      isDirty: lines.length > 0,
      staged,
      unstaged,
      untracked
    });
  }
  async pull(branch) {
    const targetBranch = branch ?? "HEAD";
    const result = await git(["pull"], this.workspaceRoot);
    if (result.kind === "err") return result;
    const branchResult = await this.getCurrentBranch();
    const resolvedBranch = branchResult.kind === "ok" ? branchResult.value : targetBranch;
    return success({
      success: true,
      branch: resolvedBranch,
      message: result.value || "Already up to date."
    });
  }
  async commit(message, _branch) {
    const result = await git(
      ["commit", "-m", message],
      this.workspaceRoot
    );
    if (result.kind === "err") return result;
    const match = /\[.*? ([0-9a-f]+)\]/.exec(result.value);
    const hash = match?.[1] ?? result.value.split("\n")[0] ?? "";
    return success(hash);
  }
  async getChanges() {
    const result = await git(
      ["diff", "--cached", "--name-status"],
      this.workspaceRoot
    );
    if (result.kind === "err") return result;
    const changes = [];
    for (const line of result.value.split("\n").filter(Boolean)) {
      const [code, ...rest] = line.split("	");
      const filePath = rest.join("	").trim();
      if (!filePath) continue;
      let status = "modified";
      if (code === "A") status = "added";
      else if (code === "D") status = "deleted";
      changes.push({ path: filePath, status });
    }
    return success(changes);
  }
  async getDiff(paths) {
    const args = ["diff", "--cached"];
    if (paths && paths.length > 0) {
      args.push("--", ...paths);
    }
    return git(args, this.workspaceRoot);
  }
  async stage(paths) {
    if (paths.length === 0) return success(void 0);
    const result = await git(["add", "--", ...paths], this.workspaceRoot);
    if (result.kind === "err") return result;
    return success(void 0);
  }
  async reset(paths) {
    let args;
    if (Array.isArray(paths)) {
      if (paths.length === 0) return success(void 0);
      args = ["reset", "HEAD", "--", ...paths];
    } else {
      args = ["reset", `--${paths.mode}`, paths.ref];
    }
    const result = await git(args, this.workspaceRoot);
    if (result.kind === "err") return result;
    return success(void 0);
  }
  async getAllChanges() {
    const stagedResult = await git(
      ["diff", "--cached", "--numstat"],
      this.workspaceRoot
    );
    if (stagedResult.kind === "err") return stagedResult;
    const unstagedResult = await git(
      ["diff", "--numstat"],
      this.workspaceRoot
    );
    if (unstagedResult.kind === "err") return unstagedResult;
    const statusResult = await git(
      ["status", "--porcelain=v1"],
      this.workspaceRoot
    );
    if (statusResult.kind === "err") return statusResult;
    const statusMap = /* @__PURE__ */ new Map();
    for (const line of statusResult.value.split("\n").filter(Boolean)) {
      const x = line[0] ?? " ";
      const y = line[1] ?? " ";
      const filePath = line.slice(3).trim().split(" -> ").pop() ?? "";
      const code = x !== " " ? x : y;
      let s = "M";
      if (code === "A") s = "A";
      else if (code === "D") s = "D";
      else if (code === "R") s = "R";
      statusMap.set(filePath, s);
    }
    const changes = /* @__PURE__ */ new Map();
    const parseNumstat = (raw) => {
      for (const line of raw.split("\n").filter(Boolean)) {
        const parts = line.split("	");
        if (parts.length < 3) continue;
        const additions = parseInt(parts[0] ?? "0", 10);
        const deletions = parseInt(parts[1] ?? "0", 10);
        const filePath = (parts[2] ?? "").trim();
        if (!filePath) continue;
        const existing = changes.get(filePath);
        if (existing) {
          existing.additions += isNaN(additions) ? 0 : additions;
          existing.deletions += isNaN(deletions) ? 0 : deletions;
        } else {
          changes.set(filePath, {
            path: filePath,
            status: statusMap.get(filePath) ?? "M",
            additions: isNaN(additions) ? 0 : additions,
            deletions: isNaN(deletions) ? 0 : deletions
          });
        }
      }
    };
    parseNumstat(stagedResult.value);
    parseNumstat(unstagedResult.value);
    return success(Array.from(changes.values()));
  }
  async fetch(remote) {
    const args = ["fetch", remote ?? "origin"];
    const result = await git(args, this.workspaceRoot);
    if (result.kind === "err") return result;
    return success(void 0);
  }
  async getRemoteUrl(remote) {
    const result = await git(
      ["remote", "get-url", remote ?? "origin"],
      this.workspaceRoot
    );
    return result;
  }
  async getCurrentBranch() {
    const result = await git(
      ["rev-parse", "--abbrev-ref", "HEAD"],
      this.workspaceRoot
    );
    return result;
  }
  async diff(revision, options) {
    const args = ["diff", ...options ?? [], revision];
    return git(args, this.workspaceRoot);
  }
  async getRecentCommits(count) {
    const logResult = await git(
      ["log", `-${count}`, "--pretty=format:%h|%s|%an", "--numstat"],
      this.workspaceRoot
    );
    if (logResult.kind === "err") return logResult;
    return success(parseCommitLog(logResult.value));
  }
  async getCommitRange(from, to = "HEAD") {
    const logResult = await git(
      ["log", `${from}..${to}`, "--pretty=format:%h|%s|%an", "--numstat"],
      this.workspaceRoot
    );
    if (logResult.kind === "err") return logResult;
    return success(parseCommitLog(logResult.value));
  }
  async getMergeBase(branch, base = "main") {
    const result = await git(["merge-base", branch, base], this.workspaceRoot);
    if (result.kind === "err") return result;
    return success(result.value.trim());
  }
};
function createGitProvider(workspaceRoot) {
  return new RealGitProvider(workspaceRoot);
}

// src/infrastructure/workspace-provider.ts
var fs4 = __toESM(require("fs/promises"));
var path9 = __toESM(require("path"));
function fsError(code, op, filePath, err) {
  return {
    code,
    message: `${op} failed for '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    context: "WorkspaceProvider",
    details: err
  };
}
async function collectFiles(dir, pattern, logger) {
  const results = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs4.readdir(current, { withFileTypes: true });
    } catch {
      logger?.warn("Workspace traversal failed", "WorkspaceProvider", {
        code: "WORKSPACE_READ_ERROR",
        message: `Failed to read directory: ${current}`
      });
      return;
    }
    for (const entry of entries) {
      const fullPath = path9.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && matchesPattern(entry.name, pattern)) {
        results.push(fullPath);
      }
    }
  }
  await walk(dir);
  return results;
}
function matchesPattern(name, pattern) {
  const base = pattern.replace(/^\*+\//, "");
  if (base === "*" || base === "**") return true;
  const escaped = base.replace(/\./g, "\\.").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(name);
}
var RealWorkspaceProvider = class {
  constructor(workspaceRoot, logger) {
    this.workspaceRoot = workspaceRoot;
    this.logger = logger;
  }
  async findFiles(pattern) {
    try {
      const files = await collectFiles(this.workspaceRoot, pattern, this.logger);
      return success(files);
    } catch (err) {
      return failure(
        fsError("WORKSPACE_NOT_FOUND", "findFiles", this.workspaceRoot, err)
      );
    }
  }
  async readFile(filePath) {
    const resolved = path9.isAbsolute(filePath) ? filePath : path9.join(this.workspaceRoot, filePath);
    try {
      const content = await fs4.readFile(resolved, "utf8");
      return success(content);
    } catch (err) {
      return failure(fsError("FILE_READ_ERROR", "readFile", resolved, err));
    }
  }
  async deleteFile(filePath) {
    const resolved = path9.isAbsolute(filePath) ? filePath : path9.join(this.workspaceRoot, filePath);
    try {
      await fs4.unlink(resolved);
      return success(void 0);
    } catch (err) {
      return failure(fsError("FILE_DELETE_ERROR", "deleteFile", resolved, err));
    }
  }
};
function createWorkspaceProvider(workspaceRoot, logger) {
  return new RealWorkspaceProvider(workspaceRoot, logger);
}

// src/infrastructure/telemetry.ts
var TelemetryTracker = class {
  constructor(sink, sessionId) {
    this.commandFrequency = /* @__PURE__ */ new Map();
    this.sink = sink;
    this.sessionId = sessionId || this.generateSessionId();
  }
  /**
   * Track command execution start.
   */
  trackCommandStarted(commandName) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.COMMAND_STARTED,
      payload: {
        commandName
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track command execution completion.
   */
  trackCommandCompleted(commandName, duration, outcome = "success") {
    const frequency = (this.commandFrequency.get(commandName) || 0) + 1;
    this.commandFrequency.set(commandName, frequency);
    const event = {
      kind: TELEMETRY_EVENT_KINDS.COMMAND_COMPLETED,
      payload: {
        commandName,
        duration,
        outcome,
        frequency
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track command execution failure.
   */
  trackCommandFailed(commandName, duration, error) {
    const frequency = (this.commandFrequency.get(commandName) || 0) + 1;
    this.commandFrequency.set(commandName, frequency);
    const event = {
      kind: TELEMETRY_EVENT_KINDS.COMMAND_FAILED,
      payload: {
        commandName,
        duration,
        outcome: "failure",
        error: {
          code: error.code,
          message: error.message
        },
        frequency
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track cache hit.
   */
  trackCacheHit(cacheKey, itemSize) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.CACHE_HIT,
      payload: {
        cacheKey,
        itemSize
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track cache miss.
   */
  trackCacheMiss(cacheKey) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.CACHE_MISS,
      payload: {
        cacheKey
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track error occurrence.
   */
  trackError(error, recoverable = false, additionalContext) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.ERROR_OCCURRED,
      payload: {
        errorCode: error.code,
        errorMessage: error.message,
        recoverable,
        context: additionalContext || error.context
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track workflow execution start.
   */
  trackWorkflowStarted(workflowId) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.WORKFLOW_STARTED,
      payload: {
        workflowId
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track workflow execution completion.
   */
  trackWorkflowCompleted(workflowId, duration, stepId) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.WORKFLOW_COMPLETED,
      payload: {
        workflowId,
        stepId,
        duration,
        outcome: "success"
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track workflow execution failure.
   */
  trackWorkflowFailed(workflowId, duration, error, stepId) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.WORKFLOW_FAILED,
      payload: {
        workflowId,
        stepId,
        duration,
        outcome: "failure",
        error: {
          code: error.code,
          message: error.message
        }
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track agent invocation.
   */
  trackAgentInvoked(agentId, capability, duration, outcome) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.AGENT_INVOKED,
      payload: {
        agentId,
        capability,
        duration,
        outcome
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Track user action (e.g., UI interaction).
   */
  trackUserAction(action, target, value) {
    const event = {
      kind: TELEMETRY_EVENT_KINDS.USER_ACTION,
      payload: {
        action,
        target,
        value
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    this.emit(event);
  }
  /**
   * Get command execution frequency for a given command.
   */
  getCommandFrequency(commandName) {
    return this.commandFrequency.get(commandName) || 0;
  }
  /**
   * Flush any pending events to the sink.
   */
  async flush() {
    if (this.sink.flush) {
      await this.sink.flush();
    }
  }
  /**
   * Private: emit an event to the sink.
   */
  emit(event) {
    try {
      this.sink.emit(event);
    } catch (err) {
      console.error("Telemetry emit failed", err);
    }
  }
  /**
   * Generate a unique session ID.
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
};
var ConsoleTelemetrySink = class {
  constructor(silent = false) {
    this.silent = silent;
  }
  emit(event) {
    if (this.silent) {
      return;
    }
    const importantKinds = [
      TELEMETRY_EVENT_KINDS.COMMAND_STARTED,
      TELEMETRY_EVENT_KINDS.COMMAND_FAILED,
      TELEMETRY_EVENT_KINDS.ERROR_OCCURRED,
      TELEMETRY_EVENT_KINDS.WORKFLOW_FAILED
    ];
    if (importantKinds.includes(event.kind)) {
      console.log(`[TELEMETRY:${event.kind}]`, event.payload);
    }
  }
  async flush() {
  }
};

// src/ui/chat-participant.ts
var vscode = __toESM(require("vscode"));

// src/infrastructure/result-handler.ts
var ERROR_MESSAGES = {
  // Git
  NO_CHANGES: "No changes to commit.",
  NO_GROUPS_APPROVED: "No commit groups were approved.",
  COMMIT_CANCELLED: "Smart commit cancelled.",
  GIT_UNAVAILABLE: "Git is not available in this workspace.",
  GIT_STATUS_ERROR: "Failed to read git status.",
  GIT_PULL_ERROR: "Git pull failed.",
  GIT_COMMIT_ERROR: "Commit failed.",
  GIT_FETCH_ERROR: "Fetch failed.",
  BATCH_COMMIT_ERROR: "One or more commits failed.",
  // Hygiene
  HYGIENE_SCAN_ERROR: "Workspace scan failed.",
  HYGIENE_CLEANUP_ERROR: "Cleanup failed.",
  // Router
  HANDLER_NOT_FOUND: "Command not recognized.",
  // Workflow
  INVALID_WORKFLOW: "Workflow definition is invalid.",
  WORKFLOW_NOT_FOUND: "Workflow not found.",
  WORKFLOW_EXECUTION_FAILED: "Workflow execution failed.",
  WORKFLOW_RUN_ERROR: "Failed to run workflow.",
  // Agent
  AGENT_NOT_FOUND: "Agent not found.",
  MISSING_CAPABILITY: "Agent does not have the requested capability.",
  EXECUTION_FAILED: "Agent execution failed.",
  // Chat
  CHAT_CONTEXT_ERROR: "Failed to gather chat context.",
  CHAT_DELEGATE_ERROR: "Failed to delegate chat action."
};
function formatResultMessage(commandName, result) {
  if (result.kind === "err") {
    const msg = ERROR_MESSAGES[result.error.code] ?? result.error.message;
    return { level: "error", message: `[${commandName}] ${msg}` };
  }
  const v = result.value;
  switch (commandName) {
    case "git.status": {
      const branch = v.branch ?? "unknown";
      const dirty = v.isDirty ? "dirty" : "clean";
      return { level: "info", message: `${branch} (${dirty}) \u2014 staged: ${v.staged}, unstaged: ${v.unstaged}, untracked: ${v.untracked}` };
    }
    case "git.pull":
      return { level: "info", message: `Pulled: ${v.message ?? "up to date"}` };
    case "git.commit":
      return { level: "info", message: `Committed: ${v}` };
    case "git.smartCommit": {
      const sc = v;
      return { level: "info", message: `Smart commit: ${sc.totalGroups} group(s), ${sc.totalFiles} file(s)` };
    }
    case "git.generatePR": {
      const pr = v;
      return { level: "info", message: `PR description generated for "${pr.branch}" \u2014 copied to clipboard` };
    }
    case "git.reviewPR": {
      const rv = v;
      return { level: "info", message: `PR review for "${rv.branch}": ${rv.verdict} \u2014 ${rv.comments?.length ?? 0} comment(s)` };
    }
    case "git.commentPR": {
      const cm = v;
      return { level: "info", message: `${cm.comments?.length ?? 0} inline comment(s) generated for "${cm.branch}"` };
    }
    case "git.resolveConflicts": {
      const cr = v;
      return { level: "info", message: `Conflict resolution for ${cr.perFile?.length ?? 0} file(s) \u2014 see Output` };
    }
    case "git.sessionBriefing":
      return { level: "info", message: "Session briefing generated \u2014 see Output" };
    case "hygiene.scan": {
      const dead = (v.deadFiles ?? []).length;
      const large = (v.largeFiles ?? []).length;
      const logs = (v.logFiles ?? []).length;
      return { level: "info", message: `Scan complete \u2014 dead: ${dead}, large: ${large}, logs: ${logs}` };
    }
    case "hygiene.cleanup":
      return { level: "info", message: "Cleanup complete." };
    case "workflow.list":
      return { level: "info", message: `Found ${v.count ?? 0} workflow(s)` };
    case "workflow.run": {
      const r = v;
      const dur = r.duration ? ` in ${(r.duration / 1e3).toFixed(1)}s` : "";
      return { level: "info", message: `Workflow "${r.workflowName}" \u2014 ${r.stepCount ?? "?"} step(s)${dur}` };
    }
    case "agent.list":
      return { level: "info", message: `Found ${v.count ?? 0} agent(s)` };
    case "agent.execute": {
      const ar = v;
      const what = ar.executedCommand ?? ar.executedWorkflow ?? "unknown";
      if (!ar.success) {
        return { level: "error", message: `Agent "${ar.agentId}" ran "${what}" \u2014 failed: ${ar.error ?? "unknown error"}` };
      }
      return { level: "info", message: `Agent "${ar.agentId}" ran "${what}" \u2014 done in ${ar.durationMs}ms` };
    }
    case "chat.context":
      return { level: "info", message: "Chat context gathered." };
    case "chat.delegate": {
      const dr = v;
      return { level: "info", message: `Delegated \u2192 ${dr.commandName ?? "unknown"}` };
    }
    default:
      return { level: "info", message: `[${commandName}] OK` };
  }
}

// src/ui/chat-participant.ts
var SLASH_MAP = {
  "/status": "git.status",
  "/scan": "hygiene.scan",
  "/workflows": "workflow.list",
  "/agents": "agent.list",
  "/analytics": "git.showAnalytics",
  "/context": "chat.context",
  "/pr": "git.generatePR",
  "/review": "git.reviewPR",
  "/briefing": "git.sessionBriefing",
  "/conflicts": "git.resolveConflicts",
  "/impact": "hygiene.impactAnalysis"
};
function createChatParticipant(router, ctx, logger) {
  const handler = async (request, _chatCtx, stream, _token) => {
    logger.info(
      `Chat request \u2014 command: ${JSON.stringify(request.command)}, prompt: ${JSON.stringify(request.prompt)}`,
      "ChatParticipant"
    );
    if (request.command) {
      const cmd = request.command.toLowerCase();
      const commandName = SLASH_MAP[`/${cmd}`];
      if (commandName) {
        logger.info(`Routing via request.command: ${cmd} \u2192 ${commandName}`, "ChatParticipant");
        stream.markdown(`\`@meridian\` \u2192 \`${commandName}\`

`);
        return handleDirectDispatch(commandName, {}, router, ctx, stream, logger);
      }
    }
    const text = request.prompt.trim();
    const firstWord = text.split(" ")[0].toLowerCase();
    if (firstWord in SLASH_MAP) {
      const commandName = SLASH_MAP[firstWord];
      stream.markdown(`\`@meridian\` \u2192 \`${commandName}\`

`);
      return handleDirectDispatch(commandName, {}, router, ctx, stream, logger);
    }
    if (firstWord === "run" && text.length > 4) {
      const name = text.slice(4).trim();
      stream.markdown(`\`@meridian\` \u2192 \`workflow.run\`

`);
      return handleDirectDispatch("workflow.run", { name }, router, ctx, stream, logger);
    }
    if (text.length > 0) {
      stream.progress("Figuring out what you need...");
      const delegateResult = await router.dispatch(
        { name: "chat.delegate", params: { task: text } },
        ctx
      );
      if (delegateResult.kind === "ok") {
        const dr = delegateResult.value;
        stream.markdown(`\`@meridian\` \u2192 \`${dr.commandName}\`

`);
        return formatCommandResult(dr.commandName, dr.result, stream);
      } else {
        logger.warn("chat.delegate failed, falling back", "ChatParticipant", delegateResult.error);
        stream.markdown(`\`@meridian\` \u2192 \`chat.context\`

`);
        return handleDirectDispatch("chat.context", {}, router, ctx, stream, logger);
      }
    }
    stream.markdown(`\`@meridian\` \u2014 use \`/status\`, \`/scan\`, \`/pr\`, \`/review\`, \`/briefing\`, \`/conflicts\`, \`/workflows\`, \`/agents\`, \`/analytics\`, or just describe what you need.`);
  };
  const participant = vscode.chat.createChatParticipant("meridian", handler);
  participant.iconPath = vscode.Uri.joinPath(
    vscode.Uri.file(ctx.extensionPath),
    "media",
    "icon.svg"
  );
  return participant;
}
async function handleDirectDispatch(commandName, params, router, ctx, stream, logger) {
  if (commandName === "hygiene.impactAnalysis" && !params.filePath) {
    if (!ctx.activeFilePath) {
      stream.markdown("Open a TypeScript file first, then try `/impact` again.");
      return;
    }
    params = { ...params, filePath: ctx.activeFilePath };
  }
  const cmd = { name: commandName, params };
  const result = await router.dispatch(cmd, ctx);
  if (result.kind === "ok") {
    formatCommandResult(commandName, result.value, stream);
  } else {
    logger.warn(`Chat dispatch failed: ${commandName}`, "ChatParticipant", result.error);
    stream.markdown(`**Error** \`${result.error.code}\`: ${result.error.message}`);
  }
}
var RESULT_FORMATTERS = {
  "chat.context": (value, stream) => {
    const v = value;
    const gitStatus = v.gitStatus;
    const branch = v.gitBranch ?? gitStatus?.branch ?? "unknown";
    const dirty = gitStatus?.isDirty ? "dirty" : "clean";
    const file = v.activeFile ?? "none";
    stream.markdown(
      `**Branch:** \`${branch}\` (${dirty})

**Active file:** \`${file}\`

Slash commands: \`/status\` \`/scan\` \`/pr\` \`/review\` \`/briefing\` \`/conflicts\` \`/workflows\` \`/agents\` \`/analytics\` \`/impact\`

Or ask naturally: _"show me my agents"_, _"what workflows do I have?"_, _"scan for issues"_`
    );
  },
  "git.sessionBriefing": (value, stream) => {
    stream.markdown(value);
  },
  "git.generatePR": (value, stream) => {
    stream.markdown(value.body);
  },
  "git.reviewPR": (value, stream) => {
    const rv = value;
    stream.markdown(`**Verdict:** ${rv.verdict}

${rv.summary}

`);
    for (const c of rv.comments ?? []) {
      stream.markdown(`- **[${c.severity}]** \`${c.file}\`: ${c.comment}
`);
    }
  },
  "git.resolveConflicts": (value, stream) => {
    const cr = value;
    stream.markdown(`${cr.overview}

`);
    for (const f of cr.perFile ?? []) {
      stream.markdown(`**\`${f.path}\`** \u2192 \`${f.strategy}\`
${f.rationale}
`);
    }
  },
  "hygiene.impactAnalysis": (value, stream) => {
    stream.markdown(value.summary);
  },
  "workflow.list": (value, stream) => {
    const r = value;
    if (r.count === 0) {
      stream.markdown("No workflows found. Add `.vscode/workflows/*.json` to your workspace.");
      return;
    }
    stream.markdown(`**${r.count} workflow${r.count === 1 ? "" : "s"} available:**

`);
    for (const w of r.workflows) {
      const steps = `${w.stepCount} step${w.stepCount === 1 ? "" : "s"}`;
      stream.markdown(`- **${w.name}** (${steps})${w.description ? ` \u2014 ${w.description}` : ""}
`);
    }
  },
  "agent.list": (value, stream) => {
    const r = value;
    if (r.count === 0) {
      stream.markdown("No agents found. Add `.vscode/agents/*.json` to your workspace.");
      return;
    }
    stream.markdown(`**${r.count} agent${r.count === 1 ? "" : "s"} available:**

`);
    for (const a of r.agents) {
      stream.markdown(`- **${a.id}**${a.description ? ` \u2014 ${a.description}` : ""} (${a.capabilities.length} capabilities)
`);
    }
  },
  "agent.execute": (value, stream) => {
    const r = value;
    const what = r.executedCommand ?? r.executedWorkflow ?? "unknown";
    const status = r.success ? "succeeded" : "failed";
    stream.markdown(`**Agent \`${r.agentId}\`** ran \`${what}\` \u2014 ${status} in ${r.durationMs}ms

`);
    if (r.error) {
      stream.markdown(`**Error:** ${r.error}

`);
    }
    if (r.output && Object.keys(r.output).length > 0) {
      stream.markdown("**Output:**\n```json\n" + JSON.stringify(r.output, null, 2) + "\n```\n");
    }
  }
};
function formatCommandResult(commandName, value, stream) {
  const formatter = RESULT_FORMATTERS[commandName];
  if (formatter) {
    formatter(value, stream);
    return;
  }
  const msg = formatResultMessage(commandName, { kind: "ok", value });
  stream.markdown(msg.message);
}

// src/ui/smart-commit-quick-pick.ts
var vscode2 = __toESM(require("vscode"));
function createSmartCommitApprovalUI() {
  return async (groups) => {
    const items = groups.map((g) => ({
      label: `$(git-commit) ${g.suggestedMessage.full}`,
      description: formatGroupStats(g),
      detail: formatFilePaths(g),
      picked: true,
      group: g
    }));
    const selected = await vscode2.window.showQuickPick(items, {
      canPickMany: true,
      title: "Smart Commit \u2014 Select groups to commit",
      placeHolder: "Toggle groups, then press Enter to confirm"
    });
    if (selected === void 0) return null;
    if (selected.length === 0) return [];
    const approved = [];
    for (let i = 0; i < selected.length; i++) {
      const g = selected[i].group;
      const edited = await vscode2.window.showInputBox({
        title: `Commit message (${i + 1} of ${selected.length})`,
        prompt: `${g.files.length} file(s): ${formatFilePaths(g)}`,
        value: g.suggestedMessage.full,
        validateInput: (v) => v.trim().length === 0 ? "Message cannot be empty" : null
      });
      if (edited === void 0) return null;
      approved.push({ group: g, approvedMessage: edited });
    }
    return approved;
  };
}
function formatGroupStats(g) {
  const adds = g.files.reduce((s, f) => s + f.additions, 0);
  const dels = g.files.reduce((s, f) => s + f.deletions, 0);
  return `${g.files.length} file(s) \xB7 +${adds} -${dels}`;
}
function formatFilePaths(g) {
  const MAX = 5;
  const paths = g.files.map((f) => f.path);
  if (paths.length <= MAX) return paths.join(", ");
  return `${paths.slice(0, MAX).join(", ")} +${paths.length - MAX} more`;
}

// src/ui/lm-tools.ts
var vscode3 = __toESM(require("vscode"));
function registerMeridianTools(router, ctx, logger) {
  return LM_TOOL_DEFS.map(
    ({ name, commandName }) => vscode3.lm.registerTool(name, {
      async invoke(options, _token) {
        const params = options.input ?? {};
        logger.info(`LM tool invoked: ${name}`, "LMTools");
        const result = await router.dispatch({ name: commandName, params }, ctx);
        const { message } = formatResultMessage(commandName, result);
        return new vscode3.LanguageModelToolResult([
          new vscode3.LanguageModelTextPart(message)
        ]);
      }
    })
  );
}

// src/infrastructure/prose-generator.ts
var vscode5 = __toESM(require("vscode"));

// src/infrastructure/model-selector.ts
var vscode4 = __toESM(require("vscode"));
async function selectModel(domain) {
  const cfg = vscode4.workspace.getConfiguration("meridian.model");
  const domainFamily = domain ? cfg.get(domain, "") : "";
  const defaultFamily = cfg.get("default", "gpt-4o");
  const family = domainFamily || defaultFamily;
  const models = await vscode4.lm.selectChatModels({ family });
  if (models.length > 0) return models[0];
  const any = await vscode4.lm.selectChatModels({});
  return any[0] ?? null;
}

// src/infrastructure/prose-generator.ts
async function generateProse(request) {
  try {
    const model = await selectModel(request.domain);
    if (!model) {
      return failure({
        code: "MODEL_UNAVAILABLE",
        message: "No language model available. Ensure GitHub Copilot is enabled.",
        context: "generateProse"
      });
    }
    const dataStr = request.formatData ? request.formatData(request.data) : JSON.stringify(request.data, null, 2);
    const messages = [
      vscode5.LanguageModelChatMessage.User(`${request.systemPrompt}

---

${dataStr}`)
    ];
    const cts = new vscode5.CancellationTokenSource();
    const response = await model.sendRequest(messages, {}, cts.token);
    let text = "";
    for await (const fragment of response.text) {
      text += fragment;
    }
    return success(text.trim());
  } catch (err) {
    return failure({
      code: "PROSE_GENERATION_ERROR",
      message: `Prose generation failed: ${err instanceof Error ? err.message : String(err)}`,
      context: "generateProse"
    });
  }
}

// src/infrastructure/config.ts
var vscode6 = __toESM(require("vscode"));
var CONFIG_KEYS = {
  GIT_AUTOFETCH: "git.autofetch",
  GIT_BRANCH_CLEAN: "git.branchClean",
  HYGIENE_ENABLED: "hygiene.enabled",
  HYGIENE_SCAN_INTERVAL: "hygiene.scanInterval",
  CHAT_MODEL: "chat.model",
  CHAT_CONTEXT_LINES: "chat.contextLines",
  LOG_LEVEL: "log.level"
};
var DEFAULTS = {
  [CONFIG_KEYS.GIT_AUTOFETCH]: false,
  [CONFIG_KEYS.GIT_BRANCH_CLEAN]: true,
  [CONFIG_KEYS.HYGIENE_ENABLED]: true,
  [CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: 60,
  [CONFIG_KEYS.CHAT_MODEL]: "gpt-4",
  [CONFIG_KEYS.CHAT_CONTEXT_LINES]: 50,
  [CONFIG_KEYS.LOG_LEVEL]: "info"
};
var Config = class {
  constructor() {
    this.store = {};
  }
  /**
   * Load config from VS Code workspace settings.
   */
  async initialize() {
    try {
      const cfg = vscode6.workspace.getConfiguration("meridian");
      this.store = {
        [CONFIG_KEYS.GIT_AUTOFETCH]: cfg.get("git.autofetch") ?? DEFAULTS[CONFIG_KEYS.GIT_AUTOFETCH],
        [CONFIG_KEYS.GIT_BRANCH_CLEAN]: cfg.get("git.branchClean") ?? DEFAULTS[CONFIG_KEYS.GIT_BRANCH_CLEAN],
        [CONFIG_KEYS.HYGIENE_ENABLED]: cfg.get("hygiene.enabled") ?? DEFAULTS[CONFIG_KEYS.HYGIENE_ENABLED],
        [CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: cfg.get("hygiene.scanInterval") ?? DEFAULTS[CONFIG_KEYS.HYGIENE_SCAN_INTERVAL],
        [CONFIG_KEYS.CHAT_MODEL]: cfg.get("chat.model") ?? DEFAULTS[CONFIG_KEYS.CHAT_MODEL],
        [CONFIG_KEYS.CHAT_CONTEXT_LINES]: cfg.get("chat.contextLines") ?? DEFAULTS[CONFIG_KEYS.CHAT_CONTEXT_LINES],
        [CONFIG_KEYS.LOG_LEVEL]: cfg.get("log.level") ?? DEFAULTS[CONFIG_KEYS.LOG_LEVEL]
      };
      return success(void 0);
    } catch (err) {
      this.store = { ...DEFAULTS };
      const error = {
        code: INFRASTRUCTURE_ERROR_CODES.CONFIG_INIT_ERROR,
        message: "Failed to initialize configuration",
        details: err
      };
      return failure(error);
    }
  }
  get(key, defaultValue) {
    const value = this.store[key];
    if (value === void 0) {
      return defaultValue;
    }
    return value;
  }
  async set(key, value) {
    try {
      this.store[key] = value;
      return success(void 0);
    } catch (err) {
      const error = {
        code: INFRASTRUCTURE_ERROR_CODES.CONFIG_SET_ERROR,
        message: `Failed to set config key '${key}'`,
        details: err
      };
      return failure(error);
    }
  }
  /**
   * Read current prune config from VS Code settings (reads fresh each call).
   */
  getPruneConfig() {
    const cfg = vscode6.workspace.getConfiguration("meridian.hygiene.prune");
    return {
      minAgeDays: cfg.get("minAgeDays", PRUNE_DEFAULTS.minAgeDays),
      maxSizeMB: cfg.get("maxSizeMB", PRUNE_DEFAULTS.maxSizeMB),
      minLineCount: cfg.get("minLineCount", PRUNE_DEFAULTS.minLineCount),
      categories: cfg.get("categories", PRUNE_DEFAULTS.categories)
    };
  }
  /**
   * Export current configuration (for debugging).
   */
  exportAll() {
    return { ...this.store };
  }
};

// src/presentation/command-registry.ts
var vscode8 = __toESM(require("vscode"));

// src/presentation/result-presenters.ts
var vscode7 = __toESM(require("vscode"));
var HR = "\u2500".repeat(60);
function ts4() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
async function presentResult(commandName, result, ctx) {
  if (result.kind !== "ok") return false;
  const { outputChannel, analyticsPanel, hygieneAnalyticsPanel } = ctx;
  switch (commandName) {
    case "git.showAnalytics": {
      await analyticsPanel.openPanel(result.value);
      outputChannel.appendLine(`[${ts4()}] Analytics panel opened`);
      return true;
    }
    case "hygiene.showAnalytics": {
      await hygieneAnalyticsPanel.openPanel(result.value);
      outputChannel.appendLine(`[${ts4()}] Hygiene analytics panel opened`);
      return true;
    }
    case "git.generatePR": {
      const pr = result.value;
      outputChannel.show(true);
      outputChannel.appendLine(`
${HR}`);
      outputChannel.appendLine(`[${ts4()}] PR Description: ${pr.branch}`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(pr.body);
      outputChannel.appendLine("");
      await vscode7.env.clipboard.writeText(pr.body);
      vscode7.window.showInformationMessage(`PR description copied to clipboard (${pr.branch})`);
      return true;
    }
    case "git.reviewPR": {
      const rv = result.value;
      outputChannel.show(true);
      outputChannel.appendLine(`
${HR}`);
      outputChannel.appendLine(`[${ts4()}] PR Review: ${rv.branch} \u2014 ${rv.verdict}`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(`
${rv.summary}
`);
      for (const c of rv.comments ?? []) {
        outputChannel.appendLine(`[${c.severity}] ${c.file}: ${c.comment}`);
      }
      outputChannel.appendLine("");
      const text = `${rv.summary}

${(rv.comments ?? []).map((c) => `[${c.severity}] ${c.file}: ${c.comment}`).join("\n")}`;
      await vscode7.env.clipboard.writeText(text);
      vscode7.window.showInformationMessage(`PR review copied to clipboard (${rv.branch}: ${rv.verdict})`);
      return true;
    }
    case "git.commentPR": {
      const cm = result.value;
      outputChannel.show(true);
      outputChannel.appendLine(`
${HR}`);
      outputChannel.appendLine(`[${ts4()}] PR Comments: ${cm.branch} \u2014 ${cm.comments?.length ?? 0} comment(s)`);
      outputChannel.appendLine(HR);
      for (const c of cm.comments ?? []) {
        const loc = c.line ? `:${c.line}` : "";
        outputChannel.appendLine(`${c.file}${loc}: ${c.comment}`);
      }
      outputChannel.appendLine("");
      const cmText = (cm.comments ?? []).map((c) => `${c.file}${c.line ? `:${c.line}` : ""}: ${c.comment}`).join("\n");
      await vscode7.env.clipboard.writeText(cmText);
      vscode7.window.showInformationMessage(`${cm.comments?.length ?? 0} PR comment(s) copied to clipboard`);
      return true;
    }
    case "git.sessionBriefing": {
      const briefing = result.value;
      outputChannel.show(true);
      outputChannel.appendLine(`
${HR}`);
      outputChannel.appendLine(`[${ts4()}] Session Briefing`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(briefing);
      outputChannel.appendLine("");
      await vscode7.env.clipboard.writeText(briefing);
      vscode7.window.showInformationMessage("Session briefing copied to clipboard");
      return true;
    }
    case "git.resolveConflicts": {
      const cr = result.value;
      outputChannel.show(true);
      outputChannel.appendLine(`
${HR}`);
      outputChannel.appendLine(`[${ts4()}] Conflict Resolution \u2014 ${cr.perFile?.length ?? 0} file(s)`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(`
${cr.overview}
`);
      for (const f of cr.perFile ?? []) {
        outputChannel.appendLine(`${f.path} \u2192 ${f.strategy}`);
        outputChannel.appendLine(`  ${f.rationale}`);
        for (const step of f.suggestedSteps ?? []) {
          outputChannel.appendLine(`  \u2022 ${step}`);
        }
      }
      outputChannel.appendLine("");
      vscode7.window.showInformationMessage(`Conflict resolution for ${cr.perFile?.length ?? 0} file(s) \u2014 see Output`);
      return true;
    }
    case "chat.delegate": {
      const dr = result.value;
      const { message } = formatResultMessage(dr.commandName, { kind: "ok", value: dr.result });
      outputChannel.appendLine(`[${ts4()}] Delegated \u2192 ${dr.commandName}: ${message}`);
      vscode7.window.showInformationMessage(`Delegated \u2192 ${dr.commandName}`);
      return true;
    }
    default:
      return false;
  }
}

// src/presentation/command-registry.ts
var COMMAND_MAP = [
  ["meridian.git.status", "git.status"],
  ["meridian.git.pull", "git.pull"],
  ["meridian.git.commit", "git.commit"],
  ["meridian.git.smartCommit", "git.smartCommit"],
  ["meridian.git.analyzeInbound", "git.analyzeInbound"],
  ["meridian.hygiene.scan", "hygiene.scan"],
  ["meridian.hygiene.cleanup", "hygiene.cleanup"],
  // hygiene.impactAnalysis — dedicated registration (active-file fallback + function name prompt)
  ["meridian.chat.context", "chat.context"],
  ["meridian.workflow.list", "workflow.list"],
  ["meridian.agent.list", "agent.list"],
  ["meridian.agent.execute", "agent.execute"],
  ["meridian.git.showAnalytics", "git.showAnalytics"],
  ["meridian.git.exportJson", "git.exportJson"],
  ["meridian.git.exportCsv", "git.exportCsv"],
  ["meridian.hygiene.showAnalytics", "hygiene.showAnalytics"],
  ["meridian.git.generatePR", "git.generatePR"],
  ["meridian.git.reviewPR", "git.reviewPR"],
  ["meridian.git.commentPR", "git.commentPR"],
  ["meridian.git.resolveConflicts", "git.resolveConflicts"],
  ["meridian.git.sessionBriefing", "git.sessionBriefing"],
  ["meridian.chat.delegate", "chat.delegate"]
];
function registerCommands(context, router, outputChannel, getCommandContext2, readPruneConfig, presenterCtx) {
  for (const [vsCodeId, commandName] of COMMAND_MAP) {
    const disposable = vscode8.commands.registerCommand(
      vsCodeId,
      async (params = {}) => {
        const cmdCtx = getCommandContext2();
        if (commandName === "hygiene.showAnalytics") {
          const pruneResult = await router.dispatch(
            { name: "hygiene.showAnalytics", params: readPruneConfig() },
            cmdCtx
          );
          await presentResult(commandName, pruneResult, presenterCtx);
          if (pruneResult.kind !== "ok") {
            const { message: message2 } = formatResultMessage(commandName, pruneResult);
            vscode8.window.showErrorMessage(message2);
          }
          return;
        }
        const command = { name: commandName, params };
        const result = await router.dispatch(command, cmdCtx);
        const handled = await presentResult(commandName, result, presenterCtx);
        if (handled) return;
        const { level, message } = formatResultMessage(commandName, result);
        outputChannel.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
        if (level === "info") {
          vscode8.window.showInformationMessage(message);
        } else {
          vscode8.window.showErrorMessage(message);
        }
      }
    );
    context.subscriptions.push(disposable);
  }
}

// src/presentation/status-bar.ts
var vscode9 = __toESM(require("vscode"));
function setupStatusBar(context, gitProvider, refreshAll) {
  const statusBar = vscode9.window.createStatusBarItem(
    vscode9.StatusBarAlignment.Left,
    50
  );
  statusBar.name = "Meridian";
  statusBar.command = "meridian.statusBar.clicked";
  context.subscriptions.push(statusBar);
  async function update() {
    const status = await gitProvider.status();
    if (status.kind === "ok") {
      const s = status.value;
      const dirty = s.isDirty ? "$(circle-filled)" : "$(check)";
      const changes = s.staged + s.unstaged + s.untracked;
      statusBar.text = changes > 0 ? `$(source-control) ${s.branch} ${dirty} ${changes}` : `$(source-control) ${s.branch} ${dirty}`;
      statusBar.tooltip = [
        `Branch: ${s.branch}`,
        `Staged: ${s.staged}`,
        `Unstaged: ${s.unstaged}`,
        `Untracked: ${s.untracked}`,
        ``,
        `Click for Meridian actions`
      ].join("\n");
    } else {
      statusBar.text = "$(source-control) Meridian";
      statusBar.tooltip = "Git unavailable \u2014 click for Meridian actions";
    }
    statusBar.show();
  }
  context.subscriptions.push(
    vscode9.commands.registerCommand("meridian.statusBar.clicked", async () => {
      const pick = await vscode9.window.showQuickPick(
        [
          { label: "$(git-commit) Smart Commit", command: "meridian.git.smartCommit" },
          { label: "$(search) Hygiene Scan", command: "meridian.hygiene.scan" },
          { label: "$(graph) Git Analytics", command: "meridian.git.showAnalytics" },
          { label: "$(graph) Hygiene Analytics", command: "meridian.hygiene.showAnalytics" },
          { label: "$(refresh) Refresh All Views", command: "meridian.refreshAll" }
        ],
        { placeHolder: "Meridian \u2014 choose an action" }
      );
      if (pick) {
        vscode9.commands.executeCommand(pick.command);
      }
    })
  );
  context.subscriptions.push(
    vscode9.commands.registerCommand("meridian.refreshAll", () => {
      refreshAll();
      update();
    })
  );
  return { update };
}

// src/presentation/file-watchers.ts
var vscode10 = __toESM(require("vscode"));
function debounce(fn, ms) {
  let timer;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
function setupFileWatchers(context, workspaceRoot, targets) {
  const debouncedGitRefresh = debounce(() => {
    targets.gitRefresh();
    targets.statusBarUpdate();
  }, UI_SETTINGS.WATCHER_DEBOUNCE_MS);
  const debouncedHygieneRefresh = debounce(() => {
    targets.hygieneRefresh();
  }, UI_SETTINGS.WATCHER_DEBOUNCE_MS);
  const debouncedDefinitionsRefresh = debounce(() => {
    targets.definitionsRefresh();
  }, UI_SETTINGS.WATCHER_DEBOUNCE_MS);
  const gitWatcher = vscode10.workspace.createFileSystemWatcher(
    new vscode10.RelativePattern(workspaceRoot, ".git/{HEAD,index,refs/**}")
  );
  gitWatcher.onDidChange(debouncedGitRefresh);
  gitWatcher.onDidCreate(debouncedGitRefresh);
  const fileWatcher = vscode10.workspace.createFileSystemWatcher(
    new vscode10.RelativePattern(workspaceRoot, "**/*")
  );
  fileWatcher.onDidCreate(debouncedHygieneRefresh);
  fileWatcher.onDidDelete(debouncedHygieneRefresh);
  const defWatcher = vscode10.workspace.createFileSystemWatcher(
    new vscode10.RelativePattern(workspaceRoot, ".vscode/{agents,workflows}/*.json")
  );
  defWatcher.onDidChange(debouncedDefinitionsRefresh);
  defWatcher.onDidCreate(debouncedDefinitionsRefresh);
  defWatcher.onDidDelete(debouncedDefinitionsRefresh);
  context.subscriptions.push(gitWatcher, fileWatcher, defWatcher);
}

// src/presentation/tree-setup.ts
var vscode15 = __toESM(require("vscode"));

// src/ui/tree-providers/git-tree-provider.ts
var path10 = __toESM(require("path"));
var vscode11 = __toESM(require("vscode"));
var GitTreeItem = class extends vscode11.TreeItem {
  constructor(label, itemKind, collapsible, description) {
    super(label, collapsible);
    this.itemKind = itemKind;
    this.description = description;
    this.contextValue = itemKind;
  }
};
var GitTreeProvider = class {
  constructor(gitProvider, logger, workspaceRoot) {
    this.gitProvider = gitProvider;
    this.logger = logger;
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData = new vscode11.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.cached = null;
  }
  refresh() {
    this.cached = null;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (!element) return this.getRootItems();
    if (element.itemKind === "branch") return this.getBranchChildren();
    if (element.itemKind === "changeGroup") return this.getFilesForGroup(element);
    return [];
  }
  async getRootItems() {
    if (!this.cached) {
      const result = await this.gitProvider.status();
      if (result.kind === "err") {
        this.logger.warn("GitTreeProvider: status failed", "GitTreeProvider", result.error);
        const err = new GitTreeItem(
          "Git unavailable",
          "changeGroup",
          vscode11.TreeItemCollapsibleState.None,
          result.error.code
        );
        err.iconPath = new vscode11.ThemeIcon("error");
        return [err];
      }
      this.cached = result.value;
    }
    const s = this.cached;
    const dirty = s.isDirty ? "dirty" : "clean";
    const item = new GitTreeItem(
      s.branch,
      "branch",
      vscode11.TreeItemCollapsibleState.Expanded,
      dirty
    );
    item.iconPath = new vscode11.ThemeIcon(s.isDirty ? "git-branch" : "check");
    return [item];
  }
  async getBranchChildren() {
    const changeGroups = this.getChangeGroupItems();
    const commitsGroup = await this.getRecentCommitsGroup();
    return [...changeGroups, commitsGroup];
  }
  getChangeGroupItems() {
    if (!this.cached) return [];
    const s = this.cached;
    const make = (label, count, icon, category) => {
      const it = new GitTreeItem(
        label,
        "changeGroup",
        count > 0 ? vscode11.TreeItemCollapsibleState.Collapsed : vscode11.TreeItemCollapsibleState.None,
        String(count)
      );
      it.iconPath = new vscode11.ThemeIcon(icon);
      it.category = category;
      return it;
    };
    return [
      make("Staged", s.staged, "diff-added", "staged"),
      make("Unstaged", s.unstaged, "diff-modified", "unstaged"),
      make("Untracked", s.untracked, "question", "untracked")
    ];
  }
  async getRecentCommitsGroup() {
    const result = await this.gitProvider.getRecentCommits(3);
    const commits = result.kind === "ok" ? result.value : [];
    const group = new GitTreeItem(
      "Recent Commits",
      "changeGroup",
      commits.length > 0 ? vscode11.TreeItemCollapsibleState.Expanded : vscode11.TreeItemCollapsibleState.None,
      String(commits.length)
    );
    group.iconPath = new vscode11.ThemeIcon("history");
    group.category = "recentCommits";
    group.__commits = commits;
    return group;
  }
  async getFilesForGroup(group) {
    if (group.category === "recentCommits") {
      const commits = group.__commits ?? [];
      return commits.map((c) => {
        const label = c.message.length > 50 ? `${c.message.slice(0, 47)}\u2026` : c.message;
        const it = new GitTreeItem(
          label,
          "commit",
          vscode11.TreeItemCollapsibleState.None,
          `+${c.insertions}/-${c.deletions} \xB7 ${c.shortHash}`
        );
        it.iconPath = new vscode11.ThemeIcon("git-commit");
        it.tooltip = `${c.shortHash} by ${c.author}
+${c.insertions} / -${c.deletions}`;
        return it;
      });
    }
    if (group.category === "untracked") {
      const placeholder = new GitTreeItem(
        "(untracked files not listed)",
        "changedFile",
        vscode11.TreeItemCollapsibleState.None
      );
      placeholder.iconPath = new vscode11.ThemeIcon("info");
      return [placeholder];
    }
    const result = await this.gitProvider.getAllChanges();
    if (result.kind === "err") {
      this.logger.warn("GitTreeProvider: getAllChanges failed", "GitTreeProvider", result.error);
      return [];
    }
    const files = result.value.filter(
      (f) => group.category === "staged" ? f.status === "A" : f.status !== "A"
    );
    return files.map((f) => {
      const absolutePath = path10.join(this.workspaceRoot, f.path);
      const iconName = f.status === "A" ? "diff-added" : f.status === "D" ? "diff-removed" : "diff-modified";
      const it = new GitTreeItem(
        path10.basename(f.path),
        "changedFile",
        vscode11.TreeItemCollapsibleState.None,
        f.path
      );
      it.iconPath = new vscode11.ThemeIcon(iconName);
      it.filePath = absolutePath;
      it.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode11.Uri.file(absolutePath)]
      };
      return it;
    });
  }
};

// src/ui/tree-providers/hygiene-tree-provider.ts
var vscode12 = __toESM(require("vscode"));
var HygieneTreeItem = class extends vscode12.TreeItem {
  constructor(label, itemKind, children, collapsible, description, filePath) {
    super(label, collapsible);
    this.itemKind = itemKind;
    this.children = children;
    this.filePath = filePath;
    this.description = description;
    this.contextValue = itemKind;
  }
};
var HygieneTreeProvider = class {
  constructor(dispatch, ctx, logger) {
    this.dispatch = dispatch;
    this.ctx = ctx;
    this.logger = logger;
    this._onDidChangeTreeData = new vscode12.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.cached = null;
  }
  refresh() {
    this.cached = null;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (!element) {
      return this.getRootItems();
    }
    return element.children;
  }
  async getRootItems() {
    if (this.cached) return this.cached;
    const result = await this.dispatch({ name: "hygiene.scan", params: {} }, this.ctx);
    if (result.kind === "err") {
      this.logger.warn("HygieneTreeProvider: scan failed", "HygieneTreeProvider", result.error);
      const err = new HygieneTreeItem(
        "Scan failed",
        "category",
        [],
        vscode12.TreeItemCollapsibleState.None,
        result.error.code
      );
      err.iconPath = new vscode12.ThemeIcon("error");
      return [err];
    }
    const scan = result.value;
    const makeFileItem = (filePath, description) => {
      const it = new HygieneTreeItem(
        filePath.split("/").pop() ?? filePath,
        "file",
        [],
        vscode12.TreeItemCollapsibleState.None,
        description ?? filePath,
        filePath
      );
      it.iconPath = new vscode12.ThemeIcon("file");
      it.tooltip = filePath;
      it.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode12.Uri.file(filePath)]
      };
      return it;
    };
    const makeCategory = (label, icon, children) => {
      const it = new HygieneTreeItem(
        label,
        "category",
        children,
        children.length > 0 ? vscode12.TreeItemCollapsibleState.Collapsed : vscode12.TreeItemCollapsibleState.None,
        String(children.length)
      );
      it.iconPath = new vscode12.ThemeIcon(icon);
      return it;
    };
    const makeMarkdownItem = (filePath, sizeBytes, lineCount) => {
      const sizeKb = (sizeBytes / 1024).toFixed(1);
      const it = new HygieneTreeItem(
        filePath.split("/").pop() ?? filePath,
        "markdownFile",
        [],
        vscode12.TreeItemCollapsibleState.None,
        `${sizeKb} KB \xB7 ${lineCount} lines`,
        filePath
      );
      it.iconPath = new vscode12.ThemeIcon("markdown");
      it.tooltip = filePath;
      it.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode12.Uri.file(filePath)]
      };
      return it;
    };
    const deadCodeSection = this.buildDeadCodeSection(scan, makeCategory);
    const deadItems = scan.deadFiles.map((p) => makeFileItem(p));
    const largeItems = scan.largeFiles.map(
      (f) => makeFileItem(f.path, `${(f.sizeBytes / 1024).toFixed(1)} KB`)
    );
    const logItems = scan.logFiles.map((p) => makeFileItem(p));
    const mdItems = (scan.markdownFiles ?? []).map(
      (f) => makeMarkdownItem(f.path, f.sizeBytes, f.lineCount)
    );
    this.cached = [
      deadCodeSection,
      makeCategory("Dead Files", "trash", deadItems),
      makeCategory("Large Files", "database", largeItems),
      makeCategory("Log Files", "output", logItems),
      makeCategory("Markdown Files", "markdown", mdItems)
    ];
    return this.cached;
  }
  // ---------------------------------------------------------------------------
  // Dead code tree construction
  // ---------------------------------------------------------------------------
  buildDeadCodeSection(scan, makeCategory) {
    const { deadCode } = scan;
    const groups = /* @__PURE__ */ new Map();
    for (const item of deadCode.items) {
      if (!groups.has(item.filePath)) {
        groups.set(item.filePath, []);
      }
      groups.get(item.filePath).push(item);
    }
    const sortedPaths = [...groups.keys()].sort();
    const fileNodes = sortedPaths.map((filePath) => {
      const issues = groups.get(filePath);
      const issueNodes = issues.map((issue) => {
        const label2 = `${issue.line}: ${issue.message}`;
        const it = new HygieneTreeItem(
          label2,
          "deadCodeIssue",
          [],
          vscode12.TreeItemCollapsibleState.None,
          void 0,
          filePath
        );
        it.iconPath = new vscode12.ThemeIcon(iconForDeadCode(issue.category));
        it.tooltip = `${filePath}:${issue.line}:${issue.character} \u2014 ${issue.message}`;
        it.command = {
          command: "vscode.open",
          title: "Go to Issue",
          arguments: [
            vscode12.Uri.file(filePath),
            { selection: new vscode12.Range(issue.line - 1, issue.character - 1, issue.line - 1, issue.character - 1) }
          ]
        };
        return it;
      });
      const fileName = filePath.split("/").pop() ?? filePath;
      const fileNode = new HygieneTreeItem(
        fileName,
        "deadCodeFile",
        issueNodes,
        vscode12.TreeItemCollapsibleState.Collapsed,
        `${issues.length} issue${issues.length !== 1 ? "s" : ""}`,
        filePath
      );
      fileNode.iconPath = new vscode12.ThemeIcon("file-code");
      fileNode.tooltip = filePath;
      return fileNode;
    });
    const label = deadCode.tsconfigPath === null ? "Dead Code (no tsconfig)" : "Dead Code";
    return makeCategory(label, "symbol-misc", fileNodes);
  }
};
function iconForDeadCode(category) {
  switch (category) {
    case "unusedImport":
      return "symbol-namespace";
    case "unusedTypeParam":
      return "symbol-type-parameter";
    default:
      return "symbol-variable";
  }
}

// src/ui/tree-providers/workflow-tree-provider.ts
var vscode13 = __toESM(require("vscode"));
var WorkflowTreeItem = class extends vscode13.TreeItem {
  constructor(label, itemKind, collapsible, description) {
    super(label, collapsible);
    this.itemKind = itemKind;
    this.description = description;
    this.contextValue = itemKind;
  }
};
var WorkflowTreeProvider = class {
  constructor(dispatch, ctx, logger) {
    this.dispatch = dispatch;
    this.ctx = ctx;
    this.logger = logger;
    this._onDidChangeTreeData = new vscode13.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    // Cache workflow data separately from tree items so state changes rebuild items cheaply
    this.cachedWorkflows = null;
    // Per-workflow execution state
    this.runningSet = /* @__PURE__ */ new Set();
    this.lastRuns = /* @__PURE__ */ new Map();
  }
  refresh() {
    this.cachedWorkflows = null;
    this._onDidChangeTreeData.fire();
  }
  /** Called by main.ts when a workflow starts executing. */
  setRunning(name) {
    this.runningSet.add(name);
    this._onDidChangeTreeData.fire();
  }
  /** Called by main.ts when a workflow finishes. Updates description with result. */
  setLastRun(name, success2, duration) {
    this.runningSet.delete(name);
    this.lastRuns.set(name, { success: success2, duration });
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    return this.getRootItems();
  }
  async getRootItems() {
    if (!this.cachedWorkflows) {
      const result = await this.dispatch({ name: "workflow.list", params: {} }, this.ctx);
      if (result.kind === "err") {
        this.logger.warn("WorkflowTreeProvider: list failed", "WorkflowTreeProvider", result.error);
        const err = new WorkflowTreeItem(
          "Failed to load workflows",
          "root",
          vscode13.TreeItemCollapsibleState.None,
          result.error.code
        );
        err.iconPath = new vscode13.ThemeIcon("error");
        return [err];
      }
      const { workflows } = result.value;
      this.cachedWorkflows = workflows;
    }
    if (this.cachedWorkflows.length === 0) {
      const empty = new WorkflowTreeItem(
        "No workflows found",
        "root",
        vscode13.TreeItemCollapsibleState.None
      );
      empty.iconPath = new vscode13.ThemeIcon("info");
      return [empty];
    }
    return this.cachedWorkflows.map((w) => {
      const isRunning = this.runningSet.has(w.name);
      const lastRun = this.lastRuns.get(w.name);
      const description = isRunning ? "running\u2026" : lastRun ? `${lastRun.success ? "\u2713" : "\u2717"} ${(lastRun.duration / 1e3).toFixed(1)}s` : w.description ?? `${w.stepCount} step(s)`;
      const it = new WorkflowTreeItem(
        w.name,
        "workflow",
        vscode13.TreeItemCollapsibleState.None,
        description
      );
      it.iconPath = new vscode13.ThemeIcon(isRunning ? "loading~spin" : "play");
      it.command = {
        command: "meridian.workflow.run",
        title: "Run Workflow",
        arguments: [{ name: w.name }]
      };
      return it;
    });
  }
};

// src/ui/tree-providers/agent-tree-provider.ts
var vscode14 = __toESM(require("vscode"));
var AgentTreeItem = class extends vscode14.TreeItem {
  constructor(label, itemKind, children, collapsible, description) {
    super(label, collapsible);
    this.itemKind = itemKind;
    this.children = children;
    this.description = description;
    this.contextValue = itemKind;
  }
};
var AgentTreeProvider = class {
  constructor(dispatch, ctx, logger) {
    this.dispatch = dispatch;
    this.ctx = ctx;
    this.logger = logger;
    this._onDidChangeTreeData = new vscode14.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.cached = null;
  }
  refresh() {
    this.cached = null;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (!element) return this.getRootItems();
    return element.children;
  }
  async getRootItems() {
    if (this.cached) return this.cached;
    const result = await this.dispatch({ name: "agent.list", params: {} }, this.ctx);
    if (result.kind === "err") {
      this.logger.warn("AgentTreeProvider: list failed", "AgentTreeProvider", result.error);
      const err = new AgentTreeItem(
        "Failed to load agents",
        "agent",
        [],
        vscode14.TreeItemCollapsibleState.None,
        result.error.code
      );
      err.iconPath = new vscode14.ThemeIcon("error");
      return [err];
    }
    const { agents } = result.value;
    if (agents.length === 0) {
      const empty = new AgentTreeItem(
        "No agents found",
        "agent",
        [],
        vscode14.TreeItemCollapsibleState.None
      );
      empty.iconPath = new vscode14.ThemeIcon("info");
      return [empty];
    }
    this.cached = agents.map((a) => {
      const capItems = a.capabilities.map((cap) => {
        const it2 = new AgentTreeItem(
          cap,
          "capability",
          [],
          vscode14.TreeItemCollapsibleState.None
        );
        it2.iconPath = new vscode14.ThemeIcon("symbol-method");
        return it2;
      });
      const it = new AgentTreeItem(
        a.id,
        "agent",
        capItems,
        capItems.length > 0 ? vscode14.TreeItemCollapsibleState.Collapsed : vscode14.TreeItemCollapsibleState.None,
        a.version ? `v${a.version}` : void 0
      );
      it.iconPath = new vscode14.ThemeIcon("robot");
      it.tooltip = a.description;
      return it;
    });
    return this.cached;
  }
};

// src/presentation/tree-setup.ts
function setupTreeProviders(context, gitProvider, logger, workspaceRoot, dispatch, cmdCtx) {
  const gitTree = new GitTreeProvider(gitProvider, logger, workspaceRoot);
  const hygieneTree = new HygieneTreeProvider(dispatch, cmdCtx, logger);
  const workflowTree = new WorkflowTreeProvider(dispatch, cmdCtx, logger);
  const agentTree = new AgentTreeProvider(dispatch, cmdCtx, logger);
  context.subscriptions.push(
    vscode15.window.registerTreeDataProvider("meridian.git.view", gitTree),
    vscode15.window.registerTreeDataProvider("meridian.hygiene.view", hygieneTree),
    vscode15.window.registerTreeDataProvider("meridian.workflow.view", workflowTree),
    vscode15.window.registerTreeDataProvider("meridian.agent.view", agentTree)
  );
  context.subscriptions.push(
    vscode15.commands.registerCommand("meridian.git.refresh", () => gitTree.refresh()),
    vscode15.commands.registerCommand("meridian.hygiene.refresh", () => hygieneTree.refresh()),
    vscode15.commands.registerCommand("meridian.workflow.refresh", () => workflowTree.refresh()),
    vscode15.commands.registerCommand("meridian.agent.refresh", () => agentTree.refresh())
  );
  return { gitTree, hygieneTree, workflowTree, agentTree };
}

// src/presentation/specialized-commands.ts
var vscode16 = __toESM(require("vscode"));
var fs5 = __toESM(require("fs"));
var nodePath = __toESM(require("path"));
function registerSpecializedCommands(context, router, outputChannel, getCommandContext2, workflowTree, hygieneTree) {
  context.subscriptions.push(
    vscode16.commands.registerCommand(
      "meridian.workflow.run",
      async (arg = {}) => {
        const freshCtx = getCommandContext2();
        let name;
        if (arg && typeof arg === "object") {
          const obj = arg;
          if (typeof obj.name === "string" && obj.name) {
            name = obj.name;
          } else if (typeof obj.label === "string" && obj.label) {
            name = obj.label;
          }
        }
        if (!name) {
          vscode16.window.showErrorMessage("No workflow selected.");
          return;
        }
        workflowTree.setRunning(name);
        const result = await router.dispatch({ name: "workflow.run", params: { name } }, freshCtx);
        const r = result.kind === "ok" ? result.value : null;
        workflowTree.setLastRun(name, r?.success ?? result.kind === "ok", r?.duration ?? 0);
        const { message } = formatResultMessage("workflow.run", result);
        outputChannel.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
      }
    )
  );
  context.subscriptions.push(
    vscode16.commands.registerCommand("meridian.hygiene.deleteFile", async (item) => {
      const filePath = item instanceof vscode16.Uri ? item.fsPath : item?.filePath;
      if (!filePath) return;
      const filename = nodePath.basename(filePath);
      const confirm = await vscode16.window.showWarningMessage(
        `Delete "${filename}"? This cannot be undone.`,
        { modal: true },
        "Delete"
      );
      if (confirm !== "Delete") return;
      const freshCtx = getCommandContext2();
      const result = await router.dispatch(
        { name: "hygiene.cleanup", params: { files: [filePath] } },
        freshCtx
      );
      if (result.kind === "ok") {
        vscode16.window.showInformationMessage(`Deleted: ${filename}`);
        hygieneTree.refresh();
      } else {
        vscode16.window.showErrorMessage(`Delete failed: ${result.error.message}`);
      }
    }),
    vscode16.commands.registerCommand("meridian.hygiene.ignoreFile", async (item) => {
      const filePath = item instanceof vscode16.Uri ? item.fsPath : item?.filePath;
      if (!filePath) return;
      const wsRoot = vscode16.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      const ignorePath = nodePath.join(wsRoot, ".meridianignore");
      const pattern = nodePath.relative(wsRoot, filePath);
      fs5.appendFileSync(ignorePath, `
${pattern}
`);
      vscode16.window.showInformationMessage(`Added to .meridianignore: ${pattern}`);
      hygieneTree.refresh();
    }),
    vscode16.commands.registerCommand("meridian.hygiene.reviewFile", async (item) => {
      const filePath = item instanceof vscode16.Uri ? item.fsPath : item?.filePath;
      if (!filePath) return;
      let content;
      try {
        content = fs5.readFileSync(filePath, "utf-8");
      } catch {
        vscode16.window.showErrorMessage(`Could not read: ${nodePath.basename(filePath)}`);
        return;
      }
      const model = await selectModel("hygiene");
      if (!model) {
        vscode16.window.showErrorMessage("No language model available. Ensure GitHub Copilot is enabled.");
        return;
      }
      const filename = nodePath.basename(filePath);
      outputChannel.show(true);
      outputChannel.appendLine(`
${"\u2500".repeat(60)}`);
      outputChannel.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] AI Review: ${filename}`);
      outputChannel.appendLine("\u2500".repeat(60));
      const messages = [
        vscode16.LanguageModelChatMessage.User(
          `You are a critical technical reviewer. Analyze this Markdown document and provide concise, actionable feedback on:
1. Content accuracy and factual correctness
2. Clarity and readability
3. Completeness (gaps or missing context)
4. Effectiveness (does it achieve its purpose?)
5. Top 3 specific improvements

Document: ${filename}
\`\`\`markdown
${content}
\`\`\``
        )
      ];
      try {
        const cts = new vscode16.CancellationTokenSource();
        context.subscriptions.push(cts);
        const response = await model.sendRequest(messages, {}, cts.token);
        for await (const fragment of response.text) {
          outputChannel.append(fragment);
        }
        outputChannel.appendLine("\n");
      } catch (err) {
        outputChannel.appendLine(`[Error] Review failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );
  context.subscriptions.push(
    vscode16.commands.registerCommand("meridian.hygiene.impactAnalysis", async (item) => {
      const filePath = item instanceof vscode16.Uri ? item.fsPath : item?.filePath ?? vscode16.window.activeTextEditor?.document.uri.fsPath;
      if (!filePath) {
        vscode16.window.showErrorMessage("Impact Analysis: open a TypeScript file first.");
        return;
      }
      const functionName = await vscode16.window.showInputBox({
        prompt: "Function or symbol to trace (leave blank to analyze the whole file)",
        placeHolder: "e.g. createStatusHandler"
      });
      if (functionName === void 0) return;
      const freshCtx = getCommandContext2();
      const params = { filePath };
      if (functionName) params.functionName = functionName;
      const result = await router.dispatch({ name: "hygiene.impactAnalysis", params }, freshCtx);
      if (result.kind === "ok") {
        const val = result.value;
        outputChannel.show(true);
        outputChannel.appendLine(`
${"\u2500".repeat(60)}`);
        outputChannel.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] Impact Analysis: ${nodePath.basename(filePath)}`);
        outputChannel.appendLine("\u2500".repeat(60));
        outputChannel.appendLine(val.summary ?? "No summary available.");
        outputChannel.appendLine("");
        await vscode16.env.clipboard.writeText(val.summary ?? "");
        vscode16.window.showInformationMessage("Impact analysis copied to clipboard.");
      } else {
        vscode16.window.showErrorMessage(`Impact Analysis failed: ${result.error.message}`);
      }
    })
  );
}

// src/infrastructure/webview-provider.ts
var vscode17 = __toESM(require("vscode"));
var fs6 = __toESM(require("fs"));
var path11 = __toESM(require("path"));
var crypto = __toESM(require("crypto"));
var BaseWebviewProvider = class {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
    this.panel = null;
  }
  async openPanel(report) {
    const uiDirUri = vscode17.Uri.joinPath(this.extensionUri, ...this.getUiDirSegments());
    if (this.panel) {
      this.panel.reveal(vscode17.ViewColumn.One);
    } else {
      this.panel = vscode17.window.createWebviewPanel(
        this.getViewId(),
        this.getViewTitle(),
        vscode17.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [uiDirUri],
          retainContextWhenHidden: true
        }
      );
      this.panel.onDidDispose(() => {
        this.panel = null;
      });
      this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
      this.panel.webview.html = this.buildHtml(this.panel.webview, uiDirUri);
    }
    this.panel.webview.postMessage({ type: "init", payload: report });
  }
  buildHtml(webview, uiDirUri) {
    const htmlPath = path11.join(uiDirUri.fsPath, "index.html");
    let html = fs6.readFileSync(htmlPath, "utf-8");
    const nonce = crypto.randomBytes(16).toString("base64");
    const cspSource = webview.cspSource;
    const cssUri = webview.asWebviewUri(vscode17.Uri.joinPath(uiDirUri, "styles.css"));
    const jsUri = webview.asWebviewUri(vscode17.Uri.joinPath(uiDirUri, "script.js"));
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    html = html.replace(/\{\{WEBVIEW_CSP_SOURCE\}\}/g, cspSource);
    html = html.replace(/href="styles\.css"/g, `href="${cssUri}"`);
    html = html.replace(/src="script\.js"/g, `src="${jsUri}"`);
    return html;
  }
};
var AnalyticsWebviewProvider = class extends BaseWebviewProvider {
  constructor(extensionUri, workspaceRoot, onFilter) {
    super(extensionUri);
    this.workspaceRoot = workspaceRoot;
    this.onFilter = onFilter;
  }
  getViewId() {
    return "meridian.analytics";
  }
  getViewTitle() {
    return "Git Analytics \u2014 Meridian";
  }
  getUiDirSegments() {
    return ["out", "domains", "git", "analytics-ui"];
  }
  async handleMessage(msg) {
    if (msg.type === "filter") {
      try {
        const report = await this.onFilter(msg.payload);
        this.panel?.webview.postMessage({ type: "init", payload: report });
      } catch (e) {
        console.error("[Meridian] git analytics filter error:", e);
      }
    } else if (msg.type === "refresh") {
      try {
        const period = msg.payload?.period ?? "3mo";
        const report = await this.onFilter({ period });
        this.panel?.webview.postMessage({ type: "init", payload: report });
      } catch (e) {
        console.error("[Meridian] git analytics refresh error:", e);
      }
    } else if (msg.type === "openFile") {
      const abs = path11.join(this.workspaceRoot, msg.payload);
      vscode17.commands.executeCommand("vscode.open", vscode17.Uri.file(abs));
    }
  }
};
var HygieneAnalyticsWebviewProvider = class extends BaseWebviewProvider {
  constructor(extensionUri, onRefresh) {
    super(extensionUri);
    this.workspaceRoot = "";
    this.onRefresh = onRefresh;
  }
  getViewId() {
    return "meridian.hygiene.analytics";
  }
  getViewTitle() {
    return "Hygiene Analytics \u2014 Meridian";
  }
  getUiDirSegments() {
    return ["out", "domains", "hygiene", "analytics-ui"];
  }
  async openPanel(report) {
    this.workspaceRoot = report.workspaceRoot;
    return super.openPanel(report);
  }
  async handleMessage(msg) {
    if (msg.type === "refresh") {
      try {
        const report = await this.onRefresh();
        this.panel?.webview.postMessage({ type: "init", payload: report });
      } catch (e) {
        console.error("[Meridian] hygiene analytics refresh error:", e);
      }
    } else if (msg.type === "openSettings") {
      vscode17.commands.executeCommand("workbench.action.openSettings", "meridian.hygiene");
    } else if (msg.type === "openFile") {
      const abs = path11.join(this.workspaceRoot, msg.path);
      vscode17.commands.executeCommand("vscode.open", vscode17.Uri.file(abs));
    } else if (msg.type === "revealFile") {
      const abs = path11.join(this.workspaceRoot, msg.path);
      vscode17.commands.executeCommand("revealInExplorer", vscode17.Uri.file(abs));
    }
  }
};

// src/presentation/webview-setup.ts
function createWebviewPanels(context, router, workspaceRoot, getCommandContext2, readPruneConfig) {
  const analyticsPanel = new AnalyticsWebviewProvider(
    context.extensionUri,
    workspaceRoot,
    async (opts) => {
      const freshCtx = getCommandContext2();
      const result = await router.dispatch({ name: "git.showAnalytics", params: opts }, freshCtx);
      if (result.kind === "ok") {
        return result.value;
      }
      throw new Error(result.error?.message ?? "Analytics failed");
    }
  );
  const hygieneAnalyticsPanel = new HygieneAnalyticsWebviewProvider(
    context.extensionUri,
    async () => {
      const freshCtx = getCommandContext2();
      const result = await router.dispatch(
        { name: "hygiene.showAnalytics", params: readPruneConfig() },
        freshCtx
      );
      if (result.kind === "ok") return result.value;
      throw new Error(result.error?.message ?? "Hygiene analytics failed");
    }
  );
  return { analyticsPanel, hygieneAnalyticsPanel };
}

// src/main.ts
function getCommandContext(context) {
  return {
    extensionPath: context.extensionUri.fsPath,
    workspaceFolders: vscode18.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [],
    activeFilePath: vscode18.window.activeTextEditor?.document.uri.fsPath
  };
}
async function activate(context) {
  const logger = new Logger();
  const outputChannel = vscode18.window.createOutputChannel("Meridian");
  context.subscriptions.push(outputChannel);
  const config = new Config();
  const configResult = await config.initialize();
  if (configResult.kind === "err") {
    logger.warn("Config initialization used defaults", "activate", configResult.error);
  }
  const telemetry = new TelemetryTracker(new ConsoleTelemetrySink(false));
  const workspaceRoot = vscode18.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const extensionPath = context.extensionUri.fsPath;
  const gitProvider = createGitProvider(workspaceRoot);
  const workspaceProvider = createWorkspaceProvider(workspaceRoot, logger);
  const router = new CommandRouter(logger);
  router.use(createObservabilityMiddleware(logger, telemetry));
  router.use(createAuditMiddleware(logger));
  const stepRunner = async (command, ctx) => {
    const result = await router.dispatch(command, ctx);
    if (result.kind === "ok") {
      return { kind: "ok", value: result.value || {} };
    }
    return result;
  };
  const smartCommitApprovalUI = createSmartCommitApprovalUI();
  router.registerDomain(createGitDomain(gitProvider, logger, workspaceRoot, smartCommitApprovalUI, generateProse));
  router.registerDomain(createHygieneDomain(workspaceProvider, logger, workspaceRoot, generateProse));
  router.registerDomain(createChatDomain(gitProvider, logger, (cmd, ctx) => router.dispatch(cmd, ctx), generateProse));
  router.registerDomain(createWorkflowDomain(logger, stepRunner, workspaceRoot, extensionPath));
  router.registerDomain(createAgentDomain(logger, workspaceRoot, extensionPath, (cmd, ctx) => router.dispatch(cmd, ctx)));
  const validationResult = await router.validateDomains();
  if (validationResult.kind === "err") {
    logger.error("Domain validation failed", "activate", validationResult.error);
    throw new Error(validationResult.error.message);
  }
  const ctxFn = () => getCommandContext(context);
  const dispatch = (cmd, ctx) => router.dispatch(cmd, ctx);
  const cmdCtx = getCommandContext(context);
  const trees = setupTreeProviders(context, gitProvider, logger, workspaceRoot, dispatch, cmdCtx);
  const { analyticsPanel, hygieneAnalyticsPanel } = createWebviewPanels(
    context,
    router,
    workspaceRoot,
    ctxFn,
    () => config.getPruneConfig()
  );
  registerCommands(context, router, outputChannel, ctxFn, () => config.getPruneConfig(), {
    outputChannel,
    analyticsPanel,
    hygieneAnalyticsPanel
  });
  registerSpecializedCommands(context, router, outputChannel, ctxFn, trees.workflowTree, trees.hygieneTree);
  const statusBar = setupStatusBar(context, gitProvider, () => {
    trees.gitTree.refresh();
    trees.hygieneTree.refresh();
    trees.workflowTree.refresh();
    trees.agentTree.refresh();
  });
  setupFileWatchers(context, workspaceRoot, {
    gitRefresh: () => trees.gitTree.refresh(),
    hygieneRefresh: () => trees.hygieneTree.refresh(),
    definitionsRefresh: () => {
      trees.workflowTree.refresh();
      trees.agentTree.refresh();
    },
    statusBarUpdate: () => statusBar.update()
  });
  context.subscriptions.push(createChatParticipant(router, cmdCtx, logger));
  context.subscriptions.push(...registerMeridianTools(router, cmdCtx, logger));
  statusBar.update();
  logger.info(`Extension activated with ${router.listDomains().length} domains`, "activate");
  logger.info(`Registered ${COMMAND_MAP.length} commands`, "activate");
}
async function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CommandRouter,
  Logger,
  activate,
  deactivate
});
/*! Bundled license information:

is-number/index.js:
  (*!
   * is-number <https://github.com/jonschlinkert/is-number>
   *
   * Copyright (c) 2014-present, Jon Schlinkert.
   * Released under the MIT License.
   *)

to-regex-range/index.js:
  (*!
   * to-regex-range <https://github.com/micromatch/to-regex-range>
   *
   * Copyright (c) 2015-present, Jon Schlinkert.
   * Released under the MIT License.
   *)

fill-range/index.js:
  (*!
   * fill-range <https://github.com/jonschlinkert/fill-range>
   *
   * Copyright (c) 2014-present, Jon Schlinkert.
   * Licensed under the MIT License.
   *)
*/
