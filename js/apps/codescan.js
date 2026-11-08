import { CodeEditor } from '../core/code-editor.js';
import { iconHTML } from '../core/icons.js';

const PYTHON_RULES = [
  // --- Execution & Injection ---
  { re: /\beval\s*\(/g, severity: 'high', title: 'Dangerous Eval', desc: 'eval() executes arbitrary Python code, leading to Remote Code Execution (RCE).' },
  { re: /\bexec\s*\(/g, severity: 'high', title: 'Dangerous Exec', desc: 'exec() executes arbitrary Python code, leading to Remote Code Execution (RCE).' },
  { re: /\bos\.system\s*\(/g, severity: 'high', title: 'OS Command Execution', desc: 'os.system() with untrusted input leads to Command Injection.' },
  { re: /\bos\.popen\s*\(/g, severity: 'high', title: 'OS Popen Execution', desc: 'os.popen() opens a pipe to a shell command. Risk of Command Injection.' },
  { re: /\bsubprocess\.(Popen|run|call|check_output)\s*\([^)]*shell\s*=\s*True/g, severity: 'high', title: 'Subprocess Shell Injection', desc: 'Setting shell=True with untrusted input allows Command Injection.' },
  { re: /(?:execute|executemany)\s*\([^)]*(?:f["']|\.format\(|%\s*\(|%\s*[a-zA-Z])/g, severity: 'high', title: 'Potential SQL Injection', desc: 'String formatting inside SQL queries can lead to SQL injection. Use parameterized queries.' },
  
  // --- Deserialization ---
  { re: /\bpickle\.loads?\s*\(/g, severity: 'high', title: 'Insecure Deserialization (Pickle)', desc: 'Pickle can execute arbitrary code. Never unpickle untrusted data.' },
  { re: /\bmarshal\.loads?\s*\(/g, severity: 'high', title: 'Insecure Deserialization (Marshal)', desc: 'Marshal is not secure against maliciously constructed data.' },
  { re: /\byaml\.unsafe_load\s*\(/g, severity: 'high', title: 'Unsafe YAML Load', desc: 'yaml.unsafe_load() allows arbitrary code execution. Use safe_load().' },
  { re: /\byaml\.load\s*\(/g, severity: 'medium', title: 'Unsafe YAML Load', desc: 'yaml.load() without SafeLoader can execute arbitrary code. Use safe_load().' },
  { re: /\b__import__\s*\(/g, severity: 'medium', title: 'Dynamic Import', desc: 'Using __import__() can bypass static analysis. Ensure input is strictly validated.' },

  // --- Cryptography & Secrets ---
  { re: /\bhashlib\.(md5|sha1)\s*\(/g, severity: 'high', title: 'Weak Hashing Algorithm', desc: 'MD5 and SHA1 are cryptographically broken. Use SHA-256 or SHA-3.' },
  { re: /\brandom\.(random|randint|choice|randrange)\s*\(/g, severity: 'medium', title: 'Insecure Randomness', desc: 'The random module is not cryptographically secure. Use the secrets module for tokens/passwords.' },
  { re: /\b(api_key|apikey|secret|password|passwd|token|auth)\s*=\s*["'][^"']+["']/ig, severity: 'high', title: 'Hardcoded Secret', desc: 'Hardcoded credentials or API keys in source code can be leaked.' },
  
  // --- Web Frameworks & Debugging ---
  { re: /debug\s*=\s*True/g, severity: 'high', title: 'Debug Mode Enabled', desc: 'Running Flask/Django with debug=True in production exposes sensitive stack traces.' },
  { re: /\bassert\s+/g, severity: 'low', title: 'Assert Statement', desc: 'Assertions are stripped when Python runs with -O optimization. Do not use for input validation.' },
  { re: /\brequests\.(get|post|put|delete)\s*\([^)]*verify\s*=\s*False/g, severity: 'high', title: 'Insecure SSL Verification', desc: 'Disabling SSL verification (verify=False) makes the app vulnerable to Man-in-the-Middle attacks.' },
  { re: /\brequests\.(get|post|put|delete)\s*\((?![^)]*timeout=)[^)]*\)/g, severity: 'low', title: 'Missing Request Timeout', desc: 'Requests without a timeout can cause the application to hang indefinitely.' },
  { re: /\bflask\.Flask\([^)]*debug\s*=\s*True/g, severity: 'high', title: 'Flask Debug Mode', desc: 'Flask debug mode exposes an interactive debugger (RCE risk).' },
  { re: /\bapp\.run\([^)]*debug\s*=\s*True/g, severity: 'high', title: 'App Debug Mode', desc: 'Running the app with debug=True exposes an interactive debugger.' },

  // --- Filesystem & OS ---
  { re: /\btempfile\.mktemp\s*\(/g, severity: 'medium', title: 'Insecure Temp File', desc: 'tempfile.mktemp() is vulnerable to race conditions. Use mkstemp() instead.' },
  { re: /\btarfile\.extractall\s*\(/g, severity: 'high', title: 'Unsafe Archive Extraction', desc: 'extractall() is vulnerable to Path Traversal (Zip Slip). Validate paths before extraction.' },
  { re: /\bchmod\s*\([^)]*0o777[^)]*\)/g, severity: 'medium', title: 'Overly Permissive File Mode', desc: 'Setting chmod 777 grants read/write/execute to everyone. Follow least privilege.' },
  { re: /\bshutil\.rmtree\s*\(/g, severity: 'medium', title: 'Recursive Deletion', desc: 'shutil.rmtree() permanently deletes directories. Ensure paths are validated.' },
  { re: /\bxml\.etree\.ElementTree\b/g, severity: 'medium', title: 'XML Parsing (XXE)', desc: 'Standard XML parsers are vulnerable to XML External Entity (XXE) attacks. Use defusedxml.' },
  
  // --- Code Smells & Bugs ---
  { re: /\bexcept\s*:/g, severity: 'low', title: 'Bare Except Clause', desc: 'Catching all exceptions makes debugging difficult and can hide system exits.' },
  { re: /\bfrom\s+[a-zA-Z0-9_]+\s+import\s+\*/g, severity: 'low', title: 'Wildcard Import', desc: 'Wildcard imports pollute the namespace and make it unclear where variables originate.' },
  { re: /def\s+[a-zA-Z0-9_]+\([^)]*=\s*(\[\]|\{\})/g, severity: 'medium', title: 'Mutable Default Argument', desc: 'Using a list or dict as a default argument shares the same object across calls.' },
  { re: /\bpass\s*$/gm, severity: 'low', title: 'Empty Block (Pass)', desc: 'A pass statement does nothing. Ensure this is intentional and not a forgotten implementation.' }
];

const WEB_RULES = [
  // --- XSS (Cross-Site Scripting) ---
  { re: /\.innerHTML\s*=/g, severity: 'high', title: 'InnerHTML Assignment', desc: 'Assigning user input to innerHTML leads to XSS. Use textContent or DOM APIs.' },
  { re: /\.outerHTML\s*=/g, severity: 'high', title: 'OuterHTML Assignment', desc: 'Assigning user input to outerHTML leads to XSS.' },
  { re: /\.insertAdjacentHTML\s*\(/g, severity: 'high', title: 'InsertAdjacentHTML', desc: 'Injecting HTML strings into the DOM can lead to XSS.' },
  { re: /\bdocument\.write\s*\(/g, severity: 'high', title: 'Document Write', desc: 'document.write() can overwrite the entire document and poses XSS risks.' },
  { re: /javascript:[^\s"']+/ig, severity: 'high', title: 'Javascript URI', desc: 'Using "javascript:" in href or src attributes allows XSS execution.' },
  { re: /\bdangerouslySetInnerHTML\b/g, severity: 'high', title: 'React DangerouslySetInnerHTML', desc: 'Bypasses React XSS protections. Ensure the HTML is absolutely trusted.' },
  { re: /\bv-html\s*=/g, severity: 'high', title: 'Vue v-html', desc: 'Renders raw HTML. Ensure the content is trusted to prevent XSS.' },
  { re: /\[innerHTML\]\s*=/g, severity: 'high', title: 'Angular InnerHTML', desc: 'Angular bypasses its sanitizer. Ensure content is trusted.' },
  { re: /\$\([^)]+\)\.html\s*\(/g, severity: 'high', title: 'jQuery .html()', desc: 'jQuery .html() parses strings as HTML, leading to XSS. Use .text() instead.' },

  // --- Execution & Eval ---
  { re: /\beval\s*\(/g, severity: 'high', title: 'Dangerous Eval (JS)', desc: 'eval() executes arbitrary JavaScript and is a major XSS vector.' },
  { re: /\bnew\s+Function\s*\(/g, severity: 'high', title: 'Dynamic Function Creation', desc: 'new Function() is equivalent to eval() and poses the same risks.' },
  { re: /\bsetTimeout\s*\(\s*["'`]/g, severity: 'high', title: 'String Eval in setTimeout', desc: 'Passing a string to setTimeout evaluates it as code.' },
  { re: /\bsetInterval\s*\(\s*["'`]/g, severity: 'high', title: 'String Eval in setInterval', desc: 'Passing a string to setInterval evaluates it as code.' },

  // --- DOM & Window ---
  { re: /<iframe(?![^>]*sandbox)/ig, severity: 'medium', title: 'Unrestricted Iframe', desc: 'Iframes without the sandbox attribute can execute scripts and access parent DOM.' },
  { re: /target=["']_blank["'](?![^>]*rel=["'][^"']*noopener)/gi, severity: 'medium', title: 'Reverse Tabnabbing', desc: 'target="_blank" without rel="noopener" allows the new page to redirect your page.' },
  { re: /\bwindow\.open\s*\(/g, severity: 'low', title: 'Window Open', desc: 'Ensure window.open() includes "noopener,noreferrer" in features to prevent tabnabbing.' },
  { re: /\bdocument\.domain\s*=/g, severity: 'medium', title: 'Document Domain', desc: 'Modifying document.domain weakens same-origin policy protections.' },
  { re: /\bpostMessage\s*\(/g, severity: 'medium', title: 'PostMessage', desc: 'Ensure you validate event.origin on the receiving end of postMessage to prevent XSS.' },

  // --- Network & Storage ---
  { re: /http:\/\//g, severity: 'medium', title: 'Insecure HTTP Protocol', desc: 'Data transmitted over HTTP is unencrypted. Use HTTPS.' },
  { re: /ws:\/\//g, severity: 'medium', title: 'Insecure WebSocket', desc: 'Unencrypted WebSocket connection. Use wss:// instead.' },
  { re: /\blocalStorage\.(setItem|getItem)\s*\(/g, severity: 'low', title: 'LocalStorage Usage', desc: 'Do not store sensitive data (passwords, JWTs) in localStorage. It is vulnerable to XSS.' },
  { re: /\bsessionStorage\.(setItem|getItem)\s*\(/g, severity: 'low', title: 'SessionStorage Usage', desc: 'Do not store sensitive data in sessionStorage.' },
  { re: /\bdocument\.cookie\s*=/g, severity: 'medium', title: 'Setting Document Cookie', desc: 'Ensure cookies are set with Secure; HttpOnly; SameSite=Strict flags.' },
  { re: /document\.cookie\s*=(?![^;]*HttpOnly)/ig, severity: 'medium', title: 'Cookie Missing HttpOnly', desc: 'Cookies without HttpOnly can be stolen via XSS.' },

  // --- Secrets & Crypto ---
  { re: /\b(api_key|apikey|secret|password|passwd|token|auth)\s*=\s*["'][^"']+["']/ig, severity: 'high', title: 'Hardcoded Secret', desc: 'Never hardcode API keys or passwords in frontend code.' },
  { re: /\bMath\.random\s*\(/g, severity: 'medium', title: 'Insecure Randomness', desc: 'Math.random() is not cryptographically secure. Use crypto.getRandomValues() for tokens.' },
  
  // --- Prototype Pollution & Code Smells ---
  { re: /\b__proto__\b/g, severity: 'high', title: 'Prototype Pollution Risk', desc: 'Direct manipulation of __proto__ can lead to prototype pollution.' },
  { re: /\bconstructor\s*\[\s*["']prototype["']\s*\]/g, severity: 'high', title: 'Prototype Pollution Risk', desc: 'Manipulating constructor.prototype can lead to prototype pollution.' },
  { re: /\bObject\.assign\s*\(\s*\{\s*\}\s*,\s*(req|request|input|body|params)/g, severity: 'medium', title: 'Prototype Pollution Risk', desc: 'Merging untrusted objects with Object.assign can pollute the prototype.' },
  { re: /\bwith\s*\(/g, severity: 'medium', title: 'With Statement', desc: 'The with statement is deprecated and unpredictable. Avoid using it.' },
  { re: /\bdebugger\s*;/g, severity: 'low', title: 'Debugger Statement', desc: 'Forgotten debugger statements will pause execution in production.' },
  { re: /\bconsole\.(log|warn|error)\s*\(/g, severity: 'low', title: 'Console Log', desc: 'Remove console statements before deploying to production to prevent data leaks.' },
  
  // --- HTML Forms ---
  { re: /<form(?![^>]*csrf)/ig, severity: 'medium', title: 'Missing CSRF Token', desc: 'Forms should include a CSRF token to prevent Cross-Site Request Forgery.' },
  { re: /autocomplete=["']off["']/ig, severity: 'low', title: 'Autocomplete Disabled', desc: 'Disabling autocomplete on password fields is generally bad for security (encourages weak passwords).' }
];

export const codeScanApp = {
  id: 'codescan',
  name: 'Code Scanner',
  icon: 'search',
  defaultSize: [900, 600],

  launch(body, args, ctx) {
    let activeLang = 'web'; 
    let editor = null;

    body.innerHTML = `
      <div class="cs-app">
        <div class="app-toolbar">
          <button class="toolbar-btn primary btn-scan">${iconHTML('search', 14)} Scan Code</button>
          <div class="toolbar-sep"></div>
          <select class="cs-lang-select" id="cs-lang">
            <option value="web" selected>Web (HTML/JS/CSS)</option>
            <option value="python">Python</option>
          </select>
          <div style="flex:1"></div>
          <span class="muted" style="font-size:11px" id="cs-status">Ready</span>
        </div>
        
        <div class="cs-split">
          <div class="cs-editor-pane" id="cs-editor-wrap"></div>
          
          <div class="cs-results-pane">
            <div class="cs-results-header">
              <span>Security Report</span>
              <span id="cs-count" style="font-weight:400; color:var(--tx-muted);">0 issues</span>
            </div>
            <div class="cs-results-list" id="cs-list">
              <div class="cs-empty">
                ${iconHTML('info', 32)}
                <div>No issues detected.</div>
                <div>Paste code and click "Scan".</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const editorWrap = body.querySelector('#cs-editor-wrap');
    const selectLang = body.querySelector('#cs-lang');
    const listEl = body.querySelector('#cs-list');
    const countEl = body.querySelector('#cs-count');
    const statusEl = body.querySelector('#cs-status');
    const btnScan = body.querySelector('.btn-scan');

    const defaultCode = {
      web: `<!-- Example Web Code -->\n<div id="app"></div>\n<script>\n  const user = "Alice";\n  const query = window.location.search;\n  \n  // XSS Risk:\n  document.getElementById("app").innerHTML = "Hello " + user;\n  \n  // Insecure HTTP\n  fetch("http://api.example.com/data")\n</script>`,
      python: `# Example Python Code\nimport os\nimport hashlib\n\nuser_input = input("Enter command: ")\n\n# RCE Risk:\nos.system(user_input)\n\n# Weak Crypto\nhash = hashlib.md5(b"password").hexdigest()\n\n# SQL Injection risk\ncursor.execute(f"SELECT * FROM users WHERE name = '{user_input}'")`
    };

    function initEditor() {
      editorWrap.innerHTML = '';
      editor = new CodeEditor(editorWrap, {
        language: activeLang === 'python' ? 'python' : 'html',
        value: defaultCode[activeLang],
        onChange: () => {
          clearTimeout(editor.scanTimer);
          editor.scanTimer = setTimeout(runScan, 600);
        }
      });
      runScan();
    }

    function runScan() {
      const code = editor.getValue();
      const rules = activeLang === 'python' ? PYTHON_RULES : WEB_RULES;
      const issues = [];
      
      const lines = code.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        
        for (const rule of rules) {
          rule.re.lastIndex = 0; 
          let match;
          while ((match = rule.re.exec(lineText)) !== null) {
            issues.push({
              line: i + 1,
              title: rule.title,
              desc: rule.desc,
              severity: rule.severity,
              snippet: lineText.trim()
            });
            // Prevent infinite loops on zero-length matches
            if (match.index === rule.re.lastIndex) rule.re.lastIndex++; 
          }
        }
      }

      const weights = { high: 3, medium: 2, low: 1 };
      issues.sort((a, b) => weights[b.severity] - weights[a.severity] || a.line - b.line);

      // Deduplicate (if one line has multiple identical rule triggers, just show once)
      const uniqueIssues = [];
      const seen = new Set();
      issues.forEach(iss => {
        const key = `${iss.line}-${iss.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueIssues.push(iss);
        }
      });

      renderResults(uniqueIssues);
    }

    function renderResults(issues) {
      countEl.textContent = `${issues.length} issue${issues.length === 1 ? '' : 's'}`;
      
      if (issues.length === 0) {
        listEl.innerHTML = `
          <div class="cs-empty">
            ${iconHTML('check', 32)}
            <div>No issues detected.</div>
            <div>Your code looks clean!</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = '';
      issues.forEach(iss => {
        const el = document.createElement('div');
        el.className = `cs-issue ${iss.severity}`;
        el.innerHTML = `
          <div class="cs-issue-header">
            <span class="cs-issue-title">${iss.title}</span>
            <span class="cs-issue-line">Ln ${iss.line}</span>
          </div>
          <div class="cs-issue-desc">${iss.desc}</div>
          <div class="cs-issue-code">${iss.snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div><span class="cs-badge ${iss.severity}">${iss.severity}</span></div>
        `;
        listEl.appendChild(el);
      });
    }

    selectLang.addEventListener('change', (e) => {
      activeLang = e.target.value;
      initEditor();
    });

    btnScan.onclick = () => {
      statusEl.textContent = 'Scanning...';
      setTimeout(() => {
        runScan();
        statusEl.textContent = 'Ready';
      }, 150);
    };

    initEditor();
    ctx.onCleanup(() => clearTimeout(editor.scanTimer));
  }
};
